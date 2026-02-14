# TODO - 12-elementary-assertions

## Scope

This TODO tracks only active remaining work for Step 12 in this repository.

Out of scope for this file:
- historical implementation logs
- completed cycle narratives
- archived migration notes

## Current status

- Step 12 is active and stable.
- Persisted assertion model is role-based (`arguments` / `modifiers` / `operators`); legacy persisted `slots` are rejected by schema/checker.
- Extraction, checker, renderer, and reports are deterministic and green in normal cycle.
- Catch-all theme trimming is implemented and active.
- Passive theme assignment is clause-gated (`VBN`), reducing `executed` / `accepted` mixed-theme assertions.
- Upstream `linguistic-enricher` 1.1.5 improved determiner-subject finite-verb disambiguation and `such as` exemplar projection; Step-12 sees stronger exemplar evidence with less spurious event promotion in list contexts.
- Upstream `linguistic-enricher` 1.1.6 improved copula complement (`acomp`/`attr`) and passive adverb attachment; Step-12 receives cleaner copula/passive relation signals while remaining copula-carrier suppression stays a local backlog item.
- Upstream `linguistic-enricher` 1.1.7 improves Step-12 inputs for exemplar and purpose chains (e.g. `exemplifies(...)`, `beneficiary(recorded,auditing)` now visible in artifacts).
- Upstream `linguistic-enricher` 1.1.8 adds temporal `for + CD + noun` hardening; Step-12 now sees stronger duration relations (e.g. `irs s8` gained modifier evidence), while temporal/condition drift into theme remains an open Step-12 host/role issue.
- Upstream `linguistic-enricher` 1.1.9 normalizes additive `as well as` coordination evidence; Step-12 no longer attaches connector tokens as modifiers in `irs s2`, but unresolved/coverage currently regressed there (`as`, `well` unresolved), so this remains a monitored upstream-interface effect.
- Upstream `linguistic-enricher` 1.1.10 suppresses contradictory passive fallback actor/theme synthesis; Step-12 now gets cleaner passive role signals (e.g. `reviewed by supervisors`), with broader actor->theme shifts in passive rows that should be monitored for readability and role-policy fit.
- Upstream `linguistic-enricher` 1.1.11 adds coordinated-clause noun attachment and actor propagation across verb `conj`; Step-12 sees better local subject/object handling in some chains (e.g. `access_control` coverage +1), but current artifacts also show regressions in `irs`/`webshop` (higher uncovered/noise and additional nominal fragments), so this requires active monitoring before calling it net-positive.
- Upstream `linguistic-enricher` 1.1.12 improves inline multi-verb comma-list coordination structure; Step-12 shows cleaner grouped action rendering in `webshop`, but also reintroduces a low-quality copula carrier row (`are (predicate_quality=low)` in `s2`) that conflicts with current carrier-elimination expectations.
- Upstream `linguistic-enricher` 1.1.13 hardens passive subject anchoring for noun chains before `be+VBN`; while this improves anchor consistency upstream, current Step-12 artifacts show mixed side effects (e.g. `prime_gen s2` reintroduces standalone `given (predicate_quality=low)` and `irs s1` gains extra nominal modifier payload), so keep this release under active regression watch.
- Upstream `linguistic-enricher` 1.1.14 suppresses residual VP-fallback passive noise and preserves nominal modifier heads under PP normalization; Step-12 shows cleaner passive noise profile (e.g. `irs` structural fragments reduced), while remaining carrier regressions (`given`/`are (low)`) still need explicit Step-12 policy handling.
- Upstream `linguistic-enricher` 1.1.15 suppresses connector-local `such as` noise in Stage 11 dep-label projection; Step-12 artifacts remain stable overall, with a minor current-side effect in `access_control` coverage (`such` now unresolved) that should be monitored.
- Upstream `linguistic-enricher` 1.1.16 normalizes coordinated nominal-tail orientation in purpose PP chains; current Step-12 impact is mixed: `prime_factors` improved (`covered +1`, `uncovered -1`) while `access_control` regressed slightly (`covered -1`, `uncovered +1`, `such` unresolved), so keep this version under active monitoring.
- Upstream `linguistic-enricher` 1.1.17 adds connector-contract regression locks; in this Step-12 repo the upgrade was behavior-neutral (no artifact deltas), consistent with a contract-lock release.
- Upstream `linguistic-enricher` 1.1.18 targets clause/PP drift in complex comma-coordination variants; current Step-12 run shows explicit effects (notably `prime_gen s2` no longer emits standalone `given (low)` and maps `starts` to PP location), while cross-seed side effects still require monitoring (`irs`/`access_control` assertion-shape shifts).
- Upstream `linguistic-enricher` 1.1.19 hardens fallback boundaries in long passive/complement chains; historical Step-12 checkpoint showed reduced long-chain noise in `irs` (fragment/noise drop) and temporary webshop coverage recovery (`covered` = 22 at that checkpoint). Current baseline has shifted again (`webshop covered` = 21), so this remains monitor-only.
- Upstream `linguistic-enricher` 1.1.20/1.1.21 adjusted and fixed packaging around fallback actor suppression; no persistent Step-12 artifact deltas beyond the intended 1.1.20 actor-restoration shape.
- Upstream `linguistic-enricher` 1.1.22 introduced weak-carrier suppression that oversuppressed webshop/IRS copula attribute/modifier payload in long-chain shapes; this regression was not adopted as stable.
- Upstream `linguistic-enricher` 1.1.23 narrowed the 1.1.22 suppression and restored webshop/IRS copula payload coverage (`available/actually`, `valid/present`), with no adverse Step-12 metric drift.
- Upstream `linguistic-enricher` 1.1.24 fixed webshop copula-theme drift (`theme(is,purchase)` removed; `attribute(is,store)` preserved).
- Upstream `linguistic-enricher` 1.1.25 removed webshop pronoun-as-predicate artifacts (`head=them`) while preserving `theme(put, them)`.
- Upstream `linguistic-enricher` 1.1.26 weak-`are` remap produced an unwanted host drift to `doing` in webshop `s2`; this regression was rejected (no stable adoption).
- Upstream `linguistic-enricher` 1.1.27 fixed the `doing` remap regression by excluding gerund hosts in weak-`are` remap selection; webshop baseline metrics returned to stable values.
- Upstream `linguistic-enricher` 1.1.28 was test/documentation-only for connector contract locks; Step-12 artifacts remained unchanged.
- Upstream `linguistic-enricher` 1.1.29 added cross-seed drift guardrail locks (`access_control`/`irs`/`webshop`); Step-12 artifacts remained stable.
- Current upstream integration baseline is `linguistic-enricher@1.1.34`.
- Open upstream-interface gap (still reproducible): connector-token unresolveds remain visible in Step 12 (`irs s2`: `as`/`well`; `access_control s3`: `such`), while upstream intentionally keeps connector tokens out of accepted semantic endpoints.
- Open carrier gap (still reproducible): low-quality copula carriers remain as standalone rows in some long-chain shapes (`webshop s2 are (low)`, `access_control s2 are (low)`), although payload remap improved in 1.1.34.
- Open nominal-fragment gap (still reproducible): residual nominal payload/unresolved fragments remain (`prime_factors s2`: `their`/`product`, plus related nominal residuals in `access_control`/`irs`).
- Carrier elimination (phase 1) was achieved in earlier cycles; current remaining issue is primarily weak copula carrier persistence (notably `webshop s2 are(low)`), while historical `prime_gen s2 given(low)` is currently not reproduced.
- Predicate/theme self-overlap normalization is active for current acute cases (`webshop s1 placing an order`, `prime_factors s3 continues iteratively`).

