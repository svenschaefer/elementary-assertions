# RELEASE_NOTES_TEMPLATE.md

Use this template for each release note entry.

## Release

- Version: `vX.Y.Z`
- Date: `YYYY-MM-DD`
- Release commit: `<commit-sha>`
- Tag: `vX.Y.Z`

## CI Evidence

- Workflow: `CI`
- Run id: `<github-actions-run-id>`
- Result: `success|failure`

## Smoke Evidence

- Pre-tag smoke root: `C:\code\elementary-assertions-smoke-test\vX.Y.Z-pretag-smoke-<timestamp>`
- Post-tag smoke root: `C:\code\elementary-assertions-smoke-test\vX.Y.Z-posttag-smoke-<timestamp>`
- Pre-tag rendered root: `...\rendered`
- Post-tag rendered root: `...\rendered`

## Contract Notes

- API surface check summary:
- CLI help check summary:
- Render parity check summary:

## Changes Summary

- Added:
- Changed:
- Fixed:
- Removed:

