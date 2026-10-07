# VazhaiGuard AI — PROJECT HANDOFF

> **Purpose:** This file is the handoff document for continuing VazhaiGuard AI in a new chat/session without losing the project architecture, decisions, repository state, AWS setup, completed prototype work, known limitations, and the next implementation sequence.
>
> **Handoff date:** 2026-10-05
> **Repository:** `raviprakash-c/VazhaiGuardAI`
> **Current development branch:** `prototype-commit13-cdse-farm-layers`
> **Current branch HEAD:** current branch head contains the free Leaflet/OSM map hardening and satellite-layer display
> **Latest commit:** `feat: harden free farm map and satellite display`

---

## 1. Project in one sentence

**VazhaiGuard AI is a Tamil-first, multimodal and agentic banana-farm decision assistant that combines farmer voice/photo evidence, live weather, farmer-confirmed farm location/boundary, periodic satellite evidence, and future soil evidence into a deterministic evidence-fusion risk assessment, then uses Amazon Bedrock Ministral 8B to turn the structured evidence into simple, actionable farmer guidance and continues the loop through feedback and re-inspection.**

The system must not pretend that one AI model can see everything. Each evidence source has a defined role:

> **Satellite tells us what may be happening across the farm; the farmer's photo tells us what is visibly happening at plant level; weather and soil explain environmental conditions; the evidence-fusion engine decides how much trust to give each source; Ministral turns the structured evidence into an understandable farmer action.**

This separation is a core project principle and should be preserved.

---

# 2. Main project goals

The project is intended to be a **heavyweight but meaningful multimodal + agentic AI prototype**, not a collection of disconnected AI demos.

### Farmer goals

- Farmer can interact in **Tamil** first, with English as a fallback/secondary language.
- Farmer should not need to understand AI, JSON, model names, confidence scores, or technical terminology.
- The UI should use large controls, simple Tamil, clear risk states, camera/photo actions, and voice playback.
- The system should answer the practical question:

  **“What should I do now?”**

- The system should not stop after one answer. It should remember the current action state, receive farmer feedback, decide the next state, and request a new photo when verification/reinspection is useful.

### AI goals

- Multimodal observation from crop photos.
- Weather-aware risk reasoning.
- Farm/location-aware reasoning.
- Periodic satellite evidence using Sentinel-2 / Dynamic World through Google Earth Engine.
- Deterministic evidence fusion before LLM reasoning.
- Ministral 8B as the main farmer decision/explanation model.
- Vision model primary/fallback strategy using Bedrock multimodal models.
- Agentic state machine: observe → fuse → decide → verify → reflect → wait/recheck.
- Evidence freshness and temporal conflict handling.
- Closed-loop reinspection using a new farmer-supplied image.

---

# 3. Important architectural principle

## Do NOT build this as:

`photo -> LLM -> disease -> answer`

That would be too weak and unsafe for the intended project.

## Build it as:

```text
Farmer
  |
  | Tamil voice / text / photo
  v
Farmer Interaction Layer
  |
  +--> Voice / browser-device speech
  |
  +--> Crop photo
  |
  +--> Farm context / confirmed boundary
  v
Agent Orchestrator
  |
  +--> OBSERVE
  |      |
  |      +--> Vision evidence (Nova Lite -> Nova Pro fallback)
  |      +--> Weather evidence
  |      +--> Farm/location evidence
  |      +--> Satellite evidence (Sentinel-2 + Dynamic World)
  |      +--> Future soil evidence
  |
  +--> EVIDENCE QUALITY
  |      |
  |      +--> freshness
  |      +--> observation age
  |      +--> cloud quality
  |      +--> temporal conflict
  |      +--> crop-status consistency
  |
  +--> FUSE
  |      |
  |      +--> deterministic weighted risk
  |      +--> evidence confidence
  |      +--> signal-level scores
  |
  +--> DECIDE
  |      |
  |      +--> Ministral 8B
  |      +--> structured farmer action
  |
  +--> VERIFY / REFLECT
  |      |
  |      +--> field verification
  |      +--> farmer feedback
  |      +--> recheck timing
  |      +--> new photo
  |      +--> compare current vs previous risk
  |
  +--> WAIT / NEXT TURN
         |
         +--> farmer speaks/acts again
```

The deterministic evidence layer is important because the LLM should **not** decide whether old satellite imagery is trustworthy or override a temporal conflict by itself.

---

# 4. Multimodal model strategy

The project uses several model capabilities rather than forcing one model to do every job.

## Current intended model roles

### Vision / image inspection

Primary:

```text
apac.amazon.nova-lite-v1:0
```

Fallback:

```text
apac.amazon.nova-pro-v1:0
```

The backend uses the Bedrock Converse API and tries the primary vision model first, then the fallback if the primary fails.

### Farmer decision / action generation

Current text decision model:

```text
mistral.ministral-3-8b-instruct
```

This model receives structured evidence rather than raw uncontrolled evidence and converts it into farmer-friendly action.

### Other Bedrock models available in the configured region

