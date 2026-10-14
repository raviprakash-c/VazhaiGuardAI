# Evidence fusion hardening

This change tightens the deterministic evidence-state contract used by VazhaiGuard AI.

## Rules

- Satellite observations older than seven days are marked stale and excluded from current decision weights. Their signal score remains available for audit/context.
- A known conflict between a satellite bare/low-vegetation classification and a farmer crop record older than 30 days excludes that satellite observation from current decision weights.
- Satellite evidence without a usable timestamp is marked unknown, not fresh. It remains available with a conservative reliability factor.
- Soil confidence values are parsed defensively. Missing, malformed, non-finite or out-of-range confidence values fall back to the conservative default; unavailable soil evidence has zero reliability.
- The evidence-state effective_weights now follows the same stale/conflict exclusions as the unified risk engine so the UI/audit metadata does not claim that excluded imagery contributed to the decision.

## Validation

Run from backend:

```powershell
python -m unittest discover -s tests -p "test_evidence_fusion_hardening.py" -v
```

The tests use synthetic timestamps and mocked evidence. They do not call external providers, AWS, or local model endpoints.
