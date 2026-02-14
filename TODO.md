# TODO - Productize `elementary-assertions`

This plan defines how to build the productized package described in `README.md`, using:
- `prototype/elementary-assertions.js`
- `prototype/elementary-assertions/*.js`

It is execution-oriented, phase-gated, and contract-first.

Status: Completed through Phase 8 and post-phase helper deduplication (as of 2026-02-14).

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
- Latest hardening commit: `f5e8439` (`chore: add changelog ci smoke checks and hardening tests`)
- Current local suite status at head: `npm test` green (`75/75`)

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
  - `test/artifacts/*/prototype-reference/`
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
- [x] Verify `package.json` remains pinned to exact `linguistic-enricher@1.1.34`.

### Golden Reference Contract

- Golden input set:
  - `test/artifacts/<seed>/seed.txt`
- Golden output set (authoritative baseline outputs):
  - `test/artifacts/<seed>/prototype-reference/seed.elementary-assertions.yaml`
  - `test/artifacts/<seed>/prototype-reference/seed.elementary-assertions.md`
  - `test/artifacts/<seed>/prototype-reference/seed.elementary-assertions.meaning.md`
  - `test/artifacts/<seed>/prototype-reference/seed.elementary-assertions.txt`
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
  - [x] exactly one of `--text` / `--in`
  - [x] both provided -> explicit error
  - [x] neither provided -> explicit error
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
- [x] Add tests against frozen golden references in `test/artifacts/*/prototype-reference`.

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