The AWS account currently exposed these relevant model IDs during project testing:

```text
mistral.ministral-3-3b-instruct
mistral.ministral-3-8b-instruct
mistral.ministral-3-14b-instruct
amazon.nova-micro-v1:0
amazon.nova-lite-v1:0
amazon.nova-pro-v1:0
amazon.nova-2-lite-v1:0
```

Many other multimodal models were also visible in `list-foundation-models`. Do not switch models just because they are available. Keep the current architecture stable unless a measured improvement is required.

### Important AWS discovery result

Direct on-demand invocation of:

```text
amazon.nova-lite-v1:0
```

returned:

```text
Invocation of model ID amazon.nova-lite-v1:0 with on-demand throughput isn’t supported.
Retry your request with the ID or ARN of an inference profile that contains this model.
```

The working inference profile is:

```text
apac.amazon.nova-lite-v1:0
```

and this was successfully tested with Bedrock Converse, returning `OK`.

Available APAC/Global Nova inference profiles discovered during testing:

```text
apac.amazon.nova-micro-v1:0
apac.amazon.nova-lite-v1:0
apac.amazon.nova-pro-v1:0
global.amazon.nova-2-lite-v1:0
```

**Do not revert the Nova vision configuration to the direct on-demand model IDs.** Use the working inference-profile IDs.

---

# 5. AWS access configuration

The local development setup used:

```text
AWS profile: vazhaiguard
AWS region: ap-south-1
```

Backend AWS session is configured around the `vazhaiguard` IAM Identity Center profile and `ap-south-1`.

The repository backend also references the existing Team 53 DynamoDB table:

```text
fai-tce-team53-vazhaiguard-farms
```

Do not put AWS access keys, secret keys, SSO tokens, or other credentials into this file or into Git.

### Basic AWS verification

```powershell
aws configure get region --profile vazhaiguard
aws sts get-caller-identity --profile vazhaiguard
```

Expected configured region:

```text
ap-south-1
```

### Check Bedrock models

```powershell
aws bedrock list-foundation-models `
  --region ap-south-1 `
  --profile vazhaiguard `
  --query "modelSummaries[?contains(modelId, 'ministral') || contains(modelId, 'nova')].modelId" `
  --output text
```

### Check inference profiles

```powershell
aws bedrock list-inference-profiles `
  --region ap-south-1 `
  --profile vazhaiguard `
  --query "inferenceProfileSummaries[?contains(inferenceProfileName, 'Nova')].[inferenceProfileId,inferenceProfileName,status]" `
  --output text
```

### Known successful Bedrock smoke test

```powershell
.\.venv\Scripts\python.exe -c "import boto3; c=boto3.Session(profile_name='vazhaiguard',region_name='ap-south-1').client('bedrock-runtime'); r=c.converse(modelId='apac.amazon.nova-lite-v1:0',messages=[{'role':'user','content':[{'text':'Reply with exactly OK'}]}],inferenceConfig={'maxTokens':20,'temperature':0}); print(r['output']['message']['content'])"
```

Successful result previously observed:

```text
[{'text': 'OK'}]
```

---

# 6. Backend structure and responsibilities

The backend is Python/FastAPI based.

Important areas include:

```text
backend/
  app/
    main.py
    agents/
  agents/
    orchestrator.py
    farm_profile_agent.py
  services/
    bedrock_service.py
    multimodal_service.py
    ...
  routes/
    ...
  schemas/
    ...
  data/
    banana_vision_master/
```

The current repository contains the banana vision dataset area, including:

```text
backend/data/banana_vision_master/03_disease_detection
backend/data/banana_vision_master/06_nutrient_deficiency
backend/data/banana_vision_master/disease_detection
```

The repository also contains challenge/geospatial data under:

```text
backend/challenge_data/
```

including GeoJSON boundaries and ground-truth point data.

### Important dataset principle

The presence of a dataset does **not** mean the current production flow is training or directly querying a disease classifier from that dataset.

Current multimodal inspection primarily uses Bedrock vision for visual evidence extraction. The local banana datasets are an important future/validation asset for measured disease/nutrient detection, benchmarking, and possible specialized model work.

Do not claim that the current system has trained a custom banana disease model unless that has actually been implemented and evaluated.

---

# 7. Farm profile and location

Farmer registration/farm setup has been built into the project.

The farm profile can include:

- farmer information
- banana crop information
- variety
- planting age/status
- acreage/registered area
- farmer-confirmed location
- farmer-confirmed boundary
- mapped area
- perimeter
- parcel/context metadata where available

Farm location and boundary are stored using the existing DynamoDB-backed farm flow.

The project deliberately treats the farm boundary as **farmer-confirmed**, not as a magically inferred legal property boundary.

This is important for viva/presentation:

> “The system asks the farmer to confirm the farm location and boundary. It does not claim legal ownership from a map.”

---

# 8. Weather module

The project already has a live weather dashboard and weather-aware action planning.

Weather is treated as environmental evidence, not as a final diagnosis.

The weather signal can include factors such as:

