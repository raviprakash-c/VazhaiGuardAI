from datetime import datetime, timezone
from math import isfinite
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from routes.multimodal import _fuse_signals, _generate_farmer_decision
from services.multimodal_service import analyze_crop_image, decode_data_url


router = APIRouter(prefix="/agent", tags=["agent-follow-up"])


class ActionFeedbackRequest(BaseModel):
    action_id: str = Field(min_length=1, max_length=160)
    outcome: Literal["completed", "unable", "needs_help", "recheck"]
    farmer_id: Optional[str] = Field(default=None, max_length=120)
    language: str = "ta-IN"
    note: Optional[str] = Field(default=None, max_length=500)


class ActionFeedbackResponse(BaseModel):
    success: bool
    action_id: str
    outcome: str
    next_state: str
    farmer_message: str
    recorded_at: str


class ReinspectionRequest(BaseModel):
    action_id: str = Field(min_length=1, max_length=160)
    language: str = "ta-IN"
    image_data_url: Optional[str] = Field(default=None, max_length=12_000_000)
    image_base64: Optional[str] = Field(default=None, max_length=12_000_000)
    previous_risk_score: Optional[float] = Field(default=None, ge=0, le=100)
    previous_risk_level: Optional[str] = Field(default=None, max_length=30)
    weather_context: Optional[Dict[str, Any]] = None
    satellite_context: Optional[Dict[str, Any]] = None
    farm_context: Optional[Dict[str, Any]] = None


class ReinspectionResponse(BaseModel):
    success: bool
    action_id: str
    current_risk_score: float
    current_risk_level: str
    previous_risk_score: Optional[float]
    risk_delta: Optional[float]
    trend: Literal["improving", "worsening", "stable", "baseline"]
    visual_confidence: Optional[float] = None
    needs_field_verification: bool
    farmer_message: str
    next_state: str
    next_action: str
    next_reason: str
    follow_up_check: str
    recheck_after: str
    signals_used: list[str]
    model: Optional[str] = None
    recorded_at: str


MESSAGES = {
    "ta-IN": {
        "completed": "சரி. இந்த நடவடிக்கை முடிந்தது. அடுத்த மாற்றத்தை கண்காணிக்கலாம்.",
        "unable": "பரவாயில்லை. இப்போது செய்ய முடியவில்லை என்றால், என்ன சிரமம் என்று சொல்லுங்கள். அதன்படி அடுத்த உதவியை சொல்கிறேன்.",
        "needs_help": "சரி. இந்த வேலையை செய்ய உதவி தேவை என்று பதிவு செய்துள்ளேன். தேவையான விவரத்தை சொல்லுங்கள்.",
        "recheck": "சரி. புதிய படம் அல்லது புதிய நிலவரத்தை அனுப்புங்கள். அதை வைத்து மீண்டும் சரிபார்க்கலாம்.",
    },
    "en-IN": {
        "completed": "Good. This action is marked complete. We can watch the next change.",
        "unable": "That is okay. Tell me what made it difficult, and I will suggest the next safe step.",
        "needs_help": "Okay. I have noted that you need help with this action. Tell me what help you need.",
        "recheck": "Okay. Send a new photo or the latest condition and I will check it again.",
    },
}


def _data_url(request: ReinspectionRequest) -> str | None:
    if request.image_data_url:
        return request.image_data_url
    if request.image_base64:
        value = request.image_base64.strip()
        return value if value.startswith("data:") else "data:image/jpeg;base64," + value
    return None


def _trend(previous: float | None, current: float) -> str:
    if previous is None or not isfinite(previous) or not isfinite(current):
        return "baseline"
    delta = current - previous
    if delta <= -8:
        return "improving"
    if delta >= 8:
        return "worsening"
    return "stable"


def _decision_action(decision: dict[str, Any], tamil: bool) -> tuple[str, str]:
    actions = decision.get("priority_actions")
    if isinstance(actions, list) and actions:
        first = actions[0]
        if isinstance(first, dict):
            action = str(first.get("action", "")).strip()
            reason = str(first.get("reason", "")).strip()
            if action:
                return action, reason

    action = str(decision.get("action", "")).strip()
    if action:
        return action, str(decision.get("reason", "")).strip()

    fallback = (
        "புதிய படத்தின் அடிப்படையில் அடுத்த நிலையை கவனித்து, தேவையான களச் சரிபார்ப்பை செய்யுங்கள்."
        if tamil
        else "Review the new photo result and complete the suggested field verification if needed."
    )
    return fallback, ""


