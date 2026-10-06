# VazhaiGuardAI — S3 Inspection Evidence

Every crop inspection photo becomes durable evidence.

Flow: Farmer photo -> Amazon S3 -> DynamoDB inspection metadata -> Bedrock analysis -> incident/action decision.

The S3 object remains private.

## Setup

Run from the repository root in PowerShell:

aws sso login --profile vazhaiguard
.\scripts\setup_s3.ps1

The script creates a private bucket named vazhaiguard-inspections-<AWS-account-id> and enables Block Public Access, SSE-S3 encryption, and versioning.

## Runtime configuration

AWS_PROFILE=vazhaiguard
AWS_REGION=ap-south-1
VAZHAIGUARD_S3_BUCKET=<bucket-name>
VAZHAIGUARD_S3_PREFIX=inspections

The existing DynamoDB table remains fai-tce-team53-vazhaiguard-farms.

## API flow

Normal inspection: POST /ai/multimodal/inspect-and-decide

When farm_id is supplied, the backend validates the photo, runs Bedrock vision, fuses evidence, evaluates the decision, builds the incident/action plan, uploads the original photo to S3, appends inspection metadata to DynamoDB, and returns inspection_id plus storage status.

Reinspection: POST /ai/inspections/reinspect

The backend loads the farm, links the new inspection to the latest inspection, re-runs the evidence pipeline, stores the new photo, and appends the new inspection to history.

History: GET /ai/inspections/{farm_id}/history

Health: GET /ai/inspections/health

## Safety behavior

If S3 is temporarily unavailable, the decision is still returned and inspection_storage.status is storage_error.

If no bucket is configured, inspection_storage.status is not_configured.

The farmer-facing decision can still be generated, but durable evidence storage is not complete until S3 is configured.

## IAM

The backend needs s3:HeadBucket, s3:PutObject, and s3:GetObject on the inspection bucket.

Do not make the inspection bucket public.