- rainfall probability
- precipitation
- wind/gust conditions
- temperature/heat conditions
- forecast window

Weather is passed into evidence fusion and can influence risk and recommended action.

Example reasoning:

```text
High rain probability + poor drainage evidence
        -> water/storm preparation becomes more important

High wind + vulnerable banana plants
        -> support/staking and storm preparation become more important
```

The final farmer message is generated from structured evidence rather than raw weather JSON.

---

# 9. Multimodal crop inspection

The farmer can take/select a crop photo from the browser.

The current vision service:

```text
services/multimodal_service.py
```

accepts an image and sends it to Bedrock using the configured vision model/fallback.

The visual result is structured into fields such as:

```json
{
  "observation": "...",
  "crop_visible": true,
  "stress_signals": [],
  "possible_causes": [],
  "urgency": "low|medium|high",
  "visual_confidence": 0.0,
  "needs_field_verification": true,
  "recommended_checks": [],
  "farmer_message": "..."
}
```

### Safety rule

The vision component must not confidently diagnose a disease from appearance alone.

It should use wording such as:

- possible
- visible
- may indicate
- needs field verification

It should not invent measurements, farm history, weather values, or treatment results.

It should not prescribe pesticide/fungicide dosage.

---

# 10. Unified Evidence Fusion / Risk Engine

This is one of the most important project modules.

The risk engine combines evidence rather than allowing one model to dominate.

Conceptually:

```text
Photo evidence
Weather evidence
Satellite evidence
Farm/context evidence
       |
       v
Evidence quality + freshness + temporal consistency
       |
       v
Deterministic weighted risk calculation
       |
       v
Risk score + level + evidence confidence + signals used
       |
       v
Ministral 8B
       |
       v
Farmer action
```

The unified risk result is designed to contain:

- overall risk score
- risk level
- individual signal scores
- evidence confidence
- effective weights
- freshness state
- temporal conflict state
- signals actually used

### Critical rule for satellite conflicts

Satellite imagery is **periodic, not live video**.

If a farmer plants new banana trees after the latest satellite observation, the satellite image may still show bare land.

Example:

```text
Satellite image: old / bare land
Farmer record: banana planted 3 months ago
Farmer photo: banana plants visibly present
```

The system must **not** say “there are no banana plants.”

Instead:

```text
satellite evidence = stale / temporally conflicting
current farmer/photo evidence = preferred
satellite weight = discounted or removed
```

This is a major viva point and a major correctness rule.

---

# 11. Satellite Evidence Service

The next-generation architecture uses real satellite evidence through **Google Earth Engine (GEE)** with Sentinel-2 and Dynamic World.

Current intended satellite stack:

```text
Google Earth Engine
        |
        +--> Sentinel-2 Surface Reflectance Harmonized
        |
        +--> Dynamic World crop/land-cover probability
        |
        +--> NDVI
        +--> NDRE
        +--> NDWI
        +--> recent-vs-baseline NDVI trend
        +--> observation age
        +--> cloud quality
        v
structured satellite evidence
```

The satellite layer is deliberately a **farm/zone-level evidence source**.

It is not a live camera.

It is not individual-tree disease diagnosis.

It cannot reliably see every individual banana plant at plant level.

### Intended satellite interpretation

Satellite can help answer:

- Is vegetation present?
- Is vegetation changing?
- Is the farm area generally stressed?
- Is the crop signal consistent across the farm/zone?
- Has vegetation vigor changed relative to a baseline?
- Is the observation too old/cloudy to trust strongly?

The farmer photo answers the plant-level question better.

---

# 12. Soil evidence — planned next evidence source

Soil evidence has **not yet been completed as a production-grade fused module**.

The intended next evidence source is SoilGrids or another verified soil-data provider, depending on final implementation and access requirements.

Potential soil evidence:

- soil texture
- organic carbon
- pH
- bulk density
- soil properties by depth

Important limitation:

> Satellite imagery alone should not be described as a complete soil analysis.

A proper project answer is:

```text
Satellite -> vegetation/environmental evidence
Soil dataset/sensor -> soil-property evidence
Weather -> atmospheric/forecast evidence
Farmer photo -> plant-level visual evidence
Farmer input -> local ground truth/context
```

These are fused only after evidence quality is assessed.

---

# 13. Farmer Risk Map UX

The project now includes a farmer-facing risk-map experience.

The map is deliberately designed for a farmer who may not understand technical dashboards.

The UX principles are:

- Tamil-first labels
- large visual states
- low jargon
- color + text redundancy
- voice playback
- camera shortcut
- clear next action
- evidence-source visibility
- no raw model JSON

### Critical map rule

Until true zone-specific evidence exists, the map must **not fabricate per-zone or per-plant risk**.

The current whole-farm boundary can represent the current whole-farm evidence risk.

It must be explained to the farmer as farm-level risk, not individual-tree risk.

This distinction is important for both safety and viva defense.

---

# 14. Agentic orchestration

The current agent health endpoint reports the intended flow:

