# Commit 5 — Multimodal evidence fusion

This module now runs the core prototype decision path:

**Farmer photo → Nova Lite vision → visual evidence → live weather evidence → optional satellite evidence → unified risk engine → Ministral 8B decision → structured farmer action → Tamil voice**

## 1. Approved Bedrock configuration

The challenge account requires the APAC Nova inference profiles for on-demand vision calls.

PowerShell:

```powershell
$env:AWS_PROFILE="vazhaiguard"
$env:AWS_REGION="ap-south-1"
$env:VAZHAIGUARD_TEXT_MODEL="mistral.ministral-3-8b-instruct"
$env:VAZHAIGUARD_VISION_MODEL="apac.amazon.nova-lite-v1:0"
$env:VAZHAIGUARD_VISION_FALLBACK_MODEL="apac.amazon.nova-pro-v1:0"
```

The application defaults already use these APAC inference-profile IDs, so the environment variables are optional when the standard challenge profile is active.

## 2. Start the backend

```powershell
cd D:\VazhaiGuardAI\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Health check:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/ai/multimodal/health -UseBasicParsing | Select-Object -ExpandProperty Content
```

The response should show:

- primary vision: `apac.amazon.nova-lite-v1:0`
- fallback vision: `apac.amazon.nova-pro-v1:0`
- decision model: `mistral.ministral-3-8b-instruct`
- fusion: vision + weather + optional satellite + farm context

## 3. Start the frontend

```powershell
cd D:\VazhaiGuardAI\frontend
npm run build
npm run dev
```

Open **Crop Photo Check**.

## 4. End-to-end test

1. Take a clear banana leaf/plant photo.
2. Press **Inspect with AI**.
3. The browser attempts to obtain the current farm/device location and fetches live Open-Meteo weather.
4. The frontend calls `/ai/multimodal/inspect-and-decide` once for the complete decision path.
5. Nova Lite analyzes the image. Nova Pro is used automatically if the primary vision call fails.
6. The unified risk engine combines the available evidence. Missing evidence is excluded instead of being treated as zero risk.
7. Ministral 8B receives the structured evidence and risk score and returns a structured farmer decision.
8. The UI shows the risk score, evidence signals, priority actions, follow-up check, and spoken Tamil response.
9. Press **தமிழில் கேளுங்கள்** or continue to **AI Copilot**.

## 5. Risk fusion behavior

Default evidence weights are:

- Vision: 50%
- Weather: 30%
- Satellite: 20%

Weights are automatically renormalized when an evidence source is unavailable. Therefore, a missing satellite provider does **not** artificially add zero risk to the result.

Satellite data is intentionally optional until a real satellite-risk/NDVI provider is connected. The application never fabricates satellite observations.

## 6. Safety behavior

The visual model reports visible evidence rather than diagnosing a disease with certainty. The decision agent must:

- distinguish observation from diagnosis;
- request field verification when evidence is weak;
- avoid invented measurements;
- avoid pesticide/fungicide dosage prescriptions;
- keep spoken farmer guidance short and practical.

## 7. Backward-compatible endpoints

Vision-only inspection remains available:

```text
POST /ai/multimodal/inspect
```

Evidence fusion remains available:

```text
POST /ai/multimodal/risk-fusion
```

The new end-to-end endpoint is:

```text
POST /ai/multimodal/inspect-and-decide
```
