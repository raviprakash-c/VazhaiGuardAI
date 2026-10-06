$ErrorActionPreference = "Stop"

$Region = "ap-south-1"
$Profile = "vazhaiguard"

Write-Host ""
Write-Host "========================================"
Write-Host "   VAZHAIGUARD INSPECTION S3 SETUP"
Write-Host "========================================"
Write-Host ""

Write-Host "[1/5] Checking AWS identity..."
$AccountId = (aws sts get-caller-identity --profile $Profile --query Account --output text).Trim()
if ($LASTEXITCODE -ne 0 -or -not $AccountId) {
    throw "Could not read AWS account ID. Run: aws sso login --profile $Profile"
}

$Bucket = "vazhaiguard-inspections-$AccountId"
Write-Host "AWS account: $AccountId"
Write-Host "Bucket:      $Bucket"
Write-Host "Region:      $Region"

Write-Host ""
Write-Host "[2/5] Checking bucket..."

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$headOutput = & aws s3api head-bucket --bucket $Bucket --profile $Profile 2>&1
$headExit = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference

if ($headExit -eq 0) {
    Write-Host "Bucket already exists and is accessible."
}
else {
    Write-Host "Bucket not accessible from this account. Creating it..."

    aws s3api create-bucket `
        --bucket $Bucket `
        --region $Region `
        --create-bucket-configuration LocationConstraint=$Region `
        --profile $Profile | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "S3 bucket creation failed. The bucket may already exist in another AWS account/region, or the current AWS identity may not have s3:CreateBucket permission."
    }

    Write-Host "Bucket created successfully."
}

Write-Host ""
Write-Host "[3/5] Configuring private access..."

aws s3api put-public-access-block `
    --bucket $Bucket `
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true `
    --profile $Profile

if ($LASTEXITCODE -ne 0) {
    throw "Failed to configure S3 public-access blocking."
}

Write-Host ""
Write-Host "[4/5] Configuring encryption and versioning..."

# AWS CLI shorthand avoids PowerShell JSON quoting problems.
aws s3api put-bucket-encryption `
    --bucket $Bucket `
    --server-side-encryption-configuration Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=AES256}}] `
    --profile $Profile

if ($LASTEXITCODE -ne 0) {
    throw "Failed to configure S3 server-side encryption."
}

aws s3api put-bucket-versioning `
    --bucket $Bucket `
    --versioning-configuration Status=Enabled `
    --profile $Profile

if ($LASTEXITCODE -ne 0) {
    throw "Failed to enable S3 versioning."
}

Write-Host ""
Write-Host "[5/5] Saving application configuration..."

$env:VAZHAIGUARD_S3_BUCKET = $Bucket
$env:VAZHAIGUARD_S3_PREFIX = "inspections"

[Environment]::SetEnvironmentVariable("VAZHAIGUARD_S3_BUCKET", $Bucket, "User")
[Environment]::SetEnvironmentVariable("VAZHAIGUARD_S3_PREFIX", "inspections", "User")

# Final verification
aws s3api head-bucket --bucket $Bucket --profile $Profile | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Final S3 bucket verification failed."
}

Write-Host ""
Write-Host "========================================"
Write-Host " S3 INSPECTION STORAGE IS READY"
Write-Host "========================================"
Write-Host "Bucket: $Bucket"
Write-Host "Region: $Region"
Write-Host "Encryption: AES256"
Write-Host "Versioning: Enabled"
Write-Host "Public access: Blocked"
Write-Host ""
Write-Host "IMPORTANT: Restart the backend so it reads VAZHAIGUARD_S3_BUCKET."
