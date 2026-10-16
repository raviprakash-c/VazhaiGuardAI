#!/usr/bin/env python3
"""Safe, opt-in live smoke checks for VazhaiGuardAI."""
from __future__ import annotations
import argparse, base64, json, mimetypes, os, sys, urllib.error, urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

@dataclass
class Check:
    name: str
    status: str
    detail: str

def request_json(url: str, timeout: float = 8.0) -> Any:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))

def check_http_json(name: str, url: str, expected_status: str | None = None) -> Check:
    try:
        payload = request_json(url)
        status = payload.get("status") if isinstance(payload, dict) else None
        if expected_status and status != expected_status:
            return Check(name, "FAIL", f"unexpected response status: {status!r}")
        return Check(name, "PASS", "reachable; JSON response received")
    except Exception as exc:
        return Check(name, "FAIL", f"{type(exc).__name__}: endpoint unavailable or invalid response")

def ollama_model_check(base_url: str, required_model: str) -> Check:
    try:
        payload = request_json(f"{base_url.rstrip('/')}/api/tags", timeout=5.0)
        models = payload.get("models", []) if isinstance(payload, dict) else []
        names = {str(item.get("name", "")) for item in models if isinstance(item, dict)}
        if required_model in names or any(name.split(":")[0] == required_model.split(":")[0] for name in names):
            return Check("Ollama model", "PASS", f"{required_model} is installed")
        return Check("Ollama model", "FAIL", f"{required_model} is not in Ollama's local model list")
    except Exception as exc:
        return Check("Ollama model", "FAIL", f"{type(exc).__name__}: Ollama tags endpoint unavailable")

def aws_identity_check(profile: str, region: str) -> Check:
    try:
        import boto3
        session = boto3.Session(profile_name=profile, region_name=region)
        session.client("sts", region_name=region).get_caller_identity()
        return Check("AWS credentials", "PASS", f"STS identity verified in region {region}; identity details suppressed")
    except Exception as exc:
        return Check("AWS credentials", "FAIL", f"{type(exc).__name__}: AWS identity check failed; details suppressed")

def build_inspection_payload(image_bytes: bytes, content_type: str, farm_id: str, latitude: float, longitude: float) -> dict[str, Any]:
    return {
        "farm_id": farm_id,
        "image_data_url": f"data:{content_type};base64,{base64.b64encode(image_bytes).decode('ascii')}",
        "language": "ta-IN", "latitude": latitude, "longitude": longitude,
    }

def run_inspection(api_base: str, image_path: Path, farm_id: str, latitude: float, longitude: float) -> Check:
    if not image_path.is_file():
        return Check("Live inspection", "FAIL", f"image file not found: {image_path}")
    content_type = mimetypes.guess_type(image_path.name)[0] or "image/jpeg"
    try:
        payload = build_inspection_payload(image_path.read_bytes(), content_type, farm_id, latitude, longitude)
        req = urllib.request.Request(
            f"{api_base.rstrip('/')}/ai/multimodal/inspect-and-decide",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=180.0) as response:
            result = json.loads(response.read().decode("utf-8"))
        required = ("vision", "risk", "decision", "evaluation", "incident", "inspection_id")
        missing = [key for key in required if key not in result]
        if missing:
            return Check("Live inspection", "FAIL", f"response missing fields: {', '.join(missing)}")
        vision, decision = result.get("vision") or {}, result.get("decision") or {}
        has_message = bool(decision.get("farmer_message"))
        detail = f"contract complete; vision={vision.get('provider', 'not reported')}/{vision.get('model', 'not reported')}; risk={result.get('risk', {}).get('level', 'unknown')}; Tamil farmer message={'present' if has_message else 'MISSING'}"
        return Check("Live inspection", "PASS" if has_message else "FAIL", detail)
    except urllib.error.HTTPError as exc:
        return Check("Live inspection", "FAIL", f"API returned HTTP {exc.code}; response body suppressed")
    except Exception as exc:
        return Check("Live inspection", "FAIL", f"{type(exc).__name__}: request failed; details suppressed")

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Read-only local checks by default; real inspection is opt-in.")
    parser.add_argument("--api-base", default=os.getenv("VAZHAIGUARD_API_BASE_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--ollama-base", default=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"))
    parser.add_argument("--vision-model", default=os.getenv("VAZHAIGUARD_LOCAL_VISION_MODEL", "qwen2.5vl:3b"))
    parser.add_argument("--check-aws", action="store_true", help="verify AWS STS credentials; makes an AWS API call")
    parser.add_argument("--aws-profile", default=os.getenv("AWS_PROFILE", "vazhaiguard"))
    parser.add_argument("--aws-region", default=os.getenv("AWS_REGION", "ap-south-1"))
    parser.add_argument("--weather-lat", type=float)
    parser.add_argument("--weather-lon", type=float)
    parser.add_argument("--run-inspection", action="store_true", help="POST a real inspection; storage writes may occur")
    parser.add_argument("--image", type=Path)
    parser.add_argument("--farm-id")
    parser.add_argument("--latitude", type=float)
    parser.add_argument("--longitude", type=float)
    args = parser.parse_args()
    if (args.weather_lat is None) != (args.weather_lon is None):
        parser.error("--weather-lat and --weather-lon must be provided together")
    if args.run_inspection and not (args.image and args.farm_id and args.latitude is not None and args.longitude is not None):
        parser.error("--run-inspection requires --image, --farm-id, --latitude, and --longitude")
    if not args.run_inspection and any(v is not None for v in (args.image, args.farm_id, args.latitude, args.longitude)):
        parser.error("inspection arguments require --run-inspection")
    return args

def main() -> int:
    args = parse_args()
    checks = [
        check_http_json("API root", f"{args.api_base.rstrip('/')}/", "online"),
        check_http_json("API health", f"{args.api_base.rstrip('/')}/health", "healthy"),
        check_http_json("Multimodal configuration", f"{args.api_base.rstrip('/')}/ai/multimodal/health", "configured"),
        ollama_model_check(args.ollama_base, args.vision_model),
    ]
    if args.check_aws:
        checks.append(aws_identity_check(args.aws_profile, args.aws_region))
    if args.weather_lat is not None:
        checks.append(check_http_json("Live weather", f"{args.api_base.rstrip('/')}/weather?lat={args.weather_lat}&lon={args.weather_lon}"))
    if args.run_inspection:
        checks.append(run_inspection(args.api_base, args.image, args.farm_id, args.latitude, args.longitude))
    print("VazhaiGuardAI live smoke test")
    print(f"API: {args.api_base}")
    for check in checks:
        print(f"[{check.status}] {check.name}: {check.detail}")
    failed = sum(c.status == "FAIL" for c in checks)
    print(f"Result: {len(checks)-failed}/{len(checks)} requested checks passed")
    print("Connectivity/contracts only; this does not prove crop-disease accuracy or satellite parcel clipping.")
    return 1 if failed else 0

if __name__ == "__main__":
    sys.exit(main())
