from __future__ import annotations

import os
import time
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.bedrock_service import extract_json, generate_text


router = APIRouter(prefix="/ai/bedrock", tags=["bedrock-ai"])

MODEL_ID = os.getenv(
    "VAZHAIGUARD_TEXT_MODEL",
    "mistral.ministral-3-8b-instruct",
)


class FarmerChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    language: str = Field(default="ta-IN", min_length=2, max_length=16)
    farmer_name: str | None = Field(default=None, max_length=120)
    farm_context: dict[str, Any] | None = None
    decision_context: dict[str, Any] | None = None


class FarmerVoiceTurnRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=4000)
    language: str = Field(default="ta-IN", min_length=2, max_length=16)
    farmer_name: str | None = Field(default=None, max_length=120)
    farm_context: dict[str, Any] | None = None
    decision_context: dict[str, Any] | None = None
    conversation_history: list[dict[str, str]] = Field(default_factory=list, max_length=12)


class FarmerChatResponse(BaseModel):
    message: str
    language: str
    model: str
    latency_ms: int
    source: str


class FarmerVoiceTurnResponse(BaseModel):
    reply_text: str
    intent: str
    urgency: str
    actions: list[str]
    next_question: str | None = None
    should_listen_again: bool = True
    confidence: float
    language: str
    model: str
    latency_ms: int
    source: str


def _language_instruction(language: str) -> str:
    language = language.lower().strip()
    if language in {"ta", "ta-in", "tamil", "தமிழ்"}:
        return (
            "Reply primarily in simple, natural spoken Tamil used by Tamil Nadu farmers. "
            "Use short sentences. Keep unavoidable agricultural terms in familiar English only when helpful."
        )
    if language in {"en", "en-in", "english"}:
        return "Reply in clear, simple English suitable for a farmer."
    return (
        "Reply in the requested language when possible. Keep the wording simple, polite, practical, "
        "and suitable for a farmer."
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


def _voice_prompt(request: FarmerVoiceTurnRequest) -> str:
    farmer = request.farmer_name or "the farmer"
    language_instruction = _language_instruction(request.language)
    history = request.conversation_history[-8:]

    return f"""
You are VazhaiGuard AI, a safe and polite banana-farm copilot for a farmer in Tamil Nadu.
You are processing one turn in a two-way voice conversation with {farmer}.

{language_instruction}

FARM CONTEXT:
{request.farm_context or {}}

CURRENT DECISION CONTEXT:
{request.decision_context or {}}

RECENT CONVERSATION:
{history}

FARMER'S LATEST SPOKEN TRANSCRIPT:
{request.transcript}

Your job is to understand the farmer's intent and produce a concise, actionable response.

Possible intent values include:
- weather_question
- rain_risk
- wind_risk
- irrigation_question
- crop_care
- disease_or_pest_question
- farm_action
- resource_planning
- farm_information
- clarification
- greeting
- general_farm_question
- unknown

Urgency must be exactly one of: low, medium, high.

Return STRICT JSON only, with exactly this shape:
{{
  "reply_text": "spoken farmer-facing answer",
  "intent": "one intent value",
  "urgency": "low|medium|high",
  "actions": ["short practical action 1", "short practical action 2"],
  "next_question": "one useful follow-up question or null",
  "should_listen_again": true,
  "confidence": 0.0
}}

Rules:
1. reply_text must be natural spoken language, not a report.
2. actions must contain at most 3 concrete actions and may be empty.
3. Do not invent weather, crop measurements, diagnoses, prices, or farm facts.
4. If the farmer asks about disease/pests and there is not enough evidence, do not diagnose. Explain what to observe and ask one useful question.
5. If the farmer asks about weather, only use supplied weather context. If none is supplied, say that current weather data is needed rather than inventing it.
6. For urgent risk, put the safest immediate action first.
7. Never tell the farmer that success or crop safety is guaranteed.
8. Be respectful and reassuring. Never blame or shame the farmer.
9. If the transcript is unclear, use intent=clarification and ask one short question.
10. Keep reply_text short enough to hear comfortably.
11. Keep confidence between 0 and 1.
12. Output valid JSON with no Markdown fences.
"""


def _normalise_voice_result(raw: dict[str, Any], language: str) -> FarmerVoiceTurnResponse:
    reply = str(raw.get("reply_text") or raw.get("message") or "").strip()
    if not reply:
        reply = (
            "மன்னிக்கவும். உங்கள் கேள்வியை முழுமையாக புரிந்துகொள்ள முடியவில்லை. "
            "மீண்டும் கொஞ்சம் மெதுவாக சொல்லுங்க."
            if language.lower().startswith("ta")
            else "Sorry, I could not understand that clearly. Please say it again slowly."
        )

    actions_raw = raw.get("actions") or []
    if isinstance(actions_raw, str):
        actions = [actions_raw.strip()] if actions_raw.strip() else []
    elif isinstance(actions_raw, list):
        actions = [str(item).strip() for item in actions_raw if str(item).strip()][:3]
    else:
        actions = []

    urgency = str(raw.get("urgency") or "low").lower().strip()
    if urgency not in {"low", "medium", "high"}:
        urgency = "low"

    try:
        confidence = float(raw.get("confidence", 0.5))
    except (TypeError, ValueError):
        confidence = 0.5
    confidence = max(0.0, min(1.0, confidence))

    next_question = raw.get("next_question")
    if next_question is not None:
        next_question = str(next_question).strip() or None

    return FarmerVoiceTurnResponse(
        reply_text=reply,
        intent=str(raw.get("intent") or "general_farm_question"),
        urgency=urgency,
        actions=actions,
        next_question=next_question,
        should_listen_again=bool(raw.get("should_listen_again", True)),
        confidence=confidence,
        language=language,
        model=MODEL_ID,
        latency_ms=0,
        source="AWS Bedrock",
    )


@router.post("/voice-turn", response_model=FarmerVoiceTurnResponse)
async def farmer_voice_turn(request: FarmerVoiceTurnRequest) -> FarmerVoiceTurnResponse:
    started = time.perf_counter()

    try:
        raw_text = generate_text(
            prompt=_voice_prompt(request),
            model_id=MODEL_ID,
            max_tokens=650,
            temperature=0.2,
        )

        try:
            raw = extract_json(raw_text)
        except Exception:
            raw = {
                "reply_text": raw_text.strip(),
                "intent": "general_farm_question",
                "urgency": "low",
                "actions": [],
                "next_question": None,
                "should_listen_again": True,
                "confidence": 0.5,
            }

        result = _normalise_voice_result(raw, request.language)
        result.latency_ms = round((time.perf_counter() - started) * 1000)
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Bedrock is currently unavailable. Check AWS SSO credentials, "
                "region, model access, and network connectivity."
            ),
        ) from exc


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
                "Bedrock is currently unavailable. Check AWS SSO credentials, region, model access, and network connectivity."
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
        "voice_turn": True,
    }
