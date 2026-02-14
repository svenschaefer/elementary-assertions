const { findSelector, normalizeSpanKey, normalizeIds } = require("./determinism");
const { getMweHeadEvidence, getMweLexiconEvidence } = require("./mention-materialization");
const {
  buildChunkHeadMaps,
  buildDependencyObservationMaps,
  resolveMentionHead,
} = require("./mention-head-resolution");
const { buildMentionLexiconEvidence } = require("./mention-evidence");

function mentionSortKey(mention) {
  return `${mention.segment_id}|${String(mention.span.start).padStart(8, "0")}|${String(mention.span.end).padStart(8, "0")}|${mention.kind}|${mention.id}`;
}

function buildMentions({ relationsSeed, mweSeed, headsSeed, tokenById, tokenWikiById }) {
  const annotations = Array.isArray(mweSeed?.annotations) ? mweSeed.annotations : [];
  const mweCandidates = [];
  for (const annotation of annotations) {
    if (!annotation || annotation.kind !== "mwe" || annotation.status !== "accepted") continue;
    const tokenSelector = findSelector(annotation, "TokenSelector");
    const textPos = findSelector(annotation, "TextPositionSelector");
    if (!tokenSelector || !Array.isArray(tokenSelector.token_ids) || tokenSelector.token_ids.length === 0) continue;
    if (!textPos || !textPos.span || typeof textPos.span.start !== "number" || typeof textPos.span.end !== "number") continue;
    const ids = normalizeIds(tokenSelector.token_ids);
    const missing = ids.some((id) => !tokenById.has(id));
    if (missing) continue;
    const segmentId = tokenById.get(ids[0]).segment_id;
    if (!ids.every((id) => tokenById.get(id).segment_id === segmentId)) continue;
    mweCandidates.push({
      annotation_id: typeof annotation.id === "string" ? annotation.id : "",
      token_ids: ids,
      span: { start: textPos.span.start, end: textPos.span.end },
      segment_id: segmentId,
      explicit_head: getMweHeadEvidence(annotation),
      lexicon_evidence: getMweLexiconEvidence(annotation),
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
  for (const candidate of mweCandidates) {
    if (candidate.token_ids.some((id) => claimed.has(id))) {
      alternatives.push(candidate);
      continue;
    }
    winners.push(candidate);
    for (const id of candidate.token_ids) claimed.add(id);
  }

  const { chunkById, headByChunkId } = buildChunkHeadMaps(headsSeed);
  const { incomingInside } = buildDependencyObservationMaps(relationsSeed, tokenById);

  const mentions = [];
  const unresolvedHeadMap = new Map();

  for (const winner of winners) {
    const head = resolveMentionHead({
      tokenIds: winner.token_ids,
      explicitHead: winner.explicit_head,
      chunkById,
      headByChunkId,
      incomingInsideMap: incomingInside,
      tokenById,
      findSelector,
    });
    const mentionLexiconEvidence = buildMentionLexiconEvidence({
      tokenIds: winner.token_ids,
      tokenWikiById,
      mweLexiconEvidence: winner.lexicon_evidence,
    });
    const idBase = `m:${winner.segment_id}:${normalizeSpanKey(winner.span)}:mwe`;
    mentions.push({
      id: idBase,
      kind: "mwe",
      priority: 0,
      token_ids: winner.token_ids,
      head_token_id: head.head,
      span: winner.span,
      segment_id: winner.segment_id,
      is_primary: true,
      provenance: {
        source_annotation_id: winner.annotation_id || undefined,
        source_kind: "mwe_materialized",
        head_strategy: head.strategy,
        lexicon_source: mentionLexiconEvidence ? "wikipedia-title-index" : undefined,
        lexicon_evidence: mentionLexiconEvidence || undefined,
      },
    });
    if (head.unresolved) unresolvedHeadMap.set(idBase, head.unresolved);
  }

  for (const winner of alternatives) {
    const head = resolveMentionHead({
      tokenIds: winner.token_ids,
      explicitHead: winner.explicit_head,
      chunkById,
      headByChunkId,
      incomingInsideMap: incomingInside,
      tokenById,
      findSelector,
    });
    const mentionLexiconEvidence = buildMentionLexiconEvidence({
      tokenIds: winner.token_ids,
      tokenWikiById,
      mweLexiconEvidence: winner.lexicon_evidence,
    });
    const idBase = `m:${winner.segment_id}:${normalizeSpanKey(winner.span)}:mwe_alt`;
    mentions.push({
      id: idBase,
      kind: "mwe",
      priority: 2,
      token_ids: winner.token_ids,
      head_token_id: head.head,
      span: winner.span,
      segment_id: winner.segment_id,
      is_primary: false,
      provenance: {
        source_annotation_id: winner.annotation_id || undefined,
        source_kind: "mwe_alternative",
        head_strategy: head.strategy,
        lexicon_source: mentionLexiconEvidence ? "wikipedia-title-index" : undefined,
        lexicon_evidence: mentionLexiconEvidence || undefined,
      },
    });
    if (head.unresolved) unresolvedHeadMap.set(idBase, head.unresolved);
  }

  const allTokensSorted = Array.from(tokenById.values()).sort((a, b) => a.i - b.i);
  for (const token of allTokensSorted) {
    if (claimed.has(token.id)) continue;
    const mentionLexiconEvidence = buildMentionLexiconEvidence({
      tokenIds: [token.id],
      tokenWikiById,
      mweLexiconEvidence: null,
    });
    const idBase = `m:${token.segment_id}:${token.span.start}-${token.span.end}:token`;
    mentions.push({
      id: idBase,
      kind: "token",
      priority: 1,
      token_ids: [token.id],
      head_token_id: token.id,
      span: { start: token.span.start, end: token.span.end },
      segment_id: token.segment_id,
      is_primary: true,
      provenance: {
        source_kind: "token_fallback",
        head_strategy: "explicit",
        lexicon_source: mentionLexiconEvidence ? "wikipedia-title-index" : undefined,
        lexicon_evidence: mentionLexiconEvidence || undefined,
      },
    });
  }

  for (const token of allTokensSorted) {
    if (!claimed.has(token.id)) continue;
    const mentionLexiconEvidence = buildMentionLexiconEvidence({
      tokenIds: [token.id],
      tokenWikiById,
      mweLexiconEvidence: null,
    });
    const idBase = `m:${token.segment_id}:${token.span.start}-${token.span.end}:token_shadow`;
    mentions.push({
      id: idBase,
      kind: "token",
      priority: 4,
      token_ids: [token.id],
      head_token_id: token.id,
      span: { start: token.span.start, end: token.span.end },
      segment_id: token.segment_id,
      is_primary: false,
      provenance: {
        source_kind: "token_shadow",
        head_strategy: "explicit",
        lexicon_source: mentionLexiconEvidence ? "wikipedia-title-index" : undefined,
        lexicon_evidence: mentionLexiconEvidence || undefined,
      },
    });
  }

  for (const [chunkId, chunk] of chunkById.entries()) {
    const tokenSelector = findSelector(chunk, "TokenSelector");
    const textPos = findSelector(chunk, "TextPositionSelector");
    if (!tokenSelector || !Array.isArray(tokenSelector.token_ids) || tokenSelector.token_ids.length === 0) continue;
    if (!textPos || !textPos.span || typeof textPos.span.start !== "number" || typeof textPos.span.end !== "number") continue;
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
      findSelector,
    });
    const mentionLexiconEvidence = buildMentionLexiconEvidence({
      tokenIds,
      tokenWikiById,
      mweLexiconEvidence: null,
    });
    const idBase = `m:${segmentId}:${normalizeSpanKey(textPos.span)}:chunk`;
    mentions.push({
      id: idBase,
      kind: "chunk",
      priority: 3,
      token_ids: tokenIds,
      head_token_id: head.head,
      span: { start: textPos.span.start, end: textPos.span.end },
      segment_id: segmentId,
      is_primary: false,
      provenance: {
        source_annotation_id: chunkId,
        source_kind: "chunk_accepted",
        head_strategy: head.strategy,
        lexicon_source: mentionLexiconEvidence ? "wikipedia-title-index" : undefined,
        lexicon_evidence: mentionLexiconEvidence || undefined,
      },
    });
    if (head.unresolved) unresolvedHeadMap.set(idBase, head.unresolved);
  }

  mentions.sort((a, b) => mentionSortKey(a).localeCompare(mentionSortKey(b)));

  const baseIdCounts = new Map();
  const assignedIds = new Set();
  for (const mention of mentions) {
    const baseId = mention.id;
    let n = (baseIdCounts.get(baseId) || 0) + 1;
    let candidate = n === 1 ? baseId : `${baseId}:${n}`;
    while (assignedIds.has(candidate)) {
      n += 1;
      candidate = `${baseId}:${n}`;
    }
    baseIdCounts.set(baseId, n);
    assignedIds.add(candidate);
    mention.id = candidate;
  }

  const tokenToPrimaryMention = new Map();
  const tokenToAllMentions = new Map();
  for (const mention of mentions) {
    if (!mention.is_primary) continue;
    for (const tokenId of mention.token_ids) tokenToPrimaryMention.set(tokenId, mention.id);
  }
  for (const mention of mentions) {
    for (const tokenId of mention.token_ids) {
      if (!tokenToAllMentions.has(tokenId)) tokenToAllMentions.set(tokenId, []);
      tokenToAllMentions.get(tokenId).push(mention.id);
    }
  }
  for (const mentionIds of tokenToAllMentions.values()) mentionIds.sort((a, b) => a.localeCompare(b));

  return { mentions, tokenToPrimaryMention, tokenToAllMentions, unresolvedHeadMap };
}

module.exports = {
  mentionSortKey,
  buildMentions,
};
