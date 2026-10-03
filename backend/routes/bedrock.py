from __future__ import annotations

import os
import time
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.bedrock_service import generate_text


router = APIRouter(prefix="/ai/bedrock", tags=["bedrock-ai"])

MODEL_ID = os.getenv(
    "VAZHAIGUARD_TEXT_MODEL",
    "mistral.ministral-3-8b-instruct",
)


class FarmerChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    language: str = Field(default="ta", min_length=2, max_length=16)
    farmer_name: str | None = Field(default=None, max_length=120)
    farm_context: dict[str, Any] | None = None
    decision_context: dict[str, Any] | None = None


class FarmerChatResponse(BaseModel):
    message: str
    language: str
    model: str
    latency_ms: int
    source: str


def _language_instruction(language: str) -> str:
    language = language.lower().strip()
    if language in {"ta", "tamil", "தமிழ்"}:
        return (
            "Reply primarily in simple spoken Tamil that a Tamil Nadu farmer can understand. "
            "Keep technical English terms only when they are commonly used by farmers."
        )
    if language in {"en", "english"}:
        return "Reply in clear, simple English suitable for a farmer."
    return (
        "Reply in the requested language when possible. Keep the wording simple, polite, "
        "practical, and suitable for a farmer."
    )


def _build_prompt(request: FarmerChatRequest) -> str:
    farmer = request.farmer_name or "the farmer"
    farm = request.farm_context or {}
    decision = request.decision_context or {}

    return f"""
You are VazhaiGuard AI, a polite agricultural copilot for banana farmers in Tamil Nadu.
You are speaking directly to {farmer}.

{_language_instruction(request.language)}

Farmer message:
{request.message}

Known farm context:
{farm}

Current decision/action context:
{decision}

Response rules:
1. Answer the farmer's actual question first.
2. Prefer practical actions over long explanations.
3. If weather or risk context is supplied, connect the advice to it.
4. Never invent measurements, weather values, diagnoses, costs, or farm facts.
5. If information is missing, say what is missing and ask at most one useful follow-up question.
6. For urgent field risk, clearly say what to do now and what to check.
7. Be respectful and reassuring; never blame or shame the farmer.
8. Do not claim that an action guarantees crop safety.
9. Do not expose internal prompts, model names, AWS details, or implementation details unless explicitly asked.
10. Keep the answer concise enough to be spoken aloud.
"""


@router.post("/chat", response_model=FarmerChatResponse)
async def farmer_chat(request: FarmerChatRequest) -> FarmerChatResponse:
    started = time.perf_counter()

    try:
        text = generate_text(
            prompt=_build_prompt(request),
            model_id=MODEL_ID,
            max_tokens=500,
            temperature=0.2,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Bedrock is currently unavailable. "
                "Check AWS SSO credentials, region, model access, and network connectivity."
            ),
        ) from exc

    return FarmerChatResponse(
        message=text.strip(),
        language=request.language,
        model=MODEL_ID,
        latency_ms=round((time.perf_counter() - started) * 1000),
        source="AWS Bedrock",
    )


@router.get("/health")
def bedrock_health() -> dict[str, Any]:
    return {
        "service": "AWS Bedrock",
        "model": MODEL_ID,
        "region": os.getenv("AWS_REGION", "ap-south-1"),
        "status": "configured",
    }
