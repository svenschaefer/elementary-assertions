# TODO - Productize `elementary-assertions`

This plan defines how to build the productized package described in `README.md`, using:
- `prototype/elementary-assertions.js`
- `prototype/elementary-assertions/*.js`

It is execution-oriented, phase-gated, and contract-first.

Status: Completed through Phase 11 hardening (as of 2026-02-14).

## Release Execution Snapshot (v0.1.7, 2026-02-14)

- Released version: `v0.1.7`
- Release commit: `554fe1df2f4fb9381bb2b125df1f64a6bf322b2d`
- Annotated tag: `v0.1.7` (pushed)
- CI run: `22025229028` (success)
- Smoke workspaces (clean installs, version + reason naming):
  - `C:\code\elementary-assertions-smoke-test\v0.1.7-pretag-smoke-20260214-232200`
  - `C:\code\elementary-assertions-smoke-test\v0.1.7-posttag-smoke-20260214-232230`
- Rendered smoke outputs were generated in both folders under:
  - `C:\code\elementary-assertions-smoke-test\v0.1.7-pretag-smoke-20260214-232200\rendered\*.compact.txt`
  - `C:\code\elementary-assertions-smoke-test\v0.1.7-pretag-smoke-20260214-232200\rendered\*.table.md`
  - `C:\code\elementary-assertions-smoke-test\v0.1.7-posttag-smoke-20260214-232230\rendered\*.compact.txt`
  - `C:\code\elementary-assertions-smoke-test\v0.1.7-posttag-smoke-20260214-232230\rendered\*.table.md`

## Phase 10 Kickoff Snapshot (2026-02-14)

- Added docs-regression guard for release staging command consistency:
  - `test/integration/docs-consistency.test.js` now enforces explicit staging paths in `docs/NPM_RELEASE.md`.
- Local quality gates re-validated at head:
  - `npm test` green (`90/90`)
  - `npm pack --dry-run` green

## Phase 10.1 Snapshot (2026-02-14)

- Added stable validation diagnostics with explicit typed errors:
  - `src/validate/errors.js` (`ValidationError` + `failValidation`)
  - schema/integrity validation now emits stable `err.code` values.
- Exported `ValidationError` from `elementary-assertions/validate`.
- Added contract tests:
  - `test/unit/validate-errors.contract.test.js`
- Re-ran full suite after hardening:
  - `npm test` green (`95/95`)

## Phase 10.2 Snapshot (2026-02-14)

- Expanded golden-reference integration checks with YAML structural parsing:
  - assertions must include `arguments[]`, `modifiers[]`, `operators[]`
  - legacy `assertions[*].slots` must be absent
  - coverage arrays must be present
- Added test coverage in:
  - `test/integration/golden-reference-contract.test.js`

## Phase 10.3 Snapshot (2026-02-14)

- Extended validation error-code contract tests to cover:
  - coverage partition failures (`EA_VALIDATE_COVERAGE_PARTITION`)
  - determinism sort failures (`EA_VALIDATE_DETERMINISM_SORT`)
- Updated changelog Unreleased notes for expanded validation code coverage.

## Phase 10.4 Snapshot (2026-02-14)

- Extended docs consistency integration checks:
  - enforce `docs/DEV_TOOLING.md` presence in README documentation links
  - enforce README mention of `ValidationError` stable `code` semantics
- Updated changelog Unreleased notes for docs-contract lock expansion.

## Phase 10.5 Snapshot (2026-02-14)

- Expanded validation error-code contract coverage (`test/unit/validate-errors.contract.test.js`) for:
  - unknown mention token reference
  - invalid mention head token
  - unknown assertion mention reference
  - unknown assertion evidence token
  - coverage unresolved length mismatch
  - coverage unresolved unknown mention
  - unknown suppressed target assertion reference
- Re-ran full suite after expansion:
  - `npm test` green (`106/106`)

## Phase 10.6 Snapshot (2026-02-14)

- Added explicit validation error contract language to `docs/OPERATIONAL.md`:
  - `ValidationError` is thrown for contract violations
  - `ValidationError.code` is stable and should be used for consumer branching

## Release Execution Snapshot (v0.1.6, 2026-02-14)

- Released version: `v0.1.6`
- Release commit: `087e5b8f86b9d897da61d7b8107140a55baaf26b`
- Annotated tag: `v0.1.6` (pushed)
- CI run: `22024520208` (success)
- Smoke workspaces (clean installs, version + reason naming):
  - `C:\code\elementary-assertions-smoke-test\v0.1.6-pretag-smoke-20260214-222607`
  - `C:\code\elementary-assertions-smoke-test\v0.1.6-posttag-smoke-20260214-222642`
