const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const packageJsonPath = path.join(repoRoot, "package.json");

test("dependency freeze pins linguistic-enricher to exact 1.1.34", () => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  assert.equal(pkg.dependencies?.["linguistic-enricher"], "1.1.34");
});

