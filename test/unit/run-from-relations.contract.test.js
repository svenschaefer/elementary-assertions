const test = require("node:test");
const assert = require("node:assert/strict");

const { runFromRelations } = require("../../src");

function minimalRelationsDoc(overrides = {}) {
  return {
    seed_id: "seed",
    canonical_text: "Alpha runs.",
    stage: "something_else",
    segments: [{ id: "s1", span: { start: 0, end: 11 }, token_range: { start: 0, end: 2 } }],
    tokens: [
      { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "Alpha", pos: { tag: "NNP", coarse: "NOUN" } },
      { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 10 }, surface: "runs", pos: { tag: "VBZ", coarse: "VERB" } },
    ],
    annotations: [],
    ...overrides,
  };
}

test("runFromRelations rejects legacy assertions[*].slots immediately", () => {
  const input = minimalRelationsDoc({
    assertions: [{ id: "a:legacy", slots: { actor: [], theme: [], attr: [], topic: [], location: [], other: [] } }],
  });

  assert.throws(
    () => runFromRelations(input),
    /slots|legacy/i,
    "runFromRelations must reject legacy assertions[*].slots"
  );
});

test("runFromRelations rejects malformed upstream input shapes explicitly", () => {
  const cases = [
    { name: "non-object input", input: null, pattern: /object input/i },
    { name: "missing tokens", input: minimalRelationsDoc({ tokens: undefined }), pattern: /tokens\[\]/i },
    { name: "missing annotations", input: minimalRelationsDoc({ annotations: undefined }), pattern: /annotations\[\]/i },
    { name: "missing segments", input: minimalRelationsDoc({ segments: undefined }), pattern: /segments\[\]/i },
    { name: "missing canonical_text", input: minimalRelationsDoc({ canonical_text: undefined }), pattern: /canonical_text/i },
  ];

  for (const c of cases) {
    assert.throws(
      () => runFromRelations(c.input),
      c.pattern,
      `runFromRelations should reject ${c.name}`
    );
  }
});

test("runFromRelations ignores stage label and tolerates unrelated extra fields", () => {
  const input = minimalRelationsDoc({
    stage: "rich_upstream_stage",
    extra_upstream_blob: { a: 1, b: [2, 3] },
  });

  const out = runFromRelations(input);
  assert.equal(out.stage, "elementary_assertions");
  assert.equal(out.index_basis.text_field, "canonical_text");
  assert.equal(out.index_basis.span_unit, "utf16_code_units");
});

test("runFromRelations omits schema_version when absent upstream", () => {
  const out = runFromRelations(minimalRelationsDoc());
  assert.equal(Object.prototype.hasOwnProperty.call(out, "schema_version"), false);
});

test("runFromRelations carries schema_version verbatim when present upstream", () => {
  const out = runFromRelations(minimalRelationsDoc({ schema_version: "9.9.9" }));
  assert.equal(out.schema_version, "9.9.9");
});

test("runFromRelations is deterministic for identical input", () => {
  const input = minimalRelationsDoc({
    annotations: [
      {
        id: "ann:dep:1",
        kind: "dependency",
        status: "accepted",
        label: "nsubj",
        head: { id: "t2" },
        dep: { id: "t1" },
        sources: [{ name: "relation-extraction", evidence: {} }],
      },
    ],
  });
  const a = runFromRelations(input);
  const b = runFromRelations(input);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