- Rendered smoke outputs were generated in both folders under:
  - `C:\code\elementary-assertions-smoke-test\v0.1.6-pretag-smoke-20260214-222607\rendered\*.compact.txt`
  - `C:\code\elementary-assertions-smoke-test\v0.1.6-pretag-smoke-20260214-222607\rendered\*.table.md`
  - `C:\code\elementary-assertions-smoke-test\v0.1.6-posttag-smoke-20260214-222642\rendered\*.compact.txt`
  - `C:\code\elementary-assertions-smoke-test\v0.1.6-posttag-smoke-20260214-222642\rendered\*.table.md`

## Post-Phase 9 Snapshot (2026-02-14)

- Added integration automation for dev report scripts JSON validity:
  - `test/integration/dev-report-scripts.test.js`
- Refactored validator internals into focused modules (no contract change):
  - `src/validate/determinism.js`
  - `src/validate/coverage.js`
  - `src/validate/references.js`
  - `src/validate/integrity.js` as orchestrator
- CI now executes `dev:report:*` scripts directly as workflow gates.
- Coverage now asserts report shape for:
  - `scripts/dev-report-metrics.js`
  - `scripts/dev-report-fragment-hotspots.js`
  - `scripts/dev-report-maturity.js`
- Latest main CI run for docs/test hardening commit: `22024273512` (success).
- Current local suite status at head: `npm test` green (`90/90`)

## Active Workstream (Phase 9 - Contract Hardening and Dev Workflow Productization)

Objective: close remaining product-relevant gaps identified against prototype behavior, without expanding public API surface beyond approved contract.

### Phase 9.1 - Validation Deepening

- [x] Extend `validateElementaryAssertions` with deterministic integrity invariants:
  - [x] duplicate id detection (`tokens`, `mentions`, `assertions`, suppressed assertions)
  - [x] deterministic sorting checks (role/evidence arrays and related deterministic lists)
  - [x] coverage/unresolved consistency checks
  - [x] explicit fail-fast errors (no auto-repair)
- [x] Port selective invariant logic from prototype `check-elementary-assertions` into `src/validate/*` (contract-valid subset only).
- [x] Add focused unit/integration tests for each invariant family.

Exit criteria:
- `validate` enforces structural and deterministic integrity at runtime, not only via golden tests.

### Phase 9.2 - CLI Relations Input Path

- [x] Add `run --relations <path>` for offline/replay execution via `runFromRelations`.
- [x] Enforce strict one-of input rule: exactly one of `--text` / `--in` / `--relations`.
- [x] Ensure `--relations` path bypasses upstream execution and does not require WTI endpoint.
- [x] Add CLI contract tests for mutual exclusivity and runtime routing.

Exit criteria:
- CLI can execute both upstream-running mode and relations-replay mode with explicit one-of semantics.

### Phase 9.3 - WTI Evidence Sanity Guard

- [x] Reinstate post-upstream WTI evidence presence check in `runElementaryAssertions`:
  - [x] endpoint healthy but no positive WTI signal -> explicit failure
  - [x] `runFromRelations` remains unaffected
- [x] Add regression tests for both pass/fail cases.

Exit criteria:
- upstream-running path enforces both endpoint reachability and evidence presence.

### Phase 9.4 - Dev-Only Quality Tooling (Non-Public)

- [x] Productize useful prototype reporting intent as Node dev scripts (not public CLI contract):
  - [x] baseline metrics snapshot
  - [x] fragment hotspots report
  - [x] maturity snapshot
- [x] Place under `scripts/` with `npm run dev:*` script names.
- [x] Keep tooling explicitly non-contractual and non-public in docs.

Exit criteria:
- repeatable, cross-platform dev diagnostics exist without polluting public package interface.

### Phase 9.5 - Documentation Synchronization

- [x] Update `README.md`:
  - [x] determinism enforcement wording: validation + golden/regression tests
  - [x] add CLI relations replay example
  - [x] clarify WTI requirement includes evidence presence (not only health)
- [x] Update `docs/OPERATIONAL.md` for new CLI one-of rule including `--relations`.
- [x] Keep explicit boundary: dev scripts are non-public tooling.

Exit criteria:
- documentation matches implemented behavior and scope boundaries.

## Release Execution Snapshot (2026-02-14)

