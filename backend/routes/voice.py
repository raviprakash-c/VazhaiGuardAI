from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse


router = APIRouter()


BASE_DIR = Path(__file__).resolve().parent.parent

TAMIL_AUDIO_DIR = BASE_DIR / "generated_audio"

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


@router.get("/voice/tamil-audio/{field}")
async def get_tamil_audio(field: str):

    if field not in FIELD_AUDIO_FILES:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown Tamil voice field: {field}",
        )

    filename = FIELD_AUDIO_FILES[field]

    audio_path = TAMIL_AUDIO_DIR / filename

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