```text
route -> observe -> fuse -> decide -> verify -> reflect -> wait
```

This is the agentic core.

### State-machine concept

Typical states include:

```text
observe
fuse
recommend_action
field_verification
capture_photo
recheck_due
reflect
wait
```

The agent should decide what evidence/action is needed next rather than simply returning a one-time answer.

### Current agent behavior

1. Receive farmer request or crop inspection.
2. Observe available evidence.
3. Fuse evidence deterministically.
4. Ask Ministral 8B to produce a structured farmer action.
5. Show/speak the action.
6. Wait for farmer feedback.
7. Move to a deterministic next state.
8. If reinspection is required, ask farmer for a new photo.
9. Inspect the new photo.
10. Re-run evidence fusion.
11. Compare current risk with the previous risk baseline.
12. Classify the trend.
13. Give the next simple farmer action.

---

# 15. Closed-loop reinspection

The latest branch adds the reinspection loop.

Current branch:

```text
prototype-commit11-closed-loop-reinspection
```

Latest commit:

```text
9882ebb — feat: connect farmer actions to reinspection UI
```

The intended flow is:

```text
Action
  -> farmer reports outcome
  -> agent says next state
  -> re-check becomes due
  -> farmer takes a new photo
  -> vision observes new image
  -> current evidence is fused
  -> current risk compared with previous risk
  -> trend = improving / stable / worsening / baseline
  -> next farmer action
```

Important safety rule:

The previous risk score is only a comparison baseline. It must never override fresh evidence.

The farmer explicitly supplies the new image. The system must not pretend that a crop changed without new evidence.

---

# 16. Farmer voice interaction

The intended user experience is hands-free and Tamil-first:

```text
Farmer speaks Tamil
      |
      v
Speech recognition / browser voice input
      |
      v
Farmer intent
      |
      v
Agent orchestrator
      |
      v
Evidence observation + fusion
      |
      v
Ministral 8B
      |
      v
Structured farmer action
      |
      v
Tamil response
      |
      v
Browser/device speech
      |
      v
Wait for farmer
      |
      v
Next turn
```

The project already uses the browser/device voice path for farmer-facing spoken responses.

Voice availability varies by browser/device. Therefore the UI must always provide a visible text fallback.

The system should never fail just because a Tamil browser voice is unavailable.

---

# 17. Current farmer-facing UI areas

The application has evolved into a farm operations dashboard with areas such as:

- Weather & Alerts
- Risk Analysis
- Storm Plan
- Crop Photo Check
- AI Copilot
- My Actions / farmer actions
- Farm risk map
- Farm registration/location workflow

The UI is intentionally designed around:

```text
Observe -> Understand -> Act -> Verify -> Continue
```

rather than:

```text
Dashboard -> technical charts -> raw AI output
```

---

# 18. What has already been completed

## Foundation

- Full-stack VazhaiGuard AI project initialized.
- Responsive application shell created.
- Weather dashboard implemented.
- Farm visualization and farm registration workflow implemented.
- Voice-based farmer registration added.
- Farm and banana acreage/context incorporated.
- Farm location and farmer-confirmed boundary workflow implemented.
- DynamoDB farm persistence integrated.

## Decision engine

- Weather-driven prioritized farmer action plan implemented.
- Time-aware actions and rationale implemented.
- Tamil/English action explanations implemented.
- Action checklist/local persistence implemented.

## Bedrock farmer copilot

- AWS Bedrock integration added.
- Ministral 8B configured as the main text decision model.
- Farmer-language-aware prompting implemented.
- Farm/decision context passed to the model.
- Spoken-friendly response design implemented.
- Bedrock health endpoint implemented.
- Safe HTTP fallback behavior implemented.

## Multimodal crop inspection

- Crop photo UI implemented.
- Bedrock vision integration implemented.
- Primary/fallback vision model architecture implemented.
- Structured visual observations implemented.
- Visual confidence and field-verification signals implemented.
- Vision + weather + optional satellite fusion architecture implemented.
- Ministral receives structured evidence for final farmer action.

## Evidence freshness

- Evidence freshness monitoring implemented.
- Photo/weather/farm/satellite temporal context represented.
- Temporal conflict detection implemented.
- Stale satellite evidence can be discounted.
- Newly planted banana vs old bare satellite image is explicitly handled as a temporal conflict.

## Unified risk

- Deterministic unified evidence risk engine implemented.
- Signal-level scores implemented.
- Freshness-adjusted weights implemented.
- Evidence confidence implemented.
- Standalone redundant risk route removed where it was no longer needed.

## Satellite

- Real satellite evidence service implemented on the satellite branch using Google Earth Engine.
- Sentinel-2 evidence added.
- Dynamic World evidence added.
- NDVI / NDRE / NDWI added.
- Recent-vs-baseline NDVI trend added.
- Observation age and cloud quality added.
- Satellite stress heuristic added with safety caveats.
- Satellite health/evidence APIs added.
- Farmer-confirmed farm location/boundary is used when available.
- Satellite evidence feeds the existing unified risk engine.
- Satellite failure/setup absence does not break photo + weather inspection.

