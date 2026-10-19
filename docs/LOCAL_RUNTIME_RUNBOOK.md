# Local API and end-to-end smoke runbook

This runbook is for the Windows development checkout at `D:\\VazhaiGuardAI`. It does not deploy anything, alter Git state, or create inspection records during the default smoke test.

## 1. Start from a fresh PowerShell window

Use the repository's existing virtual environment. Do not create a new environment just to run this check.

```powershell
Set-Location D:\\VazhaiGuardAI
if (-not (Test-Path '.\\.venv\\Scripts\\python.exe')) {
    throw 'Expected repository virtual environment .venv was not found; stop and locate the existing environment before installing anything.'
}
.\\.venv\\Scripts\\Activate.ps1
python --version
python -m pip show uvicorn
```

If `pip show uvicorn` reports that it is not installed, stop and inspect the project's existing requirements/environment before installing packages. Do not upgrade or replace dependencies as a troubleshooting shortcut.

## 2. Refresh AWS SSO before starting the backend

The backend may call Bedrock during voice registration or decision generation. An already-running process may continue using expired credentials, so restart it after the SSO session is refreshed.

```powershell
aws sso login --profile vazhaiguard
aws sts get-caller-identity --profile vazhaiguard
$env:AWS_PROFILE = 'vazhaiguard'
$env:AWS_REGION = 'ap-south-1'
$env:AWS_DEFAULT_REGION = 'ap-south-1'
```

The STS command should succeed. Never print or paste SSO cache files, tokens, access keys, or secret values.

## 3. Check port 8000 before starting the API

```powershell
$listener = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    $listener | Select-Object LocalAddress, LocalPort, OwningProcess
    Write-Host 'Port 8000 is already listening. Check the existing process before starting another server.'
} else {
    Write-Host 'Port 8000 is free.'
}
```

If port 8000 is already listening, do not kill the process automatically. Identify whether it is the existing VazhaiGuardAI server first.

## 4. Start the backend in this terminal

Only run this if port 8000 is free. Keep this terminal open while testing.

```powershell
Set-Location D:\\VazhaiGuardAI\\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Expected startup output indicates Uvicorn is running on `http://127.0.0.1:8000`. If startup fails, preserve the first traceback and resolve that error before continuing; do not treat an unreachable API as a passing smoke test.

## 5. Run read-only checks in a second PowerShell terminal

```powershell
Set-Location D:\\VazhaiGuardAI
.\\.venv\\Scripts\\python.exe .\\backend\\scripts\\live_smoke_test.py
```

The default runner checks the API root and health, multimodal/satellite/soil/inspection health interfaces, and whether the configured Qwen model is listed by Ollama. `SKIP` means a live operation was deliberately not requested; `DEGRADED` means an interface responded but its provider is not ready. Neither is proof of a complete end-to-end inspection.

## 6. Verify local image inference without writing an inspection

Use a non-sensitive image already present on the machine:

```powershell
.\\.venv\\Scripts\\python.exe .\\backend\\scripts\\live_smoke_test.py --run-local-vision --image 'D:\\VazhaiGuardAI\\banana_test.jpg'
```

This calls Ollama inference. The runner suppresses the returned model text from its summary. A successful command-line `ollama run` alone confirms the model responds, but this runner additionally verifies the application's Ollama HTTP integration.

## 7. Troubleshoot the API connection failure

If the smoke runner says the remote server cannot be reached:

1. Confirm the Uvicorn terminal is still running and did not exit with a traceback.
2. In a second terminal, run `Invoke-RestMethod http://127.0.0.1:8000/health`.
3. Check `Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue`.
4. If no listener exists, fix the backend startup failure before rerunning the smoke test.
5. If the API responds but a provider reports an error, diagnose that provider separately. For Bedrock, refresh SSO and restart the backend process; do not assume that listing available models proves inference permission.

## 8. Real inspection/reinspection is a separate, write-capable step

Do not run `--run-inspection` or `--run-reinspection` as part of a routine read-only check. They can upload a photo and append inspection history. Only use those flags with a registered farm, a non-sensitive crop image, and the farm/boundary confirmed in the application. A smoke-test flag is not an independent verification of farmer consent or parcel correctness.

## Completion criteria

A local end-to-end validation is complete only when the API is reachable, the relevant service health checks are understood, actual Qwen image inference passes, Bedrock inference succeeds when required, and a deliberate inspection/reinspection returns the documented contract. Report provider setup gaps as degraded rather than claiming the whole system is complete.
