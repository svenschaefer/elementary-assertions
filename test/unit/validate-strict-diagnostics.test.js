const test = require("node:test");
const assert = require("node:assert/strict");

const { validateElementaryAssertions, ValidationError } = require("../../src/validate");

function buildStrictValidDoc() {
  return {
    seed_id: "seed-strict",
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
        diagnostics: {
          suppression_eligibility: {
            eligible: true,
            failure_reason: null,
            candidate_class: "auxiliary",
            segment_id: "s1",
            assertion_id: "a1",
            chosen_host_assertion_id: null,
            chosen_host_predicate: null,
            chosen_host_predicate_class: null,
            source_non_operator_token_ids: [],
            chosen_host_token_ids: [],
            missing_in_host_token_ids: [],
          },
        },
      },
    ],
    relation_projection: { all_relations: [], projected_relations: [], dropped_relations: [] },
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
    diagnostics: {
      token_wiki_signal_count: 0,
      mentions_with_lexicon_evidence: 0,
      assertions_with_wiki_signals: 0,
      projected_relation_count: 0,
      dropped_relation_count: 0,
      subject_role_gaps: [],
      warnings: [],
      coordination_groups: [{ id: "c1", member_assertion_ids: ["a1"] }],
      suppressed_assertions: [],
    },
    coverage: {
      primary_mention_ids: ["m1", "m2", "m3"],
      covered_primary_mention_ids: ["m1", "m2", "m3"],
      uncovered_primary_mention_ids: [],
      unresolved: [],
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

test("strict diagnostics checks are opt-in", () => {
  const doc = buildStrictValidDoc();
  doc.diagnostics.warnings = ["z-last", "a-first"];
  assert.doesNotThrow(() => validateElementaryAssertions(doc));
});

test("strict diagnostics enforces warning ordering", () => {
  const doc = buildStrictValidDoc();
  doc.diagnostics.warnings = ["z-last", "a-first"];
  assert.throws(
    () => validateElementaryAssertions(doc, { strict: true }),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_STRICT_WARNING_ORDER"
  );
});

test("strict diagnostics enforces suppression eligibility coherence", () => {
  const doc = buildStrictValidDoc();
  doc.assertions[0].diagnostics.suppression_eligibility = {
    ...doc.assertions[0].diagnostics.suppression_eligibility,
    eligible: true,
    failure_reason: "no_host",
  };
  assert.throws(
    () => validateElementaryAssertions(doc, { strict: true }),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_STRICT_SUPPRESSION_ELIGIBILITY"
  );
});

test("strict diagnostics enforces suppression eligibility assertion/segment consistency", () => {
  const doc = buildStrictValidDoc();
  doc.assertions[0].diagnostics.suppression_eligibility = {
    ...doc.assertions[0].diagnostics.suppression_eligibility,
    assertion_id: "a404",
  };
  assert.throws(
    () => validateElementaryAssertions(doc, { strict: true }),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_STRICT_SUPPRESSION_ELIGIBILITY"
  );
});

test("strict diagnostics enforces subject_role_gaps sorted keys", () => {
  const doc = buildStrictValidDoc();
  doc.assertions[0].arguments = [
    { role: "theme", mention_ids: ["m3"], evidence: { relation_ids: ["r2"], token_ids: ["t2", "t3"] } },
  ];
  doc.diagnostics.subject_role_gaps = [
    {
      segment_id: "s2",
      assertion_id: "a1",
      predicate_mention_id: "m2",
      predicate_head_token_id: "t2",
      reason: "missing_subject_role",
      evidence: { token_ids: ["t2"], upstream_relation_ids: [] },
    },
    {
      segment_id: "s1",
      assertion_id: "a1",
      predicate_mention_id: "m2",
      predicate_head_token_id: "t2",
      reason: "missing_subject_role",
      evidence: { token_ids: ["t2"], upstream_relation_ids: [] },
    },
  ];
  assert.throws(
    () => validateElementaryAssertions(doc, { strict: true }),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_STRICT_SUBJECT_GAP_ORDER"
  );
});

test("strict diagnostics enforces subject_role_gaps actor-empty consistency", () => {
  const doc = buildStrictValidDoc();
  doc.diagnostics.subject_role_gaps = [
    {
      segment_id: "s1",
      assertion_id: "a1",
      predicate_mention_id: "m2",
      predicate_head_token_id: "t2",
      reason: "missing_subject_role",
      evidence: { token_ids: ["t2"], upstream_relation_ids: [] },
    },
  ];
  assert.throws(
    () => validateElementaryAssertions(doc, { strict: true }),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_STRICT_SUBJECT_GAP_ACTOR_CONSISTENCY"
  );
});

test("strict diagnostics enforces subject_role_gaps evidence sorting", () => {
  const doc = buildStrictValidDoc();
  doc.assertions[0].arguments = [
    { role: "theme", mention_ids: ["m3"], evidence: { relation_ids: ["r2"], token_ids: ["t2", "t3"] } },
  ];
  doc.diagnostics.subject_role_gaps = [
    {
      segment_id: "s1",
      assertion_id: "a1",
      predicate_mention_id: "m2",
      predicate_head_token_id: "t2",
      reason: "missing_subject_role",
      evidence: { token_ids: ["t2", "t1"], upstream_relation_ids: [] },
    },
  ];
  assert.throws(
    () => validateElementaryAssertions(doc, { strict: true }),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_STRICT_SUBJECT_GAP_EVIDENCE_ORDER"
  );
});

test("strict diagnostics enforces suppressed assertion host/target consistency", () => {
  const doc = buildStrictValidDoc();
  doc.diagnostics.suppressed_assertions = [
    {
      id: "a-sup-1",
      segment_id: "s1",
      predicate: { mention_id: "m2", head_token_id: "t2" },
      diagnostics: {
        suppressed_by: {
          kind: "predicate_redirect",
          target_assertion_id: "a1",
          reason: "role_carrier_suppressed",
          evidence: { token_ids: ["t2", "t3"], upstream_relation_ids: [] },
        },
      },
      host_assertion_id: "a404",
      reason: "role_carrier_suppressed",
      predicate_class: "auxiliary",
      transferred_buckets: [],
      transferred_mention_ids: [],
      evidence: { token_ids: ["t2", "t3"] },
    },
  ];
  assert.throws(
    () => validateElementaryAssertions(doc, { strict: true }),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_STRICT_SUPPRESSED_SEMANTICS"
  );
});

test("strict diagnostics enforces suppressed transfer mention presence on host assertion", () => {
  const doc = buildStrictValidDoc();
  doc.assertions[0].arguments = [
    { role: "theme", mention_ids: ["m3"], evidence: { relation_ids: ["r2"], token_ids: ["t2", "t3"] } },
  ];
  doc.diagnostics.suppressed_assertions = [
    {
      id: "a-sup-2",
      segment_id: "s1",
      predicate: { mention_id: "m2", head_token_id: "t2" },
      diagnostics: {
        suppressed_by: {
          kind: "predicate_redirect",
          target_assertion_id: "a1",
          reason: "role_carrier_suppressed_v2_nominal",
          evidence: { token_ids: ["t2", "t3"], upstream_relation_ids: [] },
        },
      },
      host_assertion_id: "a1",
      reason: "role_carrier_suppressed_v2_nominal",
      predicate_class: "nominal_head",
      transferred_buckets: ["operator:compare_gt"],
      transferred_mention_ids: ["m404"],
      evidence: { token_ids: ["t2", "t3"] },
    },
  ];
  assert.throws(
    () => validateElementaryAssertions(doc, { strict: true }),
    (err) => err instanceof ValidationError && err.code === "EA_VALIDATE_STRICT_SUPPRESSED_SEMANTICS"
  );
});
