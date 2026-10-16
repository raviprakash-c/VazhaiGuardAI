#!/usr/bin/env python3
"""Safe, opt-in live smoke checks for VazhaiGuardAI.

Default checks are read-only. Provider inference, evidence retrieval, and inspection
writes require explicit flags; response bodies, credentials, and image data are never printed.
"""
from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

STATUSES = {"PASS", "FAIL", "SKIP", "DEGRADED"}


@dataclass
class Check:
    name: str
    status: str
    detail: str

    def __post_init__(self) -> None:
        if self.status not in STATUSES:
            raise ValueError(f"unsupported check status: {self.status}")


def request_json(url: str, timeout: float = 8.0, *, method: str = "GET",
                 payload: dict[str, Any] | None = None) -> Any:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def safe_exception(exc: Exception) -> str:
    """Avoid printing exception text, which can contain URLs, tokens, or response data."""
    if isinstance(exc, urllib.error.HTTPError):
        return f"HTTP {exc.code}"
    if isinstance(exc, TimeoutError) or isinstance(exc, urllib.error.URLError) and isinstance(exc.reason, TimeoutError):
        return "request timed out"
    if isinstance(exc, urllib.error.URLError):
        return "endpoint unavailable"
    if isinstance(exc, json.JSONDecodeError):
        return "invalid JSON response"
    return type(exc).__name__


def check_http_json(name: str, url: str, expected_status: str | None = None,
                    timeout: float = 8.0) -> Check:
    try:
        payload = request_json(url, timeout=timeout)
        if not isinstance(payload, dict):
            return Check(name, "FAIL", "response was not a JSON object")
        status = payload.get("status")
        if expected_status and status != expected_status:
            return Check(name, "FAIL", f"unexpected service status: {status!r}")
        return Check(name, "PASS", "reachable; JSON contract received")
    except Exception as exc:
        return Check(name, "FAIL", safe_exception(exc))


def check_service_health(name: str, url: str, timeout: float = 8.0) -> Check:
    try:
        payload = request_json(url, timeout=timeout)
        if not isinstance(payload, dict):
            return Check(name, "FAIL", "response was not a JSON object")
        service_status = str(payload.get("status", "")).lower()
        configured = payload.get("configured")
        if service_status in {"setup_required", "not_configured", "unavailable", "degraded"} or configured is False:
            return Check(name, "DEGRADED", f"endpoint reachable; service status={service_status or 'not reported'}")
        if service_status in {"healthy", "configured", "ready", "online"} or configured is True:
            return Check(name, "PASS", f"endpoint reachable; service status={service_status or 'configured'}")
        return Check(name, "DEGRADED", "endpoint reachable; configuration state is inconclusive")
    except Exception as exc:
        return Check(name, "FAIL", safe_exception(exc))


def ollama_model_check(base_url: str, required_model: str) -> Check:
    try:
        payload = request_json(f"{base_url.rstrip('/')}/api/tags", timeout=5.0)
        models = payload.get("models", []) if isinstance(payload, dict) else []
        names = {str(item.get("name", "")) for item in models if isinstance(item, dict)}
        if required_model in names or any(n.split(":")[0] == required_model.split(":")[0] for n in names):
            return Check("Ollama model installed", "PASS", f"{required_model} appears in local model list")
        return Check("Ollama model installed", "FAIL", f"{required_model} is not in Ollama's local model list")
    except Exception as exc:
        return Check("Ollama model installed", "FAIL", safe_exception(exc))


def ollama_vision_inference(base_url: str, model: str, image_path: Path) -> Check:
    if not image_path.is_file():
        return Check("Local vision inference", "FAIL", "image file not found")
    try:
        image = base64.b64encode(image_path.read_bytes()).decode("ascii")
        payload = {
            "model": model,
            "stream": False,
            "messages": [{
                "role": "user",
                "content": "Describe only visible crop/plant features in this image. If uncertain, say so.",
                "images": [image],
            }],
        }
        result = request_json(f"{base_url.rstrip('/')}/api/chat", timeout=180.0,
                              method="POST", payload=payload)
        message = result.get("message") if isinstance(result, dict) else None
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, str) or not content.strip():
            return Check("Local vision inference", "FAIL", "Ollama returned no assistant content")
        return Check("Local vision inference", "PASS", "model returned a non-empty vision response; content suppressed")
    except Exception as exc:
        return Check("Local vision inference", "FAIL", safe_exception(exc))


def aws_identity_check(profile: str, region: str) -> Check:
    try:
        import boto3
        session = boto3.Session(profile_name=profile, region_name=region)
        session.client("sts", region_name=region).get_caller_identity()
        return Check("AWS credentials", "PASS", f"STS identity verified in region {region}; identity details suppressed")
    except Exception as exc:
        return Check("AWS credentials", "FAIL", f"{type(exc).__name__}: AWS identity check failed; details suppressed")


def build_inspection_payload(image_bytes: bytes, content_type: str, farm_id: str,
                             latitude: float, longitude: float) -> dict[str, Any]:
    return {
        "farm_id": farm_id,
        "image_data_url": f"data:{content_type};base64,{base64.b64encode(image_bytes).decode('ascii')}",
        "language": "ta-IN",
        "latitude": latitude,
        "longitude": longitude,
    }


def _image_payload(image_path: Path, farm_id: str) -> dict[str, Any]:
    content_type = mimetypes.guess_type(image_path.name)[0] or "image/jpeg"
    return {
        "farm_id": farm_id,
        "image_data_url": f"data:{content_type};base64,{base64.b64encode(image_path.read_bytes()).decode('ascii')}",
        "language": "ta-IN",
    }


def run_inspection(api_base: str, image_path: Path, farm_id: str,
                   latitude: float, longitude: float, *, reinspection: bool = False) -> Check:
    label = "Live reinspection" if reinspection else "Live inspection"
    if not image_path.is_file():
        return Check(label, "FAIL", "image file not found")
    try:
        payload = _image_payload(image_path, farm_id)
        if not reinspection:
            payload.update({"latitude": latitude, "longitude": longitude})
        endpoint = "/ai/inspections/reinspect" if reinspection else "/ai/multimodal/inspect-and-decide"
        result = request_json(f"{api_base.rstrip('/')}{endpoint}", timeout=240.0,
                              method="POST", payload=payload)
        if not isinstance(result, dict):
            return Check(label, "FAIL", "response was not a JSON object")
        if reinspection:
            required = ("inspection_id", "parent_inspection_id", "comparison", "risk", "decision")
        else:
            required = ("vision", "risk", "decision", "evaluation", "incident", "inspection_id")
        missing = [key for key in required if key not in result]
        if missing:
            return Check(label, "FAIL", f"response missing fields: {', '.join(missing)}")
        decision = result.get("decision") or {}
        if not isinstance(decision, dict) or not decision.get("farmer_message"):
            return Check(label, "FAIL", "decision contract has no farmer_message")
        if not reinspection and result.get("inspection_history", {}).get("stored") is False:
            return Check(label, "DEGRADED", "decision returned but inspection history was not persisted")
        vision = result.get("vision") or {}
        provider = vision.get("provider", "not reported") if isinstance(vision, dict) else "not reported"
        return Check(label, "PASS", f"contract complete; vision provider={provider}; farmer message present; response content suppressed")
    except Exception as exc:
        return Check(label, "FAIL", safe_exception(exc))


def validate_boundary(path: Path) -> dict[str, Any]:
    try:
        boundary = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError("boundary file is not valid JSON") from exc
    if not isinstance(boundary, dict) or boundary.get("type") != "Polygon":
        raise ValueError("boundary must be a GeoJSON Polygon object")
    coordinates = boundary.get("coordinates")
    if not isinstance(coordinates, list) or not coordinates or not isinstance(coordinates[0], list) or len(coordinates[0]) < 4:
        raise ValueError("Polygon must contain a closed exterior ring with at least four positions")
    ring = coordinates[0]
    if ring[0] != ring[-1]:
        raise ValueError("Polygon exterior ring must be closed (first and last positions equal)")
    return boundary


