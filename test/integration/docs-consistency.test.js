const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

test("CHANGELOG keeps an Unreleased section", () => {
  const changelog = read("CHANGELOG.md");
  assert.match(changelog, /^## Unreleased\s*$/m);
});

test("release guide references shared smoke script", () => {
  const releaseGuide = read("docs/NPM_RELEASE.md");
  assert.match(releaseGuide, /scripts[\\/]+release-smoke-check\.js/);
  assert.match(releaseGuide, /md\/meaning/);
  assert.match(releaseGuide, /vX\.Y\.Z-git-smoke-/);
  assert.match(releaseGuide, /vX\.Y\.Z-npmjs-smoke-/);
});

test("release guide uses explicit staging paths for release commits", () => {
  const releaseGuide = read("docs/NPM_RELEASE.md");
  assert.match(
    releaseGuide,
    /git add src docs test scripts package\.json README\.md CHANGELOG\.md/
  );
  assert.doesNotMatch(releaseGuide, /\ngit add -A\n/);
});

test("README documentation links reference existing files", () => {
  const readme = read("README.md");
  const requiredDocs = [
    "AGENTS.md",
    "docs/OPERATIONAL.md",
    "docs/REPO_WORKFLOWS.md",
    "docs/NPM_RELEASE.md",
    "docs/DEV_TOOLING.md",
    "docs/RELEASE_NOTES_TEMPLATE.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
  ];

  for (const doc of requiredDocs) {
    assert.match(readme, new RegExp(doc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(exists(doc), `missing documented file: ${doc}`);
  }
});

test("README documents stable validation error contract", () => {
  const readme = read("README.md");
  assert.match(readme, /ValidationError/i);
  assert.match(readme, /stable\s+`code`\s+field/i);
});
