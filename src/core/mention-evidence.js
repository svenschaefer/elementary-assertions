const { deepCloneJson, normalizeIds } = require("./determinism");

function buildMentionLexiconEvidence({ tokenIds, tokenWikiById, mweLexiconEvidence }) {
  const tokenEvidence = normalizeIds(tokenIds || [])
    .filter((tokenId) => tokenWikiById.has(tokenId))
    .map((tokenId) => ({
      token_id: tokenId,
      evidence: deepCloneJson(tokenWikiById.get(tokenId)),
    }));

  if (tokenEvidence.length === 0 && !mweLexiconEvidence) return null;

  const out = {};
  if (mweLexiconEvidence) out.mwe = deepCloneJson(mweLexiconEvidence);
  if (tokenEvidence.length > 0) out.tokens = tokenEvidence;
  return out;
}

function buildAssertionWikiSignals({ predicateMentionId, relations, mentionById }) {
  const mentionIds = new Set([predicateMentionId]);
  for (const relation of relations || []) {
    if (relation && typeof relation.dep_mention_id === "string") mentionIds.add(relation.dep_mention_id);
  }

  const mentionEvidence = Array.from(mentionIds)
    .sort((a, b) => a.localeCompare(b))
    .map((mentionId) => {
      const mention = mentionById.get(mentionId);
      const lexiconEvidence =
        mention &&
        mention.provenance &&
        mention.provenance.lexicon_evidence &&
        typeof mention.provenance.lexicon_evidence === "object"
          ? deepCloneJson(mention.provenance.lexicon_evidence)
          : null;
      if (!mention || !lexiconEvidence) return null;
      return {
        mention_id: mentionId,
        token_ids: normalizeIds(mention.token_ids || []),
        evidence: lexiconEvidence,
      };
    })
    .filter(Boolean);

  if (mentionEvidence.length === 0) return null;
  return { mention_evidence: mentionEvidence };
}

module.exports = {
  buildMentionLexiconEvidence,
  buildAssertionWikiSignals,
};
