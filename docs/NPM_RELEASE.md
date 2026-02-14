# NPM_RELEASE.md

This document defines the release flow for `elementary-assertions`.

Important: This project is not published to npmjs.
Consumers install it as a Git dependency pinned to a tag (or commit).
`files` is used to keep Git installs and `npm pack` deterministic; it does not imply publication to npmjs.

Examples (consumer `package.json`):

- SSH:
  - `"elementary-assertions": "git+ssh://git@github.com:svenschaefer/elementary-assertions.git#v1.2.3"`
- HTTPS:
  - `"elementary-assertions": "git+https://github.com/svenschaefer/elementary-assertions.git#v1.2.3"`

Consumers MUST pin to tags or commits, not branches.

## Core rule

A release is defined by:
- version bump in `package.json`
- a commit on `main`
- an annotated Git tag `vX.Y.Z` pointing at that commit

## Packaging rule for Git dependencies

Even though installs come from Git, the repository MUST remain a valid Node package.
Golden baseline freeze metadata is maintained in `test/artifacts/README.md`.

- `npm pack --dry-run` MUST succeed.
- `package.json` `files` is the primary packlist control.
- `.npmignore` is an additional safeguard, including explicitly excluding `prototype/`.

## 0) Preconditions

- Working tree clean.
- `npm test` passes.
- If `runElementaryAssertions` is used in smoke tests, ensure any required `wikipedia-title-index` endpoint is reachable.

## 1) Prepare release branch

```powershell
git checkout main
git pull
git checkout -b release/vX.Y.Z
```

## 2) Implement + test

* Make the change.
* Add/update regression tests.
* Run:

```powershell
npm test
```

## 3) Bump version (no auto-tag)

```powershell
npm version X.Y.Z --no-git-tag-version
```

If a lockfile exists and changes, keep it consistent with your npm version.

## 4) Pack sanity (must exclude prototype/)

```powershell
npm pack --dry-run
```

Optional: build the tarball locally (not uploaded anywhere):

```powershell
npm pack
```

Cleanup after local pack steps:

```powershell
Remove-Item -Force .\elementary-assertions-*.tgz
```

## 5) Smoke install checks (pre-tag)

Create a clean workspace and install from the commit hash you intend to tag.
Use the shared smoke script so API/CLI checks and render parity are enforced together.

Smoke workspace rule:
- Use `C:\code\elementary-assertions-smoke-test\`.
- Create one folder per clean install.
- Folder name MUST include the target version and the reason for the install (for example `v1.2.3-pretag-smoke-20260214-113000`).

```powershell
$SmokeRoot = "C:\code\elementary-assertions-smoke-test\vX.Y.Z-pretag-smoke-$(Get-Date -Format yyyyMMdd-HHmmss)"
New-Item -ItemType Directory -Path $SmokeRoot -Force | Out-Null
Set-Location $SmokeRoot
npm init -y | Out-Null

# Replace <COMMIT> with the commit you intend to tag
npm install "git+ssh://git@github.com:svenschaefer/elementary-assertions.git#<COMMIT>"

node C:\code\elementary-assertions\scripts\release-smoke-check.js --repo-root C:\code\elementary-assertions --smoke-root $SmokeRoot --out-root (Join-Path $SmokeRoot "rendered")
npm ls elementary-assertions
```

If the smoke test exercises `runElementaryAssertions`, also ensure the environment provides whatever endpoint configuration your CLI/tooling expects for `wikipedia-title-index`.

## 6) Commit + merge to main

Safeguard: `prototype/` is a junction. `git add -A` will stage changes from the junction target.
For release commits, prefer explicit staging paths to avoid unintended additions, for example:
`git add src docs test scripts package.json README.md CHANGELOG.md`.

```powershell
Set-Location C:\code\elementary-assertions
git add src docs test scripts package.json README.md CHANGELOG.md
git commit -m "release: vX.Y.Z"
git push -u origin release/vX.Y.Z
```

Merge the release branch to `main` (PR merge or fast-forward merge), then:

```powershell
git checkout main
git pull
git merge --ff-only release/vX.Y.Z
git push origin main
```

## 7) Tag + push

Tag only after the release commit is on `main`:

```powershell
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

## 8) Post-tag verification (install from tag)

```powershell
$SmokeRoot = "C:\code\elementary-assertions-smoke-test\vX.Y.Z-posttag-smoke-$(Get-Date -Format yyyyMMdd-HHmmss)"
New-Item -ItemType Directory -Path $SmokeRoot -Force | Out-Null
Set-Location $SmokeRoot
npm init -y | Out-Null

npm install "git+ssh://git@github.com:svenschaefer/elementary-assertions.git#vX.Y.Z"
node C:\code\elementary-assertions\scripts\release-smoke-check.js --repo-root C:\code\elementary-assertions --smoke-root $SmokeRoot --out-root (Join-Path $SmokeRoot "rendered")
npm ls elementary-assertions
```

## Failure rule

If anything is wrong after tagging, do not move or delete the tag.
Ship a new patch version with a new tag.

## Release notes

Create/update release notes using:
- `docs/RELEASE_NOTES_TEMPLATE.md`
