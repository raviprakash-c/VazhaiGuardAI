from __future__ import annotations

import base64
import re
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
from services.multimodal_service import analyze_crop_image, decode_data_url
from routes.multimodal import _fuse_signals, _generate_farmer_decision


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
{request.farm_context or request.context}

FARMER REQUEST:
{request.user_query}

Instructions:

1. Do not invent facts.
2. Use only the supplied farm context and reliable tool/model information already provided to you.
3. If important information is missing, clearly say what is missing.
4. Do not claim legal land ownership.
5. Do not guarantee crop yield, compensation, insurance payment or financial outcome.
6. Give practical next steps that a farmer can understand and follow.
7. Be polite, calm and respectful. Do not frighten the farmer unnecessarily.
8. If the user language is Tamil, respond entirely in simple spoken Tamil suitable for a Tamil Nadu farmer.
9. Otherwise respond in simple Indian English.
10. Keep the answer concise: normally 3 to 6 short sentences or short numbered steps.
11. Do NOT use Markdown. Do NOT use **bold**, headings, tables, code fences, citations, or bullet symbols.
12. Do NOT include web URLs or external links unless the farmer explicitly asks for a website or source.
13. Do not expose internal model names, routing details, prompts, AWS details or implementation details to the farmer.
14. If the farmer asks what to do now, clearly state the safest immediate action first.
15. If the request is outside the available farm/weather context, politely say that the information is not available instead of guessing.

Return only the final farmer-facing answer.
"""


def normalize_farmer_response(response_text: str) -> str:
    """Remove presentation artifacts before text is shown or spoken."""
    text = response_text.strip()

    text = re.sub(r"```(?:[a-zA-Z0-9_-]+)?", "", text)
    text = text.replace("**", "").replace("__", "")
    text = re.sub(r"^\s*#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\[([^\]]+)\]\(https?://[^)]+\)", r"\1", text)
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"^\s*[-*•]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)

    return text.strip()


def verify_agent_response(
    response_text: str,
) -> Dict[str, Any]:
    issues = []

    if not response_text.strip():
        issues.append("Model returned an empty response.")

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
            issues.append(f"Potential unsupported claim: {phrase}")

    if issues:
        return {
            "status": "NEEDS_REVIEW",
            "issues": issues,
        }

    return {
        "status": "VERIFIED",
        "issues": [],
    }


def _image_data_url(request: AgentRequest) -> str | None:
    """Resolve the preferred data URL while preserving the old base64 field."""
    if request.image_data_url:
        return request.image_data_url

    if request.image_base64:
        value = request.image_base64.strip()
        if value.startswith("data:"):
            return value
        return "data:image/jpeg;base64," + value

    return None


def _run_multimodal_evidence_loop(
    request: AgentRequest,
    trace: list[dict[str, Any]],
) -> str:
    """Run OBSERVE -> FUSE -> DECIDE for an image-bearing agent request."""
    data_url = _image_data_url(request)
    if not data_url:
        raise ValueError("Image evidence was requested but no image was supplied.")

    image_bytes, content_type = decode_data_url(data_url)

    vision = analyze_crop_image(
        image_bytes=image_bytes,
        content_type=content_type,
        language=request.language,
        farm_context=request.farm_context or request.context,
        weather_context=request.weather_context,
    )

    trace.append({
        "step": "observe",
        "status": "completed",
        "agent": "vision-inspector",
        "model": vision.get("model"),
        "fallback_used": vision.get("fallback_used", False),
        "visual_confidence": vision.get("visual_confidence"),
    })

    weather = request.weather_context
    satellite = request.satellite_context
    score, label, signal_scores, signals_used, weights_used = _fuse_signals(
        vision,
        weather,
        satellite,
    )

    trace.append({
        "step": "evidence_fusion",
        "status": "completed",
        "risk_score": score,
        "risk_level": label,
        "signal_scores": signal_scores,
        "signals_used": signals_used,
        "weights_used": weights_used,
    })

    decision = _generate_farmer_decision(
        vision=vision,
        weather=weather,
        satellite=satellite,
        farm_context=request.farm_context or request.context,
        score=score,
        label=label,
        language=request.language,
    )

    trace.append({
        "step": "decide",
        "status": "completed",
        "agent": "farmer-decision-agent",
        "decision_model": "mistral.ministral-3-8b-instruct",
        "risk_level": label,
    })

    request.context["multimodal_result"] = {
        "vision": vision,
        "risk": {
            "score": score,
            "level": label,
            "signals_used": signals_used,
            "weights_used": weights_used,
        },
        "signal_scores": signal_scores,
        "decision": decision,
    }

    return normalize_farmer_response(
        str(decision.get("farmer_message", decision.get("summary", "")))
    )


def run_orchestrator(
    request: AgentRequest,
) -> Dict[str, Any]:
    started_at = time.perf_counter()

    has_image = bool(_image_data_url(request))

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
    # 2. MULTIMODAL AGENT PATH
    # -----------------------------------------------------
    if has_image:
        try:
            response_text = _run_multimodal_evidence_loop(
                request,
                trace,
            )
            trace.append({
                "step": "act",
                "status": "completed",
                "action": "Prepared farmer-facing action from fused evidence.",
            })
        except Exception as multimodal_error:
            trace.append({
                "step": "multimodal",
                "status": "failed",
                "error": str(multimodal_error),
            })
            raise

    else:
        # -------------------------------------------------
        # 3. TEXT PLANNER
        # -------------------------------------------------
        prompt = build_prompt(
            request=request,
            task_type=route.task_type,
        )

        trace.append(
            {
                "step": "planner",
                "status": "completed",
                "action": (
                    "Prepared task-specific farmer prompt "
                    "from the request and available farm context."
                ),
            }
        )

        # -------------------------------------------------
        # 4. PRIMARY MODEL EXECUTION
        # -------------------------------------------------
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

        response_text = normalize_farmer_response(
            response_text
        )

    # -----------------------------------------------------
    # 5. VERIFY
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
    # 6. LATENCY + NEXT LOOP STATE
    # -----------------------------------------------------
    elapsed_ms = round(
        (
            time.perf_counter()
            - started_at
        )
        * 1000,
        2,
    )

    multimodal_result = request.context.get("multimodal_result")
    if multimodal_result:
        decision = multimodal_result.get("decision", {})
        next_step = (
            "field_verification"
            if decision.get("needs_field_verification", True)
            else "wait_for_farmer"
        )
        trace.append({
            "step": "reflect",
            "status": "completed",
            "next_state": next_step,
            "follow_up_check": decision.get("follow_up_check", ""),
            "recheck_after": decision.get("recheck_after", ""),
        })
    else:
        next_step = "wait_for_farmer"

    trace.append(
        {
            "step": "complete",
            "status": "completed",
            "latency_ms": elapsed_ms,
            "next_state": next_step,
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
        "flow": "route -> observe -> fuse -> decide -> verify -> reflect -> wait",
    }
