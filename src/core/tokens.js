const { deepCloneJson } = require('./determinism');

function buildTokenIndex(seed) {
  if (!Array.isArray(seed.tokens) || seed.tokens.length === 0) throw new Error('relations seed missing tokens');
  const byId = new Map();
  for (const t of seed.tokens) {
    if (!t || typeof t.id !== 'string') throw new Error('token missing id');
    if (typeof t.segment_id !== 'string') throw new Error(`token ${t.id} missing segment_id`);
    if (!t.span || typeof t.span.start !== 'number' || typeof t.span.end !== 'number') {
      throw new Error(`token ${t.id} missing span`);
    }
    if (typeof t.i !== 'number') throw new Error(`token ${t.id} missing i`);
    if (!t.pos || typeof t.pos.tag !== 'string') throw new Error(`token ${t.id} missing pos.tag`);
    byId.set(t.id, t);
  }
  return byId;
}


function getTokenWikipediaEvidence(token) {
  if (!token || !token.lexicon || typeof token.lexicon !== 'object') return null;
  const ev = token.lexicon.wikipedia_title_index;
  if (!ev || typeof ev !== 'object') return null;
  return deepCloneJson(ev);
}

function buildTokenWikiById(relationsSeed) {
  const out = new Map();
  const tokens = Array.isArray(relationsSeed && relationsSeed.tokens) ? relationsSeed.tokens : [];
  for (const token of tokens) {
    if (!token || typeof token.id !== 'string') continue;
    const ev = getTokenWikipediaEvidence(token);
    if (!ev) continue;
    out.set(token.id, ev);
  }
  return out;
}

function getTokenMetadataProjection(token) {
  const out = {};
  if (token && typeof token.normalized === 'string') out.normalized = token.normalized;
  if (token && token.flags && typeof token.flags === 'object') out.flags = deepCloneJson(token.flags);
  if (token && token.joiner && typeof token.joiner === 'object') out.joiner = deepCloneJson(token.joiner);
  return out;
}


module.exports = {
  buildTokenIndex,
  getTokenWikipediaEvidence,
  buildTokenWikiById,
  getTokenMetadataProjection,
};
