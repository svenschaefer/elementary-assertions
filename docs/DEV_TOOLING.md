# Developer Tooling (Non-Public)

This document describes repository developer tooling only.  
It is not part of the npm package contract and can change between releases.

## Scope

These scripts are intended for internal quality analysis and regression triage:

- `npm run dev:check`
- `npm run dev:report:metrics`
- `npm run dev:report:hotspots`
- `npm run dev:report:maturity`
- `npm run dev:diagnose:wiki-upstream`
- `npm run dev:diagnose:wti-wiring`
- `npm run dev:diagnose:coverage-audit`
- `npm run dev:reports`

They read from committed artifact references under `test/artifacts/*/result-reference/` and emit JSON reports to stdout.

`npm run dev:reports` is an aggregate maintainer command that executes:
- metrics
- hotspots
- maturity
- wiki-upstream diagnostics
- WTI wiring diagnostics
- coverage-audit diagnostics

`npm run dev:check` runs strict validation (`validateElementaryAssertions(..., { strict: true })`) across:
- a single file via `--in <path>`, or
- all artifact golden YAML files under `test/artifacts/` (default).

## Common script options

Most `dev:*` scripts support:
- `--seed <name>` to run on one artifact seed only
- `--artifacts-root <path>` to override the default `test/artifacts` root

`npm run dev:check` additionally supports:
- `--in <path>` to validate one explicit document instead of artifact references

`npm run dev:diagnose:wiki-upstream` additionally supports:
- `--upstream <path>` (JSON/YAML) to correlate uncovered mentions between EA output and accepted upstream dependency endpoints

`npm run dev:diagnose:wti-wiring` additionally supports:
- `--runtime-probe` to enforce runtime wiring checks
- `--wti-endpoint <url>` (required in runtime probe mode)
- `--wti-timeout-ms <ms>` (optional override for runtime probe health timeout)

Runtime probe mode intentionally fails on wiring-contract violations (for example missing endpoint or no positive pass-through signals).

## Contract boundary

- Public/stable interfaces remain:
  - `require("elementary-assertions")`
  - `require("elementary-assertions/validate")`
  - `require("elementary-assertions/render")`
  - `require("elementary-assertions/tools")`
  - `require("elementary-assertions/schema")`
- `npm run dev:*` scripts are non-public workflow tooling and are not a compatibility guarantee.
