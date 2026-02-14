const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

test("documentation files referenced by README exist", () => {
  assert.ok(exists("AGENTS.md"));
  assert.ok(exists("README.md"));
  assert.ok(exists("docs/OPERATIONAL.md"));
  assert.ok(exists("docs/REPO_WORKFLOWS.md"));
  assert.ok(exists("docs/NPM_RELEASE.md"));
});

test("test layout has unit and integration folders", () => {
  assert.ok(exists("test/unit"));
  assert.ok(exists("test/integration"));
  assert.ok(exists("test/fixtures"));
  assert.ok(exists("test/helpers"));
  assert.ok(exists("test/artifacts"));
});