- Released version: `v0.1.0`
- Release commit: `d7b9eff643e3c118d32b9c3571597dea2388f98e`
- Annotated tag: `v0.1.0` (pushed)
- Smoke workspaces (clean installs, version + reason naming):
  - `C:\code\elementary-assertions-smoke-test\v0.1.0-pretag-smoke-20260214-155509`
  - `C:\code\elementary-assertions-smoke-test\v0.1.0-posttag-smoke-20260214-155534`
- Rendered smoke outputs were generated in both folders under:
  - `rendered\*.compact.txt`
  - `rendered\*.table.md`

## Post-Release Hardening Snapshot (2026-02-14)

- Added `CHANGELOG.md` with `v0.1.0` contract and release evidence.
- Added CI workflow (`.github/workflows/ci.yml`) for:
  - `npm install`
  - `npm test`
  - `npm pack --dry-run`
  - clean-install API + CLI smoke check from packed tarball
- Added README cross-link to release/smoke workspace convention in `docs/NPM_RELEASE.md`.
- Added malformed upstream input negative tests for `runFromRelations` in `test/unit/run-from-relations.contract.test.js`.
- Added manual performance baseline helper:
  - script: `scripts/benchmark-run-from-relations.js`
  - npm script: `npm run benchmark:core`
  - repo workflow note in `docs/REPO_WORKFLOWS.md`
- Latest hardening commit: `7e4a9cf` (`hardening: validate annotation internals and add dense benchmark`)
- Current local suite status at head: `npm test` green (`76/76`)

## CI Stabilization Snapshot (2026-02-14)

- CI workflow validated on `main` via GitHub Actions:
  - initial failing runs analyzed and fixed
  - `test/fixtures/.gitkeep` added so repository layout test is stable in clean checkouts
  - successful run after fixes: `22020277602`
- successful run for release commit:
  - `release: v0.1.1` -> run `22020293090` (success)
- release-smoke automation is now script-driven and CI-enforced:
  - script: `scripts/release-smoke-check.js`
  - checks: API surface, CLI help, rendered output generation, and txt/md golden parity
  - wired into CI workflow and release guide (`docs/NPM_RELEASE.md`)

## Release Execution Snapshot (v0.1.1, 2026-02-14)

- Released version: `v0.1.1`
- Release commit: `378acc1d177cd3dbcd0c72dfccc83df7fdae7486`
- Annotated tag: `v0.1.1` (pushed)
- Smoke workspaces (clean installs, version + reason naming):
  - `C:\code\elementary-assertions-smoke-test\v0.1.1-pretag-smoke-20260214-170352`
  - `C:\code\elementary-assertions-smoke-test\v0.1.1-posttag-smoke-20260214-170418`
- Rendered smoke outputs were generated in both folders under:
  - `C:\code\elementary-assertions-smoke-test\v0.1.1-pretag-smoke-20260214-170352\rendered\*.compact.txt`
  - `C:\code\elementary-assertions-smoke-test\v0.1.1-pretag-smoke-20260214-170352\rendered\*.table.md`
  - `C:\code\elementary-assertions-smoke-test\v0.1.1-posttag-smoke-20260214-170418\rendered\*.compact.txt`
  - `C:\code\elementary-assertions-smoke-test\v0.1.1-posttag-smoke-20260214-170418\rendered\*.table.md`

## Release Execution Snapshot (v0.1.2, 2026-02-14)

- Released version: `v0.1.2`
- Release commit: `7908ff90c977e0226d9d8b5b6144e4ac648f059f`
- Annotated tag: `v0.1.2` (pushed)
- CI run: `22020450744` (success)
- Smoke workspaces (clean installs, version + reason naming):
  - `C:\code\elementary-assertions-smoke-test\v0.1.2-pretag-smoke-20260214-171538`
  - `C:\code\elementary-assertions-smoke-test\v0.1.2-posttag-smoke-20260214-171605`
- Rendered smoke outputs were generated in both folders under:
  - `C:\code\elementary-assertions-smoke-test\v0.1.2-pretag-smoke-20260214-171538\rendered\*.compact.txt`
  - `C:\code\elementary-assertions-smoke-test\v0.1.2-pretag-smoke-20260214-171538\rendered\*.table.md`
  - `C:\code\elementary-assertions-smoke-test\v0.1.2-posttag-smoke-20260214-171605\rendered\*.compact.txt`
  - `C:\code\elementary-assertions-smoke-test\v0.1.2-posttag-smoke-20260214-171605\rendered\*.table.md`

## Release Execution Snapshot (v0.1.3, 2026-02-14)

