const test = require("node:test");
const assert = require("node:assert/strict");

const { buildTokenIndex, getTokenWikipediaEvidence } = require("../../src/core/tokens");

test("buildTokenIndex validates and indexes tokens by id", () => {
  const byId = buildTokenIndex({
    tokens: [
      { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 1 }, pos: { tag: "NN" } },
      { id: "t2", i: 1, segment_id: "s1", span: { start: 2, end: 3 }, pos: { tag: "VB" } },
    ],
  });
  assert.equal(byId.size, 2);
  assert.equal(byId.get("t1").segment_id, "s1");
  assert.equal(byId.get("t2").i, 1);
});

test("getTokenWikipediaEvidence returns cloned wikipedia_title_index payload", () => {
  const token = {
    id: "t1",
    lexicon: { wikipedia_title_index: { wiki_any_signal: true, exact_titles: ["X"] } },
  };
  const out = getTokenWikipediaEvidence(token);
  assert.deepEqual(out, { wiki_any_signal: true, exact_titles: ["X"] });
  out.exact_titles.push("Y");
  assert.deepEqual(getTokenWikipediaEvidence(token), { wiki_any_signal: true, exact_titles: ["X"] });
});
