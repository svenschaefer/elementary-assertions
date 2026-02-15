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
- wikipedia-upstream diagnostics (`dev:diagnose:wiki-upstream`)
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

Wikipedia-upstream diagnostics report depth:
- upstream wikipedia field-path inventory by object family
- categorized missing-field samples (`missing_upstream_acceptance` vs `present_upstream_dropped_downstream`)
- stratified representative samples by role class and mention kind

Maintainer triage scope:
- upstream diagnostics include bounded field-inventory examples and predicate-level coverage summaries
- `dev:check` is a maintainer triage tool and should emit invariant-family failure context when strict checks fail

`npm run dev:diagnose:wiki-upstream` report contracts used for maintainer triage:
- `correlation.upstream_wikipedia_field_inventory.object_families[*].field_paths[*]` includes:
  - `path`
  - `count`
  - bounded `example`
  - deterministic `example_source_id`
- `correlation.predicate_wikipedia_coverage_summary` includes:
  - total predicates considered
  - predicates with wikipedia signal
  - predicates missing wikipedia signal
  - cause split:
    - accepted predicate but missing wikipedia payload
    - predicate not present/eligible in accepted relations

`npm run dev:check` failure output contract for strict mode:
- emits deterministic `invariant_family` grouping per failing code family
- includes minimal reproducer pointer (`seed_id`, `segment_id`, `mention_id`/`assertion_id`)
- includes deterministic `recommended_next_command` for follow-up diagnostics

`npm run dev:diagnose:wti-wiring` additionally supports:
- `--runtime-probe` to enforce runtime wiring checks
- `--wti-endpoint <url>` (required in runtime probe mode)
- `--wti-timeout-ms <ms>` (optional override for runtime probe health timeout)

WTI wiring diagnostics report depth:
- non-probe mode includes explicit wiring attribution:
  - endpoint configured / mandatory endpoint behavior active
  - per-step requested vs observed signal families
- runtime probe remains authoritative for wiring truth and fail-fast behavior

Runtime probe mode intentionally fails on wiring-contract violations (for example missing endpoint or no positive pass-through signals).

Fragment hotspot diagnostics report depth:
- primary lens: clause-local lexical host + evidence containment
- secondary lens (triage-only): segment-level host availability and containment

## Contract boundary

- Public/stable interfaces remain:
  - `require("elementary-assertions")`
  - `require("elementary-assertions/validate")`
  - `require("elementary-assertions/render")`
  - `require("elementary-assertions/tools")`
  - `require("elementary-assertions/schema")`
- `npm run dev:*` scripts are non-public workflow tooling and are not a compatibility guarantee.
