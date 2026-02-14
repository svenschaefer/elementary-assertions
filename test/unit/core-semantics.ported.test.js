const test = require("node:test");
const assert = require("node:assert/strict");

const { roleToSlot } = require("../../src/core/mentions");
const { buildSubjectRoleGaps } = require("../../src/core/diagnostics");

test("roleToSlot maps known subject labels to actor", () => {
  assert.deepEqual(roleToSlot("actor"), { slot: "actor", role: null });
  assert.deepEqual(roleToSlot("agent"), { slot: "actor", role: null });
  assert.deepEqual(roleToSlot("nsubj"), { slot: "actor", role: null });
  assert.deepEqual(roleToSlot("nsubjpass"), { slot: "actor", role: null });
});

test("roleToSlot maps unknown labels to other without actor promotion", () => {
  assert.deepEqual(roleToSlot("weird_label"), { slot: "other", role: "weird_label" });
});

test("buildSubjectRoleGaps emits missing_subject_role for lexical predicate without subject relation", () => {
  const assertions = [
    {
      id: "a:s1:pred",
      segment_id: "s1",
      predicate: { mention_id: "m:runs", head_token_id: "t:runs" },
      arguments: [{ role: "theme", mention_ids: ["m:task"] }],
      modifiers: [],
      operators: [],
      diagnostics: { predicate_class: "lexical_verb" },
    },
  ];
  const projected = [
    {
      relation_id: "r:theme",
      label: "theme",
      head_mention_id: "m:runs",
      dep_mention_id: "m:task",
      head_token_id: "t:runs",
      dep_token_id: "t:task",
      segment_id: "s1",
      evidence: {},
    },
  ];

  const gaps = buildSubjectRoleGaps({ assertions, projected });
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].reason, "missing_subject_role");
  assert.equal(gaps[0].predicate_mention_id, "m:runs");
});

test("buildSubjectRoleGaps does not emit gap when subject relation is present", () => {
  const assertions = [
    {
      id: "a:s1:pred",
      segment_id: "s1",
      predicate: { mention_id: "m:runs", head_token_id: "t:runs" },
      arguments: [{ role: "theme", mention_ids: ["m:task"] }],
      modifiers: [],
      operators: [],
      diagnostics: { predicate_class: "lexical_verb" },
    },
  ];
  const projected = [
    {
      relation_id: "r:theme",
      label: "theme",
      head_mention_id: "m:runs",
      dep_mention_id: "m:task",
      head_token_id: "t:runs",
      dep_token_id: "t:task",
      segment_id: "s1",
      evidence: {},
    },
    {
      relation_id: "r:subj",
      label: "nsubj",
      head_mention_id: "m:runs",
      dep_mention_id: "m:it",
      head_token_id: "t:runs",
      dep_token_id: "t:it",
      segment_id: "s1",
      evidence: {},
    },
  ];

  const gaps = buildSubjectRoleGaps({ assertions, projected });
  assert.equal(gaps.length, 0);
});

