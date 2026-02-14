# AGENTS.md

This file defines mandatory implementation and process constraints for the `elementary-assertions` repository.

## Project identity

This repository produces a Node.js package named `elementary-assertions`.

The package integrates with:
- `linguistic-enricher` (upstream text-to-relations pipeline)
- `wikipedia-title-index` (optional at repository/package level because `runFromRelations` does not require it, but required for `runElementaryAssertions`; accessed over HTTP)

## Mandatory constraints

- Language: JavaScript only.
- Module system: CommonJS only.
- Do not use TypeScript.
- Do not use ES Modules (`import`/`export`, no `"type": "module"`).
- Use only `require(...)` and `module.exports`.
- Library-first: the library API is authoritative; CLI is a thin wrapper around the same API.
- Determinism is a contract: avoid non-deterministic iteration order and unstable serialization.

## Public API contract (mandatory)

The package MUST expose two stable entry points:

1) `runFromRelations(relationsDoc, options)`
- Input is an already enriched upstream document containing accepted relations as produced by `linguistic-enricher`.
- This path MUST NOT invoke `linguistic-enricher`.
- Determinism scope: MUST be byte-identical for identical input object + options within the same `elementary-assertions` version.

2) `runElementaryAssertions(text, options)`
- Invokes `linguistic-enricher` internally to produce the required upstream relations in-memory.
- This path uses `wikipedia-title-index` only by configuring the upstream `linguistic-enricher` services and consuming resulting evidence.
- Determinism scope: byte-identical output is guaranteed only when:
  - the `elementary-assertions` version is fixed,
  - the `linguistic-enricher` version is fixed,
  - and the `wikipedia-title-index` endpoint responses are stable for identical requests (service version + dataset state + behavior).

## wikipedia-title-index integration rules (mandatory)

- `elementary-assertions` MUST NOT perform Wikipedia lookups itself.
- If `wikipedia-title-index` signals are present in the upstream data, they are consumed as upstream evidence only.
- `runElementaryAssertions` REQUIRES a configured `wikipedia-title-index` endpoint.
- `runFromRelations` does not require a `wikipedia-title-index` endpoint.
- For `runElementaryAssertions`, tooling MUST perform a fail-fast health check:
  - Request: `GET /health`
  - Success: HTTP 200 only
  - Timeout: 2000 ms default (tooling option `--wti-timeout-ms` may override)
  - Retries: none
  - Auth headers: none by default; any auth must be explicitly configured by a dedicated option.

## Output contract enforcement (mandatory)

- The library output must be stable and schema-conformant.
- If upstream does not provide `schema_version`, the output MUST omit `schema_version` (no null, no default injection).
- Any role arrays required by the persisted model MUST be present as arrays even when empty.

## Tooling layer (mandatory separation)

The repository may contain a tooling layer that consumes the core library:
- validation (schema + integrity + determinism checks)
- rendering (view-only)
- CLI (file I/O wrappers)

Tooling MUST NOT:
- mutate core output
- create alternative authoritative structures

## Workspace link (prototype/) policy

This repository may contain a workspace-local `prototype/` directory (junction) pointing to another working copy.

- `prototype/` is allowed for development convenience.
- `prototype/` MUST be excluded from npm package artifacts (via `.npmignore`).
- `prototype/` is intentionally NOT ignored by Git if the workflow requires `git diff` visibility.

## Test gates (mandatory)

- Every functional change MUST include tests.
- `npm test` MUST be green before creating a release tag.

## Release discipline (mandatory)

- Releases are defined by commits on `main` and annotated tags `vX.Y.Z`.
- Do not rewrite history after tagging.
- If a tagged release is wrong, ship a new patch version.
