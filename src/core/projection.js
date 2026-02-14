const { deepCloneJson, sha256Hex, normalizeIds } = require('./determinism');
const { chooseBestMentionForToken, compareMentionProjectionPriority, mentionHasLexiconEvidence } = require('./mentions');
const { annotationHasSource, collectStep11Relations } = require('./upstream');
const { getTokenWikipediaEvidence, buildTokenWikiById, getTokenMetadataProjection } = require('./tokens');
const { getMweHeadEvidence, getMweLexiconEvidence } = require('./mention-materialization');
const { toAnnotationSummary, buildAcceptedAnnotationsInventory } = require('./accepted-annotations');
const { buildChunkHeadMaps } = require('./mention-head-resolution');

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

function buildProjectedRelations(relations, tokenToMention, tokenToAllMentions, mentionById, tokenById) {
  function mentionKindRank(kind) {
    if (kind === 'token') return 0;
    if (kind === 'mwe') return 1;
    if (kind === 'chunk') return 2;
    return 9;
  }

  function chooseMentionId(candidates, preferPrimary, excludeId) {
    const ids = (candidates || [])
      .filter((id) => typeof id === 'string' && mentionById.has(id) && id !== excludeId)
      .slice();
    ids.sort((a, b) => {
      const ma = mentionById.get(a);
      const mb = mentionById.get(b);
      const pa = ma && ma.is_primary ? 0 : 1;
      const pb = mb && mb.is_primary ? 0 : 1;
      if (preferPrimary && pa !== pb) return pa - pb;
      if (!preferPrimary && pa !== pb) return pb - pa;
      const ka = mentionKindRank(ma ? ma.kind : '');
      const kb = mentionKindRank(mb ? mb.kind : '');
      if (ka !== kb) return ka - kb;
      if (ma && mb && ma.segment_id !== mb.segment_id) return ma.segment_id.localeCompare(mb.segment_id);
      if (ma && mb && ma.span.start !== mb.span.start) return ma.span.start - mb.span.start;
      if (ma && mb && ma.span.end !== mb.span.end) return ma.span.end - mb.span.end;
      return a.localeCompare(b);
    });
    return ids.length > 0 ? ids[0] : null;
  }

  const out = [];
  const unresolved = [];
  const dropped = [];
  const all = [];
  for (const r of relations) {
    const headMentionIds = tokenToAllMentions.get(r.head_token_id) || [];
    const depMentionIds = tokenToAllMentions.get(r.dep_token_id) || [];
    const headTok = tokenById.get(r.head_token_id);
    const depTok = tokenById.get(r.dep_token_id);
    const segmentId = headTok.segment_id;

    let headMentionId = tokenToMention.get(r.head_token_id);
    let depMentionId = tokenToMention.get(r.dep_token_id);

    if (!headMentionId) {
      headMentionId = chooseMentionId(headMentionIds, true, null);
    }
    if (!depMentionId) {
      depMentionId = chooseMentionId(depMentionIds, true, null);
    }
    if (headMentionId && depMentionId && headMentionId === depMentionId) {
      const depAlt = chooseMentionId(depMentionIds, false, headMentionId);
      if (depAlt) {
        depMentionId = depAlt;
      } else {
        const headAlt = chooseMentionId(headMentionIds, false, depMentionId);
        if (headAlt) headMentionId = headAlt;
      }
    }
    all.push({
      relation_id: r.id,
      label: r.label,
      segment_id: segmentId,
      head_token_id: r.head_token_id,
      dep_token_id: r.dep_token_id,
      head_primary_mention_id: headMentionId || null,
      dep_primary_mention_id: depMentionId || null,
      head_mention_ids: headMentionIds,
      dep_mention_ids: depMentionIds,
    });
    if (!depTok || depTok.segment_id !== segmentId) continue;
    if (!headMentionId || !depMentionId) {
      if (depMentionId) unresolved.push({ kind: 'unresolved_attachment', segment_id: segmentId, mention_id: depMentionId, reason: 'missing_primary_projection', relation: r });
      dropped.push({
        relation_id: r.id,
        label: r.label,
        segment_id: segmentId,
        reason: 'missing_primary_projection',
        head_token_id: r.head_token_id,
        dep_token_id: r.dep_token_id,
        head_primary_mention_id: headMentionId || null,
        dep_primary_mention_id: depMentionId || null,
      });
      continue;
    }
    if (headMentionId === depMentionId) {
      dropped.push({
        relation_id: r.id,
        label: r.label,
        segment_id: segmentId,
        reason: 'self_loop_after_primary_projection',
        head_token_id: r.head_token_id,
        dep_token_id: r.dep_token_id,
        head_primary_mention_id: headMentionId,
        dep_primary_mention_id: depMentionId,
      });
      continue;
    }
    const headMention = mentionById.get(headMentionId);
    const depMention = mentionById.get(depMentionId);
    if (!headMention || !depMention) continue;
    if (headMention.segment_id !== depMention.segment_id) continue;
    out.push({
      relation_id: r.id,
      label: r.label,
      head_token_id: r.head_token_id,
      dep_token_id: r.dep_token_id,
      head_mention_id: headMentionId,
      dep_mention_id: depMentionId,
      segment_id: headMention.segment_id,
      evidence: r.evidence || {},
    });
  }
  out.sort((a, b) => {
    const ta = tokenById.get(a.head_token_id);
    const tb = tokenById.get(b.head_token_id);
    if (a.segment_id !== b.segment_id) return a.segment_id.localeCompare(b.segment_id);
    if (ta.span.start !== tb.span.start) return ta.span.start - tb.span.start;
    const da = tokenById.get(a.dep_token_id);
    const db = tokenById.get(b.dep_token_id);
    if (da.span.start !== db.span.start) return da.span.start - db.span.start;
    if (a.label !== b.label) return a.label.localeCompare(b.label);
    return a.relation_id.localeCompare(b.relation_id);
  });
  dropped.sort((a, b) => {
    if (a.segment_id !== b.segment_id) return a.segment_id.localeCompare(b.segment_id);
    if (a.head_token_id !== b.head_token_id) return a.head_token_id.localeCompare(b.head_token_id);
    if (a.dep_token_id !== b.dep_token_id) return a.dep_token_id.localeCompare(b.dep_token_id);
    if (a.label !== b.label) return a.label.localeCompare(b.label);
    return (a.relation_id || '').localeCompare(b.relation_id || '');
  });
  all.sort((a, b) => {
    if (a.segment_id !== b.segment_id) return a.segment_id.localeCompare(b.segment_id);
    if (a.head_token_id !== b.head_token_id) return a.head_token_id.localeCompare(b.head_token_id);
    if (a.dep_token_id !== b.dep_token_id) return a.dep_token_id.localeCompare(b.dep_token_id);
    if (a.label !== b.label) return a.label.localeCompare(b.label);
    return (a.relation_id || '').localeCompare(b.relation_id || '');
  });
  return { projected: out, unresolved, dropped, all };
}

function buildCoordinationGroups(projected) {
  const edges = projected.filter((p) => p.label === 'coordination');
  const graph = new Map();
  for (const e of edges) {
    if (!graph.has(e.head_mention_id)) graph.set(e.head_mention_id, new Set());
    if (!graph.has(e.dep_mention_id)) graph.set(e.dep_mention_id, new Set());
    graph.get(e.head_mention_id).add(e.dep_mention_id);
    graph.get(e.dep_mention_id).add(e.head_mention_id);
  }
  const seen = new Set();
  const groups = new Map();
  for (const node of graph.keys()) {
    if (seen.has(node)) continue;
    const comp = [];
    const q = [node];
    seen.add(node);
    while (q.length > 0) {
      const cur = q.shift();
      comp.push(cur);
      for (const n of graph.get(cur) || []) {
        if (seen.has(n)) continue;
        seen.add(n);
        q.push(n);
      }
    }
    comp.sort((a, b) => a.localeCompare(b));
    const gid = `cg:${sha256Hex(comp.join('|')).slice(0, 12)}`;
    for (const m of comp) groups.set(m, gid);
  }
  return groups;
}


module.exports = {
  annotationHasSource,
  collectStep11Relations,
  buildProjectedRelations,
  buildCoordinationGroups,
};