## Farmer risk map

- Dedicated risk map navigation implemented.
- Whole-farm risk display implemented.
- Farmer-friendly low/watch/act-soon style states implemented.
- Actual evidence-source visibility implemented.
- Missing/disqualified satellite evidence is explained.
- No fake per-plant risk is generated.

## Agentic loop

- Agent orchestrator implemented.
- Health endpoint implemented.
- Route → observe → fuse → decide → verify → reflect → wait flow established.
- Farmer feedback endpoint implemented.
- Feedback states implemented, including done/not now/need help/check again.
- Deterministic next-state transitions implemented.
- Tamil-first My Actions flow implemented.
- Voice playback integrated into follow-up responses.

## Reinspection

- New-photo reinspection endpoint/UI implemented on the latest branch.
- Farmer can provide a new crop photo after feedback.
- New photo is inspected again.
- New evidence is fused with current weather and optional satellite/farm context.
- Previous risk is used as a comparison baseline.
- Risk trend can be classified as improving/stable/worsening/baseline.
- Farmer receives a new action and state.

---

# 19. Git branch / PR history relevant to the project

The project has intentionally been developed as sequential prototype branches.

| Stage | Branch / PR | Purpose | Status |
|---|---|---|---|
| Foundation | `prototype-latest` | Core application/weather/farm foundation | Existing base |
| Commit 3 | `prototype-commit3-action-engine` / PR #1 | Farmer action decision engine | PR exists |
| Commit 4 | `prototype-commit4-bedrock-ministral` / PR #2 | AWS Bedrock Ministral 8B copilot | PR exists |
| Commit 5 | `prototype-commit5-multimodal-inspection` / PR #3 | Multimodal crop inspection + risk fusion | PR exists |
| Commit 6 | `prototype-commit6-agentic-evidence-loop` | Agent orchestration/evidence loop | Implemented |
| Evidence freshness | `prototype-commit7-fresh-evidence-monitor` / PR #4 | Freshness + temporal conflicts | PR exists |
| Unified risk | `prototype-commit8-unified-risk-engine` / PR #5 | Deterministic evidence-fused risk | **Merged PR #5** |
| Risk map | `prototype-commit9-farmer-risk-map-ux` / PR #6 | Farmer-friendly risk map | Open PR |
| Follow-up | `prototype-commit10-agentic-followup-loop` / PR #7 | Farmer action feedback loop | Open PR |
| Reinspection | `prototype-commit11-closed-loop-reinspection` / PR #8 | New-photo closed-loop reinspection | Open PR |
| Satellite | `prototype-commit7-satellite-evidence` / PR #9 | Real Sentinel-2/GEE evidence fusion | Open PR |

### Important numbering note

There are two numbering systems:

- **Prototype commit branch numbers** describe the development sequence.
- **GitHub PR numbers** are independent GitHub pull-request numbers.

Do not assume “prototype commit 7” means “PR #7”.

---

# 20. Current repository state

As of this handoff, the latest developed branch is:

```text
prototype-commit11-closed-loop-reinspection
```

HEAD:

```text
9882ebb612804f55a517e7ca6c507b0f12226578
```

Latest commit:

```text
feat: connect farmer actions to reinspection UI
```

The GitHub branch exists and is based on the preceding agentic follow-up work.

The repository also contains the separate satellite branch:

```text
prototype-commit7-satellite-evidence
```

with an open PR that adds real GEE/Sentinel-2 evidence.

### Current GitHub PR state observed during handoff

- **PR #5:** merged — unified evidence risk engine.
- **PR #6:** open — farmer risk map/evidence UX.
- **PR #7:** open — farmer action feedback loop.
- **PR #8:** open — closed-loop crop reinspection.
- **PR #9:** open — real satellite evidence fusion with Sentinel-2/GEE.

Before merging anything in a future session, inspect the current PR/branch state again. Do not assume the PR state from this document remains unchanged.

---

# 21. How to start the backend locally

PowerShell:

```powershell
cd D:\VazhaiGuardAI\backend

(Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned) ; (& D:\VazhaiGuardAI\backend\.venv\Scripts\Activate.ps1)

.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Expected startup:

```text
Uvicorn running on http://127.0.0.1:8000
Application startup complete.
```

### Backend health

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/agent/health
```

Known successful response:

```json
{
  "status": "ok",
  "service": "agent-orchestrator",
  "flow": "route -> observe -> fuse -> decide -> verify -> reflect -> wait"
}
```

### Compile check

```powershell
cd D:\VazhaiGuardAI\backend
.\.venv\Scripts\python.exe -m compileall agents services schemas routes
```

### Import check

```powershell
.\.venv\Scripts\python.exe -c "from services.multimodal_service import analyze_crop_image; print('IMPORT OK')"
```

---

# 22. How to start the frontend locally

Open another PowerShell window:

```powershell
cd D:\VazhaiGuardAI\frontend
npm run dev
```

Do **not** run `npm run build` from `backend`. The frontend build command belongs in:

