const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildMentionLexiconEvidence,
  buildAssertionWikiSignals,
} = require("../../src/core/mention-evidence");

test("buildMentionLexiconEvidence merges mwe and token evidence deterministically", () => {
  const tokenWikiById = new Map([
    ["t2", { wiki_any_signal: true }],
    ["t1", { wiki_prefix_count: 2 }],
  ]);
  const out = buildMentionLexiconEvidence({
    tokenIds: ["t2", "t1", "t2"],
    tokenWikiById,
    mweLexiconEvidence: { exact_titles: ["A"] },
  });
  assert.deepEqual(out, {
    mwe: { exact_titles: ["A"] },
    tokens: [
      { token_id: "t1", evidence: { wiki_prefix_count: 2 } },
      { token_id: "t2", evidence: { wiki_any_signal: true } },
    ],
  });
});

test("buildAssertionWikiSignals emits sorted mention evidence for predicate and deps", () => {
  const mentionById = new Map([
    ["m:p", { token_ids: ["t2"], provenance: { lexicon_evidence: { wiki_any_signal: true } } }],
    ["m:d", { token_ids: ["t1"], provenance: { lexicon_evidence: { wiki_prefix_count: 1 } } }],
  ]);
  const out = buildAssertionWikiSignals({
    predicateMentionId: "m:p",
    relations: [{ dep_mention_id: "m:d" }],
    mentionById,
  });
  assert.deepEqual(out, {
    mention_evidence: [
      { mention_id: "m:d", token_ids: ["t1"], evidence: { wiki_prefix_count: 1 } },
      { mention_id: "m:p", token_ids: ["t2"], evidence: { wiki_any_signal: true } },
    ],
  });
});
