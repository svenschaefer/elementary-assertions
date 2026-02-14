const test = require("node:test");
const assert = require("node:assert/strict");

const { renderElementaryAssertions } = require("../../src/render");

function buildDoc() {
  return {
    stage: "elementary_assertions",
    index_basis: { text_field: "canonical_text", span_unit: "utf16_code_units" },
    canonical_text: "Alpha builds carts.",
    segments: [{ id: "s1", span: { start: 0, end: 19 }, token_range: { start: 0, end: 3 } }],
    tokens: [
      { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "Alpha", pos: { tag: "NNP", coarse: "NOUN" } },
      { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 12 }, surface: "builds", pos: { tag: "VBZ", coarse: "VERB" } },
      { id: "t3", i: 2, segment_id: "s1", span: { start: 13, end: 18 }, surface: "carts", pos: { tag: "NNS", coarse: "NOUN" } },
    ],
    mentions: [
      { id: "m1", kind: "token", token_ids: ["t1"], head_token_id: "t1", span: { start: 0, end: 5 }, segment_id: "s1", is_primary: true },
      { id: "m2", kind: "token", token_ids: ["t2"], head_token_id: "t2", span: { start: 6, end: 12 }, segment_id: "s1", is_primary: true },
      { id: "m3", kind: "token", token_ids: ["t3"], head_token_id: "t3", span: { start: 13, end: 18 }, segment_id: "s1", is_primary: true },
    ],
    assertions: [
      {
        id: "a1",
        segment_id: "s1",
        predicate: { mention_id: "m2", head_token_id: "t2" },
        arguments: [
          { role: "actor", mention_ids: ["m1"], evidence: { relation_ids: ["r1"], token_ids: ["t1", "t2"] } },
          { role: "theme", mention_ids: ["m3"], evidence: { relation_ids: ["r2"], token_ids: ["t2", "t3"] } },
        ],
        modifiers: [],
        operators: [],
        evidence: { token_ids: ["t1", "t2", "t3"] },
        diagnostics: { predicate_quality: "ok" },
      },
    ],
    coverage: {
      primary_mention_ids: ["m1", "m2", "m3"],
      covered_primary_mention_ids: ["m1", "m2", "m3"],
      uncovered_primary_mention_ids: [],
      unresolved: [],
    },
    diagnostics: { suppressed_assertions: [] },
    wiki_title_evidence: { mention_matches: [], assertion_predicate_matches: [] },
  };
}

test("render output is deterministic for identical input", () => {
  const doc = buildDoc();
  const a = renderElementaryAssertions(doc, { format: "txt", layout: "compact", segments: true, mentions: true, coverage: true });
  const b = renderElementaryAssertions(doc, { format: "txt", layout: "compact", segments: true, mentions: true, coverage: true });
  assert.equal(a, b, "render output must be byte-identical for identical input");
});

test("default layout equals explicit compact layout", () => {
  const doc = buildDoc();
  const baseline = renderElementaryAssertions(doc, { format: "txt", segments: true, mentions: true, coverage: true, debugIds: false });
  const compact = renderElementaryAssertions(doc, { format: "txt", layout: "compact", segments: true, mentions: true, coverage: true, debugIds: false });
  assert.equal(compact, baseline, "explicit compact output must match default layout output");
});

test("render section toggles keep Assertions and omit disabled sections", () => {
  const doc = buildDoc();
  const out = renderElementaryAssertions(doc, {
    format: "md",
    layout: "readable",
    segments: false,
    mentions: false,
    coverage: false,
    debugIds: false,
  });
  assert.match(out, /## Assertions/, "Assertions section must always be present");
  assert.doesNotMatch(out, /## Segments/, "Segments section must be omitted when disabled");
  assert.doesNotMatch(out, /## Mentions/, "Mentions section must be omitted when disabled");
  assert.doesNotMatch(out, /## Coverage/, "Coverage section must be omitted when disabled");
});

test("render fails integrity checks for unknown token references", () => {
  const doc = buildDoc();
  doc.mentions[0].token_ids = ["t-does-not-exist"];
  assert.throws(
    () => renderElementaryAssertions(doc, { format: "txt", layout: "compact" }),
    /unknown token/i,
    "renderer must reject broken mention token references"
  );
});
