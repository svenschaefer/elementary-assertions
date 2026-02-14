const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const packageJsonPath = path.join(repoRoot, "package.json");

test("package.json defines stable public export subpaths", () => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  assert.equal(typeof pkg.exports, "object");
  assert.equal(pkg.exports["."], "./src/index.js");
  assert.equal(pkg.exports["./validate"], "./src/validate/index.js");
  assert.equal(pkg.exports["./render"], "./src/render/index.js");
  assert.equal(pkg.exports["./tools"], "./src/tools/index.js");
  assert.equal(pkg.exports["./schema"], "./src/schema/seed.elementary-assertions.schema.json");
});

test("package.json packlist includes docs for linked README references", () => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  assert.ok(Array.isArray(pkg.files));
  assert.ok(pkg.files.includes("docs/"));
  assert.ok(pkg.files.includes("README.md"));
});
