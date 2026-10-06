$ErrorActionPreference = "Stop"

$Region = "ap-south-1"
$AccountId = (aws sts get-caller-identity --profile vazhaiguard --query Account --output text).Trim()
if (-not $AccountId) {
    throw "Could not read AWS account ID. Confirm: aws sso login --profile vazhaiguard"
}

$Bucket = "vazhaiguard-inspections-$AccountId"
Write-Host "Creating/validating S3 bucket: $Bucket"

$exists = $true
try {
    aws s3api head-bucket --bucket $Bucket --profile vazhaiguard | Out-Null
} catch {
    $exists = $false
}

if (-not $exists) {
    aws s3api create-bucket --bucket $Bucket --region $Region --create-bucket-configuration LocationConstraint=$Region --profile vazhaiguard | Out-Null
}

aws s3api put-public-access-block --bucket $Bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true --profile vazhaiguard | Out-Null
aws s3api put-bucket-encryption --bucket $Bucket --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' --profile vazhaiguard | Out-Null
aws s3api put-bucket-versioning --bucket $Bucket --versioning-configuration Status=Enabled --profile vazhaiguard | Out-Null

$env:VAZHAIGUARD_S3_BUCKET = $Bucket
[Environment]::SetEnvironmentVariable("VAZHAIGUARD_S3_BUCKET", $Bucket, "User")

Write-Host ""
Write-Host "S3 inspection bucket is ready: $Bucket"
Write-Host "Restart the backend after running this script."