- Released version: `v0.1.3`
- Release commit: `d2bb91a16c40b60f1652c1477ec35f5fb736540f`
- Annotated tag: `v0.1.3` (pushed)
- Smoke workspaces (clean installs, version + reason naming):
  - `C:\code\elementary-assertions-smoke-test\v0.1.3-pretag-smoke-20260214-174438`
  - `C:\code\elementary-assertions-smoke-test\v0.1.3-posttag-smoke-20260214-174516`
- Rendered smoke outputs were generated in both folders under:
  - `C:\code\elementary-assertions-smoke-test\v0.1.3-pretag-smoke-20260214-174438\rendered\*.compact.txt`
  - `C:\code\elementary-assertions-smoke-test\v0.1.3-pretag-smoke-20260214-174438\rendered\*.table.md`
  - `C:\code\elementary-assertions-smoke-test\v0.1.3-posttag-smoke-20260214-174516\rendered\*.compact.txt`
  - `C:\code\elementary-assertions-smoke-test\v0.1.3-posttag-smoke-20260214-174516\rendered\*.table.md`

## Release Execution Snapshot (v0.1.4, 2026-02-14)

- Released version: `v0.1.4`
- Release commit: `e116ff6298a6ab139bb5f6b79c109f35f90a20e1`
- Annotated tag: `v0.1.4` (pushed)
- CI run: `22020914080` (success)
- Smoke workspaces (clean installs, version + reason naming):
  - `C:\code\elementary-assertions-smoke-test\v0.1.4-pretag-smoke-20260214-175142`
  - `C:\code\elementary-assertions-smoke-test\v0.1.4-posttag-smoke-20260214-175210`
- Rendered smoke outputs were generated in both folders under:
  - `C:\code\elementary-assertions-smoke-test\v0.1.4-pretag-smoke-20260214-175142\rendered\*.compact.txt`
  - `C:\code\elementary-assertions-smoke-test\v0.1.4-pretag-smoke-20260214-175142\rendered\*.table.md`
  - `C:\code\elementary-assertions-smoke-test\v0.1.4-posttag-smoke-20260214-175210\rendered\*.compact.txt`
  - `C:\code\elementary-assertions-smoke-test\v0.1.4-posttag-smoke-20260214-175210\rendered\*.table.md`

## Release Execution Snapshot (v0.1.5, 2026-02-14)

- Released version: `v0.1.5`
- Release commit: `a6698b31cadc1d9dbb9e5f4e1bb51df73a84edf9`
- Annotated tag: `v0.1.5` (pushed)
- CI run: `22024304301` (success)
- Smoke workspaces (clean installs, version + reason naming):
  - `C:\code\elementary-assertions-smoke-test\v0.1.5-pretag-smoke-20260214-220932`
  - `C:\code\elementary-assertions-smoke-test\v0.1.5-posttag-smoke-20260214-221001`
- Rendered smoke outputs were generated in both folders under:
  - `C:\code\elementary-assertions-smoke-test\v0.1.5-pretag-smoke-20260214-220932\rendered\*.compact.txt`
  - `C:\code\elementary-assertions-smoke-test\v0.1.5-pretag-smoke-20260214-220932\rendered\*.table.md`
  - `C:\code\elementary-assertions-smoke-test\v0.1.5-posttag-smoke-20260214-221001\rendered\*.compact.txt`
  - `C:\code\elementary-assertions-smoke-test\v0.1.5-posttag-smoke-20260214-221001\rendered\*.table.md`

## Scope and Goal

Build a production Node.js package with stable CommonJS APIs:
- `runFromRelations(relationsDoc, options)`
- `runElementaryAssertions(text, options)`

and stable package entry points:
- `require("elementary-assertions")`
- `require("elementary-assertions/validate")`
- `require("elementary-assertions/render")`
- `require("elementary-assertions/tools")`
- `require("elementary-assertions/schema")`

while enforcing product docs and constraints in:
- `README.md`
- `docs/OPERATIONAL.md`
- `AGENTS.md`

## Non-Negotiable Decisions (Locked)

1. Legacy `assertions[*].slots` backward-read support: **REMOVE COMPLETELY**
- Core MUST NOT emit `slots`.
- Renderer MUST NOT accept `slots`.
- Tooling MUST NOT tolerate `slots`.
- Inputs containing `slots` are invalid and MUST fail validation with explicit errors.
- All prototype compatibility code paths for `slots` must be removed during port.
- Prototype tests expecting `slots` must be rewritten or deleted.

