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
});

test("README documentation links reference existing files", () => {
  const readme = read("README.md");
  const requiredDocs = [
    "AGENTS.md",
    "docs/OPERATIONAL.md",
    "docs/REPO_WORKFLOWS.md",
    "docs/NPM_RELEASE.md",
    "docs/RELEASE_NOTES_TEMPLATE.md",
    "CHANGELOG.md",
  ];

  for (const doc of requiredDocs) {
    assert.match(readme, new RegExp(doc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(exists(doc), `missing documented file: ${doc}`);
  }
});
