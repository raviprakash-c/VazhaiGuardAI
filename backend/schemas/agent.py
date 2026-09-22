from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AgentRequest(BaseModel):
    farm_id: Optional[str] = None

    user_query: str = Field(
        min_length=1,
        max_length=5000
    )

    language: str = "en-IN"

    context: Dict[str, Any] = Field(
        default_factory=dict
    )

    image_base64: Optional[str] = None


class RoutingDecision(BaseModel):
    task_type: str

    selected_model: str

    model_id: str

    reason: str

    fallback_model: Optional[str] = None


class AgentResponse(BaseModel):
    success: bool

    farm_id: Optional[str]

    user_query: str

    task_type: str

    response: str

    routing: RoutingDecision

    verification: Dict[str, Any]

    trace: List[Dict[str, Any]]