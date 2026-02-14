const test = require("node:test");
const assert = require("node:assert/strict");

const { renderElementaryAssertions } = require("../../src/render");

function buildDoc() {
  return {
    seed_id: "seed-test",
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
      { id: "m1", kind: "token", priority: 0, token_ids: ["t1"], head_token_id: "t1", span: { start: 0, end: 5 }, segment_id: "s1", is_primary: true },
      { id: "m2", kind: "token", priority: 0, token_ids: ["t2"], head_token_id: "t2", span: { start: 6, end: 12 }, segment_id: "s1", is_primary: true },
      { id: "m3", kind: "token", priority: 0, token_ids: ["t3"], head_token_id: "t3", span: { start: 13, end: 18 }, segment_id: "s1", is_primary: true },
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
        evidence: {
          relation_evidence: [
            { annotation_id: "r1", from_token_id: "t2", to_token_id: "t1", label: "nsubj" },
            { annotation_id: "r2", from_token_id: "t2", to_token_id: "t3", label: "obj" },
          ],
          token_ids: ["t1", "t2", "t3"],
        },
        diagnostics: { predicate_quality: "ok" },
      },
    ],
    relation_projection: {
      all_relations: [],
      projected_relations: [],
      dropped_relations: [],
    },
    accepted_annotations: [],
    coverage: {
      primary_mention_ids: ["m1", "m2", "m3"],
      covered_primary_mention_ids: ["m1", "m2", "m3"],
      uncovered_primary_mention_ids: [],
      unresolved: [],
    },
    diagnostics: {
      token_wiki_signal_count: 0,
      mentions_with_lexicon_evidence: 0,
      assertions_with_wiki_signals: 0,
      projected_relation_count: 0,
      dropped_relation_count: 0,
      subject_role_gaps: [],
      warnings: [],
      suppressed_assertions: [],
    },
    wiki_title_evidence: {
      normalization: {
        unicode_form: "NFKC",
        punctuation_map: {},
        whitespace: "collapse_spaces_trim",
        casefold: "toLowerCase",
      },
      mention_matches: [],
      assertion_predicate_matches: [],
    },
    sources: {
      inputs: [{ artifact: "seed.text.in_memory", digest: "d-seed" }],
      pipeline: {
        target: "relations_extracted",
        relations_extracted_digest: "d-rel",
        token_count: 3,
        annotation_count: 2,
        wikipedia_title_index_configured: false,
      },
    },
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
