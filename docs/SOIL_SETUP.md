# Soil evidence setup and validation

VazhaiGuard AI uses ISRIC SoilGrids as an optional, coarse soil-context source. The module is deliberately a supporting signal: it does not replace a field soil test and does not diagnose a crop disease.

## Data returned

The backend requests the topsoil layer (`0-5cm`) and mean/uncertainty estimates for:

- `phh2o`: modelled pH
- `clay` and `sand`: texture fractions
- `soc`: soil organic carbon
- `cec`: cation-exchange capacity

The provider's encoded values are normalized by the existing soil service before they are returned. The result includes source, approximate 250 m resolution, depth, a conservative confidence value, a contextual heuristic score when enough values exist, and explicit limitations.

## API

- `GET /ai/soil/health`: describes the configured provider and evidence scope.
- `POST /ai/soil/evidence`: request body `{"latitude": 10.79, "longitude": 78.70}`.

The frontend Soil Evidence workspace reads the farmer-saved location from `vazhaiguard_farm_complete`. It does not silently replace it with device GPS. A farmer should confirm the farm location first.

## Inspection integration

The crop inspection page requests soil evidence alongside weather and satellite context. If SoilGrids is unavailable, the UI sends no fabricated soil measurements and continues with the other available evidence. The deterministic risk engine gives soil a low base weight and discounts it by soil confidence. The decision prompt prohibits using this layer alone to prescribe fertilizer or treatment.

SoilGrids is a predictive global dataset, not a measurement of a specific field or a live sensor. Do not describe the soil values as lab results or infer that all parts of a farm have the same properties.

## Local validation

From the backend directory:

```powershell
python -m unittest tests.test_soil_service -v
```

From the frontend directory:

```powershell
npm run build
```

Manual UI check: open `/soil`, select **Refresh soil evidence**, and confirm that the page either displays the returned estimates with limitations or a clear unavailable state. An unavailable provider must not prevent photo, weather, or satellite evidence from being used.
