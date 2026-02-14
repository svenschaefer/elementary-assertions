const test = require("node:test");
const assert = require("node:assert/strict");

const {
  argumentRolePriority,
  canonicalizeRoleEntries,
  slotToRoleEntries,
  collectAssertionMentionRefs,
  projectRolesToSlots,
  collectMentionIdsFromRoles,
} = require("../../src/core/roles");

test("argumentRolePriority ordering is stable", () => {
  assert.equal(argumentRolePriority("actor"), 0);
  assert.equal(argumentRolePriority("patient"), 1);
  assert.equal(argumentRolePriority("location"), 2);
  assert.equal(argumentRolePriority("theme"), 3);
  assert.equal(argumentRolePriority("attribute"), 4);
  assert.equal(argumentRolePriority("topic"), 5);
  assert.equal(argumentRolePriority("unknown"), 10);
});

test("canonicalizeRoleEntries is deterministic and drops empty entries", () => {
  const input = [
    { role: "topic", mention_ids: ["m3", "m2", "m2"], evidence: { relation_ids: ["r2", "r1"], token_ids: ["t2", "t1"] } },
    { role: "actor", mention_ids: ["m1"], evidence: { relation_ids: ["r3", "r3"], token_ids: ["t3", "t1"] } },
    { role: "theme", mention_ids: [], evidence: { relation_ids: ["r4"], token_ids: ["t4"] } },
  ];
  const out = canonicalizeRoleEntries(input, (role) => (role === "actor" ? 0 : 10));
  assert.equal(out.length, 2);
  assert.equal(out[0].role, "actor");
  assert.deepEqual(out[0].mention_ids, ["m1"]);
  assert.deepEqual(out[0].evidence.relation_ids, ["r3"]);
  assert.deepEqual(out[0].evidence.token_ids, ["t1", "t3"]);
  assert.deepEqual(out[1].mention_ids, ["m2", "m3"]);
  assert.deepEqual(out[1].evidence.relation_ids, ["r1", "r2"]);
  assert.deepEqual(out[1].evidence.token_ids, ["t1", "t2"]);
});

test("slotToRoleEntries output is stable across slot ordering", () => {
  const mentionById = new Map([
    ["m1", { token_ids: ["t2", "t1"] }],
    ["m2", { token_ids: ["t3"] }],
    ["m3", { token_ids: ["t5", "t4"] }],
  ]);
  const slotsA = {
    actor: ["m2", "m1"],
    theme: ["m3"],
    attr: [],
    topic: [],
    location: [],
    other: [{ role: "modifier", mention_ids: ["m3", "m1"] }],
  };
  const slotsB = {
    actor: ["m1", "m2"],
    theme: ["m3"],
    attr: [],
    topic: [],
    location: [],
    other: [{ role: "modifier", mention_ids: ["m1", "m3"] }],
  };
  const a = slotToRoleEntries(slotsA, mentionById);
  const b = slotToRoleEntries(slotsB, mentionById);
  assert.deepEqual(a, b);
});

test("collectMentionIdsFromRoles and collectAssertionMentionRefs include argument and modifier mentions", () => {
  const assertion = {
    arguments: [
      { role: "theme", mention_ids: ["m2"] },
      { role: "actor", mention_ids: ["m1"] },
    ],
    modifiers: [{ role: "modifier", mention_ids: ["m3", "m1"] }],
  };
  assert.deepEqual(collectMentionIdsFromRoles(assertion), ["m1", "m2", "m3"]);
  const refs = collectAssertionMentionRefs(assertion);
  assert.ok(refs.has("m1") && refs.has("m2") && refs.has("m3"));
});

test("projectRolesToSlots maps role arrays deterministically", () => {
  const assertion = {
    arguments: [
      { role: "actor", mention_ids: ["m1"] },
      { role: "theme", mention_ids: ["m2"] },
    ],
    modifiers: [{ role: "recipient", mention_ids: ["m3"] }],
  };
  const slots = projectRolesToSlots(assertion);
  assert.deepEqual(slots.actor, ["m1"]);
  assert.deepEqual(slots.theme, ["m2"]);
  assert.deepEqual(slots.other, [{ role: "recipient", mention_ids: ["m3"] }]);
});
