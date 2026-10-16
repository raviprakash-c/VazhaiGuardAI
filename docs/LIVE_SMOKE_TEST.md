# VazhaiGuardAI live smoke test

This runner records each integration separately as \`PASS\`, \`FAIL\`, \`SKIP\`, or \`DEGRADED\`. Default execution is read-only. Never paste credentials, tokens, private photos, or full model responses into issues or screenshots.

## 1. Read-only API and interface checks

From PowerShell at the repository root:

\`\`\`powershell
Set-Location D:\\VazhaiGuardAI
python backend\\scripts\\live_smoke_test.py
\`\`\`

This checks root/health, multimodal/satellite/soil/inspection-storage health interfaces, and whether the configured Qwen2.5-VL model appears in Ollama's model list. It prints explicit \`SKIP\` rows for live inference, evidence retrieval, persistence, history, and reinspection when not requested. An unconfigured provider is \`DEGRADED\`, not a false pass.

## 2. Actual local Qwen2.5-VL inference

Use a non-sensitive crop image. This invokes Ollama and consumes local compute:

\`\`\`powershell
python backend\\scripts\\live_smoke_test.py --run-local-vision --image "D:\\path\\to\\crop-photo.jpg"
\`\`\`

## 3. AWS identity check (optional)

This calls AWS STS, not Bedrock inference. Refresh the existing SSO profile first if needed:

\`\`\`powershell
aws sso login --profile vazhaiguard
python backend\\scripts\\live_smoke_test.py --check-aws --aws-profile vazhaiguard --aws-region ap-south-1
\`\`\`

## 4. Live satellite and soil evidence (provider calls)

Only use coordinates and a GeoJSON Polygon exported from the farmer-confirmed farm boundary. The runner validates a closed Polygon ring before sending evidence requests. These requests can incur provider usage/costs.

\`\`\`powershell
python backend\\scripts\\live_smoke_test.py --check-evidence --boundary-json "D:\\path\\to\\confirmed-boundary.geojson" --latitude 9.5003 --longitude 77.4999 --confirmed-boundary-checked
\`\`\`

## 5. Read-only inspection history

\`\`\`powershell
python backend\\scripts\\live_smoke_test.py --check-history --farm-id "YOUR_CONFIRMED_FARM_ID"
\`\`\`

## 6. Real inspection or reinspection (writes may occur)

These endpoints can store photos and append inspection history. Only run them deliberately with a non-sensitive crop image, a registered farm ID, coordinates for the inspection endpoint, and a boundary you have already confirmed in the application. The explicit flag is a safety acknowledgement, not an independent verification of the database.

\`\`\`powershell
# New inspection: may write photo/history
python backend\\scripts\\live_smoke_test.py --run-inspection --image "D:\\path\\to\\crop-photo.jpg" --farm-id "YOUR_CONFIRMED_FARM_ID" --latitude 9.5003 --longitude 77.4999 --confirmed-boundary-checked

# Reinspection: may write another photo/history record
python backend\\scripts\\live_smoke_test.py --run-reinspection --image "D:\\path\\to\\new-crop-photo.jpg" --farm-id "YOUR_CONFIRMED_FARM_ID" --confirmed-boundary-checked
\`\`\`

## Interpretation

- \`PASS\`: the requested interface returned its expected contract.
- \`FAIL\`: the requested check could not complete or violated its contract.
- \`SKIP\`: the check was intentionally not requested.
- \`DEGRADED\`: an interface responded, but its provider is unconfigured or evidence is unavailable.

Exit code is 1 only when a check is \`FAIL\`. A \`DEGRADED\` or \`SKIP\` still means that part of the end-to-end path is not fully verified. Passing checks do not establish crop-disease accuracy or parcel-level satellite clipping.
