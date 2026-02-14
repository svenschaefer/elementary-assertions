const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getMweHeadEvidence,
  getMweLexiconEvidence,
} = require("../../src/core/mention-materialization");

test("getMweHeadEvidence extracts head token id from mwe-materialization source", () => {
  const mwe = {
    sources: [
      { name: "wikipedia-title-index", evidence: { wiki_any_signal: true } },
      { name: "mwe-materialization", evidence: { head_token_id: "t:head" } },
    ],
  };
  assert.equal(getMweHeadEvidence(mwe), "t:head");
  assert.equal(getMweHeadEvidence({ sources: [] }), null);
  assert.equal(getMweHeadEvidence(null), null);
});

test("getMweLexiconEvidence returns deep-cloned wikipedia-title-index evidence", () => {
  const mwe = {
    sources: [
      { name: "wikipedia-title-index", evidence: { wiki_any_signal: true, exact_titles: ["A"] } },
    ],
  };
  const ev = getMweLexiconEvidence(mwe);
  assert.deepEqual(ev, { wiki_any_signal: true, exact_titles: ["A"] });
  ev.exact_titles.push("B");
  assert.deepEqual(getMweLexiconEvidence(mwe), { wiki_any_signal: true, exact_titles: ["A"] });
  assert.equal(getMweLexiconEvidence({ sources: [] }), null);
});
