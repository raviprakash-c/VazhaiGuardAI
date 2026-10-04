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

    # Backward-compatible image field used by the original agent route.
    image_base64: Optional[str] = None

    # Preferred multimodal field. The browser sends a data URL so the
    # orchestrator can pass the original image bytes to the vision model.
    image_data_url: Optional[str] = Field(
        default=None,
        max_length=12_000_000,
    )

    # Evidence supplied by real tools/services. Missing evidence stays missing.
    weather_context: Optional[Dict[str, Any]] = None
    satellite_context: Optional[Dict[str, Any]] = None
    farm_context: Optional[Dict[str, Any]] = None


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
