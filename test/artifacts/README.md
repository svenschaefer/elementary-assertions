# Golden Baseline Artifacts

This directory stores test seeds and golden reference outputs used for deterministic regression checks.

## Result reference baselines

The `result-reference/` folders under each artifact case are committed golden outputs.

### Prototype-derived freeze (2026-02-14)

Seeds:
- `access_control`
- `irs`
- `prime_factors`
- `prime_gen`
- `webshop`

Freeze metadata:
- baseline date: `2026-02-14`
- upstream freeze: `linguistic-enricher@1.1.34`
- reference: `https://www.npmjs.com/package/linguistic-enricher/v/1.1.34`

### Product-result baseline (0.1.7)

Seed:
- `saas`

This baseline is explicitly generated from `elementary-assertions@0.1.7` output and is not a prototype-derived reference.

Current package dependency freeze:
- upstream freeze: `linguistic-enricher@1.1.35`
- reference: `https://www.npmjs.com/package/linguistic-enricher/v/1.1.35`

These baselines are intended for stable comparison and review of output deltas over time.
