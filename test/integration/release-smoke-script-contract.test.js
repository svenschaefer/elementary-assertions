const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const scriptPath = path.resolve(__dirname, "..", "..", "scripts", "release-smoke-check.js");

test("release smoke script enforces meaning markdown parity", () => {
  const script = fs.readFileSync(scriptPath, "utf8");
  assert.match(script, /seed\.elementary-assertions\.meaning\.md/);
  assert.match(script, /layout",\s*"meaning"/);
  assert.match(script, /Render parity mismatch \(md\/meaning\)/);
});
