# Changelog

## Unreleased

### Added
- Integration coverage for non-public dev report scripts:
  - `test/integration/dev-report-scripts.test.js`
  - validates JSON output shape for:
    - `scripts/dev-report-metrics.js`
    - `scripts/dev-report-fragment-hotspots.js`
    - `scripts/dev-report-maturity.js`

### Changed
- Validation internals were refactored into focused modules without contract changes:
  - `src/validate/determinism.js`
  - `src/validate/coverage.js`
  - `src/validate/references.js`
  - `src/validate/integrity.js` now orchestrates these modules.
- CI now executes dev report scripts directly as workflow gates:
  - `npm run dev:report:metrics`
  - `npm run dev:report:hotspots`
  - `npm run dev:report:maturity`

## v0.1.3 - 2026-02-14

### Added
- CLI relations replay mode: `run --relations <path>` (routes to `runFromRelations`).
- Non-public developer report scripts:
  - `npm run dev:report:metrics`
  - `npm run dev:report:hotspots`
  - `npm run dev:report:maturity`
- Developer tooling scope document: `docs/DEV_TOOLING.md`.

### Changed
- Validation now enforces deeper deterministic integrity invariants at runtime:
  - duplicate id detection
  - sorted deterministic arrays/evidence checks
  - coverage/unresolved consistency checks
- `runElementaryAssertions` now requires positive upstream WTI evidence in addition to health-check success.
- `README.md` and `docs/OPERATIONAL.md` now document:
  - determinism enforcement via validation plus golden/regression tests
  - `--relations` replay path
  - WTI evidence-presence requirement

### Release Evidence
- Release commit: `d2bb91a16c40b60f1652c1477ec35f5fb736540f`
- Tag: `v0.1.3`
- Smoke roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.3-pretag-smoke-20260214-174438`
  - `C:\code\elementary-assertions-smoke-test\v0.1.3-posttag-smoke-20260214-174516`
- Rendered smoke output roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.3-pretag-smoke-20260214-174438\rendered`
  - `C:\code\elementary-assertions-smoke-test\v0.1.3-posttag-smoke-20260214-174516\rendered`

## v0.1.2 - 2026-02-14

### Added
- Shared release smoke script: `scripts/release-smoke-check.js`.
- Release notes template: `docs/RELEASE_NOTES_TEMPLATE.md`.
- Documentation consistency integration test: `test/integration/docs-consistency.test.js`.

### Changed
- CI smoke step now enforces render generation and txt/md golden parity in addition to API/CLI checks.
- Release guide (`docs/NPM_RELEASE.md`) now uses the shared smoke script for pre-tag and post-tag verification.
- README documentation section includes the release notes template link.

### Release Evidence
- Release commit: `7908ff90c977e0226d9d8b5b6144e4ac648f059f`
- Tag: `v0.1.2`
- CI run: `22020450744` (success)
- Smoke roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.2-pretag-smoke-20260214-171538`
  - `C:\code\elementary-assertions-smoke-test\v0.1.2-posttag-smoke-20260214-171605`
- Rendered smoke output roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.2-pretag-smoke-20260214-171538\rendered`
  - `C:\code\elementary-assertions-smoke-test\v0.1.2-posttag-smoke-20260214-171605\rendered`

## v0.1.1 - 2026-02-14

### Added
- Additional `runFromRelations` hardening checks for malformed accepted annotation internals:
  - accepted dependency refs must point to known token ids
  - accepted `TokenSelector` ids must point to known token ids
  - accepted `TextPositionSelector` spans must be numeric and valid (`start <= end`)
- New negative contract tests for malformed accepted annotation internals.
- Dense benchmark scenario for `runFromRelations`:
  - `npm run benchmark:core -- <iterations> dense`

### Changed
- CI workflow now runs on Node `24` (matching dependency engine constraints).
- `test/fixtures` is tracked (`.gitkeep`) so repository layout checks are stable in CI.

### Release Evidence
- Release commit: `378acc1d177cd3dbcd0c72dfccc83df7fdae7486`
- Tag: `v0.1.1`
- Smoke roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.1-pretag-smoke-20260214-170352`
  - `C:\code\elementary-assertions-smoke-test\v0.1.1-posttag-smoke-20260214-170418`
- Rendered smoke output roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.1-pretag-smoke-20260214-170352\rendered`
  - `C:\code\elementary-assertions-smoke-test\v0.1.1-posttag-smoke-20260214-170418\rendered`

## v0.1.0 - 2026-02-14

### Added
- Stable CommonJS package entry points:
  - `require("elementary-assertions")`
  - `require("elementary-assertions/validate")`
  - `require("elementary-assertions/render")`
  - `require("elementary-assertions/tools")`
  - `require("elementary-assertions/schema")`
- Deterministic output contract with golden parity locks for:
  - `access_control`
  - `irs`
  - `prime_factors`
  - `prime_gen`
  - `webshop`
- Strict CLI contract:
  - exactly one of `--text` / `--in` for `run`
  - strict booleans: `true|false` only
  - explicit `--wti-timeout-ms`
  - developer diagnostics gated behind global `--dev`
- Smoke-install release convention:
  - clean installs in `C:\code\elementary-assertions-smoke-test\`
  - one folder per install, including version + reason in the folder name

### Changed
- Role-array model is authoritative (`arguments`, `modifiers`, `operators`).
- `schema_version` handling is strict:
  - carried verbatim when present upstream
  - omitted when absent upstream
- WTI health-check behavior is fixed and fail-fast (`GET /health`, HTTP `200` only, default timeout `2000ms`, no retries).

### Removed / Rejected
- Legacy `assertions[*].slots` support across core, validate, render, and tooling.

### Release Evidence
- Release commit: `d7b9eff643e3c118d32b9c3571597dea2388f98e`
- Tag: `v0.1.0`
- Smoke roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.0-pretag-smoke-20260214-155509`
  - `C:\code\elementary-assertions-smoke-test\v0.1.0-posttag-smoke-20260214-155534`
