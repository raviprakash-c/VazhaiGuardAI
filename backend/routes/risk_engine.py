from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.bedrock_service import extract_json, generate_text
from services.unified_risk_engine import calculate_unified_risk


router = APIRouter(prefix="/ai/risk-engine", tags=["unified-risk-engine"])

TEXT_MODEL_ID = "mistral.ministral-3-8b-instruct"


class UnifiedRiskRequest(BaseModel):
    vision: dict[str, Any] | None = None
    weather: dict[str, Any] | None = None
    satellite: dict[str, Any] | None = None
    farm_context: dict[str, Any] | None = None
    zone_id: str | None = Field(default=None, max_length=80)
    language: str = Field(default="ta-IN", min_length=2, max_length=16)
    generate_farmer_action: bool = True


def _decision_prompt(result: dict[str, Any], request: UnifiedRiskRequest) -> str:
    tamil = request.language.lower().startswith("ta") or request.language in {"tamil", "தமிழ்"}
    response_language = "simple spoken Tamil" if tamil else "simple English"
    return f"""
You are the final farmer decision agent for VazhaiGuard AI.
Use ONLY the deterministic unified risk result and supplied evidence below.
Respond in {response_language}.

UNIFIED RISK RESULT:
{result}

FARM CONTEXT:
{request.farm_context or {}}

Return STRICT JSON only:
{{
  "summary": "short explanation of the combined evidence",
  "priority_actions": [
    {{"priority": 1, "action": "...", "reason": "..."}},
    {{"priority": 2, "action": "...", "reason": "..."}}
  ],
  "follow_up_check": "one useful field check or empty string",
  "recheck_after": "short practical guidance or empty string",
  "needs_field_verification": true,
  "farmer_message": "short natural spoken response"
}}

Rules:
1. Current farmer/photo evidence takes precedence over stale or conflicting satellite evidence.
2. Never claim satellite imagery is live.
3. Never invent missing evidence.
4. Do not diagnose disease with certainty from a photograph.
5. Do not prescribe pesticide or fungicide dosage.
6. If evidence conflicts, explicitly request field verification.
7. Keep farmer_message short enough for voice playback.
8. Return valid JSON only, without Markdown fences.
"""


@router.get("/health")
def risk_engine_health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "unified-evidence-risk-engine",
        "decision_model": TEXT_MODEL_ID,
        "flow": "photo + weather + satellite + farm context -> freshness/conflict -> weighted risk -> farmer action",
    }


@router.post("/calculate")
def calculate_risk(request: UnifiedRiskRequest) -> dict[str, Any]:
    result = calculate_unified_risk(
        vision=request.vision,
        weather=request.weather,
        satellite=request.satellite,
        farm_context=request.farm_context,
    )

    response: dict[str, Any] = {
        "zone_id": request.zone_id,
        "risk": result,
        "source": "deterministic evidence fusion",
    }

    if not request.generate_farmer_action:
        return response

    try:
        raw = generate_text(
            prompt=_decision_prompt(result, request),
            model_id=TEXT_MODEL_ID,
            max_tokens=650,
            temperature=0.2,
        ).strip()
        try:
            decision = extract_json(raw)
        except Exception:
            decision = {
                "summary": raw,
                "priority_actions": [],
                "follow_up_check": "",
                "recheck_after": "",
                "needs_field_verification": True,
                "farmer_message": raw,
            }
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Farmer decision model is temporarily unavailable.",
        ) from exc

    response["decision"] = decision
    response["action"] = decision.get("farmer_message", "") if isinstance(decision, dict) else str(decision)
    response["decision_model"] = TEXT_MODEL_ID
    return response