def check_evidence(api_base: str, latitude: float, longitude: float,
                   boundary_path: Path) -> list[Check]:
    try:
        boundary = validate_boundary(boundary_path)
    except ValueError as exc:
        return [Check("Satellite evidence", "FAIL", str(exc)),
                Check("Soil evidence", "SKIP", "not run because confirmed Polygon boundary validation failed")]
    payload = {"latitude": latitude, "longitude": longitude, "boundary": boundary}
    checks: list[Check] = []
    try:
        result = request_json(f"{api_base.rstrip('/')}/ai/satellite/evidence",
                              timeout=90.0, method="POST", payload=payload)
        if isinstance(result, dict) and result.get("available") is True:
            checks.append(Check("Satellite evidence", "PASS", "evidence response available; measurements suppressed"))
        elif isinstance(result, dict):
            checks.append(Check("Satellite evidence", "DEGRADED", f"endpoint responded; status={result.get('status', 'not available')}"))
        else:
            checks.append(Check("Satellite evidence", "FAIL", "response was not a JSON object"))
    except Exception as exc:
        checks.append(Check("Satellite evidence", "FAIL", safe_exception(exc)))
    try:
        result = request_json(f"{api_base.rstrip('/')}/ai/soil/evidence",
                              timeout=45.0, method="POST",
                              payload={"latitude": latitude, "longitude": longitude})
        if isinstance(result, dict) and result.get("available") is True:
            checks.append(Check("Soil evidence", "PASS", "evidence response available; measurements suppressed"))
        elif isinstance(result, dict):
            checks.append(Check("Soil evidence", "DEGRADED", f"endpoint responded; status={result.get('status', 'not available')}"))
        else:
            checks.append(Check("Soil evidence", "FAIL", "response was not a JSON object"))
    except Exception as exc:
        checks.append(Check("Soil evidence", "FAIL", safe_exception(exc)))
    return checks


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Read-only checks by default; inference/evidence/writes are opt-in.")
    parser.add_argument("--api-base", default=os.getenv("VAZHAIGUARD_API_BASE_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--ollama-base", default=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"))
    parser.add_argument("--vision-model", default=os.getenv("VAZHAIGUARD_LOCAL_VISION_MODEL", "qwen2.5vl:3b"))
    parser.add_argument("--check-aws", action="store_true", help="call AWS STS using the selected local profile")
    parser.add_argument("--aws-profile", default=os.getenv("AWS_PROFILE", "vazhaiguard"))
    parser.add_argument("--aws-region", default=os.getenv("AWS_REGION", "ap-south-1"))
    parser.add_argument("--weather-lat", type=float)
    parser.add_argument("--weather-lon", type=float)
    parser.add_argument("--run-local-vision", action="store_true", help="send --image to Ollama for actual local vision inference")
    parser.add_argument("--check-evidence", action="store_true", help="call live satellite and soil evidence providers")
    parser.add_argument("--boundary-json", type=Path, help="GeoJSON Polygon exported from the farmer-confirmed farm boundary")
    parser.add_argument("--run-inspection", action="store_true", help="run a real inspection; photo/history writes may occur")
    parser.add_argument("--run-reinspection", action="store_true", help="run a real reinspection; photo/history writes may occur")
    parser.add_argument("--confirmed-boundary-checked", action="store_true", help="assert the farm ID and boundary were verified in the app")
    parser.add_argument("--check-history", action="store_true", help="GET existing inspection history (read-only)")
    parser.add_argument("--image", type=Path)
    parser.add_argument("--farm-id")
    parser.add_argument("--latitude", type=float)
    parser.add_argument("--longitude", type=float)
    args = parser.parse_args(argv)
    if (args.weather_lat is None) != (args.weather_lon is None):
        parser.error("--weather-lat and --weather-lon must be provided together")
    if (args.latitude is None) != (args.longitude is None):
        parser.error("--latitude and --longitude must be provided together")
    if args.check_evidence and not (args.boundary_json and args.latitude is not None and args.longitude is not None and args.confirmed_boundary_checked):
        parser.error("--check-evidence requires --boundary-json, --latitude, --longitude, and --confirmed-boundary-checked")
    if args.run_local_vision and not args.image:
        parser.error("--run-local-vision requires --image")
    if (args.run_inspection or args.run_reinspection) and not (args.image and args.farm_id and args.confirmed_boundary_checked):
        parser.error("inspection writes require --image, --farm-id, and --confirmed-boundary-checked")
    if args.run_inspection and (args.latitude is None or args.longitude is None):
        parser.error("--run-inspection also requires --latitude and --longitude")
    if args.run_inspection and args.run_reinspection:
        parser.error("choose either --run-inspection or --run-reinspection")
    if args.check_history and not args.farm_id:
        parser.error("--check-history requires --farm-id")
    if args.boundary_json and not args.check_evidence:
        parser.error("--boundary-json requires --check-evidence")
    if args.image and not (args.run_local_vision or args.run_inspection or args.run_reinspection):
        parser.error("--image requires --run-local-vision, --run-inspection, or --run-reinspection")
    if args.farm_id and not (args.check_history or args.run_inspection or args.run_reinspection):
        parser.error("--farm-id requires --check-history, --run-inspection, or --run-reinspection")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    api = args.api_base.rstrip("/")
    checks = [
        check_http_json("API root", f"{api}/", "online"),
        check_http_json("API health", f"{api}/health", "healthy"),
        check_service_health("Multimodal configuration", f"{api}/ai/multimodal/health"),
        check_service_health("Satellite interface", f"{api}/ai/satellite/health"),
        check_service_health("Soil interface", f"{api}/ai/soil/health"),
        check_service_health("Inspection/storage interface", f"{api}/ai/inspections/health"),
        ollama_model_check(args.ollama_base, args.vision_model),
        Check("Local vision inference", "SKIP", "not requested; use --run-local-vision --image <path>"),
        Check("Satellite evidence retrieval", "SKIP", "not requested; requires confirmed Polygon and --check-evidence"),
        Check("Soil evidence retrieval", "SKIP", "not requested; use --check-evidence"),
        Check("Inspection persistence", "SKIP", "no write requested; use --run-inspection only after confirming the farm"),
        Check("Reinspection", "SKIP", "not requested; use --run-reinspection only after confirming the farm"),
        Check("Inspection history", "SKIP", "not requested; use --check-history --farm-id <id>"),
    ]
    if args.check_aws:
        checks.append(aws_identity_check(args.aws_profile, args.aws_region))
    if args.weather_lat is not None:
        checks.append(check_http_json("Live weather", f"{api}/weather?lat={args.weather_lat}&lon={args.weather_lon}"))
    if args.run_local_vision and args.image:
        checks = [c for c in checks if c.name != "Local vision inference"]
        checks.append(ollama_vision_inference(args.ollama_base, args.vision_model, args.image))
    if args.check_evidence:
        checks = [c for c in checks if c.name not in {"Satellite evidence retrieval", "Soil evidence retrieval"}]
        checks.extend(check_evidence(api, args.latitude, args.longitude, args.boundary_json))
    if args.check_history:
        checks = [c for c in checks if c.name != "Inspection history"]
        try:
            result = request_json(f"{api}/ai/inspections/{args.farm_id}/history", timeout=15.0)
            if isinstance(result, dict) and isinstance(result.get("inspections"), list):
                checks.append(Check("Inspection history", "PASS", f"history endpoint returned {len(result['inspections'])} records"))
            else:
                checks.append(Check("Inspection history", "FAIL", "history response contract invalid"))
        except Exception as exc:
            checks.append(Check("Inspection history", "FAIL", safe_exception(exc)))
    if args.run_inspection:
        checks = [c for c in checks if c.name != "Inspection persistence"]
        checks.append(run_inspection(api, args.image, args.farm_id, args.latitude, args.longitude))
    if args.run_reinspection:
        checks = [c for c in checks if c.name != "Reinspection"]
        checks.append(run_inspection(api, args.image, args.farm_id, args.latitude, args.longitude, reinspection=True))
    print("VazhaiGuardAI live smoke test")
    print(f"API: {api}")
    for check in checks:
        print(f"[{check.status}] {check.name}: {check.detail}")
    counts = {status: sum(c.status == status for c in checks) for status in ("PASS", "FAIL", "SKIP", "DEGRADED")}
    print("Summary: " + ", ".join(f"{key}={value}" for key, value in counts.items()))
    print("Connectivity/contracts only; this does not establish crop-disease accuracy or parcel-level satellite clipping.")
    return 1 if counts["FAIL"] else 0


if __name__ == "__main__":
    sys.exit(main())