@router.post("/feedback", response_model=ActionFeedbackResponse)
def submit_action_feedback(request: ActionFeedbackRequest):
    next_states = {
        "completed": "recheck_due",
        "unable": "wait_for_farmer",
        "needs_help": "wait_for_farmer",
        "recheck": "capture_photo",
    }
    language_messages = MESSAGES["ta-IN" if request.language.lower().startswith("ta") else "en-IN"]

    return ActionFeedbackResponse(
        success=True,
        action_id=request.action_id,
        outcome=request.outcome,
        next_state=next_states[request.outcome],
        farmer_message=language_messages[request.outcome],
        recorded_at=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/reinspect", response_model=ReinspectionResponse)
def reinspect_after_feedback(request: ReinspectionRequest):
    data_url = _data_url(request)
    if not data_url:
        raise HTTPException(status_code=400, detail="A new crop photo is required for reinspection.")

    try:
        image_bytes, content_type = decode_data_url(data_url)
        if not content_type.lower().startswith("image/"):
            raise ValueError("The reinspection file must be an image.")

        vision = analyze_crop_image(
            image_bytes=image_bytes,
            content_type=content_type,
            language=request.language,
            farm_context=request.farm_context,
            weather_context=request.weather_context,
        )
        score, label, _signal_scores, signals_used, _weights = _fuse_signals(
            vision,
            request.weather_context,
            request.satellite_context,
        )
        decision = _generate_farmer_decision(
            vision=vision,
            weather=request.weather_context,
            satellite=request.satellite_context,
            farm_context=request.farm_context,
            score=score,
            label=label,
            language=request.language,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Reinspection is temporarily unavailable. Please try again.") from exc

    delta = None if request.previous_risk_score is None else round(score - request.previous_risk_score, 1)
    trend = _trend(request.previous_risk_score, score)
    tamil = request.language.lower().startswith("ta")
    farmer_message = str(decision.get("farmer_message", decision.get("summary", ""))).strip()

    trend_text = {
        "improving": "முந்தைய மதிப்பீட்டை விட ஆபத்து குறைந்துள்ளது.",
        "worsening": "முந்தைய மதிப்பீட்டை விட ஆபத்து அதிகரித்துள்ளது. இப்போது கொடுக்கப்பட்ட நடவடிக்கையை கவனமாக செய்யுங்கள்.",
        "stable": "முந்தைய மதிப்பீட்டுடன் ஒப்பிடும்போது நிலை பெரிய மாற்றமின்றி உள்ளது.",
        "baseline": "இது புதிய அடிப்படை மதிப்பீடு.",
    } if tamil else {
        "improving": "Risk is lower than the previous assessment.",
        "worsening": "Risk is higher than the previous assessment. Follow the current recommended action carefully.",
        "stable": "The risk is broadly stable compared with the previous assessment.",
        "baseline": "This is the new baseline assessment.",
    }
    combined_message = f"{trend_text[trend]} {farmer_message}".strip()
    needs_verification = bool(decision.get("needs_field_verification", vision.get("needs_field_verification", True)))
    next_action, next_reason = _decision_action(decision, tamil)
    follow_up_check = str(decision.get("follow_up_check", "")).strip()
    recheck_after = str(decision.get("recheck_after", "")).strip()

    return ReinspectionResponse(
        success=True,
        action_id=request.action_id,
        current_risk_score=round(score, 1),
        current_risk_level=label,
        previous_risk_score=request.previous_risk_score,
        risk_delta=delta,
        trend=trend,
        visual_confidence=vision.get("visual_confidence"),
        needs_field_verification=needs_verification,
        farmer_message=combined_message,
        next_state="field_verification" if needs_verification else "wait_for_farmer",
        next_action=next_action,
        next_reason=next_reason,
        follow_up_check=follow_up_check,
        recheck_after=recheck_after,
        signals_used=signals_used,
        model=vision.get("model"),
        recorded_at=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/feedback/health")
def feedback_health():
    return {
        "status": "ok",
        "service": "agent-action-follow-up",
        "states": ["completed", "unable", "needs_help", "recheck"],
        "closed_loop": "feedback -> new photo -> evidence fusion -> risk comparison -> farmer action",
    }
