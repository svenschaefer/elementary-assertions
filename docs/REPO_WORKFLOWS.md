# Repository Workflow Policies

This document defines repository workflow policies. These policies are not part of the npm package contract.

## Timestamp invariants (Secos repo workflow only)

When workflow automation writes rendered artifacts next to the YAML output, enforce:
- `seed.elementary-assertions.md` newer than `seed.elementary-assertions.yaml`
- `seed.elementary-assertions.meaning.md` newer than `seed.elementary-assertions.yaml`
- `seed.elementary-assertions.txt` newer than `seed.elementary-assertions.yaml`

These constraints apply to the Secos repository workflow only and do not define runtime behavior of `elementary-assertions` as a package.

## Performance baseline (manual repo workflow)

Use the benchmark helper to keep a coarse local baseline for `runFromRelations` performance:

```powershell
npm run benchmark:core
```

Optional iterations override:

```powershell
npm run benchmark:core -- 1000
```

This benchmark is advisory for repo workflow only (trend watching) and is not a package contract gate.
