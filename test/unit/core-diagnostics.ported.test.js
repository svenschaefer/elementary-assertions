const test = require("node:test");
const assert = require("node:assert/strict");

const { analyzeUpstreamWikiEvidence } = require("../../src/core/diagnostics");

test("analyzeUpstreamWikiEvidence counts only positive wiki signals", () => {
  const upstreamFixture = {
    tokens: [
      { id: "tok:1", lexicon: { wikipedia_title_index: { wiki_any_signal: true, wiki_prefix_count: 1 } } },
      { id: "tok:2" },
    ],
    annotations: [
      {
        id: "ann:mwe:1",
        kind: "mwe",
        status: "accepted",
        anchor: {
          selectors: [
            { type: "TokenSelector", token_ids: ["tok:1"] },
            { type: "TextPositionSelector", span: { start: 0, end: 3 } },
          ],
        },
        sources: [{ name: "wikipedia-title-index", evidence: { wiki_any_signal: false, wiki_prefix_count: 0 } }],
      },
      {
        id: "ann:mwe:2",
        kind: "mwe",
        status: "accepted",
        anchor: {
          selectors: [
            { type: "TokenSelector", token_ids: ["tok:2"] },
            { type: "TextPositionSelector", span: { start: 4, end: 7 } },
          ],
        },
        sources: [{ name: "mwe-materialization", evidence: { head_token_id: "tok:2" } }],
      },
      {
        id: "ann:dep:1",
        kind: "dependency",
        status: "accepted",
        head: { id: "tok:1" },
        dep: { id: "tok:2" },
        sources: [{ name: "relation-extraction", evidence: {} }],
      },
    ],
  };

  const stats = analyzeUpstreamWikiEvidence(upstreamFixture);
  assert.equal(stats.evidence_definition, "positive_signal_only");
  assert.equal(stats.total_mentions, 4);
  assert.equal(stats.mentions_with_wiki_evidence, 1);
  assert.equal(stats.mentions_without_wiki_evidence, 3);
  assert.equal(stats.total_predicates, 1);
  assert.equal(stats.predicates_with_wiki_evidence, 0);
  assert.equal(stats.predicates_without_wiki_evidence, 1);
  assert.equal(
    stats.mentions_with_wiki_evidence + stats.mentions_without_wiki_evidence,
    stats.total_mentions
  );
  assert.equal(
    stats.predicates_with_wiki_evidence + stats.predicates_without_wiki_evidence,
    stats.total_predicates
  );
  assert.ok(Array.isArray(stats.sample_missing_mention_ids));
  assert.ok(Array.isArray(stats.sample_missing_predicate_ids));
});