2. Prototype diagnostic flags are **NON-PUBLIC DEV TOOLING**
- `--diagnose-wiki-upstream`, `--diagnose-wti-wiring`, `--diagnose-coverage-audit` are not public API.
- They MUST NOT appear in public CLI docs.
- If retained, expose only behind a global `--dev` gate in the default CLI.
- Dev diagnostic flags MUST be rejected unless `--dev` is present.

3. `runFromRelations` strictness model
- Accept richer upstream documents (extra fields allowed).
- Do not require a specific input `stage` label.
- Perform strict structural validation of required fields/invariants.
- Never key logic on stage-string matching.

4. Tests migration strategy: **Two phases with golden anchors**
- Phase 1: port prototype tests as-is where feasible (boundary adaptations only).
- Phase 2: tighten tests to product contract; remove legacy expectations.
- Golden anchors are authoritative in `test/artifacts/` (including frozen prototype references).

## Current State Snapshot

- `src/` product modules are implemented and wired (`core`, `run`, `render`, `validate`, `tools`).
- Prototype has comprehensive logic in:
  - `prototype/elementary-assertions.js`
  - `prototype/elementary-assertions/assertions.js`
  - `prototype/elementary-assertions/determinism.js`
  - `prototype/elementary-assertions/diagnostics.js`
  - `prototype/elementary-assertions/io.js`
  - `prototype/elementary-assertions/mentions.js`
  - `prototype/elementary-assertions/output.js`
  - `prototype/elementary-assertions/projection.js`
  - `prototype/elementary-assertions/roles.js`
  - `prototype/elementary-assertions/tokens.js`
- Golden baseline references are committed under:
  - `test/artifacts/*/result-reference/`
  - `test/artifacts/README.md` (freeze metadata)
- Golden parity locks are active for all artifact sets:
  - `prime_gen`
  - `webshop`
  - `access_control`
  - `irs`
  - `prime_factors`

## Target Architecture

### Core (library-authoritative)

- `src/core/determinism.js`
  - hashing, canonical sorting, stable keying, evidence dedupe/sort
  - remove unrelated I/O/runtime loader functions

- `src/core/tokens.js`
  - token index validation/projection helpers

- `src/core/mentions.js`
  - mention construction
  - mention head resolution
  - lexicon evidence propagation
  - role label helpers (`roleToSlot`, subject-role classification)

- `src/core/projection.js`
  - accepted relations extraction from `linguistic-enricher`
  - mention projection
  - dropped/unresolved projection tracking
  - coordination grouping

- `src/core/roles.js`
  - canonical role-entry construction/sorting
  - role-array normalization helpers
  - no slot projection compatibility layer

- `src/core/assertions.js`
  - predicate selection and upgrades
  - role assignment
  - operator construction/merge
  - suppression rules and traces
  - deterministic ID generation
  - output strictly as `arguments[]`, `modifiers[]`, `operators[]`

- `src/core/diagnostics.js`
  - unresolved classification and precedence
  - coverage/gap/fragmentation diagnostics
  - suppression diagnostics

- `src/core/output.js`
  - final document assembly
  - index_basis + coverage + sources + relation projection + diagnostics
  - `schema_version` carry-if-present-else-omit rule
  - no CLI/orchestration logic in this module

### Runtime/API

- `src/run.js`
  - `runFromRelations(relationsDoc, options)`:
    - strict structural validation
    - ignore extra unrelated fields
    - no stage label dependence
    - reject legacy `assertions[*].slots` immediately (earliest fail)
  - `runElementaryAssertions(text, options)`:
    - call upstream `linguistic-enricher`
    - require WTI endpoint
    - perform health check contract (`GET /health`, `200` only, timeout default 2000, no retries, no auth by default)
    - health-check policy is library behavior; CLI is pass-through only

- `src/index.js`
  - export stable API surface

### Tooling / CLI / Render / Validate

- `src/tools/io.js`
  - file I/O wrappers
  - strict parse helpers for booleans and required one-of flags

- `src/tools/cli.js`
  - public commands: `run`, `validate`, `render`
  - public behavior from `docs/OPERATIONAL.md`
  - dev diagnostics allowed only when global `--dev` is present

- `src/validate/schema.js`, `src/validate/integrity.js`, `src/validate/index.js`
  - schema + integrity + determinism checks
  - explicit failure on legacy `assertions[*].slots`

- `src/render/render.js`, `src/render/layouts/*.js`, `src/render/index.js`
  - view-only renderer
  - strict contract input only
  - explicit failure on legacy `slots`

