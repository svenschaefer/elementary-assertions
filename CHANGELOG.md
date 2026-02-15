# Changelog

## Unreleased

### Added
- (none)

### Changed
- (none)

## v0.1.12 - 2026-02-15

### Added
- Phase 16 diagnostics and strict-check ergonomics hardening (non-public tooling):
  - `dev:diagnose:wiki-upstream` now includes deterministic upstream wikipedia field examples per path (`example` + `example_source_id`)
  - `dev:diagnose:wiki-upstream` now includes predicate-level wikipedia coverage summary with cause buckets
  - `dev:check` now emits strict failure context grouped by invariant family with minimal reproducer pointer and recommended follow-up command

### Changed
- `docs/DEV_TOOLING.md`, `README.md`, and `TODO.md` synchronized for Phase 16 completion scope.

### Release Evidence
- Release commit: `c5f7dddc7d320cfb248e675c07d5eb7fef884234`
- Tag: `v0.1.12`
- Smoke roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.12-pretag-smoke-20260215-170910`
  - `C:\code\elementary-assertions-smoke-test\v0.1.12-posttag-smoke-20260215-170945`
- Rendered smoke output roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.12-pretag-smoke-20260215-170910\rendered`
  - `C:\code\elementary-assertions-smoke-test\v0.1.12-posttag-smoke-20260215-170945\rendered`

## v0.1.11 - 2026-02-15

### Added
- Phase 15 dev diagnostics depth parity hardening (non-public tooling):
  - wiki-upstream diagnostics now emit upstream wiki field-path inventory by object family
  - wiki-upstream diagnostics now emit stratified missing-field samples by role class and mention kind
  - fragment hotspot diagnostics now include segment-level host lens (triage-only) in addition to clause-local lens
  - WTI wiring diagnostics now emit explicit non-probe wiring attribution summaries (endpoint state + per-step requested/observed signal families)

### Changed
- `docs/DEV_TOOLING.md`, `README.md`, and `TODO.md` were synchronized for Phase 15 completion scope.

### Release Evidence
- Release commit: `768e49edee6b09255a395a86a045041b55c5baed`
- Tag: `v0.1.11`
- Smoke roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.11-pretag-smoke-20260215-164624`
  - `C:\code\elementary-assertions-smoke-test\v0.1.11-posttag-smoke-20260215-164701`
- Rendered smoke output roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.11-pretag-smoke-20260215-164624\rendered`
  - `C:\code\elementary-assertions-smoke-test\v0.1.11-posttag-smoke-20260215-164701\rendered`

## v0.1.10 - 2026-02-15

### Added
- Phase 14 strict validation hardening for `coverage.unresolved[*]`:
  - mention reference existence checks (`mention_ids[*]`)
  - unresolved segment consistency checks for mention and evidence token references
  - evidence token reference existence checks
- Seed-scoped developer tooling ergonomics across `dev:*` scripts:
  - `--seed <name>`
  - `--artifacts-root <path>`
- Coverage-audit diagnostics now include per-mention triage rows (`per_mention`) with unresolved context and host candidates.
- Wiki-upstream diagnostics now support optional upstream correlation mode via `--upstream <path>`.
- WTI wiring diagnostics now support optional runtime probe mode (`--runtime-probe`) with explicit endpoint checks.

### Changed
- `npm run dev:reports` now forwards supported seed/artifacts options to all underlying report/diagnostics scripts.
- README/DEV tooling docs/TODO were synchronized for Phase 14 completion scope.
- SaaS table markdown golden reference was normalized to current renderer output for smoke parity.

### Release Evidence
- Release commit: `5b56a28b9c2c35e703a1c75666bb1d58b336c6ac`
- Tag: `v0.1.10`
- CI run: `22038001076` (success)
- Smoke roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.10-pretag-smoke-20260215-161258`
  - `C:\code\elementary-assertions-smoke-test\v0.1.10-posttag-smoke-20260215-161350`
- Rendered smoke output roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.10-pretag-smoke-20260215-161258\rendered`
  - `C:\code\elementary-assertions-smoke-test\v0.1.10-posttag-smoke-20260215-161350\rendered`

## v0.1.9 - 2026-02-15

### Added
- Strict/dev deep integrity checks for `coverage.unresolved[*]`:
  - sorted + unique `mention_ids`
  - sorted `evidence.token_ids`
  - sorted + type-checked `evidence.upstream_relation_ids`
- New dev-only diagnostics tooling:
  - `npm run dev:diagnose:wiki-upstream`
  - `npm run dev:diagnose:wti-wiring`
  - `npm run dev:diagnose:coverage-audit`
- Aggregated non-public diagnostics/report command:
  - `npm run dev:reports`

### Changed
- Strict/dev diagnostics list determinism was expanded for `diagnostics.suppressed_assertions` ordering/duplicate-id checks.
- `docs/DEV_TOOLING.md` and `TODO.md` were updated to reflect completed Phase 13 hardening.

## v0.1.8 - 2026-02-15

