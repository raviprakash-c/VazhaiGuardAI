from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from farm_map import router as farm_map_router
from parcel import router as parcel_router
from routes.zone import router as zone_router
from routes.bedrock import router as bedrock_router
from routes.multimodal import router as multimodal_router
from routes.evidence import router as evidence_router
from routes.followup import router as followup_router
from routes.satellite import router as satellite_router
from voice_registration import router as voice_registration_router
from agents.orchestrator import router as orchestrator_router
from weather import router as weather_router


app = FastAPI(
    title="VazhaiGuardAI",
    version="2.5.0",
    description=(
        "AI-powered banana farm intelligence platform with AWS Bedrock farmer copilot, "
        "multimodal crop inspection, temporal evidence monitoring, unified risk fusion, "
        "real Google Earth Engine satellite evidence, and an agentic farmer action follow-up loop"
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TAMIL_AUDIO_DIR = Path(__file__).resolve().parent.parent / "generated_audio"
FIELD_AUDIO_FILES = {
    "farm_name": "farm_name.mp3",
    "total_farm_acres": "total_farm_acres.mp3",
    "banana_area_acres": "banana_area_acres.mp3",
    "banana_variety": "banana_variety.mp3",
    "planting_age": "planting_age.mp3",
    "approximate_plants": "approximate_plants.mp3",
    "drainage": "drainage.mp3",
    "support": "support.mp3",
    "accessibility": "accessibility.mp3",
}


@app.get("/voice/tamil-audio/{field}")
async def get_tamil_audio(field: str):
    if field not in FIELD_AUDIO_FILES:
        raise HTTPException(status_code=404, detail="Unknown Tamil voice field: " + field)
    filename = FIELD_AUDIO_FILES[field]
    audio_path = TAMIL_AUDIO_DIR / filename
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Tamil audio file not found: " + str(audio_path))
    return FileResponse(path=str(audio_path), media_type="audio/mpeg", filename=filename)


app.include_router(voice_registration_router)
app.include_router(parcel_router)
app.include_router(zone_router)
app.include_router(orchestrator_router)
app.include_router(followup_router)
app.include_router(farm_map_router)
app.include_router(weather_router)
app.include_router(bedrock_router)
app.include_router(multimodal_router)
app.include_router(evidence_router)
app.include_router(satellite_router)


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "VazhaiGuardAI",
        "version": "2.5.0",
        "capabilities": [
            "farmer-voice-copilot",
            "weather-decision-engine",
            "multimodal-crop-inspection",
            "risk-fusion",
            "temporal-evidence-monitor",
            "satellite-evidence-sentinel2-dynamicworld",
            "agentic-action-follow-up",
        ],
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "VazhaiGuardAI",
        "bedrock_text_model": "mistral.ministral-3-8b-instruct",
        "multimodal": "enabled",
        "evidence_monitor": "enabled",
        "satellite_evidence": "earth-engine",
        "agentic_follow_up": "enabled",
    }