## Working rules

- Preserve deterministic behavior and stable ids/order.
- No semantic invention or probabilistic inference.
- Keep upstream-evidence-driven policy.
- Treat coverage/unresolved and maturity outputs as regression-sensitive.

## Open backlog (priority order)

### [ ] 1) Predicate decomposition after overlap cleanup (MWE/chunk heads)
- Goal:
  - improve event-core readability where overlap is already removed but predicate remains coarse (`continues iteratively`, `placing an order`).
- Representative residuals:
  - `prime_factors s3`: keep event core (`continues`) and project `iteratively` as modifier when evidence supports it.
  - `webshop s1`: evaluate whether nominal MWE predicate should remain as-is or be deterministically decomposed without semantic guessing.
- Constraints:
  - deterministic only, evidence-driven only.
  - no inferred semantics beyond observed token/mention relations.
- Success signal:
  - cleaner predicate center while preserving role/evidence determinism.

### [ ] 2) Remaining low-quality copula carrier residues
- Goal:
  - reduce remaining standalone low-quality copula assertions that still do not contribute an independent proposition core.
- Representative residuals:
  - `webshop s1` (`is (predicate_quality=low)`),
  - `prime_factors s2` (`be (predicate_quality=low)`),
  - `access_control s2` (`are (predicate_quality=low)`),
  - `irs s4` (`is (predicate_quality=low)`).
- Constraints:
  - do not suppress when operator/evidence payload would be lost.
  - keep clause-local deterministic host selection.
- Success signal:
  - fewer rendered `predicate_quality=low` rows with fragile or carrier-only payload.

### [ ] 3) Subject/role integrity in control/passive chains
- Goal:
  - improve actor/patient visibility where upstream role evidence exists.
- Representative residuals:
  - `access_control s4`/`s5` role coherence around `holds` / purpose clauses,
  - passive/control rows with empty actor but non-empty proposition payload.
- Constraints:
  - no guessed actors.
  - role projection remains evidence-driven.
- Success signal:
  - fewer empty-actor or over-broad actor assertions in cases with available upstream subject-role evidence.

