const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const yaml = require("js-yaml");

const { renderElementaryAssertions } = require("../../src/render");
const { listSeedIds, getSeedArtifactPaths } = require("../helpers/artifacts");

for (const seedId of listSeedIds()) {
  test(`${seedId} parity: md render matches frozen meaning golden`, () => {
    const p = getSeedArtifactPaths(seedId);
    const raw = fs.readFileSync(p.goldenYaml, "utf8");
    const doc = yaml.load(raw);
    const out = renderElementaryAssertions(doc, {
      format: "md",
      layout: "meaning",
      segments: true,
      mentions: true,
      coverage: true,
      debugIds: false,
      normalizeDeterminers: true,
      renderUncoveredDelta: false,
    });
    const expected = fs.readFileSync(p.goldenMeaningMd, "utf8");
    assert.equal(out, expected);
  });
}
