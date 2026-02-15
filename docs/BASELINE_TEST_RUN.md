# Baseline Test Run

Purpose: define a stable end-to-end verification baseline, even where external dependencies can vary.

## Verify Stable Invariants

- CLI/API wiring works end-to-end.
- State-changing commands persist expected changes.
- Rejected/no-op paths do not mutate persisted state.
- Required output envelope fields are present.
- Exit codes follow contract (`0` success, non-zero failure).

## Do Not Over-Constrain External Surfaces

Avoid hard-locking:
- exact wording of externally influenced text
- full byte-identical outputs from unstable external services
- incidental ordering not declared as part of contract

## Recommended Baseline Strategy

1. Define fixture(s).
2. Run command sequence.
3. Assert invariant checkpoints.
4. Capture result summary (counts/flags/hashes) instead of fragile full-output strings.
5. Keep one deterministic smoke path in CI (`npm run smoke:release` + release smoke checks).

## Suggested Run Checklist

- `npm run lint`
- `npm test`
- `npm run pack:check`
- `npm run smoke:release`
