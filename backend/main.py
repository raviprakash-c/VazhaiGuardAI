from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles  # <-- ADD THIS LINE
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
import uuid

from services.voice_service import start_session, process_turn, get_empty_state, FIELD_ORDER, QUESTIONS_TA, QUESTIONS_EN, QUESTIONS_EN

app = FastAPI(title="VazhaiGuardAI API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Audio Setup (Keep existing) ---
AUDIO_DIR = os.path.join(os.path.dirname(__file__), "generated_audio")
if not os.path.exists(AUDIO_DIR):
    os.makedirs(AUDIO_DIR)
app.mount("/voice/tamil-audio", StaticFiles(directory=AUDIO_DIR), name="tamil-audio")

# --- GIS Data Path ---
GIS_DATA_PATH = os.path.join(os.path.dirname(__file__), "challenge_data", "task2_geojson")

# --- New API: Serve Cadastral/Boundary Layers ---
@app.get("/api/gis/layers/{layer_name}")
async def get_gis_layer(layer_name: str):
    """
    Serves specific GeoJSON layers to the frontend map.
    Usage: /api/gis/layers/Park_Cadastral_Map
    """
    file_path = os.path.join(GIS_DATA_PATH, f"{layer_name}.geojson")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Layer {layer_name} not found")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return JSONResponse(content=data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading GeoJSON: {str(e)}")

# --- Voice Routes (Keep existing) ---
class VoiceStartRequest(BaseModel):
    language: str = "ta-IN"

class VoiceTurnRequest(BaseModel):
    session_id: str
    language: str
    current_field: str
    transcript: str
    farm_state: Dict[str, Any]

@app.post("/api/voice/start")
def voice_start(request: VoiceStartRequest):
    try:
        result = start_session(request.language)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/voice/turn")
def voice_turn(request: VoiceTurnRequest):
    try:
        result = process_turn(request.session_id, request.transcript, request.current_field, request.language)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Import needed for StaticFiles
from fastapi.staticfiles import StaticFiles

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)