const test = require("node:test");
const assert = require("node:assert/strict");

const { validateElementaryAssertions, ValidationError } = require("../../src/validate");

function buildValidDoc(overrides = {}) {
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
      },
    ],
    coverage: {
      primary_mention_ids: ["m1", "m2", "m3"],
      covered_primary_mention_ids: ["m1", "m2", "m3"],
      uncovered_primary_mention_ids: [],
      unresolved: [],
    },
    diagnostics: { suppressed_assertions: [] },
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
      { id: "m1", kind: "token", token_ids: ["t1"], head_token_id: "t1", span: { start: 0, end: 5 }, segment_id: "s1", is_primary: true },
      { id: "m1", kind: "token", token_ids: ["t2"], head_token_id: "t2", span: { start: 6, end: 12 }, segment_id: "s1", is_primary: true },
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
      unresolved: [{ mention_id: "m1", reason: "test" }],
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
        evidence: { token_ids: ["t2", "t1", "t3"] },
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
      { id: "m1", kind: "token", token_ids: ["t404"], head_token_id: "t404", span: { start: 0, end: 5 }, segment_id: "s1", is_primary: true },
      { id: "m2", kind: "token", token_ids: ["t2"], head_token_id: "t2", span: { start: 6, end: 12 }, segment_id: "s1", is_primary: true },
      { id: "m3", kind: "token", token_ids: ["t3"], head_token_id: "t3", span: { start: 13, end: 18 }, segment_id: "s1", is_primary: true },
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
      { id: "m1", kind: "token", token_ids: ["t1"], head_token_id: "t404", span: { start: 0, end: 5 }, segment_id: "s1", is_primary: true },
      { id: "m2", kind: "token", token_ids: ["t2"], head_token_id: "t2", span: { start: 6, end: 12 }, segment_id: "s1", is_primary: true },
      { id: "m3", kind: "token", token_ids: ["t3"], head_token_id: "t3", span: { start: 13, end: 18 }, segment_id: "s1", is_primary: true },
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
        evidence: { token_ids: ["t1", "t2", "t3"] },
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
        evidence: { token_ids: ["t1", "t2", "t404"] },
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
      unresolved: [{ mention_id: "m404", reason: "test" }],
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
      suppressed_assertions: [
        {
          id: "s1",
          diagnostics: {
            suppressed_by: {
              target_assertion_id: "a404",
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
