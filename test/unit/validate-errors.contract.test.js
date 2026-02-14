const test = require("node:test");
const assert = require("node:assert/strict");

const { validateElementaryAssertions, ValidationError } = require("../../src/validate");

function buildValidDoc(overrides = {}) {
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
      },
    ],
    relation_projection: {
      all_relations: [],
      projected_relations: [],
      dropped_relations: [],
    },
    accepted_annotations: [],
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
    ...overrides,
  };
}

test("validate exports ValidationError type", () => {
  assert.equal(typeof ValidationError, "function");
});

test("legacy slots rejection has stable validation error code", () => {
  const doc = buildValidDoc({
    assertions: [{ id: "a1", slots: { actor: [] } }],
  });
  assert.throws(
    () => validateElementaryAssertions(doc),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_LEGACY_SLOTS"
  );
});

test("schema stage mismatch has stable validation error code", () => {
  const doc = buildValidDoc({ stage: "wrong_stage" });
  assert.throws(
    () => validateElementaryAssertions(doc),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_STAGE"
  );
});

test("duplicate mention ids have stable validation error code", () => {
  const doc = buildValidDoc({
    mentions: [
      { id: "m1", kind: "token", priority: 0, token_ids: ["t1"], head_token_id: "t1", span: { start: 0, end: 5 }, segment_id: "s1", is_primary: true },
      { id: "m1", kind: "token", priority: 0, token_ids: ["t2"], head_token_id: "t2", span: { start: 6, end: 12 }, segment_id: "s1", is_primary: true },
    ],
    coverage: {
      primary_mention_ids: ["m1"],
      covered_primary_mention_ids: ["m1"],
      uncovered_primary_mention_ids: [],
      unresolved: [],
    },
  });
  assert.throws(
    () => validateElementaryAssertions(doc),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_DUPLICATE_IDS"
  );
});

test("coverage partition violations have stable validation error code", () => {
  const doc = buildValidDoc({
    coverage: {
      primary_mention_ids: ["m1", "m2", "m3"],
      covered_primary_mention_ids: ["m1", "m2", "m3"],
      uncovered_primary_mention_ids: ["m1"],
      unresolved: [
        {
          kind: "unresolved_attachment",
          segment_id: "s1",
          mention_id: "m1",
          reason: "missing_relation",
          evidence: { token_ids: ["t1"] },
        },
      ],
    },
  });
  assert.throws(
    () => validateElementaryAssertions(doc),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_COVERAGE_PARTITION"
  );
});

test("determinism sort violations have stable validation error code", () => {
  const doc = buildValidDoc({
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
          token_ids: ["t2", "t1", "t3"],
        },
      },
    ],
  });
  assert.throws(
    () => validateElementaryAssertions(doc),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_DETERMINISM_SORT"
  );
});

test("mention unknown token reference has stable validation error code", () => {
  const doc = buildValidDoc({
    mentions: [
      { id: "m1", kind: "token", priority: 0, token_ids: ["t404"], head_token_id: "t404", span: { start: 0, end: 5 }, segment_id: "s1", is_primary: true },
      { id: "m2", kind: "token", priority: 0, token_ids: ["t2"], head_token_id: "t2", span: { start: 6, end: 12 }, segment_id: "s1", is_primary: true },
      { id: "m3", kind: "token", priority: 0, token_ids: ["t3"], head_token_id: "t3", span: { start: 13, end: 18 }, segment_id: "s1", is_primary: true },
    ],
    coverage: {
      primary_mention_ids: ["m1", "m2", "m3"],
      covered_primary_mention_ids: ["m1", "m2", "m3"],
      uncovered_primary_mention_ids: [],
      unresolved: [],
    },
  });
  assert.throws(
    () => validateElementaryAssertions(doc),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_UNKNOWN_TOKEN_REFERENCE"
  );
});

