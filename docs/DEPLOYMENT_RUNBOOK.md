# VazhaiGuardAI deployment runbook

This is a deployment checklist for the current prototype, not proof that cloud deployment has already happened. Validate locally and deploy into a dedicated development environment before any public launch.

## Recommended minimum architecture

- **Frontend:** build the React/Vite app and host the static `dist/` output on a private S3 bucket behind CloudFront (or use a static hosting provider for the hackathon).
- **API:** FastAPI on AWS App Runner or ECS Fargate. App Runner is the simpler managed option; ECS is better when the app needs custom networking, multiple containers, or more control.
- **Existing data:** keep using the existing DynamoDB farms table only if the account owner approves. Do not create a duplicate table without checking the current data and access patterns.
- **Photos/artifacts:** private S3 bucket, server-side encryption, block public access, short-lived presigned URLs if browser upload/download is needed.
- **Models:** Amazon Bedrock for hosted vision/text models. Local Ollama/Qwen only works when the API host can actually reach Ollama; a cloud container's `127.0.0.1:11434` is not the developer laptop. For cloud deployment set local vision off unless Ollama is deployed as a reachable service.
- **Satellite:** Copernicus Data Space credentials in AWS Secrets Manager; never in source control or frontend variables.
- **Logs:** CloudWatch logs and alarms, with request IDs and secrets/PII redacted.

## Required AWS resources

### Required for a minimal cloud demo
1. App Runner service **or** ECS Fargate service + ECR image repository.
2. CloudWatch log group, retention period, and basic error/5xx alarm.
3. IAM execution/runtime role with least-privilege permissions.
4. Secrets Manager secret for CDSE client ID/secret and any backend-only API secrets.
5. Existing DynamoDB table access (read/write actions restricted to the table and required indexes).
6. Bedrock model access enabled for the chosen model/inference profile in the deployment region.
7. HTTPS API URL and frontend API base URL configuration.

### Required only if storing uploaded images/results in S3
- Private S3 bucket with block-public-access enabled, encryption, lifecycle expiration for temporary uploads, and CORS limited to the deployed frontend origin.
- IAM permissions restricted to the specific bucket/prefix.

### Frontend hosting
- For a quick prototype: static hosting provider or S3 + CloudFront.
- For S3 + CloudFront: private bucket, CloudFront Origin Access Control, HTTPS, SPA fallback to `index.html`, and cache policy that does not cache user-specific API responses.
- Configure the frontend's API base URL at build time; never put AWS credentials, Bedrock credentials, or CDSE secrets in Vite `VITE_*` variables.

## Environment configuration

Set these as runtime environment variables or inject them from Secrets Manager; do not commit a real `.env` file.

- `AWS_REGION=ap-south-1`
- `VAZHAIGUARD_DYNAMODB_TABLE=fai-tce-team53-vazhaiguard-farms` only if approved for this environment
- `CDSE_CLIENT_ID` and `CDSE_CLIENT_SECRET` from Secrets Manager
- `VAZHAIGUARD_LOCAL_VISION_ENABLED=false` for a cloud API unless Ollama is separately reachable from the service
- `VAZHAIGUARD_VISION_MODEL=apac.amazon.nova-lite-v1:0`
- `VAZHAIGUARD_VISION_FALLBACK_MODEL=apac.amazon.nova-pro-v1:0`
- `VAZHAIGUARD_TEXT_MODEL=mistral.ministral-3-8b-instruct`
- `VAZHAIGUARD_S3_BUCKET` only when a bucket is configured

Use the AWS service role in deployed environments instead of a developer's SSO profile. Do not configure `AWS_PROFILE=vazhaiguard` inside a cloud service.

## Before deploying

1. Rotate any CDSE credential that has ever been pasted into chat, logs, or committed.
2. Confirm the DynamoDB table owner, key schema, indexes, and whether this is a shared team table.
3. Confirm Bedrock model access and inference-profile availability in the target region/account.
4. Confirm frontend API URL, CORS allowlist, authentication, request size limits, and rate limits.
5. Ensure uploads are private and have a retention policy; do not log image bytes or secrets.
6. Run backend unit tests, Python compile check, and frontend production build.
7. Run a health check and one end-to-end inspection with a registered farmer-confirmed farm. Satellite imagery may legitimately be unavailable due to cloud cover, scene availability, or provider errors; the UI must show unavailable rather than fabricate evidence.
8. Test the deployment with a non-production farm/account before presenting it publicly.

## Cost and safety controls

- Start with one small API instance and scale only after measuring latency and memory. Keep the API at zero/low minimum capacity where the selected service supports it.
- Set AWS Budgets alerts before enabling paid model calls or always-on compute. Bedrock inference, CloudWatch ingestion, NAT gateways, load balancers, storage, and data transfer may incur charges.
- Prefer a public managed outbound path where appropriate rather than adding a NAT Gateway by default; decide based on the service's networking and security needs.
- Configure CloudWatch retention and S3 lifecycle expiration to prevent unbounded storage/log costs.
- Use least-privilege IAM and separate dev/prod resources. Do not make DynamoDB or S3 public.
- Treat satellite indices as farm/zone-level context, not individual-tree diagnosis. Require farmer-confirmed boundaries; field inspection remains authoritative.

## Not yet confirmed by this guide

This file does not create AWS resources, deploy code, prove live provider credentials, or establish a public production-ready service. Deployment requires the account owner to approve resources, billing, IAM permissions, and the target environment.
