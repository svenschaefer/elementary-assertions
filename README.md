# elementary-assertions

elementary-assertions is a deterministic, auditable assertion-construction layer for Node.js.

It converts accepted relations from `linguistic-enricher` into the first formal, assertion-centric meaning representation:

- predicate
- arguments (role-based)
- modifiers (role-based)
- operators
- evidence
- coverage and unresolved accounting

The library is conservative by design:
- no probabilistic inference
- no semantic guessing
- no hidden normalization

Its authoritative boundary ends at elementary assertions. Anything beyond this layer (concept models, norms, governance, domain interpretation) is explicitly downstream.

## What this package is

elementary-assertions is an assertion compiler that sits directly after linguistic relation extraction.

It:
- runs (or consumes) accepted linguistic relations
- constructs elementary assertions with exactly one predicate
- persists a role-based model (arguments, modifiers, operators)
- preserves explicit evidence and provenance
- computes coverage and unresolved items instead of repairing gaps
- guarantees deterministic, replayable output

## What this package is not

elementary-assertions deliberately does not:
- perform domain reasoning or business logic
- normalize predicates into semantic frames or ontologies
- invent missing roles or attachments
- infer facts beyond what is linguistically explicit
- convert output into normative keywords or policies
- depend on downstream ontologies or governance frameworks

## Core principles

Deterministic  
Determinism is mode-scoped:
- `runFromRelations(...)`: byte-identical output for identical `relationsSeed` and options, within the same `elementary-assertions` version.
- `runElementaryAssertions(...)`: byte-identical output only when all upstream inputs are fixed: identical text/options, pinned versions of `elementary-assertions` and `linguistic-enricher`, and stable WTI behavior for identical requests (service version, dataset state, and endpoint behavior).
Determinism is enforced by canonical identifiers, fixed ordering, schema validation, integrity checks, and golden-run tests.

Conservative  
If a structure cannot be projected deterministically, it is emitted as unresolved with explicit evidence. No silent repair.

Anchored  
All spans are UTF-16 code-unit offsets (JavaScript slicing semantics). All references are token- and id-anchored.

Evidence-first  
Assertions, roles, operators, suppression traces, and unresolved items carry explicit upstream evidence pointers.

Library-first  
The core API is the authoritative interface. CLI and renderers are tooling that consume the same API and remain view-only.

## Public API

### runElementaryAssertions(text, options)

Runs the upstream linguistic pipeline and produces elementary assertions.

- Input: plain text
- Output: a single document with `stage: "elementary_assertions"` (schema-conformant)

WTI endpoint requirement  
`runElementaryAssertions` requires a configured Wikipedia Title Index endpoint via `options.services["wikipedia-title-index"].endpoint`. If it is missing, execution fails explicitly.

Example:

```js
const { runElementaryAssertions } = require("elementary-assertions");

const doc = await runElementaryAssertions("A webshop is an online store.", {
  services: {
    "wikipedia-title-index": { endpoint: "http://localhost:3000" }
  },
  timeoutMs: 30000
});

console.log(doc.stage); // elementary_assertions
```

### runFromRelations(relationsSeed, options)

Builds elementary assertions from an already enriched upstream document (typically `relations_extracted` output).

This entry point:
- does not run the upstream pipeline
- does not require a WTI endpoint (WTI evidence is consumed if present in the provided seed)

Example:

```js
const { runFromRelations } = require("elementary-assertions");

const doc = runFromRelations(relationsSeed, {});
```

## Contract enforcement and view tooling

These modules are consumers of the core model.

Validation (schema + integrity checks):
```js
const { validateElementaryAssertions } = require("elementary-assertions/validate");
validateElementaryAssertions(doc);
```

Determinism is enforced via regression and golden-reference tests.

Rendering (view-only, multiple layouts):
```js
const { renderElementaryAssertions } = require("elementary-assertions/render");
const md = renderElementaryAssertions(doc, { format: "md", layout: "table" });
```

Tooling (file I/O and CLI wiring):
```js
const tools = require("elementary-assertions/tools");
```

## Output contract (summary)

- `stage` MUST be `elementary_assertions`
- `schema_version` is carried verbatim from the upstream seed schema when present; otherwise it is omitted
- `index_basis` MUST be:
  - `text_field: canonical_text`
  - `span_unit: utf16_code_units`
- persisted assertions MUST be role-based:
  - `arguments[]` (always present, empty allowed)
  - `modifiers[]` (always present, empty allowed)
  - `operators[]` (always present, empty allowed)
- persisted assertions MUST NOT include legacy view-shaped fields:
  - `assertions[*].slots`

For full operational details (CLI commands, repo layout convenience, runner scripts, rendering defaults), see `docs/OPERATIONAL.md`.
For repository-only workflow policies (not package contract), see `docs/REPO_WORKFLOWS.md`.

## Package entry points

- Core API: `require("elementary-assertions")`
- Validation: `require("elementary-assertions/validate")`
- Rendering: `require("elementary-assertions/render")`
- Tooling: `require("elementary-assertions/tools")`
- Schema asset (stable export): `require("elementary-assertions/schema")`

## Documentation

- Agent constraints: `AGENTS.md`
- Operational guide: `docs/OPERATIONAL.md`
- Repository workflow policies: `docs/REPO_WORKFLOWS.md`
- Release flow: `docs/NPM_RELEASE.md`

## License

See LICENSE (if present).
