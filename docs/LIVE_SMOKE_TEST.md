# VazhaiGuardAI live smoke test

The runner checks the running API and local Ollama model. It does not print credentials, AWS account identifiers, images, or full model responses.

## Read-only checks (default)

From PowerShell at the repository root:

    Set-Location D:\VazhaiGuardAI
    python backend\scripts\live_smoke_test.py

Override endpoints if needed:

    python backend\scripts\live_smoke_test.py --api-base http://127.0.0.1:8000 --ollama-base http://127.0.0.1:11434

## Optional AWS check

This calls AWS STS and requires a valid local SSO/profile session:

    aws sso login --profile vazhaiguard
    python backend\scripts\live_smoke_test.py --check-aws

## Optional live weather check

    python backend\scripts\live_smoke_test.py --weather-lat 9.5003 --weather-lon 77.4999

## Optional real inspection — storage writes may occur

Only use this when you deliberately want a real inspection. The endpoint can store the photo and inspection history using configured backend services. Use a non-sensitive crop photo and a registered, farmer-confirmed farm ID.

    python backend\scripts\live_smoke_test.py --run-inspection --image "D:\path\to\crop-photo.jpg" --farm-id "YOUR_CONFIRMED_FARM_ID" --latitude 9.5003 --longitude 77.4999

The command reports a compact result, not the photo or full model output. Successful HTTP response does not establish agronomic accuracy. Satellite data is periodic context; this test does not prove imagery is clipped to the parcel polygon.

Exit code 0 means all requested checks passed; 1 means one or more checks failed. The default run is read-only. Never put API keys or tokens on the command line or in screenshots.
