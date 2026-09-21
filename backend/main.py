from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uuid
import os

# Import Services
from services.land_intelligence import land_service

app = FastAPI(title="VazhaiGuardAI - Phase 1")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---
class VoiceRegistrationRequest(BaseModel):
    farmer_name: str
    audio_transcript: str  # Text from Tamil Speech-to-Text

class FarmBoundaryRequest(BaseModel):
    farmer_id: str
    coordinates: List[List[float]]  # GeoJSON Polygon [[lon, lat], [lon, lat]...]

# --- Mock Database (In-Memory) ---
farmers_db = {}
farms_db = {}

# --- Endpoints ---

@app.get("/")
def read_root():
    return {"status": "VazhaiGuardAI Phase 1 Running", "services": ["Voice", "Land Intelligence"]}

@app.post("/api/voice/register")
async def register_farmer(request: VoiceRegistrationRequest):
    """
    Phase 1 Step 1: Voice Registration
    Converts transcript to Farmer Profile.
    """
    farmer_id = str(uuid.uuid4())
    
    # Save profile
    farmers_db[farmer_id] = {
        "name": request.farmer_name,
        "language": "Tamil",
        "transcript": request.audio_transcript,
        "voice_profile_status": "Active"
    }
    
    return {
        "status": "success",
        "farmer_id": farmer_id,
        "message": f"Welcome, {request.farmer_name}. Voice profile created.",
        "next_step": "Please draw your farm boundary on the map."
    }

@app.post("/api/farm/create")
async def create_smart_farm(request: FarmBoundaryRequest):
    """
    Phase 1 Step 2: Smart Farm Setup with Land Intelligence
    Validates coordinates against Task 2 (GIS) and Task 3 (Admin) data.
    """
    if request.farmer_id not in farmers_db:
        raise HTTPException(status_code=404, detail="Farmer not found. Please register first.")

    # Calculate Center Point for Validation
    lons = [p[0] for p in request.coordinates[0]]
    lats = [p[1] for p in request.coordinates[0]]
    center_lon = sum(lons) / len(lons)
    center_lat = sum(lats) / len(lats)

    # Call Land Intelligence Service
    farm_profile = land_service.generate_farm_profile(
        request.coordinates, center_lat, center_lon
    )

    # Save Farm
    farm_id = str(uuid.uuid4())
    farms_db[farm_id] = {
        "owner_id": request.farmer_id,
        "boundary": request.coordinates,
        "profile": farm_profile,
        "area_hectares": 0.0 # Calculate actual area here if needed
    }

    return {
        "status": "success",
        "farm_id": farm_id,
        "validation_result": farm_profile,
        "message": "Farm boundary validated successfully using GIS layers."
    }

@app.get("/api/land/check/{lat}/{lon}")
async def quick_land_check(lat: float, lon: float):
    """Quick endpoint to test Land Intelligence without creating a farm."""
    context = land_service.get_admin_context(lat, lon)
    land_use = land_service.validate_land_use(lat, lon)
    return {**context, **land_use}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)