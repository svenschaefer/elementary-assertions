const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const { renderElementaryAssertions } = require("../../src/render");

const base = path.join(
  __dirname,
  "..",
  "artifacts",
  "webshop",
  "result-reference"
);

function loadDoc() {
  const raw = fs.readFileSync(path.join(base, "seed.elementary-assertions.yaml"), "utf8");
  return yaml.load(raw);
}

test("webshop parity: txt render matches frozen compact golden", () => {
  const doc = loadDoc();
  const out = renderElementaryAssertions(doc, {
    format: "txt",
    layout: "compact",
    segments: true,
    mentions: true,
    coverage: true,
    debugIds: false,
    normalizeDeterminers: true,
    renderUncoveredDelta: false,
  });
  const expected = fs.readFileSync(path.join(base, "seed.elementary-assertions.txt"), "utf8");
  assert.equal(out, expected);
});

test("webshop parity: md render matches frozen table golden", () => {
  const doc = loadDoc();
  const out = renderElementaryAssertions(doc, {
    format: "md",
    layout: "table",
    segments: true,
    mentions: true,
    coverage: true,
    debugIds: false,
    normalizeDeterminers: true,
    renderUncoveredDelta: false,
  });
  const expected = fs.readFileSync(path.join(base, "seed.elementary-assertions.md"), "utf8");
  assert.equal(out, expected);
});