```text
D:\VazhaiGuardAI\frontend
```

Build validation:

```powershell
cd D:\VazhaiGuardAI\frontend
npm run build
```

A successful build previously completed with Vite after the TypeScript weather-null errors were fixed.

The large JavaScript chunk warning from Vite is a performance warning, not a build failure.

---

# 23. Recommended smoke-test order after opening a new chat

Always test in this order instead of changing many modules simultaneously.

### Step 1 — Git

```powershell
cd D:\VazhaiGuardAI
git status
git branch --show-current
git log --oneline -5
```

### Step 2 — AWS

```powershell
aws sts get-caller-identity --profile vazhaiguard
aws configure get region --profile vazhaiguard
```

### Step 3 — Backend compile

```powershell
cd D:\VazhaiGuardAI\backend
.\.venv\Scripts\python.exe -m compileall agents services schemas routes
```

### Step 4 — Backend health

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/agent/health
```

### Step 5 — Bedrock smoke test

Test the working inference profile:

```text
apac.amazon.nova-lite-v1:0
```

### Step 6 — Frontend build

```powershell
cd D:\VazhaiGuardAI\frontend
npm run build
```

### Step 7 — Browser vertical slice

Test:

```text
farm setup
  -> weather
  -> crop photo
  -> visual evidence
  -> unified risk
  -> Ministral farmer action
  -> My Actions
  -> farmer feedback
  -> reinspection photo
  -> new risk
  -> next action
```

### Step 8 — Satellite branch

When testing the satellite PR, separately verify:

```text
farmer-confirmed boundary
  -> GEE
  -> Sentinel-2 / Dynamic World
  -> indices/trend
  -> satellite evidence
  -> evidence freshness
  -> unified risk
  -> Ministral
```

Do not mark satellite as “live” simply because the API is queried live. The imagery itself is periodic and has an acquisition/observation date.

---

# 24. What is NOT finished yet

The system is already a strong prototype, but the following should not be falsely described as complete.

## A. Production-grade satellite validation

Need to validate:

- GEE authentication/configuration in the actual development environment.
- Correct farm geometry passed to GEE.
- Sentinel-2 observation selection.
- Cloud filtering.
- Observation age.
- Index calculations.
- Trend calculations.
- Dynamic World interpretation.
- Graceful behavior when no suitable image exists.
- Performance and quota behavior.

## B. Soil evidence integration

Still required:

```text
soil provider
  -> farm coordinates/boundary
  -> structured soil evidence
  -> quality/freshness handling
  -> unified risk engine
  -> farmer action
```

Do not add a fake soil score merely to make the dashboard look complete.

## C. Banana growth/stage analysis

The project should eventually distinguish:

- newly planted
- early establishment
- vegetative growth
- mature/fruiting stage
- harvest/late stage

The farmer-provided planting date/age is more reliable for the exact local crop age than an old satellite image.

Satellite can provide vegetation trend/context, not exact individual-tree age.

## D. Dataset-backed disease/nutrient validation

The repository contains banana disease and nutrient-deficiency image data, but the project still needs a deliberate evaluation path if a custom classifier is introduced.

Required future work:

```text
dataset audit
 -> labels/classes
 -> train/validation/test split
 -> baseline model
 -> precision/recall/F1/confusion matrix
 -> field-image validation
 -> compare with Bedrock vision
 -> decide whether specialized model improves the product
```

Do not add a custom model just because a dataset exists.

## E. Soil analysis

Satellite is not a replacement for ground soil testing.

If the project claims soil analysis, specify whether the result is:

- remote/modelled soil data,
- farmer-entered soil information,
- laboratory result,
- or sensor measurement.

The source must be visible in the evidence layer.

## F. Better zone-level risk

Current whole-farm risk must not be converted into fake zone heatmaps.

A future true zone system should use real spatial evidence, for example:

```text
farm polygon
 -> grid/management zones
 -> per-zone satellite evidence
 -> per-zone weather/context where possible
 -> farmer photos tagged to zone
 -> zone-level fusion
 -> zone-level risk
```

Only then should the map color separate zones.

## G. Long-term persistence of agent loops

The current closed loop uses local/UI state for some continuation behavior.

For production, the agent state/action/reinspection history should be persisted server-side with farm/user identifiers and timestamps.

## H. Evaluation and observability

Need a repeatable evaluation suite covering:

- vision correctness
- evidence freshness correctness
- satellite conflict handling
- risk calibration
- farmer action usefulness
- Tamil clarity
- voice fallback
- reinspection trend correctness
- latency
- AWS failure handling

---

# 25. Recommended next implementation sequence

Do not jump randomly between features. Continue in this order.

## NEXT 1 — Stabilize current PR #8 reinspection

Validate:

```text
inspect
 -> action
 -> feedback
 -> new photo
 -> reinspection
 -> current risk
 -> previous risk
 -> trend
 -> next action
