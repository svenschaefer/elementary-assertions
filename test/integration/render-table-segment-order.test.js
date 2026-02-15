const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const { renderElementaryAssertions } = require("../../src/render");

test("table layout uses natural segment id ordering (s1, s2, ..., s10)", () => {
  const inPath = path.resolve(
    __dirname,
    "..",
    "artifacts",
    "saas",
    "result-reference",
    "seed.elementary-assertions.yaml"
  );
  const doc = yaml.load(fs.readFileSync(inPath, "utf8"));
  const out = renderElementaryAssertions(doc, {
    format: "md",
    layout: "table",
    segments: false,
    mentions: false,
    coverage: false,
  });

  const s1 = out.indexOf("| s1 |");
  const s2 = out.indexOf("| s2 |");
  const s10 = out.indexOf("| s10 |");
  assert.ok(s1 >= 0 && s2 >= 0 && s10 >= 0, "expected s1/s2/s10 rows in table output");
  assert.ok(s1 < s2, "expected s1 rows before s2 rows");
  assert.ok(s2 < s10, "expected s2 rows before s10 rows");
});
