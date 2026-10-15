# Farmer Outcome Feedback Loop

## Purpose
The action-feedback loop records whether a farmer completed a recommended action, could not complete it, needs help, or requests a new inspection. Feedback is persisted on the existing farm item in DynamoDB; no new AWS resource is required.

## API
- `POST /agent/feedback`: validates an action outcome and records it when a farm ID is supplied.
- `GET /agent/feedback/{farm_id}`: returns the latest 50 feedback events, newest first.
- `POST /agent/reinspect`: existing photo-based reinspection flow remains available.

## Stored event
Each event contains action ID, outcome, normalized language, optional note, and UTC timestamp. Existing farm attributes are preserved because the update appends to `farmer_feedback` instead of replacing the item.

## Outcomes
- `completed` → `recheck_due`
- `unable` → `wait_for_farmer`
- `needs_help` → `wait_for_farmer`
- `recheck` → `capture_photo`

## Operational notes
The endpoint returns an error if a farm ID is supplied but DynamoDB persistence fails; it must not claim a durable save that did not happen. This implementation uses the existing farm table and IAM permissions. Feedback is farmer-reported outcome data, not proof that a field intervention succeeded.
