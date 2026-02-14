# Changelog

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
