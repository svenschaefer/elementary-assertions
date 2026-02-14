const test = require("node:test");
const assert = require("node:assert/strict");

function buildLegacySlotsDoc() {
  return {
    stage: "elementary_assertions",
    index_basis: { text_field: "canonical_text", span_unit: "utf16_code_units" },
    canonical_text: "A demo sentence.",
    mentions: [
      {
        id: "m:s1:0-1:token",
        kind: "token",
        token_ids: ["t1"],
        head_token_id: "t1",
        span: { start: 0, end: 1 },
        segment_id: "s1",
        is_primary: true,
      },
    ],
    assertions: [
      {
        id: "a:s1:m:s1:0-1:token:deadbeef",
        segment_id: "s1",
        predicate: { mention_id: "m:s1:0-1:token", head_token_id: "t1" },
        arguments: [],
        modifiers: [],
        operators: [],
        slots: { actor: [], theme: [], attr: [], topic: [], location: [], other: [] },
      },
    ],
  };
}

test("validate contract rejects legacy assertions[*].slots explicitly", () => {
  const api = require("../../src/validate");
  assert.equal(
    typeof api.validateElementaryAssertions,
    "function",
    "validate API must export validateElementaryAssertions(doc)"
  );

  assert.throws(
    () => api.validateElementaryAssertions(buildLegacySlotsDoc()),
    /slots|legacy/i,
    "legacy assertions[*].slots must be rejected"
  );
});

test("render contract rejects legacy assertions[*].slots explicitly", () => {
  const api = require("../../src/render");
  assert.equal(
    typeof api.renderElementaryAssertions,
    "function",
    "render API must export renderElementaryAssertions(doc, options)"
  );

  assert.throws(
    () => api.renderElementaryAssertions(buildLegacySlotsDoc(), { format: "txt", layout: "compact" }),
    /slots|legacy/i,
    "renderer must reject legacy assertions[*].slots input"
  );
});