### Changed
- Upstream dependency freeze is now pinned to exact `linguistic-enricher@1.1.35`.
- SaaS golden result-reference baseline was refreshed to capture the upstream acceptance fix for `s1` (`centered` now carries `location=Organization`).
- Scoped SaaS regression fixtures/tests were updated to lock the new accepted-dependency behavior (`centered -> Organization` as `location`).

## v0.1.7 - 2026-02-14

### Added
- Full AJV-backed schema contract enforcement in runtime validation.
- Cross-field integrity invariants:
  - segment/token/mention alignment checks
  - predicate head consistency checks
  - assertion segment-consistency checks
- Strict diagnostics integrity mode (`validateElementaryAssertions(doc, { strict: true })`).
- Dedicated strict checker workflow:
  - `npm run dev:check`
  - strict validation over a single input (`--in`) or all golden artifacts.
- File-origin provenance fidelity for CLI file inputs:
  - `--in` and `--relations` now persist file-origin metadata in `sources.inputs[]`.
- Renderer contract lock expansion:
  - added parity locks for `md/meaning`.

### Changed
- `README.md` and `docs/OPERATIONAL.md` now explicitly document:
  - runtime vs strict/dev validation scope
  - provenance levels (`in_memory` vs `file`)
  - contract-locked renderer combinations (`txt/compact`, `md/table`, `md/meaning`).

### Release Evidence
- Release commit: `554fe1df2f4fb9381bb2b125df1f64a6bf322b2d`
- Tag: `v0.1.7`
- CI run: `22025229028` (success)
- Smoke roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.7-pretag-smoke-20260214-232200`
  - `C:\code\elementary-assertions-smoke-test\v0.1.7-posttag-smoke-20260214-232230`
- Rendered smoke output roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.7-pretag-smoke-20260214-232200\rendered`
  - `C:\code\elementary-assertions-smoke-test\v0.1.7-posttag-smoke-20260214-232230\rendered`

## v0.1.6 - 2026-02-14

### Added
- Stable validation diagnostics contract:
  - validator failures now throw `ValidationError` with deterministic `err.code`
  - coded failures are wired across schema + integrity validation paths
- Expanded validation error-code contract tests:
  - `test/unit/validate-errors.contract.test.js`
  - coverage and determinism error-code assertions
  - unknown token/mention refs, invalid head token, unresolved coverage, and suppressed target reference assertions
- Docs consistency enforcement expanded:
  - explicit release commit staging command in `docs/NPM_RELEASE.md`
  - README includes `docs/DEV_TOOLING.md` in documentation links
  - README documents `ValidationError` stable `code` semantics
- Golden-reference contract coverage expanded with YAML-parsed structural checks:
  - role arrays always present (`arguments`, `modifiers`, `operators`)
  - legacy `assertions[*].slots` absence
  - required coverage arrays

### Changed
- `docs/OPERATIONAL.md` now documents the validation error contract:
  - `ValidationError` usage
  - stable `ValidationError.code` semantics for consumer branching

### Release Evidence
- Release commit: `087e5b8f86b9d897da61d7b8107140a55baaf26b`
- Tag: `v0.1.6`
- CI run: `22024520208` (success)
- Smoke roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.6-pretag-smoke-20260214-222607`
  - `C:\code\elementary-assertions-smoke-test\v0.1.6-posttag-smoke-20260214-222642`
- Rendered smoke output roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.6-pretag-smoke-20260214-222607\rendered`
  - `C:\code\elementary-assertions-smoke-test\v0.1.6-posttag-smoke-20260214-222642\rendered`

## v0.1.5 - 2026-02-14

### Added
- `run --relations` parser edge-case tests:
  - JSON input file accepted
  - non-object parsed input rejected with explicit validation error

### Changed
- `v0.1.4` release evidence now includes CI run `22020914080` (success) in docs.
- Release guide now documents local tarball cleanup after `npm pack`.

### Release Evidence
- Release commit: `a6698b31cadc1d9dbb9e5f4e1bb51df73a84edf9`
- Tag: `v0.1.5`
- CI run: `22024304301` (success)
- Smoke roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.5-pretag-smoke-20260214-220932`
  - `C:\code\elementary-assertions-smoke-test\v0.1.5-posttag-smoke-20260214-221001`
- Rendered smoke output roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.5-pretag-smoke-20260214-220932\rendered`
  - `C:\code\elementary-assertions-smoke-test\v0.1.5-posttag-smoke-20260214-221001\rendered`

## v0.1.4 - 2026-02-14

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

### Release Evidence
- Release commit: `e116ff6298a6ab139bb5f6b79c109f35f90a20e1`
- Tag: `v0.1.4`
- CI run: `22020914080` (success)
- Smoke roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.4-pretag-smoke-20260214-175142`
  - `C:\code\elementary-assertions-smoke-test\v0.1.4-posttag-smoke-20260214-175210`
- Rendered smoke output roots:
  - `C:\code\elementary-assertions-smoke-test\v0.1.4-pretag-smoke-20260214-175142\rendered`
  - `C:\code\elementary-assertions-smoke-test\v0.1.4-posttag-smoke-20260214-175210\rendered`

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
