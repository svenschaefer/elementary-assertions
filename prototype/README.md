# Elementary Assertions (Step 12)

Step 12 converts accepted Step-11 linguistic relations into the first deterministic, auditable assertion layer.

Input structure is linguistic; output structure is assertion-centric:
- predicate
- arguments (role-based)
- modifiers (role-based)
- operators
- evidence
- coverage + unresolved accounting

Step 12 is conservative:
- no probabilistic inference
- no semantic guessing
- no hidden normalization

Current integration baseline in this repository:
- `linguistic-enricher@1.1.34`
- validated via `npm test` + `run/check/render/report` in Step 12

## Operational Contract

Step 12 follows the same operational model as Steps 07-11.

CLI:

```bash
node elementary-assertions.js --seed-id <id> [--artifacts-root <path>] [--wti-endpoint <url>] [--timeout-ms <ms>]
```

Paths:
- Input: `artifacts/<seed-id>/seed/seed.txt`
- Output: `artifacts/<seed-id>/seed/seed.elementary-assertions.yaml`

Runtime behavior:
- Step 12 runs `linguistic-enricher` up to `relations_extracted` in-memory.
- WTI endpoint is mandatory and passed to upstream as `services['wikipedia-title-index'].endpoint`.
- Endpoint precedence: CLI `--wti-endpoint` overrides env `WIKIPEDIA_TITLE_INDEX_ENDPOINT`.
- Missing endpoint fails fast with:
  `WTI endpoint is required for Step 12 (wikipedia-title-index service).`
- Step 12 performs a fail-fast `GET /health` check before execution.
- Step 12 does not perform Wikipedia lookups itself; all wiki evidence is consumed from upstream output.
- Step 12 no longer reads `seed.*.yaml` artifacts as inputs.

## Output Contract

Output `stage` MUST be:
- `elementary_assertions`

`schema_version` MUST be loaded from `artifacts/seed.schema.json` and written verbatim.

`index_basis` MUST be:
- `text_field: canonical_text`
- `span_unit: utf16_code_units`

All spans/offsets are UTF-16 code-unit offsets (JavaScript slicing semantics).

## Mention Inventory

Primary source priority:
1. accepted MWEs from upstream `relations_extracted`
2. token fallback for tokens not claimed by winning MWEs

Deterministic overlap winner policy:
1. longest MWE by token count
2. if tie, longer span length
3. if tie, earlier span start
4. if tie, lexicographically smaller annotation id

Result:
- one deterministic primary mention partition
- `is_primary=true` for winners/token fallbacks
- overlapping accepted MWEs/chunks retained as non-primary for provenance/recall

### Mention Head Precedence

1. explicit MWE head evidence (if valid)
2. Step 10 `chunk_head` covering the mention
3. dependency-informed head selection inside mention token set
4. POS fallback
5. unresolved

## Step 11 Label -> Step 12 Role Mapping

Current deterministic mapping:
- `actor` -> argument role `actor`
- `theme` -> argument role `theme`
- `patient` -> argument role `theme` (current policy)
- `recipient` -> modifier role `recipient`
- remaining argument-like roles -> modifier role entries (`{ role, mention_ids }`)

No implicit role invention beyond this fixed mapping.

## Operators

Operators are not slots. Core operator classes:
- modality
- negation
- coordination_group
- control markers (`control_propagation`, `control_inherit_subject`)

Optional means/method linkage is emitted only when explicit upstream evidence exists.

## Coverage Semantics

Coverage is computed over content-primary mentions only:
- domain: `is_primary=true` mentions whose head POS is content-bearing
  (`NN*`, `VB*`, `JJ*`, `RB*`, `CD`, `PRP`, `PRP$`, `FW`, `UH`), excluding punctuation surfaces
- non-primary mentions are provenance helpers, not coverage-closure requirements

Coverage fields:
- `primary_mention_ids`
- `covered_primary_mention_ids`
- `uncovered_primary_mention_ids`
- `unresolved`

## Unresolved Emission Policy

Unresolved output is grouped per reason per segment:
- one unresolved item per `(segment_id, mention_id, reason)`
- aggregated evidence token ids (and span when available)

