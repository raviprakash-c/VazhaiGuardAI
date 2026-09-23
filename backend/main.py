from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from farm_map import router as farm_map_router
from voice_registration import router as voice_registration_router
from agents.orchestrator import router as orchestrator_router
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse

app = FastAPI(
    title="VazhaiGuardAI",
    version="2.0.0",
    description="AI-powered banana farm intelligence platform",
)
# ============================================================
# TAMIL VOICE AUDIO
# ============================================================

TAMIL_AUDIO_DIR = Path(__file__).resolve().parent / "generated_audio"

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

    # Check whether requested field exists
    if field not in FIELD_AUDIO_FILES:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown Tamil voice field: {field}",
        )

    filename = FIELD_AUDIO_FILES[field]

    audio_path = TAMIL_AUDIO_DIR / filename

    print("[TamilVoice] Requested field:", field)
    print("[TamilVoice] Audio path:", audio_path)
    print("[TamilVoice] File exists:", audio_path.exists())

    # Check whether MP3 exists
    if not audio_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Tamil audio file not found: {audio_path}",
        )

    return FileResponse(
        path=str(audio_path),
        media_type="audio/mpeg",
        filename=filename,
    )
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core routes
app.include_router(voice_registration_router)
app.include_router(farm_map_router)
app.include_router(orchestrator_router)


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "VazhaiGuardAI",
        "version": "2.0.0",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "VazhaiGuardAI",
    }