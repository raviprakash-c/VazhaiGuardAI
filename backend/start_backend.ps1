$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================"
Write-Host "       VAZHAIGUARD AI BACKEND"
Write-Host "========================================"
Write-Host ""

# --------------------------------------------------
# PROJECT
# --------------------------------------------------

Set-Location "D:\VazhaiGuardAI\backend"

# --------------------------------------------------
# AWS CONFIG
# --------------------------------------------------

$env:AWS_PROFILE = "vazhaiguard"
$env:AWS_REGION = "ap-south-1"
$env:VAZHAIGUARD_DYNAMODB_TABLE = "fai-tce-team53-vazhaiguard-farms"

Write-Host "[1/5] AWS profile:"
Write-Host $env:AWS_PROFILE

Write-Host ""
Write-Host "[2/5] Checking AWS login..."

aws sts get-caller-identity --profile vazhaiguard

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "AWS SSO session expired or unavailable."
    Write-Host "Running AWS SSO login..."
    Write-Host ""

    aws sso login --profile vazhaiguard

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "AWS SSO login failed."
        exit 1
    }
}

# --------------------------------------------------
# PYTHON ENVIRONMENT
# --------------------------------------------------

Write-Host ""
Write-Host "[3/5] Activating Python environment..."

& ".\.venv\Scripts\Activate.ps1"

# --------------------------------------------------
# DYNAMODB
# --------------------------------------------------

Write-Host ""
Write-Host "[4/5] Checking DynamoDB..."

python -c "from services.dynamodb_service import DYNAMODB_TABLE_NAME, check_dynamodb_table; print('TABLE:', DYNAMODB_TABLE_NAME); print('DDB:', check_dynamodb_table())"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "DynamoDB check failed."
    exit 1
}

# --------------------------------------------------
# FASTAPI
# --------------------------------------------------

Write-Host ""
Write-Host "[5/5] Starting FastAPI..."
Write-Host ""
Write-Host "Backend:"
Write-Host "http://127.0.0.1:8000"
Write-Host ""
Write-Host "Swagger:"
Write-Host "http://127.0.0.1:8000/docs"
Write-Host ""

python -m uvicorn app.main:app --reload --port 8000