## Identifier Policy

Stable deterministic IDs:
- mention id: `m:<segment_id>:<start>-<end>:<kind>`
- assertion id: `a:<segment_id>:<predicate_mention_id>:<stable-hash(arguments|modifiers|operators)>`

If short display IDs are ever added (`m1`, `a1`), they remain display-only.

## Persisted Model Contract (Role-Based)

Persisted assertions MUST include:
- `arguments[]`
- `modifiers[]`
- `operators[]`

Persisted assertions MUST NOT include:
- `assertions[*].slots`

Suppression traces use bucket naming:
- `transferred_buckets` (deterministically sorted)
- suppression reason `copula_bucket_sink_suppressed`

Legacy fields/values are rejected by schema/checker:
- `suppressed_assertions[*].transferred_slots`
- `copula_slot_sink_suppressed`

Renderer projections (`actor/theme/attr/topic/location/other`) are view-only.

## Renderer (View-Only)

Renderer input:
- `seed.elementary-assertions.yaml`

Renderer guarantees:
- no extraction/semantic mutation
- strict integrity validation before rendering (token/mention/evidence/coverage references resolve)

CLI:

```bash
node render-elementary-assertions.js \
  --in <path> \
  [--out <path>] \
  --format <txt|md> \
  [--layout <compact|readable|table|meaning>] \
  [--normalize-determiners <true|false>] \
  [--render-uncovered-delta <true|false>] \
  --segments <true|false> \
  --mentions <true|false> \
  --coverage <true|false> \
  --debug-ids <true|false>
```

Flag/layout behavior:
- `--out` omitted -> stdout only
- `--out` provided -> file write only
- `--format=txt|md`
- `--layout` default: `compact`
- `--normalize-determiners` default: `true`
- `--render-uncovered-delta` default: `false`
- `compact`: one-line assertions
- `readable`: multi-line blocks
- `table`: Markdown-safe table with inline `evidence` column
- `meaning`: grouped semantic display (view-only)

### Render Runner Defaults

`render-elementary-assertions.ps1` without parameters:
- renders all seeds with existing `seed.elementary-assertions.yaml`
- writes:
  - `seed.elementary-assertions.md` (`--format md --layout table`)
  - `seed.elementary-assertions.meaning.md` (`--format md --layout meaning`)
  - `seed.elementary-assertions.txt` (`--format txt --layout compact`)

Required timestamp invariants:
- `seed.elementary-assertions.md` newer than `seed.elementary-assertions.yaml`
- `seed.elementary-assertions.meaning.md` newer than `seed.elementary-assertions.yaml`
- `seed.elementary-assertions.txt` newer than `seed.elementary-assertions.yaml`

## Determinism Guarantees

- Mention token order: `token.i`
- Mention order: `(segment_id, span.start, span.end, kind, id)`
- Assertion order: `(segment_id, predicate head token.i, id)`
- View slot order: `actor`, `theme`, `attr`, `topic`, `location`, `other`
- Mention text reconstruction: single-space join of `token.surface`
- Segment text reconstruction: exact `canonical_text` slicing by segment span
- identical input + flags -> byte-stable output

## Additional Scripts

- `run-elementary-assertions.ps1` (one seed or all seeds)
- `check-elementary-assertions.ps1` (schema + integrity checks)
- `render-elementary-assertions.ps1` (render one seed or all seeds)
- `report-elementary-assertions.ps1` (baseline + maturity + hotspot reports)
- `elementary-assertions.test.js` (golden run + invariants)
- `render-elementary-assertions.test.js`
- `report-baseline-metrics.test.js`
- `report-maturity.test.js`
- `report-fragment-hotspots.test.js`

## Non-Goals

Step 12 MUST NOT:
- normalize into high-level semantic frames
- perform concept identity mapping
- convert to normative keywords
- invent missing roles/attachments
- use model calls or probabilistic filling

Step 12 is the first formal meaning layer, not final semantic normalization.

## Repository Status

This repository is private/internal and currently has no public license declaration.
