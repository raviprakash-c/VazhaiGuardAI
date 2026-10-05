# VazhaiGuard AI — Satellite Evidence Setup

This module adds farm/zone-level satellite evidence using Google Earth Engine (GEE).

## Evidence flow

```text
farmer-confirmed location/boundary
        -> Google Earth Engine
        -> Sentinel-2 SR Harmonized
        -> Dynamic World
        -> NDVI / NDRE / NDWI
        -> recent-vs-baseline NDVI trend
        -> observation age + scene cloud quality
        -> deterministic unified risk engine
        -> Ministral farmer action
```

Satellite is periodic evidence. It is not live video and is not an individual-tree disease classifier.

## Backend setup

From the backend environment:

```powershell
cd D:\VazhaiGuardAI\backend
.\.venv\Scripts\pip.exe install -r requirements-satellite.txt
```

Authenticate Earth Engine once in the same development environment:

```powershell
earthengine authenticate
```

Configure the Google Cloud / Earth Engine project used by the backend:

```powershell
$env:GEE_PROJECT = "YOUR_EARTH_ENGINE_PROJECT_ID"
```

Do not commit credentials or authentication tokens to Git.

## Health check

Start FastAPI and call:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/ai/satellite/health
```

Expected configuration response includes:

- Google Earth Engine
- `COPERNICUS/S2_SR_HARMONIZED`
- `GOOGLE/DYNAMICWORLD/V1`
- NDVI, NDRE and NDWI
- `satellite_is_live: false`

If `GEE_PROJECT` is missing, health reports `setup_required` rather than failing the whole application.

## Evidence request

```powershell
$body = @{
  latitude = 10.0
  longitude = 78.0
  lookback_days = 45
  baseline_days = 45
  max_cloud_percent = 35
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/ai/satellite/evidence `
  -ContentType 'application/json' `
  -Body $body
```

If a farmer-confirmed GeoJSON Polygon or MultiPolygon is available, send it as `boundary`. A missing boundary uses a 60 m location buffer and is explicitly labeled as such; the system does not invent a legal parcel.

## Interpretation

The service returns:

- latest observation timestamp
- observation age
- Sentinel-2 image count
- mean scene cloud percentage
- NDVI
- NDRE
- NDWI
- baseline NDVI
- NDVI trend
- Dynamic World crop/tree probability
- a conservative vegetation-stress heuristic
- warnings and provenance

The risk engine then applies the existing evidence-freshness rules. Stale satellite observations are discounted, and known temporal crop conflicts can remove satellite decision weight so current farmer/photo evidence takes precedence.

## Failure behavior

Satellite is an optional evidence source. If GEE is not installed, not authenticated, not configured, or has no suitable observation, the crop-photo inspection continues using the available evidence instead of fabricating satellite data.

## Important limitation

Do not describe the returned vegetation-stress score as a banana disease diagnosis. The farmer photo remains the stronger plant-level visual source, while satellite provides farm/zone-level vegetation and environmental context.