## Prototype-to-Product Mapping

- `prototype/elementary-assertions/assertions.js` -> `src/core/assertions.js`
- `prototype/elementary-assertions/determinism.js` -> `src/core/determinism.js` (trim dead/leaky code)
- `prototype/elementary-assertions/diagnostics.js` -> `src/core/diagnostics.js`
- `prototype/elementary-assertions/mentions.js` -> `src/core/mentions.js` (dedupe overlaps with projection)
- `prototype/elementary-assertions/output.js` -> `src/core/output.js` (remove embedded orchestration block)
- `prototype/elementary-assertions/projection.js` -> `src/core/projection.js`
- `prototype/elementary-assertions/roles.js` -> `src/core/roles.js` (remove slot-compat projections)
- `prototype/elementary-assertions/tokens.js` -> `src/core/tokens.js`
- `prototype/elementary-assertions/io.js` -> split between `src/run.js` and `src/tools/io.js`
- `prototype/elementary-assertions.js` -> split between `src/run.js` and `src/tools/cli.js`

## Phase Plan

## Phase 0 - Baseline and Safety

- [x] Add baseline integration smoke tests for currently committed golden references.
- [x] Add failing tests for legacy slot rejection in validate + render.
- [x] Add test utility for loading `test/artifacts/*/seed.txt` and golden refs.
- [x] Verify `package.json` remains pinned to exact `linguistic-enricher@1.1.35`.

### Golden Reference Contract

- Golden input set:
  - `test/artifacts/<seed>/seed.txt`
- Golden output set (authoritative baseline outputs):
  - `test/artifacts/<seed>/result-reference/seed.elementary-assertions.yaml`
  - `test/artifacts/<seed>/result-reference/seed.elementary-assertions.md`
  - `test/artifacts/<seed>/result-reference/seed.elementary-assertions.meaning.md`
  - `test/artifacts/<seed>/result-reference/seed.elementary-assertions.txt`
- Comparison rules:
  - YAML: parsed structural equality for contract-relevant fields, plus deterministic serialization check for byte stability.
  - Rendered txt/md: byte comparison against golden files.
  - Validation tests: explicit failure messages for invalid contract inputs (including legacy `slots`).
- Versioning rules for intentional contract changes:
  - create a new baseline directory `test/artifacts/<seed>/product-reference/<version-or-date>/`
  - keep previous baseline set for historical diffing until explicitly deprecated
  - update `test/artifacts/README.md` with reason, date, and dependency freeze metadata

Exit criteria:
- test harness ready for porting without semantic drift.

## Phase 1 - Port Core Modules (No CLI yet)

- [x] Implement `src/core/determinism.js`.
- [x] Implement `src/core/tokens.js`.
- [x] Implement `src/core/mentions.js`.
- [x] Implement `src/core/projection.js`.
- [x] Implement `src/core/roles.js`.
- [x] Implement `src/core/assertions.js`.
- [x] Implement `src/core/diagnostics.js`.
- [x] Implement `src/core/output.js`.

Required refactors during port:
- [x] Remove duplicated helpers across modules (single owner per helper).
- [x] Delete dead code and undefined-reference code paths from prototype carry-over.
- [x] Remove all slot compatibility code from core path.
- [x] Ensure all role arrays are always present (empty allowed).
- [x] Ensure deterministic ordering and canonical IDs are preserved.

Exit criteria:
- `runFromRelations` pipeline can be wired purely from `src/core/*`.

## Phase 2 - API Runtime Layer

- [x] Implement `src/run.js` with:
- [x] `runFromRelations(relationsDoc, options)`
- [x] `runElementaryAssertions(text, options)`
- [x] Implement strict structural input validation for `runFromRelations`.
- [x] Enforce earliest-fail slot rejection in `runFromRelations` (inputs containing `assertions[*].slots` must error before further processing).
- [x] Implement WTI policy in `runElementaryAssertions`:
  - [x] endpoint required
  - [x] `GET /health`
  - [x] HTTP 200 only
  - [x] timeout default 2000ms
  - [x] no retries
  - [x] no implicit auth headers
- [x] Ensure CLI uses library-runner behavior and does not implement an independent health-check path.
- [x] Ensure schema_version behavior:
  - [x] present upstream -> carry verbatim
  - [x] absent upstream -> omit

Exit criteria:
- API-level contract in `README.md` is executable and tested.

## Phase 3 - Package Entry and Schema Export

