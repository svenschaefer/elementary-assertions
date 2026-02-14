const test = require("node:test");
const assert = require("node:assert/strict");

const { getMweHeadEvidence } = require("../../src/core/mention-materialization");

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
