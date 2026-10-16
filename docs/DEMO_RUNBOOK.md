# VazhaiGuardAI local demo runbook

This runbook is for a repeatable local demonstration. It does not create AWS resources or change shared farm data.

## 1. Refresh the isolated checkout safely

Use the dedicated worktree at `D:\\VazhaiGuardAI-coordinate-check`; do not switch branches in the main `D:\\VazhaiGuardAI` checkout.

```powershell
Set-Location D:\\VazhaiGuardAI-coordinate-check
git status --short
```

If the status is clean, fetch and check the intended branch:

```powershell
git fetch origin
git switch --detach origin/fix/satellite-auto-acquisition-coordinates
git log -1 --oneline
```

If `git status --short` shows local edits, preserve them and do not switch until they are safely saved.

## 2. Set demo-only environment variables

Set these before starting the backend. The S3 bucket name is the existing Team 53 bucket; actual upload/write access still depends on IAM and the bucket policy.

```powershell
$env:AWS_PROFILE = "vazhaiguard"
$env:AWS_REGION = "ap-south-1"
$env:VAZHAIGUARD_DYNAMODB_TABLE = "fai-tce-team53-vazhaiguard-farms"
$env:VAZHAIGUARD_S3_BUCKET = "fai-tce-team53-vazhaiguard-inspections-529170326035"
$env:VAZHAIGUARD_S3_PREFIX = "inspections"
$env:VAZHAIGUARD_LOCAL_VISION_ENABLED = "true"
$env:VAZHAIGUARD_LOCAL_VISION_MODEL = "qwen2.5vl:3b"
$env:OLLAMA_BASE_URL = "http://127.0.0.1:11434"
$env:OLLAMA_TIMEOUT_SECONDS = "90"
aws sso login --profile vazhaiguard
aws sts get-caller-identity --profile vazhaiguard
```

Verify that the returned AWS account is the approved Team 53 account. Never paste credentials into source control or the frontend. Rotate any CDSE secret previously exposed in chat before setting new values locally.

## 3. Validate before the demo

From the repository root:

```powershell
Set-Location D:\\VazhaiGuardAI-coordinate-check\\backend
$env:PYTHONPATH = (Get-Location).Path
python -m compileall -q .
python -m unittest discover -s .\\tests -p "test_*.py" -v
```

Verify Ollama and the configured model:

```powershell
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

Confirm `qwen2.5vl:3b` appears in the response. If not, do not begin a live vision demo until the local model is available or the approved Bedrock vision fallback is verified.

## 4. Start the backend on port 8001

Port 8000 may already be used by another local instance, so use a separate demo port.

```powershell
Set-Location D:\\VazhaiGuardAI-coordinate-check\\backend
$env:PYTHONPATH = (Get-Location).Path
python -m uvicorn app.main:app --reload --port 8001
```

In a second PowerShell window, verify:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
Invoke-RestMethod http://127.0.0.1:8001/ai/multimodal/health
Invoke-RestMethod http://127.0.0.1:8001/agent/feedback/health
```

Use `http://127.0.0.1:8001/docs` to inspect the API routes.

## 5. Start the frontend

```powershell
Set-Location D:\\VazhaiGuardAI-coordinate-check\\frontend
$env:VITE_API_BASE_URL = "http://127.0.0.1:8001"
npm ci
npm run dev -- --host 127.0.0.1
```

Open the local URL printed by Vite.

## 6. Demo scenario

1. Select an existing, approved, farmer-confirmed farm.
2. Upload a crop photo and run the inspection.
3. Show the visual observations, risk level, explanation, available evidence sources, and next action.
4. Explain that satellite evidence is periodic farm-level context and SoilGrids is coarse soil context—not a plant-level diagnosis or laboratory measurement.
5. Record farmer feedback and submit a new photo for reinspection.
6. Compare the new risk with the previous baseline.
7. Demonstrate graceful fallback if satellite, soil, Bedrock, or S3 is unavailable. Report the actual source status; do not label stored sample data as live output.

## 7. Known limitations to check

- CDSE credentials and a usable satellite scene are not guaranteed; cloud cover and provider availability can prevent a live result.
- Bedrock requires valid SSO credentials, model access, and quota.
- The S3 bucket's encryption and stored photo objects were verified, but this role could not verify the bucket public-access block and S3 write permission. Ask the FAI administrator to confirm security settings before public use.
- Inspection history persistence and photo storage are reported separately; verify the response fields `inspection_history` and `inspection_storage`.
- This local runbook does not establish a public deployment. Do not create EC2, ECS, ECR, CloudFront, or additional buckets just for a local demo.