```

Fix any real browser/API/state bugs before adding another major AI component.

## NEXT 2 — Complete/validate PR #9 satellite

Make the satellite path genuinely usable:

```text
farmer-confirmed farm
 -> GEE
 -> Sentinel-2
 -> Dynamic World
 -> NDVI/NDRE/NDWI
 -> observation age/cloud quality
 -> temporal conflict
 -> satellite evidence
 -> unified risk
```

## NEXT 3 — Soil evidence service

Add a verified soil source and structured soil evidence.

Keep soil independent from satellite so the evidence provenance is explicit.

## NEXT 4 — Evidence confidence and calibration

Improve deterministic fusion with:

```text
signal score
source reliability
freshness
conflict
coverage
confidence
```

The risk score should be explainable.

## NEXT 5 — Banana growth/stage module

Combine:

```text
farmer planting information
+
photo evidence
+
vegetation trend
+
optional field observations
```

Do not infer exact plant age from satellite alone.

## NEXT 6 — Dataset evaluation

Use the existing banana disease/nutrient dataset to benchmark specialized visual analysis.

Compare:

```text
Bedrock vision
vs
specialized banana model
vs
hybrid approach
```

Only adopt a specialized model if evaluation shows meaningful benefit.

## NEXT 7 — True spatial/zone risk

Only after enough evidence exists:

```text
farm boundary
 -> zones
 -> evidence per zone
 -> risk per zone
 -> map
 -> zone-specific farmer action
```

## NEXT 8 — Production-grade agent memory

Persist:

- farmer question
- observation timestamp
- evidence sources
- risk score
- action
- farmer feedback
- reinspection image reference
- new risk
- trend
- next state

## NEXT 9 — Evaluation dashboard

Add internal/administrator-only metrics, not farmer-facing technical clutter:

- evidence source usage
- average risk confidence
- reinspection trend accuracy
- model fallback frequency
- latency
- failed evidence sources
- satellite observation age
- action completion rate

## NEXT 10 — Final presentation/demo hardening

Prepare one deterministic end-to-end scenario:

```text
Tamil farmer question
 -> current weather
 -> farmer photo
 -> vision evidence
 -> satellite evidence
 -> evidence freshness
 -> unified risk
 -> Ministral 8B
 -> simple Tamil action
 -> farmer says “done”
 -> wait/recheck
 -> new photo
 -> new risk
 -> improvement/worsening
 -> next action
