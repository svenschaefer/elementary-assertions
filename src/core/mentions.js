const { findSelector, normalizeSpanKey, normalizeIds, deepCloneJson } = require('./determinism');
const { annotationHasSource } = require('./upstream');

function normalizeWikiSurface(surface) {
  if (typeof surface !== 'string') return '';
  return surface
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function hasPositiveWikiSignal(evidence) {
  if (!evidence || typeof evidence !== 'object') return false;
  if (evidence.wiki_exact_match === true) return true;
  if (typeof evidence.wiki_prefix_count === 'number' && evidence.wiki_prefix_count > 0) return true;
  if (
    typeof evidence.wiki_parenthetical_variant_count === 'number' &&
    evidence.wiki_parenthetical_variant_count > 0
  ) {
    return true;
  }
  if (evidence.wiki_hyphen_space_variant_match === true) return true;
  if (evidence.wiki_apostrophe_variant_match === true) return true;
  if (evidence.wiki_singular_plural_variant_match === true) return true;
  if (evidence.wiki_any_signal === true) return true;
  return false;
}

function mentionSortKey(mention) {
  return `${mention.segment_id}|${String(mention.span.start).padStart(8, '0')}|${String(mention.span.end).padStart(8, '0')}|${mention.kind}|${mention.id}`;
}

const SUBJECT_ROLE_LABELS = new Set([
  'actor',
  'agent',
  'subject',
  'subj',
  'nsubj',
  'nsubjpass',
  'csubj',
  'csubjpass',
  'agent_passive',
]);

function isSubjectRoleLabel(role) {
  return SUBJECT_ROLE_LABELS.has(String(role || ''));
}

function roleToSlot(role) {
  if (isSubjectRoleLabel(role)) return { slot: 'actor', role: null };
  if (role === 'theme') return { slot: 'theme', role: null };
  if (role === 'patient') return { slot: 'theme', role: null };
  if (role === 'attribute') return { slot: 'attr', role: null };
  if (role === 'topic') return { slot: 'topic', role: null };
  if (role === 'location') return { slot: 'location', role: null };
  if (role === 'recipient') return { slot: 'other', role: 'recipient' };
  return { slot: 'other', role };
}

function isCompareLabel(label) {
  const l = String(label || '');
  return l === 'compare' || l === 'compare_gt' || l === 'compare_lt';
}

function isQuantifierLabel(label) {
  const l = String(label || '');
  return l === 'quantifier' || l === 'quantifier_scope' || l === 'scope_quantifier';
}

function mentionHasLexiconEvidence(mention) {
  return !!(
    mention &&
    mention.provenance &&
    mention.provenance.lexicon_evidence &&
    typeof mention.provenance.lexicon_evidence === 'object'
  );
}

function compareMentionProjectionPriority(a, b) {
  const aSpanLen = Array.isArray(a && a.token_ids) ? a.token_ids.length : 0;
  const bSpanLen = Array.isArray(b && b.token_ids) ? b.token_ids.length : 0;
  if (aSpanLen !== bSpanLen) return bSpanLen - aSpanLen;
  const aPriority = Number.isFinite(a && a.priority) ? a.priority : Number.MAX_SAFE_INTEGER;
  const bPriority = Number.isFinite(b && b.priority) ? b.priority : Number.MAX_SAFE_INTEGER;
  if (aPriority !== bPriority) return aPriority - bPriority;
  const aLex = mentionHasLexiconEvidence(a) ? 0 : 1;
  const bLex = mentionHasLexiconEvidence(b) ? 0 : 1;
  if (aLex !== bLex) return aLex - bLex;
  return String(a && a.id ? a.id : '').localeCompare(String(b && b.id ? b.id : ''));
}

function chooseBestMentionForToken({ tokenId, segmentId, mentionById, candidateMentionIds, excludeMentionId }) {
  const sourceIds = (candidateMentionIds || [])
    .filter((id) => typeof id === 'string')
    .slice();
  const filteredIds = sourceIds.filter((id) => {
    if (excludeMentionId && id === excludeMentionId) return false;
    const mention = mentionById.get(id);
    if (!mention || mention.segment_id !== segmentId) return false;
    if (mention.suppressed === true) return false;
    return Array.isArray(mention.token_ids) && mention.token_ids.includes(tokenId);
  });
  if (filteredIds.length === 0) {
    return { mention_id: null, candidate_count: 0, chosen_was_first: true };
  }
  const chosenSorted = filteredIds.slice().sort((a, b) => {
    const ma = mentionById.get(a);
    const mb = mentionById.get(b);
    return compareMentionProjectionPriority(ma, mb);
  });
  const chosenId = chosenSorted[0];
  return {
    mention_id: chosenId,
    candidate_count: filteredIds.length,
    chosen_was_first: sourceIds.length > 0 ? sourceIds[0] === chosenId : true,
  };
}

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

function collectStep11Relations(relationsSeed, tokenById) {
  const out = [];
  const annotations = Array.isArray(relationsSeed.annotations) ? relationsSeed.annotations : [];
  for (const a of annotations) {
    if (!a || a.kind !== 'dependency' || a.status !== 'accepted') continue;
    if (!annotationHasSource(a, 'relation-extraction')) continue;
    if (!a.head || typeof a.head.id !== 'string' || !tokenById.has(a.head.id)) continue;
    if (!a.dep || typeof a.dep.id !== 'string' || !tokenById.has(a.dep.id)) continue;
    out.push({
      id: typeof a.id === 'string' ? a.id : '',
      label: String(a.label || ''),
      head_token_id: a.head.id,
      dep_token_id: a.dep.id,
      evidence: (Array.isArray(a.sources) ? a.sources.find((s) => s && s.name === 'relation-extraction') : null)?.evidence || {},
    });
  }
  return out;
}

function getMweHeadEvidence(mwe) {
  if (!Array.isArray(mwe.sources)) return null;
  const src = mwe.sources.find((s) => s && s.name === 'mwe-materialization' && s.evidence && typeof s.evidence.head_token_id === 'string');
  return src ? src.evidence.head_token_id : null;
}

function getMweLexiconEvidence(mwe) {
  if (!Array.isArray(mwe.sources)) return null;
  const src = mwe.sources.find(
    (s) =>
      s &&
      s.name === 'wikipedia-title-index' &&
      s.evidence &&
      typeof s.evidence === 'object'
  );
  if (!src) return null;
  return deepCloneJson(src.evidence);
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

function toAnnotationSummary(annotation) {
  const tokenSelector = findSelector(annotation, 'TokenSelector');
  const textPos = findSelector(annotation, 'TextPositionSelector');
  return {
    id: typeof annotation.id === 'string' ? annotation.id : '',
    kind: String(annotation.kind || ''),
    status: String(annotation.status || ''),
    label: typeof annotation.label === 'string' ? annotation.label : undefined,
    token_ids: tokenSelector && Array.isArray(tokenSelector.token_ids) ? normalizeIds(tokenSelector.token_ids) : [],
    span:
      textPos && textPos.span && typeof textPos.span.start === 'number' && typeof textPos.span.end === 'number'
        ? { start: textPos.span.start, end: textPos.span.end }
        : undefined,
    source_names: normalizeIds(
      (Array.isArray(annotation.sources) ? annotation.sources : [])
        .map((s) => (s && typeof s.name === 'string' ? s.name : ''))
        .filter(Boolean)
    ),
  };
}

function buildAcceptedAnnotationsInventory(relationsSeed) {
  const annotations = Array.isArray(relationsSeed && relationsSeed.annotations) ? relationsSeed.annotations : [];
  return annotations
    .filter((a) => a && a.status === 'accepted')
    .map(toAnnotationSummary)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
      if ((a.span && a.span.start) !== (b.span && b.span.start)) return (a.span ? a.span.start : -1) - (b.span ? b.span.start : -1);
      if ((a.span && a.span.end) !== (b.span && b.span.end)) return (a.span ? a.span.end : -1) - (b.span ? b.span.end : -1);
      return a.id.localeCompare(b.id);
    });
}

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
  for (const rel of relations) {
    if (rel && typeof rel.dep_mention_id === 'string') mentionIds.add(rel.dep_mention_id);
  }

  const mentionEvidence = Array.from(mentionIds)
    .sort((a, b) => a.localeCompare(b))
    .map((mentionId) => {
      const mention = mentionById.get(mentionId);
      const lexiconEvidence =
        mention &&
        mention.provenance &&
        mention.provenance.lexicon_evidence &&
        typeof mention.provenance.lexicon_evidence === 'object'
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

function buildChunkHeadMaps(headsSeed) {
  const chunkById = new Map();
  const headByChunkId = new Map();
  if (!headsSeed || !Array.isArray(headsSeed.annotations)) return { chunkById, headByChunkId };
  for (const a of headsSeed.annotations) {
    if (!a || a.status !== 'accepted') continue;
    if (a.kind === 'chunk' && typeof a.id === 'string') chunkById.set(a.id, a);
    if (a.kind === 'chunk_head' && typeof a.chunk_id === 'string' && a.head && typeof a.head.id === 'string') {
      headByChunkId.set(a.chunk_id, a.head.id);
    }
  }
  return { chunkById, headByChunkId };
}

function buildDependencyObservationMaps(relationsSeed, tokenById) {
  const incomingInside = new Map();
  const outgoingInside = new Map();
  const annotations = Array.isArray(relationsSeed.annotations) ? relationsSeed.annotations : [];
  for (const a of annotations) {
    if (!a || a.kind !== 'dependency' || a.status !== 'observation') continue;
    if (!a.dep || typeof a.dep.id !== 'string' || !tokenById.has(a.dep.id)) continue;
    if (a.is_root || !a.head || typeof a.head.id !== 'string' || !tokenById.has(a.head.id)) continue;
    const dep = a.dep.id;
    const head = a.head.id;
    if (!incomingInside.has(dep)) incomingInside.set(dep, []);
    if (!outgoingInside.has(head)) outgoingInside.set(head, []);
    incomingInside.get(dep).push(head);
    outgoingInside.get(head).push(dep);
  }
  return { incomingInside, outgoingInside };
}

function posFallbackHead(tokenIds, tokenById) {
  const toks = tokenIds.map((id) => tokenById.get(id)).filter(Boolean).sort((a, b) => a.i - b.i);
  const nouns = toks.filter((t) => /^(NN|NNS|NNP|NNPS|PRP|CD)/.test(t.pos.tag));
  if (nouns.length > 0) return nouns[nouns.length - 1].id;
  const verbs = toks.filter((t) => /^VB/.test(t.pos.tag));
  if (verbs.length > 0) return verbs[0].id;
  return toks.length > 0 ? toks[toks.length - 1].id : null;
}

function resolveMentionHead({
  tokenIds,
  explicitHead,
  chunkById,
  headByChunkId,
  incomingInsideMap,
  tokenById,
}) {
  const tokenSet = new Set(tokenIds);
  if (explicitHead && tokenSet.has(explicitHead)) return { head: explicitHead, strategy: 'explicit', unresolved: null };

  for (const [chunkId, chunk] of chunkById.entries()) {
    const ts = findSelector(chunk, 'TokenSelector');
    if (!ts || !Array.isArray(ts.token_ids)) continue;
    const ids = ts.token_ids;
    if (ids.length !== tokenIds.length) continue;
    let same = true;
    for (const id of ids) {
      if (!tokenSet.has(id)) {
        same = false;
        break;
      }
    }
    if (!same) continue;
    const head = headByChunkId.get(chunkId);
    if (head && tokenSet.has(head)) return { head, strategy: 'chunk_head', unresolved: null };
  }

  const rootCandidates = tokenIds.filter((id) => {
    const incoming = incomingInsideMap.get(id) || [];
    const insideIncoming = incoming.filter((h) => tokenSet.has(h));
    return insideIncoming.length === 0;
  });
  if (rootCandidates.length === 1) return { head: rootCandidates[0], strategy: 'dependency_head', unresolved: null };

  const fallback = posFallbackHead(tokenIds, tokenById);
  if (fallback) {
    return {
      head: fallback,
      strategy: 'pos_fallback',
      unresolved:
        rootCandidates.length === 0
          ? 'no_dependency_head_in_mention'
          : 'multiple_dependency_head_candidates',
    };
  }
  return { head: tokenIds[0], strategy: 'unresolved', unresolved: 'empty_mention_tokens' };
}

function buildMentions({ relationsSeed, mweSeed, headsSeed, tokenById, tokenWikiById }) {
  const annotations = Array.isArray(mweSeed?.annotations) ? mweSeed.annotations : [];
  const mweCandidates = [];
  for (const a of annotations) {
    if (!a || a.kind !== 'mwe' || a.status !== 'accepted') continue;
    const ts = findSelector(a, 'TokenSelector');
    const ps = findSelector(a, 'TextPositionSelector');
    if (!ts || !Array.isArray(ts.token_ids) || ts.token_ids.length === 0) continue;
    if (!ps || !ps.span || typeof ps.span.start !== 'number' || typeof ps.span.end !== 'number') continue;
    const ids = normalizeIds(ts.token_ids);
    const missing = ids.some((id) => !tokenById.has(id));
    if (missing) continue;
    const seg = tokenById.get(ids[0]).segment_id;
    if (!ids.every((id) => tokenById.get(id).segment_id === seg)) continue;
    mweCandidates.push({
      annotation_id: typeof a.id === 'string' ? a.id : '',
      token_ids: ids,
      span: { start: ps.span.start, end: ps.span.end },
      segment_id: seg,
      explicit_head: getMweHeadEvidence(a),
      lexicon_evidence: getMweLexiconEvidence(a),
    });
  }

  mweCandidates.sort((a, b) => {
    if (b.token_ids.length !== a.token_ids.length) return b.token_ids.length - a.token_ids.length;
    const al = a.span.end - a.span.start;
    const bl = b.span.end - b.span.start;
    if (bl !== al) return bl - al;
    if (a.span.start !== b.span.start) return a.span.start - b.span.start;
    return a.annotation_id.localeCompare(b.annotation_id);
  });

  const claimed = new Set();
  const winners = [];
  const alternatives = [];
  for (const c of mweCandidates) {
    if (c.token_ids.some((id) => claimed.has(id))) {
      alternatives.push(c);
      continue;
    }
    winners.push(c);
    for (const id of c.token_ids) claimed.add(id);
  }

  const { chunkById, headByChunkId } = buildChunkHeadMaps(headsSeed);
  const { incomingInside } = buildDependencyObservationMaps(relationsSeed, tokenById);

  const mentions = [];
  const unresolvedHeadMap = new Map();

  for (const w of winners) {
    const head = resolveMentionHead({
      tokenIds: w.token_ids,
      explicitHead: w.explicit_head,
      chunkById,
      headByChunkId,
      incomingInsideMap: incomingInside,
      tokenById,
    });
    const mentionLexiconEvidence = buildMentionLexiconEvidence({
      tokenIds: w.token_ids,
      tokenWikiById,
      mweLexiconEvidence: w.lexicon_evidence,
    });
    const idBase = `m:${w.segment_id}:${normalizeSpanKey(w.span)}:mwe`;
    mentions.push({
      id: idBase,
      kind: 'mwe',
      priority: 0,
      token_ids: w.token_ids,
      head_token_id: head.head,
      span: w.span,
      segment_id: w.segment_id,
      is_primary: true,
      provenance: {
        source_annotation_id: w.annotation_id || undefined,
        source_kind: 'mwe_materialized',
        head_strategy: head.strategy,
        lexicon_source: mentionLexiconEvidence ? 'wikipedia-title-index' : undefined,
        lexicon_evidence: mentionLexiconEvidence || undefined,
      },
    });
    if (head.unresolved) unresolvedHeadMap.set(idBase, head.unresolved);
  }

  for (const w of alternatives) {
    const head = resolveMentionHead({
      tokenIds: w.token_ids,
      explicitHead: w.explicit_head,
      chunkById,
      headByChunkId,
      incomingInsideMap: incomingInside,
      tokenById,
    });
    const mentionLexiconEvidence = buildMentionLexiconEvidence({
      tokenIds: w.token_ids,
      tokenWikiById,
      mweLexiconEvidence: w.lexicon_evidence,
    });
    const idBase = `m:${w.segment_id}:${normalizeSpanKey(w.span)}:mwe_alt`;
    mentions.push({
      id: idBase,
      kind: 'mwe',
      priority: 2,
      token_ids: w.token_ids,
      head_token_id: head.head,
      span: w.span,
      segment_id: w.segment_id,
      is_primary: false,
      provenance: {
        source_annotation_id: w.annotation_id || undefined,
        source_kind: 'mwe_alternative',
        head_strategy: head.strategy,
        lexicon_source: mentionLexiconEvidence ? 'wikipedia-title-index' : undefined,
        lexicon_evidence: mentionLexiconEvidence || undefined,
      },
    });
    if (head.unresolved) unresolvedHeadMap.set(idBase, head.unresolved);
  }

  const allTokensSorted = Array.from(tokenById.values()).sort((a, b) => a.i - b.i);
  for (const t of allTokensSorted) {
    if (claimed.has(t.id)) continue;
    const mentionLexiconEvidence = buildMentionLexiconEvidence({
      tokenIds: [t.id],
      tokenWikiById,
      mweLexiconEvidence: null,
    });
    const idBase = `m:${t.segment_id}:${t.span.start}-${t.span.end}:token`;
    mentions.push({
      id: idBase,
      kind: 'token',
      priority: 1,
      token_ids: [t.id],
      head_token_id: t.id,
      span: { start: t.span.start, end: t.span.end },
      segment_id: t.segment_id,
      is_primary: true,
      provenance: {
        source_kind: 'token_fallback',
        head_strategy: 'explicit',
        lexicon_source: mentionLexiconEvidence ? 'wikipedia-title-index' : undefined,
        lexicon_evidence: mentionLexiconEvidence || undefined,
      },
    });
  }

  for (const t of allTokensSorted) {
    if (!claimed.has(t.id)) continue;
    const mentionLexiconEvidence = buildMentionLexiconEvidence({
      tokenIds: [t.id],
      tokenWikiById,
      mweLexiconEvidence: null,
    });
    const idBase = `m:${t.segment_id}:${t.span.start}-${t.span.end}:token_shadow`;
    mentions.push({
      id: idBase,
      kind: 'token',
      priority: 4,
      token_ids: [t.id],
      head_token_id: t.id,
      span: { start: t.span.start, end: t.span.end },
      segment_id: t.segment_id,
      is_primary: false,
      provenance: {
        source_kind: 'token_shadow',
        head_strategy: 'explicit',
        lexicon_source: mentionLexiconEvidence ? 'wikipedia-title-index' : undefined,
        lexicon_evidence: mentionLexiconEvidence || undefined,
      },
    });
  }

  for (const [chunkId, chunk] of chunkById.entries()) {
    const tokenSelector = findSelector(chunk, 'TokenSelector');
    const textPos = findSelector(chunk, 'TextPositionSelector');
    if (!tokenSelector || !Array.isArray(tokenSelector.token_ids) || tokenSelector.token_ids.length === 0) continue;
    if (!textPos || !textPos.span || typeof textPos.span.start !== 'number' || typeof textPos.span.end !== 'number') continue;
    const tokenIds = normalizeIds(tokenSelector.token_ids);
    if (tokenIds.some((id) => !tokenById.has(id))) continue;
    const segmentId = tokenById.get(tokenIds[0]).segment_id;
    if (!tokenIds.every((id) => tokenById.get(id).segment_id === segmentId)) continue;
    const explicitHead = headByChunkId.get(chunkId) || null;
    const head = resolveMentionHead({
      tokenIds,
      explicitHead,
      chunkById,
      headByChunkId,
      incomingInsideMap: incomingInside,
      tokenById,
    });
    const mentionLexiconEvidence = buildMentionLexiconEvidence({
      tokenIds,
      tokenWikiById,
      mweLexiconEvidence: null,
    });
    const idBase = `m:${segmentId}:${normalizeSpanKey(textPos.span)}:chunk`;
    mentions.push({
      id: idBase,
      kind: 'chunk',
      priority: 3,
      token_ids: tokenIds,
      head_token_id: head.head,
      span: { start: textPos.span.start, end: textPos.span.end },
      segment_id: segmentId,
      is_primary: false,
      provenance: {
        source_annotation_id: chunkId,
        source_kind: 'chunk_accepted',
        head_strategy: head.strategy,
        lexicon_source: mentionLexiconEvidence ? 'wikipedia-title-index' : undefined,
        lexicon_evidence: mentionLexiconEvidence || undefined,
      },
    });
    if (head.unresolved) unresolvedHeadMap.set(idBase, head.unresolved);
  }

  mentions.sort((a, b) => mentionSortKey(a).localeCompare(mentionSortKey(b)));

  const baseIdCounts = new Map();
  const assignedIds = new Set();
  for (const m of mentions) {
    const baseId = m.id;
    let n = (baseIdCounts.get(baseId) || 0) + 1;
    let candidate = n === 1 ? baseId : `${baseId}:${n}`;
    while (assignedIds.has(candidate)) {
      n += 1;
      candidate = `${baseId}:${n}`;
    }
    baseIdCounts.set(baseId, n);
    assignedIds.add(candidate);
    m.id = candidate;
  }

  const tokenToPrimaryMention = new Map();
  const tokenToAllMentions = new Map();
  for (const m of mentions) {
    if (!m.is_primary) continue;
    for (const tid of m.token_ids) tokenToPrimaryMention.set(tid, m.id);
  }
  for (const m of mentions) {
    for (const tid of m.token_ids) {
      if (!tokenToAllMentions.has(tid)) tokenToAllMentions.set(tid, []);
      tokenToAllMentions.get(tid).push(m.id);
    }
  }
  for (const mids of tokenToAllMentions.values()) mids.sort((a, b) => a.localeCompare(b));

  return { mentions, tokenToPrimaryMention, tokenToAllMentions, unresolvedHeadMap };
}


module.exports = {
  normalizeWikiSurface,
  hasPositiveWikiSignal,
  mentionSortKey,
  SUBJECT_ROLE_LABELS,
  isSubjectRoleLabel,
  roleToSlot,
  isCompareLabel,
  isQuantifierLabel,
  mentionHasLexiconEvidence,
  compareMentionProjectionPriority,
  chooseBestMentionForToken,
  getMweHeadEvidence,
  getMweLexiconEvidence,
  toAnnotationSummary,
  buildAcceptedAnnotationsInventory,
  buildMentionLexiconEvidence,
  buildAssertionWikiSignals,
  buildChunkHeadMaps,
  buildDependencyObservationMaps,
  posFallbackHead,
  resolveMentionHead,
  buildMentions,
};
