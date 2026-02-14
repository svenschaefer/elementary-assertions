# Developer Tooling (Non-Public)

This document describes repository developer tooling only.  
It is not part of the npm package contract and can change between releases.

## Scope

These scripts are intended for internal quality analysis and regression triage:

- `npm run dev:check`
- `npm run dev:report:metrics`
- `npm run dev:report:hotspots`
- `npm run dev:report:maturity`

They read from committed artifact references under `test/artifacts/*/prototype-reference/` and emit JSON reports to stdout.

`npm run dev:check` runs strict validation (`validateElementaryAssertions(..., { strict: true })`) across:
- a single file via `--in <path>`, or
- all artifact golden YAML files under `test/artifacts/` (default).

## Contract boundary

- Public/stable interfaces remain:
  - `require("elementary-assertions")`
  - `require("elementary-assertions/validate")`
  - `require("elementary-assertions/render")`
  - `require("elementary-assertions/tools")`
  - `require("elementary-assertions/schema")`
- `npm run dev:*` scripts are non-public workflow tooling and are not a compatibility guarantee.
