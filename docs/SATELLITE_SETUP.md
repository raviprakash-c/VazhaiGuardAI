# VazhaiGuard AI — Satellite Evidence Setup

This module uses the **Copernicus Data Space Ecosystem (CDSE)** Sentinel-2 Level-2A APIs instead of Google Earth Engine.

## Evidence flow

```text
farmer-confirmed location/boundary
        -> CDSE STAC catalogue
        -> latest suitable Sentinel-2 L2A scene
        -> CDSE Statistical API
        -> NDVI / NDRE / NDWI
        -> recent-vs-baseline NDVI trend
        -> observation age + cloud quality
        -> deterministic unified risk engine
        -> farmer-facing risk map
```

The map also requests a true-colour Sentinel-2 preview through the CDSE Process API and overlays it beneath the existing farmer-confirmed boundary.

Satellite is periodic evidence. It is not live video and is not an individual-tree disease classifier.

## Why CDSE

CDSE is the official Copernicus Data Space platform. Its Sentinel-2 catalogue, Statistical API and Process API support programmatic discovery, analysis and rendering of Sentinel-2 L2A data. The project uses the public STAC catalogue for scene discovery and OAuth client credentials for processing/statistics requests.

## Backend setup

Install the satellite dependency in the existing backend environment:

```powershell
cd D:\VazhaiGuardAI\backend
.\.venv\Scripts\pip.exe install -r requirements-satellite.txt
```

Create an OAuth client in the Copernicus Data Space / Sentinel Hub dashboard. Then set the credentials only in the local shell or deployment secret store:

```powershell
$env:CDSE_CLIENT_ID = "YOUR_CDSE_CLIENT_ID"
$env:CDSE_CLIENT_SECRET = "YOUR_CDSE_CLIENT_SECRET"
```

Never commit these values to Git or expose them to the frontend.

## Health check

Start FastAPI and call:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/ai/satellite/health
```

Expected response contains:

```text
provider: Copernicus Data Space Ecosystem
collection: sentinel-2-l2a
indices: NDVI, NDRE, NDWI
satellite_is_live: False
resolution_m: 10
```

Without CDSE credentials the health endpoint reports `setup_required`. The application remains usable; satellite evidence is treated as optional instead of fabricated.

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

## Satellite image preview

The farmer risk map calls:

```text
POST /ai/satellite/preview
```

The backend selects the same suitable Sentinel-2 observation and requests a true-colour image from CDSE. The browser displays it as an image overlay while the existing Leaflet map and farm boundary remain unchanged.

## Interpretation

The evidence response contains:

- latest observation timestamp
- observation age
- Sentinel-2 scene count
- scene cloud percentage
- NDVI
- NDRE
- NDWI
- baseline NDVI
- NDVI trend
- farm geometry provenance
- conservative vegetation-stress heuristic
- warnings and scene provenance

The service deliberately does not generate a fake Dynamic World crop probability because Dynamic World was part of the old Earth Engine implementation. Crop/plant-level visual evidence continues to come from the farmer photo pipeline.

## Failure behavior

CDSE is an optional evidence source. If credentials are missing, the catalogue has no suitable scene, statistics fail, or preview generation fails, the crop-photo/weather path continues without fabricated satellite evidence. The map clearly indicates when satellite imagery is unavailable.

## Important limitation

Do not describe the vegetation-stress score as a banana disease diagnosis. Sentinel-2 provides farm/zone-level vegetation and environmental context at approximately 10 m resolution for the relevant bands. The farmer photo remains the stronger plant-level visual source.
