const { deepCloneJson, sha256Hex, normalizeIds } = require('./determinism');
const { chooseBestMentionForToken, compareMentionProjectionPriority, mentionHasLexiconEvidence } = require('./mentions');
const { annotationHasSource, collectStep11Relations } = require('./upstream');
const { getTokenWikipediaEvidence, buildTokenWikiById, getTokenMetadataProjection } = require('./tokens');
const { getMweHeadEvidence, getMweLexiconEvidence } = require('./mention-materialization');
const { toAnnotationSummary, buildAcceptedAnnotationsInventory } = require('./accepted-annotations');
const { buildChunkHeadMaps, buildDependencyObservationMaps, posFallbackHead, resolveMentionHead } = require('./mention-head-resolution');
const { buildMentionLexiconEvidence, buildAssertionWikiSignals } = require('./mention-evidence');
const { buildMentions } = require('./mention-builder');

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


