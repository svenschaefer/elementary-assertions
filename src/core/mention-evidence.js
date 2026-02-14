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

module.exports = {
  buildMentionLexiconEvidence,
};