- [x] Implement `src/index.js` exports.
- [x] Implement/verify `exports` map targets in `package.json`.
- [x] Ensure `require("elementary-assertions/schema")` is stable and resolves correctly.
- [x] Add unit tests for package exports.

Exit criteria:
- all package entry points function as documented.

## Phase 4 - Validation Layer

- [x] Implement schema validator (`src/validate/schema.js`).
- [x] Implement integrity + determinism checks (`src/validate/integrity.js`).
- [x] Implement wrapper API (`src/validate/index.js`).
- [x] Add explicit invalidation rule for legacy `assertions[*].slots`.

Exit criteria:
- `validate` catches schema/integrity violations and rejects legacy slots explicitly.

## Phase 5 - Renderer

- [x] Implement renderer core (`src/render/render.js`) and layout modules.
- [x] Keep renderer view-only and deterministic.
- [x] Reject legacy slot-shaped inputs explicitly.
- [x] Preserve documented layout options and formatting toggles.

Exit criteria:
- render path matches `docs/OPERATIONAL.md` contract and passes deterministic tests.

## Phase 6 - Tooling and CLI

- [x] Implement `src/tools/io.js` for strict parsing and I/O.
- [x] Implement `src/tools/cli.js` with public commands:
- [x] `run`
- [x] `validate`
- [x] `render`
- [x] Enforce CLI input rules:
  - [x] exactly one of `--text` / `--in` / `--relations`
  - [x] multiple provided -> explicit error
  - [x] none provided -> explicit error
- [x] Enforce strict booleans: `true|false` (case-insensitive only).
- [x] Add `--wti-timeout-ms` and endpoint precedence behavior.
- [x] Keep prototype diagnostics non-public:
  - [x] require global `--dev` flag
  - [x] reject diagnostic flags when `--dev` is absent
  - [x] do not document diagnostics in public CLI docs

Exit criteria:
- CLI behavior fully aligned with `docs/OPERATIONAL.md`.

## Phase 7 - Tests Migration

### Phase 7A - Coverage Preservation

- [x] Port prototype tests with minimal surgery to new module paths.
- [x] Keep behavior parity where still contract-valid.
- [x] Validate deterministic stability over repeated runs.

### Phase 7B - Contract Tightening

- [x] Remove/rewrite all tests that rely on legacy `slots`.
- [x] Add explicit tests for invalid `slots` rejection in validate/render.
- [x] Add tests for schema_version omission behavior.
- [x] Add tests for strict CLI boolean parsing and one-of input enforcement.
- [x] Add tests for WTI health-check strictness and timeout default.
- [x] Add tests against frozen golden references in `test/artifacts/*/result-reference`.

Exit criteria:
- test suite asserts current product contract, not prototype internals.

## Phase 8 - Release Readiness

- [x] Ensure docs and behavior are synchronized (`README.md`, `docs/OPERATIONAL.md`, `docs/NPM_RELEASE.md`).
- [x] Ensure `npm test` passes consistently.
- [x] Ensure `npm pack --dry-run` is clean and deterministic.
- [x] Ensure docs included in packlist (`package.json` `files` includes `docs/`).

Exit criteria:
- release flow in `docs/NPM_RELEASE.md` can be executed without contract drift.

## Acceptance Checklist (Definition of Done)

- [x] `runFromRelations` and `runElementaryAssertions` implemented and tested.
- [x] Determinism guarantees implemented per scoped rules in docs.
- [x] Legacy `slots` fully removed and explicitly rejected.
- [x] Public CLI stable and minimal; dev diagnostics not public.
- [x] Validation and rendering enforce strict current contract.
- [x] Golden artifact regression checks in place and green.
- [x] Package exports stable, including schema export.
- [x] Documentation and implementation fully aligned.

## Initial Execution Order (Recommended)

1. Phase 0 baseline tests and slot-rejection tests.
2. Phase 1 core module port (`determinism` -> `tokens` -> `mentions` -> `projection` -> `roles` -> `assertions` -> `diagnostics` -> `output`).
3. Phase 2 runtime API and policy enforcement.
4. Phase 4 validate, then Phase 5 render.
5. Phase 6 CLI/tools.
6. Phase 7 tests migration and tightening.
7. Phase 8 release readiness.
8. Phase 9 gap-closure (`validate` hardening -> CLI `--relations` -> WTI evidence guard -> dev scripts -> docs sync).

## Phase 11 - Validation, Provenance, and Contract Hardening (Planned)

Objective: non-breaking product hardening for validation depth, provenance fidelity, and renderer contract locks, without changing core assertion semantics.

