const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const { listSeedIds, getSeedArtifactPaths, readGoldenYamlText } = require("../helpers/artifacts");

test("golden reference set is complete for each artifact seed", () => {
  const seedIds = listSeedIds();
  assert.ok(seedIds.length > 0, "expected at least one artifact seed");

  for (const seedId of seedIds) {
    const p = getSeedArtifactPaths(seedId);
    assert.ok(fs.existsSync(p.seedTxt), `${seedId}: missing seed.txt`);
    assert.ok(fs.existsSync(p.goldenYaml), `${seedId}: missing golden yaml`);
    assert.ok(fs.existsSync(p.goldenTxt), `${seedId}: missing golden txt`);
    assert.ok(fs.existsSync(p.goldenMd), `${seedId}: missing golden md`);
    assert.ok(fs.existsSync(p.goldenMeaningMd), `${seedId}: missing golden meaning md`);
  }
});

test("golden YAML files carry core contract markers", () => {
  const seedIds = listSeedIds();

  for (const seedId of seedIds) {
    const text = readGoldenYamlText(seedId);
    assert.ok(text.length > 0, `${seedId}: yaml must be non-empty`);
    assert.match(text, /^stage:\s*elementary_assertions\s*$/m, `${seedId}: stage marker missing`);
    assert.match(text, /^index_basis:\s*$/m, `${seedId}: index_basis marker missing`);
    assert.match(text, /^\s*text_field:\s*canonical_text\s*$/m, `${seedId}: index_basis.text_field mismatch`);
    assert.match(text, /^\s*span_unit:\s*utf16_code_units\s*$/m, `${seedId}: index_basis.span_unit mismatch`);
    assert.match(text, /^mentions:\s*$/m, `${seedId}: mentions marker missing`);
    assert.match(text, /^assertions:\s*$/m, `${seedId}: assertions marker missing`);
  }
});

test("golden render artifacts are non-empty files", () => {
  const seedIds = listSeedIds();

  for (const seedId of seedIds) {
    const p = getSeedArtifactPaths(seedId);
    for (const filePath of [p.goldenTxt, p.goldenMd, p.goldenMeaningMd]) {
      const content = fs.readFileSync(filePath, "utf8");
      assert.ok(content.length > 0, `${seedId}: empty render artifact ${path.basename(filePath)}`);
    }
  }
});

test("golden YAML parsed structure matches product contract essentials", () => {
  const seedIds = listSeedIds();

  for (const seedId of seedIds) {
    const parsed = yaml.load(readGoldenYamlText(seedId));
    assert.ok(parsed && typeof parsed === "object", `${seedId}: yaml must parse to object`);
    assert.equal(parsed.stage, "elementary_assertions", `${seedId}: stage mismatch`);

    assert.ok(Array.isArray(parsed.tokens), `${seedId}: tokens[] required`);
    assert.ok(Array.isArray(parsed.mentions), `${seedId}: mentions[] required`);
    assert.ok(Array.isArray(parsed.assertions), `${seedId}: assertions[] required`);

    for (const assertion of parsed.assertions) {
      assert.ok(Array.isArray(assertion.arguments), `${seedId}: assertion ${assertion.id} missing arguments[]`);
      assert.ok(Array.isArray(assertion.modifiers), `${seedId}: assertion ${assertion.id} missing modifiers[]`);
      assert.ok(Array.isArray(assertion.operators), `${seedId}: assertion ${assertion.id} missing operators[]`);
      assert.equal(
        Object.prototype.hasOwnProperty.call(assertion, "slots"),
        false,
        `${seedId}: assertion ${assertion.id} must not include legacy slots`
      );
    }

    assert.ok(parsed.coverage && typeof parsed.coverage === "object", `${seedId}: coverage object required`);
    assert.ok(Array.isArray(parsed.coverage.primary_mention_ids), `${seedId}: coverage.primary_mention_ids[] required`);
    assert.ok(Array.isArray(parsed.coverage.covered_primary_mention_ids), `${seedId}: coverage.covered_primary_mention_ids[] required`);
    assert.ok(Array.isArray(parsed.coverage.uncovered_primary_mention_ids), `${seedId}: coverage.uncovered_primary_mention_ids[] required`);
    assert.ok(Array.isArray(parsed.coverage.unresolved), `${seedId}: coverage.unresolved[] required`);
  }
});
