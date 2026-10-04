from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field


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


@router.get("/feedback/health")
def feedback_health():
    return {
        "status": "ok",
        "service": "agent-action-follow-up",
        "states": ["completed", "unable", "needs_help", "recheck"],
    }
