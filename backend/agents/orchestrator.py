from __future__ import annotations

import time
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from schemas.agent import (
    AgentRequest,
    AgentResponse,
    RoutingDecision,
)

from services.bedrock_service import generate_text
from services.model_router import route_request


router = APIRouter(
    prefix="/agent",
    tags=["agent"],
)


def build_prompt(
    request: AgentRequest,
    task_type: str,
) -> str:

    return f"""
You are VazhaiGuard AI,
an agricultural decision-support assistant
for Tamil Nadu banana farmers.

TASK TYPE:
{task_type}

FARM ID:
{request.farm_id}

LANGUAGE:
{request.language}

FARM CONTEXT:
{request.context}

FARMER REQUEST:
{request.user_query}

Instructions:

1. Do not invent facts.
2. Use only the supplied farm context.
3. If important information is missing,
   clearly say what is missing.
4. Do not claim legal land ownership.
5. Do not guarantee crop yield, compensation,
   insurance payment or financial outcome.
6. Give practical next steps.
7. Keep the answer understandable to a farmer.
8. If the user language is Tamil,
   respond in simple spoken Tamil.
9. Otherwise respond in simple English.

Return a useful farmer-facing answer.
"""


def verify_agent_response(
    response_text: str,
) -> Dict[str, Any]:

    issues = []

    if not response_text.strip():
        issues.append(
            "Model returned an empty response."
        )

    risky_phrases = [
        "guaranteed compensation",
        "guaranteed yield",
        "guaranteed profit",
        "legal owner",
        "ownership confirmed",
    ]

    lowered = response_text.lower()

    for phrase in risky_phrases:

        if phrase in lowered:
            issues.append(
                f"Potential unsupported claim: {phrase}"
            )

    if issues:
        return {
            "status": "NEEDS_REVIEW",
            "issues": issues,
        }

    return {
        "status": "VERIFIED",
        "issues": [],
    }


def run_orchestrator(
    request: AgentRequest,
) -> Dict[str, Any]:

    started_at = time.perf_counter()

    has_image = bool(
        request.image_base64
    )

    # -----------------------------------------------------
    # 1. ROUTER
    # -----------------------------------------------------

    route = route_request(
        user_query=request.user_query,
        has_image=has_image,
    )

    trace = [
        {
            "step": "router",
            "status": "completed",
            "task_type": route.task_type,
            "selected_model": route.selected_model,
            "model_id": route.model_id,
            "reason": route.reason,
        }
    ]

    # -----------------------------------------------------
    # 2. PLANNER
    # -----------------------------------------------------

    prompt = build_prompt(
        request=request,
        task_type=route.task_type,
    )

    trace.append(
        {
            "step": "planner",
            "status": "completed",
            "action": (
                "Prepared task-specific prompt "
                "from farmer request and farm context."
            ),
        }
    )

    # -----------------------------------------------------
    # 3. PRIMARY MODEL EXECUTION
    # -----------------------------------------------------

    try:

        response_text = generate_text(
            prompt=prompt,
            model_id=route.model_id,
            max_tokens=400,
            temperature=0.2,
        )

        trace.append(
            {
                "step": "model",
                "status": "completed",
                "model": route.selected_model,
                "model_id": route.model_id,
            }
        )

    except Exception as primary_error:

        trace.append(
            {
                "step": "model",
                "status": "failed",
                "model": route.selected_model,
                "model_id": route.model_id,
                "error": str(primary_error),
            }
        )

        # -------------------------------------------------
        # 4. FALLBACK MODEL
        # -------------------------------------------------

        if not route.fallback_model:
            raise

        try:

            response_text = generate_text(
                prompt=prompt,
                model_id=route.fallback_model,
                max_tokens=400,
                temperature=0.2,
            )

            trace.append(
                {
                    "step": "fallback",
                    "status": "completed",
                    "fallback_model": route.fallback_model,
                }
            )

        except Exception as fallback_error:

            trace.append(
                {
                    "step": "fallback",
                    "status": "failed",
                    "error": str(fallback_error),
                }
            )

            raise RuntimeError(
                "Both primary model and fallback model failed."
            ) from fallback_error

    # -----------------------------------------------------
    # 5. VERIFIER
    # -----------------------------------------------------

    verification = verify_agent_response(
        response_text
    )

    trace.append(
        {
            "step": "verifier",
            "status": (
                "completed"
                if verification["status"] == "VERIFIED"
                else "needs_review"
            ),
            "verification": verification,
        }
    )

    # -----------------------------------------------------
    # 6. LATENCY
    # -----------------------------------------------------

    elapsed_ms = round(
        (
            time.perf_counter()
            - started_at
        )
        * 1000,
        2,
    )

    trace.append(
        {
            "step": "complete",
            "status": "completed",
            "latency_ms": elapsed_ms,
        }
    )

    # -----------------------------------------------------
    # 7. FINAL RESPONSE
    # -----------------------------------------------------

    return {
        "success": True,

        "farm_id": request.farm_id,

        "user_query": request.user_query,

        "task_type": route.task_type,

        "response": response_text,

        "routing": RoutingDecision(
            task_type=route.task_type,
            selected_model=route.selected_model,
            model_id=route.model_id,
            reason=route.reason,
            fallback_model=route.fallback_model,
        ).model_dump(),

        "verification": verification,

        "trace": trace,
    }


# =========================================================
# API ENDPOINT
# =========================================================

@router.post(
    "/run",
    response_model=AgentResponse,
)
def run_agent(
    request: AgentRequest,
):

    try:

        return run_orchestrator(
            request
        )

    except Exception as error:

        print(
            "AGENT ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Agent execution failed: "
                + str(error)
            ),
        ) from error


# =========================================================
# HEALTH CHECK
# =========================================================

@router.get(
    "/health"
)
def agent_health():

    return {
        "status": "ok",
        "service": "agent-orchestrator",
    }