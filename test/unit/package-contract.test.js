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

test("package metadata pins MIT license and ships LICENSE file", () => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  assert.equal(pkg.license, "MIT");
  assert.ok(Array.isArray(pkg.files));
  assert.ok(pkg.files.includes("LICENSE"));

  const licensePath = path.join(repoRoot, "LICENSE");
  const licenseText = fs.readFileSync(licensePath, "utf8");
  assert.match(licenseText, /^MIT License/m);
});

test("package metadata defines Node 24+ engine floor", () => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  assert.equal(typeof pkg.engines, "object");
  assert.equal(pkg.engines.node, ">=24.0.0");
});

test("exported schema JSON is non-empty and parseable", () => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const schemaPath = path.join(repoRoot, pkg.exports["./schema"]);
  const raw = fs.readFileSync(schemaPath, "utf8");
  assert.ok(raw.trim().length > 0, "schema export file must not be empty");

  const schema = JSON.parse(raw);
  assert.equal(typeof schema, "object");
  assert.equal(schema.type, "object");
  assert.equal(typeof schema.$schema, "string");
});
