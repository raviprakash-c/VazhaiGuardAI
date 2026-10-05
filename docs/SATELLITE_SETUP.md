# Satellite Evidence Setup

PR 7 adds a real satellite evidence layer to the existing evidence-fusion flow.

## What it uses

- Google Earth Engine
- Sentinel-2 Surface Reflectance Harmonized: `COPERNICUS/S2_SR_HARMONIZED`
- Dynamic World: `GOOGLE/DYNAMICWORLD/V1`
- NDVI, NDRE and NDWI
- Recent-vs-baseline NDVI trend
- Observation age and scene cloud percentage

Satellite evidence is **farm/zone-level evidence**. It is not an individual banana-tree disease classifier and it is not live video.

## One-time backend setup

From `D:\VazhaiGuardAI\backend`:

```powershell
.\.venv\Scripts\pip.exe install -r requirements-satellite.txt
```

Authenticate Earth Engine once in the same environment:

```powershell
earthengine authenticate
```

Set the Earth Engine Cloud project that you registered/verified for the prototype:

```powershell
$env:GEE_PROJECT="your-earth-engine-project-id"
```

Then start the backend normally:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

The backend intentionally does **not** run interactive authentication from FastAPI. If `GEE_PROJECT` or Earth Engine credentials are missing, the satellite endpoint returns a clear setup error and the farmer photo flow continues using the evidence that is actually available.

## Health check

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/ai/satellite/health | Select-Object -ExpandProperty Content
```

Expected structure:

```json
{
  "service": "satellite-evidence",
  "provider": "Google Earth Engine",
  "datasets": [
    "COPERNICUS/S2_SR_HARMONIZED",
    "GOOGLE/DYNAMICWORLD/V1"
  ],
  "indices": ["NDVI", "NDRE", "NDWI"]
}
```

## How the evidence is used

```text
Farmer-confirmed farm location/boundary
                |
                v
        Google Earth Engine
          /             \
   Sentinel-2          Dynamic World
      |                    |
 NDVI / NDRE / NDWI    crop probability
      |                    |
      +---------+----------+
                |
        satellite evidence
                |
                v
        Unified Risk Engine
                |
                v
          Ministral 8B
                |
                v
       Simple Tamil action
```

If the farmer has a saved, confirmed farm boundary, that boundary is used. If it is not available, the UI may use device GPS only as a clearly labelled location fallback; it does not pretend the device point is the farm boundary.

## Important interpretation rule

The satellite risk value is a **prototype vegetation-stress heuristic**. It is not a validated banana disease probability. The final agent is instructed to keep this distinction and request field verification when evidence is weak or conflicting.

This is deliberate: satellite imagery tells us what may be happening across the farm, while the farmer photograph supplies plant-level visual evidence.