### [ ] 4) Modifier host hardening (defensive, structural)
- Goal:
  - reduce wrong-host modifier attachments while keeping deterministic projection and unresolved-first fallback.
- Representative residuals:
  - `prime_gen s4`: `used` still carries purpose material in theme (`for educational purposes`).
  - `webshop s2`: weak copula carrier row (`are (low)`) still persists with `attribute=available`; `modifier=actually` is now attached to `needs` in 1.1.34, but the standalone carrier row remains.
  - `access_control s5`: purpose phrase material still competes with standalone `auditing` assertion.
  - `irs s8`: temporal/condition material drifts into theme (`10 years, if ...`).
- Constraints:
  - no semantic compatibility scoring.
  - no absolute bans like “PP type X is never an argument”.
  - attachment only with explicit relation evidence + clause-local eligible host.
  - do not attach to low/carrier/structural-fragment hosts.
  - if no valid host exists: keep unresolved (do not force attachment).
- Success signal:
  - fewer wrong-host modifiers and fewer temporal/purpose/condition spans inside argument roles, without semantic guessing.

### [ ] 5) Enumeration/list/example-marker handling (upstream-dependent interface)
- Goal:
  - improve output stability for list-heavy segments (`such as`, `as well as`, bullet-like content), without inventing relations.
- Representative residuals:
  - `access_control s3`: `administer` still emitted as standalone while list structure is incomplete.
  - `irs s6`: coordinated actions (`request/update/assign`) not fully represented as separate proposition cores.
- Notes:
  - this is partly Step 12 post-processing, partly upstream 00..11 relation-shape dependent.
- Success signal:
  - reduced list-collapse artifacts and clearer unresolved reporting when relation closure is incomplete.

### [ ] 6) Consistent carrier elimination (phase 2: nominal/function-word residues)
- Goal:
  - deterministically drop or integrate remaining non-propositional nominal/function-word carriers when they do not carry an independent propositional core.
- Constraints:
  - evidence-driven only (no semantic guessing).
  - do not drop assertions that are the only carrier of required operator/evidence information.
- Open seed-backed targets (`current -> target`):
  - `access_control s5` 
    - current: `beneficiary:auditing` on `recorded` is present (improved), but a standalone `auditing` assertion is still emitted.
    - target: keep the beneficiary attachment on `recorded`, remove standalone `auditing`.
  - `prime_factors s2`
    - current: standalone nominal `factor` assertion.
    - target: drop nominal carrier assertion.
    - note: current uncovered drift on `product` in `their product` is temporarily accepted as a special-case possessive/coreference shape (`their` -> previously introduced `prime numbers`) and should not block the current Step-12 baseline unless additional regressions appear.
  - `webshop s2`
    - current: standalone weak copula carrier `are (predicate_quality=low)` with `available/actually` payload.
    - target: deterministic carrier integration or suppression without payload loss and without host drift.
- Success signal:
  - lower assertion noise from nominal/function-word carriers.
  - no regressions in checker/schema determinism.

### [ ] 7) CI-style maturity/delta guard tightening
- Goal:
  - keep Gate metrics explicit and automated for future rule changes.
- Constraints:
  - threshold adjustments must be explicit and reviewed.
- Success signal:
  - baseline-delta checks catch unintended drift early.

## Completed / monitor-only

### [x] Role-based persistence hard-cut
- `slots` removed from persisted assertions.
- `arguments` / `modifiers` / `operators` are the only persisted assertion payload.

### [x] Renderer role-projection migration
- renderer consumes role payload only; no persisted `slots` dependency.

### [x] Catch-all theme trimming
- oversized mixed-clause theme spans reduced via deterministic trimming.

### [x] Passive clause-gated theme assignment
- passive (`VBN`) theme projection constrained to predicate-local clause windows.

### [x] Carrier elimination (phase 1, historical milestone)
- earlier cycles removed standalone `prime_gen s2 given` and `webshop s2 are(low)` carrier assertions and moved `prime_factors s4 is(low)` payload to `used`.
- current status: these reductions are not fully stable across recent upstream versions; keep under active regression watch and treat as open stabilization work (see backlog items 2 and 6).

### [x] Predicate/theme self-overlap normalization (phase 1)
- removed self-theme duplication for `webshop s1` (`placing an order`).
- removed self-theme duplication for `prime_factors s3` (`continues iteratively`).
- kept strict verbal overlap rule and deterministic nominal/MWE exact-self filtering.

## Validation checklist (for each implementation change)

1. `npm test`
2. `./run-elementary-assertions.ps1`
3. `./check-elementary-assertions.ps1`
4. `./render-elementary-assertions.ps1`
5. `./report-elementary-assertions.ps1`
6. Validate timestamp rules per seed:
- `seed.elementary-assertions.md` newer than `seed.elementary-assertions.yaml`
- `seed.elementary-assertions.meaning.md` newer than `seed.elementary-assertions.yaml`
- `seed.elementary-assertions.txt` newer than `seed.elementary-assertions.yaml`



