### 11.1 Full JSON Schema Enforcement (Runtime + Dev)

- [x] Add AJV-based validation against packaged schema (`src/schema/seed.elementary-assertions.schema.json`).
- [x] Runtime path: fail fast on schema violations.
- [x] Dev/strict path: include full error reporting with schema paths for CI diagnostics.

### 11.2 Cross-Field Integrity Invariants

- [x] Enforce structural relationships beyond existence checks:
  - [x] segment-token-mention alignment
  - [x] predicate head consistency
  - [x] predicate/argument and related cross-field alignment invariants
- [x] Enumerate invariants explicitly in tests and keep stable `ValidationError.code` coverage.

### 11.3 Strict Diagnostics Integrity Mode

- [x] Add deep diagnostics coherence checks (ordering, references, suppression eligibility, coordination groups).
- [x] Gate these checks behind dev/strict mode (not part of minimal runtime validation path).

### 11.4 Dedicated Strict Checker Entry Point

- [x] Add single checker command (for example `npm run dev:check`) aggregating:
  - [x] full schema validation
  - [x] cross-field integrity invariants
  - [x] deep diagnostics checks
- [x] Position checker for CI and golden-reference verification workflows.

### 11.5 Provenance Fidelity for File-Origin Runs

- [x] Preserve file-origin provenance for CLI `--in` and `--relations` inputs (paths, digests, timestamps).
- [x] Keep in-memory runs explicitly marked as in-memory artifacts.
- [x] Ensure output metadata clearly distinguishes file-origin vs in-memory provenance.

### 11.6 Renderer Contract Expansion

- [x] Extend parity/contract locks beyond compact/table where renderer behavior is stable.
- [x] Explicitly document renderer behaviors that are contract-locked vs best-effort.

Exit criteria:
- product guarantees stronger correctness, traceability, and reproducibility without expanding assertion semantics.

## Phase 12 - Diagnostics, Suppression, and Coverage Hardening (Planned)

Objective: non-breaking hardening of strict/dev validation depth and release-smoke reproducibility checks, without changing core assertion construction behavior.

### 12.1 Expand Strict Diagnostics Invariants

- [x] Enforce full ordering, reference, and content rules for:
  - [x] `suppression_eligibility`
  - [x] `fragmentation`
  - [x] `gap_signals`
  - [x] `subject_role_gaps`
- [x] Align strict-mode diagnostics checks with prototype checker depth where contract-valid.
- [x] Keep enforcement behind strict/dev tooling path (not default runtime path).

### 12.2 Suppressed-Assertion Semantic Validation

- [x] Add reason-specific invariants for suppressed assertions:
  - [x] required head/evidence presence
  - [x] host <-> suppressed assertion consistency
  - [x] transferred bucket/mention constraints
- [x] Runtime validation keeps minimal safety checks.
- [x] Strict/dev validation enforces full semantic coherence.

### 12.3 Coverage Primary-Set Integrity

- [x] Enforce equality between:
  - [x] `coverage.primary_mention_ids`
  - [x] derived domain-primary mentions (`mentions[*].is_primary` filtered by coverage-domain head rules)
- [x] Fail fast in strict mode on mismatch.

### 12.4 Subject-Role-Gap Deep Coherence

- [x] Validate:
  - [x] sorted gap entries
  - [x] sorted evidence arrays
  - [x] consistency with actor-empty assertions
- [x] Strict-mode only.

### 12.5 Release Smoke Parity Expansion

- [x] Extend release smoke checks to include `md/meaning` renderer outputs.
- [x] Keep parity tests as ground truth; smoke checks verify install-time wiring.

### 12.6 Coverage Primary ID Ordering Regression (`saas` seed)

- [x] Fix `runFromRelations` output determinism for large/new seeds where `coverage.primary_mention_ids` can be emitted unsorted.
- [x] Ensure emitted `coverage.primary_mention_ids` ordering is stable and sorted for all seeds (including newly added `test/artifacts/saas/seed.txt`).
- [x] Add regression test that locks the `s1`/`s19` locale-sort ordering invariant at the coverage-domain builder boundary.

Exit criteria:
- `test/artifacts/saas/seed.elementary-assertions.yaml` validates without `EA_VALIDATE_DETERMINISM_SORT`.
- render commands (`txt/compact`, `md/table`, `md/meaning`) succeed for `saas` output.

Exit criteria:
- strict/dev guarantees are expanded for diagnostics/suppression/coverage coherence.
- release smoke verifies all contract-locked renderer outputs.
