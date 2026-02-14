const test = require("node:test");
const assert = require("node:assert/strict");

const { buildTokenIndex, buildTokenWikiById } = require("../../src/core/tokens");
const { buildMentions } = require("../../src/core/mention-builder");

test("buildMentions emits deterministic token fallback mentions for minimal seed", () => {
  const relationsSeed = {
    annotations: [],
    tokens: [
      {
        id: "t1",
        i: 0,
        segment_id: "s1",
        span: { start: 0, end: 5 },
        pos: { tag: "NN" },
      },
      {
        id: "t2",
        i: 1,
        segment_id: "s1",
        span: { start: 6, end: 10 },
        pos: { tag: "NN" },
      },
    ],
  };
  const tokenById = buildTokenIndex(relationsSeed);
  const tokenWikiById = buildTokenWikiById(relationsSeed);
  const out = buildMentions({
    relationsSeed,
    mweSeed: { annotations: [] },
    headsSeed: { annotations: [] },
    tokenById,
    tokenWikiById,
  });

  assert.equal(out.mentions.length, 2);
  assert.deepEqual(out.mentions.map((m) => m.id), [
    "m:s1:0-5:token",
    "m:s1:6-10:token",
  ]);
  assert.equal(out.tokenToPrimaryMention.get("t1"), "m:s1:0-5:token");
  assert.equal(out.tokenToPrimaryMention.get("t2"), "m:s1:6-10:token");
});
