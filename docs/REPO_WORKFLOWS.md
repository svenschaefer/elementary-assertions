# Repository Workflow Policies

This document defines repository workflow policies. These policies are not part of the npm package contract.

## Timestamp invariants (repository workflow only)

When workflow automation writes rendered artifacts next to the YAML output, enforce:
- `seed.elementary-assertions.md` newer than `seed.elementary-assertions.yaml`
- `seed.elementary-assertions.meaning.md` newer than `seed.elementary-assertions.yaml`
- `seed.elementary-assertions.txt` newer than `seed.elementary-assertions.yaml`

These constraints apply to repository workflow only and do not define runtime behavior of `elementary-assertions` as a package.

## Performance baseline (manual repo workflow)

Use the benchmark helper to keep a coarse local baseline for `runFromRelations` performance:

```powershell
npm run benchmark:core
```

Optional iterations override:

```powershell
npm run benchmark:core -- 1000
```

Optional dense scenario override:

```powershell
npm run benchmark:core -- 1000 dense
```

This benchmark is advisory for repo workflow only (trend watching) and is not a package contract gate.

## CI gates (repo workflow)

Current CI workflow gates on:
- `npm install`
- `npm test`
- dev report script execution:
  - `npm run dev:report:metrics`
  - `npm run dev:report:hotspots`
  - `npm run dev:report:maturity`
- `npm pack --dry-run`
- packed-tarball clean-install smoke check via `scripts/release-smoke-check.js`

These are repository quality gates and release hygiene checks, not package runtime contract.

## Local release preflight (repo workflow)

Run local preflight checks before tagging:

```powershell
npm run release:check
```

This command enforces:
- clean git worktree (`scripts/ensure-clean-worktree.js`)
- repository quality gates via `npm run ci:check`
