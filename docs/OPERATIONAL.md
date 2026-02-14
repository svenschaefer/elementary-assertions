# elementary-assertions - Operational Guide

This document describes operational usage in the npm package context:
- CLI commands
- file I/O behavior
- service requirements (WTI)
- rendering defaults
- determinism rules
- repository-layout convenience options (seed-id, artifacts-root)

The authoritative interface remains the core library API. Tooling is a consumer layer and is view-only.

## Runtime dependencies

Upstream linguistic pipeline (`linguistic-enricher`)  
The default run path executes `linguistic-enricher` up to accepted relations (typically `relations_extracted`).

Wikipedia Title Index service (WTI)  
A WTI endpoint is required for the default run path (`run --text` / `run --in`).

- the endpoint is passed to the upstream pipeline as `services["wikipedia-title-index"].endpoint`
- a fail-fast `GET /health` check is performed before execution
- positive upstream WTI evidence is required after pipeline execution (endpoint health alone is insufficient)
- elementary-assertions performs no Wikipedia lookups itself
- all wiki title signals are consumed as upstream evidence

Endpoint source precedence (CLI):
1. `--wti-endpoint`
2. environment `WIKIPEDIA_TITLE_INDEX_ENDPOINT`

If the endpoint is missing or blank, the CLI fails explicitly.

WTI health-check contract (default run path):
- Request: `GET /health`
- Success: HTTP `200` only
- Timeout: `2000` ms default
- Retries: none (fail-fast)
- Auth headers: none by default

## CLI

The CLI is a thin wrapper around the library plus tooling modules.
CLI file-origin inputs preserve provenance metadata in output `sources.inputs[]`:
- `--in` -> `artifact: "seed.txt"` with `origin.kind: "file"`
- `--relations` -> `artifact: "seed.relations.yaml"` with `origin.kind: "file"`

### Commands

- `run` - produce `elementary_assertions` output from text or file input
- `run` also supports offline/replay from relations input (`--relations`)
- `validate` - schema + integrity + determinism checks
- `render` - view-only rendering (txt or md) with layouts

Examples:

```bash
npx elementary-assertions run --text "A webshop is an online store." --wti-endpoint http://localhost:3000 --wti-timeout-ms 2000 --out out.yaml
npx elementary-assertions run --in input.txt --wti-endpoint http://localhost:3000 --out out.yaml
npx elementary-assertions run --relations relations.yaml --out out.yaml
npx elementary-assertions validate --in out.yaml
npx elementary-assertions render --in out.yaml --format md --layout table --out out.md
```

### Generic I/O flags (preferred)

Run:
- exactly one of `--text <string>`, `--in <path>`, or `--relations <path>` is required; providing multiple is an explicit error, and providing none is an explicit error
- `--out <path>` (optional, defaults to stdout)
- `--timeout-ms <ms>` (optional)
- `--wti-endpoint <url>` (required unless env provides it for `--text` / `--in`; not required for `--relations`)
- `--wti-timeout-ms <ms>` (optional, default: 2000)

Validate:
- `--in <path>`

Render:
- `--in <path>`
- `--out <path>` (optional, defaults to stdout)
- `--format <txt|md>`
- `--layout <compact|readable|table|meaning>`
- `--segments <true|false>`
- `--mentions <true|false>`
- `--coverage <true|false>`
- `--debug-ids <true|false>`
- `--normalize-determiners <true|false>` (default: true)
- `--render-uncovered-delta <true|false>` (default: false)

Boolean flag parsing is strict:
- accepted lexical forms: `true|false` (case-insensitive)
- internal normalization target: lowercase (`true` or `false`)
- rejected forms: `1/0`, `yes/no`, and bare flags without explicit values

### Validation error contract

- `elementary-assertions/validate` throws `ValidationError` for contract violations.
- `ValidationError.code` is stable and intended for consumer branching.
- Consumers should branch on `err.code`, not on free-text message matching.

## Repository layout convenience (optional)

If you operate within a repo that follows the conventional seed layout, the CLI may offer convenience flags:

- `--seed-id <id>`
- `--artifacts-root <path>`

Conventional paths:
- input: `artifacts/<seed-id>/seed/seed.txt`
- output: `artifacts/<seed-id>/seed/seed.elementary-assertions.yaml`

These flags are convenience helpers only. They are not required for generic package usage.

## Rendering

The renderer is view-only. It does not modify extraction results.

Layouts:
- `compact` - one-line assertions
- `readable` - multi-line blocks
- `table` - Markdown-safe table; includes inline evidence
- `meaning` - grouped semantic display for readability only (non-normative, view-only)

Renderer contract-lock scope:
- Contract-locked by parity tests: `txt/compact`, `md/table`, `md/meaning`.
- Other layout/format combinations are best-effort and may evolve.

Renderer integrity validation (before emitting output):
- tokens must exist for all mentions
- mentions must exist for all assertions
- evidence references must resolve
- coverage references must resolve

Rendered files are not specifications and carry no authoritative semantics.

## Determinism rules (operational)

Deterministic ordering rules are enforced by core + validation tooling.
Scope:
- `runFromRelations(...)`: byte-stable for identical input and options within the same `elementary-assertions` version.
- `run` (upstream-running path): byte-stable only with pinned dependency versions (`elementary-assertions` and `linguistic-enricher`) and stable WTI service state/behavior for identical requests.

- Mention token order: by `token.i`
- Mention order: `(segment_id, span.start, span.end, kind, id)`
- Assertion order: `(segment_id, predicate head token.i, id)`
- View slot print order (renderer projection only): `actor`, `theme`, `attr`, `topic`, `location`, `other`
- Mention text reconstruction: single-space join of `token.surface`
- Segment text reconstruction: exact `canonical_text` slicing by segment span
- Identical input + identical flags produce byte-stable output within the determinism scope above

## Non-goals (operational restatement)

Tooling and core MUST NOT:
- normalize into high-level semantic frames
- perform concept identity mapping
- convert to normative keywords
- invent missing roles or attachments
- use model calls or probabilistic filling

This package is the first formal meaning layer, not final semantic normalization.
