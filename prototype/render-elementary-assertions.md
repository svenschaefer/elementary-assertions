# render-elementary-assertions.md

This document describes what the Step 12 renderer prints from
`seed.elementary-assertions.yaml`, and what it intentionally does not print.

## Scope

The renderer is view-only:
- It never changes extraction results.
- It never invents semantics.
- It reads YAML and emits human-readable text/markdown.

Producer-side meaning rules that feed this renderer:
- Step 12 persists assertions in a role-based shape (`arguments`, `modifiers`, `operators`).
- Renderer derives display columns from roles via deterministic projection (no persisted `slots` reads).
- Wikipedia-title-index is evidence-only (`wiki_title_evidence` and mention/assertion evidence), never role-binding logic.
- Step 12 materializes wiki evidence from upstream `relations_extracted` output produced by `linguistic-enricher`.
- Step 12 does not perform wikipedia title index lookups itself (no REST query loop, no direct DB access).
- WTI endpoint configuration is mandatory for Step 12 execution and is passed to `linguistic-enricher` as
  `services['wikipedia-title-index'].endpoint` (CLI `--wti-endpoint` takes precedence over env `WIKIPEDIA_TITLE_INDEX_ENDPOINT`).

Current rendered sections (depending on flags):
- `Segments`
- `Assertions`
- `Mentions`
- `Coverage` (including unresolved items)

## Rendered Semantics

### Segments
- Purpose: context and anchoring.
- Contains segment id and segment text slices from `canonical_text`.
- No semantic interpretation is introduced.

### Mentions
- Purpose: addressable spans for assertions and diagnostics.
- Includes `kind`, `is_primary`, head token, span, segment id (and ids in debug mode).
- `is_primary=true` drives coverage domain accounting.
- Non-primary mentions (e.g., alternatives/chunks) are provenance/recall aids.

### Assertions
- Purpose: formal Step 12 meaning layer.
- Includes predicate, role-projected view columns, operators, and evidence summaries.
- Deterministic ordering and rendering are applied.

### Coverage
- Purpose: utilization accounting over primary, content-bearing mentions.
- Includes covered/uncovered sets and unresolved entries.
- Coverage is measurement, not failure status.
- Uncovered mentions are rendered in two deterministic display buckets:
  - `Strictly Uncovered Primary Mentions`: uncovered mentions that are not fully contained in any mention used by assertions.
  - `Contained Uncovered Primary Mentions`: uncovered mentions whose `token_ids` are fully contained in one or more mentions used by assertions.
- This split is display-only and does not change YAML coverage semantics.

## Non-Rendered YAML Fields

Step 12 YAML contains additional machine-facing sections that the renderer does not print in dedicated sections:
- `relation_projection`
- `accepted_annotations`
- `diagnostics`
- `sources.pipeline`
- token passthrough metadata (`normalized`, `flags`, `joiner`, `pos.coarse`, token lexicon payloads)

This omission is intentional for readability. These fields remain authoritative in YAML for downstream automation.

## Layouts and Determinism

Supported layouts:
- `compact` (default, backward-compatible)
- `readable`
- `table`
- `meaning` (view-only semantic grouping)

### Table Layout Contract

For `layout=table`, Markdown validity is strict:
- Assertions are rendered as exactly one Markdown table row per assertion.
- Evidence is rendered inline in a dedicated `evidence` column.
- The renderer must not emit list items, prose blocks, or blank separators between table rows.

Evidence cell format is deterministic and compact:
- per-role counts: `role(r=<relation_ids_count>,t=<token_ids_count>)`
- operator counts: `operators(r=<relation_ids_count>,t=<token_ids_count>)`

Example evidence cell:
- `actor(r=0,t=4); theme(r=0,t=2); location(r=0,t=2); operators(r=0,t=0)`

### Meaning Layout Rules

`layout=meaning` is additive and non-normative. It groups existing assertions only:
- `Definitions`: copular predicates or assertions with `attr`
- `Capabilities`: assertions with `modality(can)`
- `Requirements`: assertions with `control_*` ops or requirement predicates (e.g. `needs`)
- `Coordinated Actions`: assertions carrying `coordination_group`
- `Actions`: fallback group

Rows are displayed as:
- `Actor | Predicate | Theme | Attr | Location | wiki⁺`

Carrier copulas (`is/are/was/were`) may be visually de-emphasized as `(copula:...)` when `attr` is present.
This is presentation-only; YAML assertions are unchanged.

### Optional Display Flags

- `--normalize-determiners true|false` (default: `true`)
  - Display-only determiner parenthesizing (for example `(a) generator`, `(the) shop`).
- `--render-uncovered-delta true|false` (default: `false`)
  - Appends display-only uncovered summary counts.

### Wiki Markers in All Layouts (Evidence Only)

Inline marker convention:
- `⟦surface_text|wiki:exact⟧`: exact Wikipedia title match (`exact_titles` non-empty)
- `⟦surface_text|wiki:prefix⟧`: prefix Wikipedia title match (`prefix_titles` non-empty, no exact match)

Deterministic precedence:
- Exact takes priority over prefix for the same surface.
- Markers are applied consistently in `compact`, `readable`, `table`, and `meaning` outputs.
- `SegmentText` remains raw and is never wrapped.

`wiki⁺` column behavior (`layout=meaning` only):
- `wiki✓` when any predicate/theme/attr/location field has exact or prefix evidence.
- `-` when no inline wiki marker is present in the row.

These markers are evidence-only and must never create or alter assertions.

## Encoding Note

Rendered files are UTF-8 text. If apostrophes display as mojibake (for example `ÔÇÖ`), the viewer/editor is likely interpreting UTF-8 bytes with a non-UTF-8 code page. Configure the viewer to UTF-8.
For canonical file outputs, prefer renderer `--out` (or `render-elementary-assertions.ps1 -OutPath ...`) instead of shell pipe redirection.

## Normative Guideline

The renderer explains; the YAML artifact is authoritative.