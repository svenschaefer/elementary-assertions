const test = require("node:test");
const assert = require("node:assert/strict");

const { buildCoverageDomainMentionIds } = require("../../src/core/output");

test("buildCoverageDomainMentionIds uses canonical localeCompare ordering", () => {
  const mentions = [
    { id: "m:s19:3872-3899:mwe", is_primary: true, head_token_id: "t19" },
    { id: "m:s1:2-21:mwe", is_primary: true, head_token_id: "t1" },
  ];
  const tokenById = new Map([
    ["t19", { id: "t19", surface: "Tenant", pos: { tag: "NN" } }],
    ["t1", { id: "t1", surface: "Organization", pos: { tag: "NN" } }],
  ]);

  const ids = buildCoverageDomainMentionIds(mentions, tokenById);
  assert.deepEqual(ids, ["m:s1:2-21:mwe", "m:s19:3872-3899:mwe"]);
});