```

This is the strongest demonstration of the multimodal + agentic architecture.

---

# 26. Viva / presentation answers to remember

## “Is satellite imagery live?”

**No.** The system may query the latest available observation, but Sentinel-2 imagery is periodic. Each observation has an acquisition/observation date and cloud-quality constraints.

## “What if the farmer planted banana trees three months ago but the satellite image shows empty land?”

The system treats that as a temporal conflict. It does not conclude that the farm is empty. The farmer's current crop record and current plant photo are newer evidence, so stale satellite evidence is discounted.

## “Can satellite detect banana disease?”

Not reliably at individual-plant level in this architecture. Satellite provides farm/zone-level vegetation and environmental evidence. Plant-level visual symptoms come from the farmer's photo.

## “How do you identify risk?”

Risk is calculated by a deterministic evidence-fusion engine using the available signals, source quality, freshness, and temporal consistency. Ministral 8B does not invent the numerical risk; it converts the structured result into a farmer action.

## “Why use multiple models?”

Different models have different strengths. A multimodal vision model extracts image evidence, while Ministral 8B is used for structured farmer decision/explanation. Primary/fallback models improve resilience. The system is not dependent on one model for every task.

## “Why not let the LLM decide everything?”

Because evidence freshness, temporal conflict, and numerical risk should be deterministic and auditable. The LLM should explain and prioritize based on trusted structured evidence.

## “How is it agentic?”

The system has a stateful decision loop: observe → fuse → decide → verify → reflect → wait. It receives farmer feedback, chooses the next state, requests new evidence when necessary, and re-evaluates the farm rather than ending after one response.

## “What makes it multimodal?”

It combines different modalities/evidence types:

- speech/text interaction
- crop images
- weather/time-series information
- geospatial farm context
- satellite imagery/indices
- future soil evidence

The modalities are fused before the final farmer action.

## “Does the AI diagnose disease?”

The safe answer is: **the visual system identifies visible stress signals and possible causes; it does not claim definitive disease diagnosis from one photo. Field verification is requested when evidence is insufficient.**

---

# 27. Things the next chat must NOT accidentally undo

1. **Do not switch Nova Lite back to the direct on-demand ID.** The working tested path is `apac.amazon.nova-lite-v1:0`.
2. **Do not remove the Nova Pro fallback.**
3. **Do not let Ministral invent numerical risk.** Risk comes from structured evidence fusion.
4. **Do not treat satellite as live video.**
5. **Do not let stale satellite imagery override current farmer/photo evidence.**
6. **Do not fabricate per-zone risk when only whole-farm evidence exists.**
7. **Do not claim the dataset is already a trained production disease model unless it actually is.**
8. **Do not prescribe pesticide/fungicide dosage from the visual model.**
9. **Do not hide missing satellite/soil evidence.** Show the farmer that a source was unavailable or discounted.
10. **Do not expose raw JSON/model/provider details to the farmer UI.**
11. **Do not make the farmer confirm complicated technical states.** Keep farmer choices simple.
12. **Do not remove text fallback when Tamil voice is unavailable.**
13. **Do not make the LLM claim that the farmer completed an action unless the farmer explicitly reports it.**
14. **Do not compare a new risk score to an old score as if the old score were ground truth.** It is only a baseline for trend comparison.

---

# 28. Final end-to-end target architecture

The final intended VazhaiGuard AI prototype should be explainable as:

```text
                 ┌──────────────────────────┐
                 │        FARMER            │
                 │ Tamil voice / text/photo │
                 └────────────┬─────────────┘
                              │
                              v
                 ┌──────────────────────────┐
                 │ Farmer Interaction Layer │
                 │ voice + UI + camera      │
                 └────────────┬─────────────┘
                              │
                              v
                 ┌──────────────────────────┐
                 │    AGENT ORCHESTRATOR    │
                 │ route / observe / wait   │
                 └────────────┬─────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          v                   v                   v
   ┌────────────┐      ┌────────────┐      ┌──────────────┐
   │ Crop Photo │      │  Weather   │      │ Farm Context │
   │ Nova Lite  │      │ forecast   │      │ boundary     │
   │ -> Nova Pro│      │ conditions │      │ location     │
   └─────┬──────┘      └─────┬──────┘      └──────┬───────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              v
                     ┌──────────────────┐
                     │ SATELLITE LAYER  │
                     │ GEE + Sentinel-2 │
                     │ Dynamic World    │
                     │ NDVI/NDRE/NDWI   │
                     └────────┬─────────┘
                              │
                              v
                     ┌──────────────────┐
                     │ FUTURE SOIL LAYER│
                     │ Soil data/sensor │
                     └────────┬─────────┘
                              │
                              v
                ┌────────────────────────────┐
                │ EVIDENCE QUALITY           │
                │ freshness / cloud / age    │
                │ temporal conflict / source │
                └────────────┬───────────────┘
                             │
                             v
                ┌────────────────────────────┐
                │ UNIFIED RISK ENGINE        │
                │ deterministic fusion       │
                │ score + level + confidence │
                └────────────┬───────────────┘
                             │
                             v
                ┌────────────────────────────┐
                │ MINISTRAL 8B               │
                │ farmer decision/explanation│
                └────────────┬───────────────┘
                             │
                             v
                ┌────────────────────────────┐
                │ STRUCTURED FARMER ACTION   │
                │ priority / reason / check  │
                │ recheck / safe message     │
                └────────────┬───────────────┘
                             │
                             v
                ┌────────────────────────────┐
                │ TAMIL UI + DEVICE SPEECH  │
                └────────────┬───────────────┘
                             │
                             v
                ┌────────────────────────────┐
                │ FARMER FEEDBACK            │
                │ done / not now / help /    │
                │ check again                 │
                └────────────┬───────────────┘
                             │
                             v
                ┌────────────────────────────┐
                │ REINSPECTION               │
                │ new farmer photo           │
                │ fresh evidence             │
                │ risk comparison             │
                └────────────┬───────────────┘
                             │
                             └──────> NEXT TURN
```

---

# 29. The strongest final project claim

The project should be presented as:

> **“VazhaiGuard AI is a multimodal, evidence-aware and agentic decision-support system for banana farmers. It does not rely on a single AI model or a single data source. It combines current farmer observations, plant photographs, weather, farm geospatial context, periodic satellite evidence, and eventually soil evidence. A deterministic evidence-fusion layer evaluates freshness and conflicts before Ministral 8B converts the trusted evidence into simple Tamil farmer actions. The agent then waits for farmer feedback and can request a new field photo to close the decision loop.”**

That is the core identity of the project.

---

# 30. New-chat instruction

When continuing this project in a new chat, start by reading this file and then verify the live GitHub state before making changes.

Recommended first request in the new chat:

```text
Read PROJECT_HANDOFF.md and inspect the current branch/PR state of VazhaiGuardAI. Do not redesign the architecture. Tell me exactly which NEXT item is currently highest priority, then implement it end-to-end with tests and a clean commit/PR.
```

If a local Windows environment is being used, the known workspace is:

```text
D:\VazhaiGuardAI
```

Backend:

```text
D:\VazhaiGuardAI\backend
```

Frontend:

```text
D:\VazhaiGuardAI\frontend
```

AWS profile:

```text
vazhaiguard
```

AWS region:

```text
ap-south-1
```

---

## Handoff status

**Current development endpoint:** closed-loop farmer reinspection.

**Highest-value next engineering work:** validate and finish the real satellite evidence path, then add verified soil evidence, strengthen evidence calibration, and only then move into true zone-level risk and dataset-backed disease/growth evaluation.

**Core product rule:** never add a feature merely because it is technically impressive. Every new modality must produce trustworthy evidence that can change the farmer's next action.
