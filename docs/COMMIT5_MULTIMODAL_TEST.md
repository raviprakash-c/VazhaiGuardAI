# Commit 5 — Multimodal crop inspection

This module adds the next complete prototype loop:

**Farmer photo → approved Bedrock vision model → visual evidence → unified risk score → Ministral 8B action response → Tamil voice playback**

## 1. Configure the approved models

PowerShell:

```powershell
$env:AWS_PROFILE="vazhaiguard"
$env:AWS_REGION="ap-south-1"
$env:VAZHAIGUARD_TEXT_MODEL="mistral.ministral-3-8b-instruct"
$env:VAZHAIGUARD_VISION_MODEL="amazon.nova-lite-v1:0"
$env:VAZHAIGUARD_VISION_FALLBACK_MODEL="amazon.nova-pro-v1:0"
```

If the challenge account exposes different approved Nova model IDs, set those IDs here without changing application code.

## 2. Start the backend

```powershell
cd D:\VazhaiGuardAI\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Health checks:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/ai/multimodal/health -UseBasicParsing | Select-Object -ExpandProperty Content
```

The response should show the primary vision model, fallback vision model, and Ministral decision model.

## 3. Start the frontend

```powershell
cd D:\VazhaiGuardAI\frontend
npm run build
npm run dev
```

Open `/inspect` from the sidebar using **Crop Photo Check**.

## 4. Test the farmer flow

1. Take a clear photo of a banana leaf/plant.
2. Press **Inspect with AI**.
3. Verify that visual observations, stress signals, confidence, and recommended checks appear.
4. Verify the unified risk score and signal cards.
5. Press **தமிழில் கேளுங்கள்** and confirm the response is spoken by the existing device/browser Tamil voice path.
6. Continue to **AI Copilot** for the normal hands-free voice conversation.

## 5. Important safety behavior

The visual model is instructed to report visible evidence rather than confidently diagnose a disease. When evidence is weak, it asks for a field verification instead of inventing a treatment or dosage.

Satellite input is optional in this commit. When a real satellite risk layer is available, its score can be supplied to `/ai/multimodal/risk-fusion` and will be fused with visual and weather signals.