test("mention invalid head token has stable validation error code", () => {
  const doc = buildValidDoc({
    mentions: [
      { id: "m1", kind: "token", priority: 0, token_ids: ["t1"], head_token_id: "t404", span: { start: 0, end: 5 }, segment_id: "s1", is_primary: true },
      { id: "m2", kind: "token", priority: 0, token_ids: ["t2"], head_token_id: "t2", span: { start: 6, end: 12 }, segment_id: "s1", is_primary: true },
      { id: "m3", kind: "token", priority: 0, token_ids: ["t3"], head_token_id: "t3", span: { start: 13, end: 18 }, segment_id: "s1", is_primary: true },
    ],
  });
  assert.throws(
    () => validateElementaryAssertions(doc),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_INVALID_HEAD_TOKEN"
  );
});

test("assertion unknown mention reference has stable validation error code", () => {
  const doc = buildValidDoc({
    assertions: [
      {
        id: "a1",
        segment_id: "s1",
        predicate: { mention_id: "m2", head_token_id: "t2" },
        arguments: [
          { role: "actor", mention_ids: ["m404"], evidence: { relation_ids: ["r1"], token_ids: ["t1", "t2"] } },
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
      },
    ],
  });
  assert.throws(
    () => validateElementaryAssertions(doc),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_UNKNOWN_ASSERTION_MENTION"
  );
});

test("assertion evidence unknown token has stable validation error code", () => {
  const doc = buildValidDoc({
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
          token_ids: ["t1", "t2", "t404"],
        },
      },
    ],
  });
  assert.throws(
    () => validateElementaryAssertions(doc),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_UNKNOWN_ASSERTION_EVIDENCE_TOKEN"
  );
});

test("coverage unresolved length mismatch has stable validation error code", () => {
  const doc = buildValidDoc({
    coverage: {
      primary_mention_ids: ["m1", "m2", "m3"],
      covered_primary_mention_ids: ["m1", "m2"],
      uncovered_primary_mention_ids: ["m3"],
      unresolved: [],
    },
  });
  assert.throws(
    () => validateElementaryAssertions(doc),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_COVERAGE_UNRESOLVED_LENGTH"
  );
});

test("coverage unresolved unknown mention has stable validation error code", () => {
  const doc = buildValidDoc({
    coverage: {
      primary_mention_ids: ["m1", "m2", "m3"],
      covered_primary_mention_ids: ["m1", "m2"],
      uncovered_primary_mention_ids: ["m3"],
      unresolved: [
        {
          kind: "unresolved_attachment",
          segment_id: "s1",
          mention_id: "m404",
          reason: "missing_relation",
          evidence: { token_ids: ["t1"] },
        },
      ],
    },
  });
  assert.throws(
    () => validateElementaryAssertions(doc),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_COVERAGE_UNKNOWN_UNRESOLVED_MENTION"
  );
});

test("suppressed target unknown assertion has stable validation error code", () => {
  const doc = buildValidDoc({
    diagnostics: {
      token_wiki_signal_count: 0,
      mentions_with_lexicon_evidence: 0,
      assertions_with_wiki_signals: 0,
      projected_relation_count: 0,
      dropped_relation_count: 0,
      subject_role_gaps: [],
      warnings: [],
      suppressed_assertions: [
        {
          id: "s1",
          segment_id: "s1",
          predicate: { mention_id: "m1", head_token_id: "t1" },
          diagnostics: {
            suppressed_by: {
              kind: "predicate_redirect",
              target_assertion_id: "a404",
              reason: "predicate_upgraded_to_lexical",
            },
          },
        },
      ],
    },
  });
  assert.throws(
    () => validateElementaryAssertions(doc),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_UNKNOWN_SUPPRESSED_TARGET"
  );
});

test("schema contract violations have stable validation error code", () => {
  const doc = buildValidDoc({
    unexpected_field: true,
  });
  assert.throws(
    () => validateElementaryAssertions(doc),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_SCHEMA_CONTRACT"
  );
});

test("strict validation exposes schema issue details", () => {
  const doc = buildValidDoc({
    unexpected_field: true,
  });
  assert.throws(
    () => validateElementaryAssertions(doc, { strict: true }),
    (err) =>
      err instanceof ValidationError &&
      err.code === "EA_VALIDATE_SCHEMA_CONTRACT" &&
      Array.isArray(err.details) &&
      err.details.length > 0 &&
      err.details.some((d) => typeof d.instancePath === "string")
  );
});
