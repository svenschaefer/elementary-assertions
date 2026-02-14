function buildChunkHeadMaps(headsSeed) {
  const chunkById = new Map();
  const headByChunkId = new Map();
  if (!headsSeed || !Array.isArray(headsSeed.annotations)) return { chunkById, headByChunkId };
  for (const annotation of headsSeed.annotations) {
    if (!annotation || annotation.status !== "accepted") continue;
    if (annotation.kind === "chunk" && typeof annotation.id === "string") {
      chunkById.set(annotation.id, annotation);
    }
    if (
      annotation.kind === "chunk_head" &&
      typeof annotation.chunk_id === "string" &&
      annotation.head &&
      typeof annotation.head.id === "string"
    ) {
      headByChunkId.set(annotation.chunk_id, annotation.head.id);
    }
  }
  return { chunkById, headByChunkId };
}

function buildDependencyObservationMaps(relationsSeed, tokenById) {
  const incomingInside = new Map();
  const outgoingInside = new Map();
  const annotations = Array.isArray(relationsSeed && relationsSeed.annotations) ? relationsSeed.annotations : [];
  for (const annotation of annotations) {
    if (!annotation || annotation.kind !== "dependency" || annotation.status !== "observation") continue;
    if (!annotation.dep || typeof annotation.dep.id !== "string" || !tokenById.has(annotation.dep.id)) continue;
    if (annotation.is_root || !annotation.head || typeof annotation.head.id !== "string" || !tokenById.has(annotation.head.id)) {
      continue;
    }
    const dep = annotation.dep.id;
    const head = annotation.head.id;
    if (!incomingInside.has(dep)) incomingInside.set(dep, []);
    if (!outgoingInside.has(head)) outgoingInside.set(head, []);
    incomingInside.get(dep).push(head);
    outgoingInside.get(head).push(dep);
  }
  return { incomingInside, outgoingInside };
}

function posFallbackHead(tokenIds, tokenById) {
  const tokens = (tokenIds || []).map((id) => tokenById.get(id)).filter(Boolean).sort((a, b) => a.i - b.i);
  const nouns = tokens.filter((token) => /^(NN|NNS|NNP|NNPS|PRP|CD)/.test(token.pos.tag));
  if (nouns.length > 0) return nouns[nouns.length - 1].id;
  const verbs = tokens.filter((token) => /^VB/.test(token.pos.tag));
  if (verbs.length > 0) return verbs[0].id;
  return tokens.length > 0 ? tokens[tokens.length - 1].id : null;
}

function resolveMentionHead({
  tokenIds,
  explicitHead,
  chunkById,
  headByChunkId,
  incomingInsideMap,
  tokenById,
  findSelector,
}) {
  const tokenSet = new Set(tokenIds);
  if (explicitHead && tokenSet.has(explicitHead)) {
    return { head: explicitHead, strategy: "explicit", unresolved: null };
  }

  for (const [chunkId, chunk] of chunkById.entries()) {
    const tokenSelector = findSelector(chunk, "TokenSelector");
    if (!tokenSelector || !Array.isArray(tokenSelector.token_ids)) continue;
    const ids = tokenSelector.token_ids;
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
    if (head && tokenSet.has(head)) return { head, strategy: "chunk_head", unresolved: null };
  }

  const rootCandidates = tokenIds.filter((id) => {
    const incoming = incomingInsideMap.get(id) || [];
    const insideIncoming = incoming.filter((headId) => tokenSet.has(headId));
    return insideIncoming.length === 0;
  });
  if (rootCandidates.length === 1) return { head: rootCandidates[0], strategy: "dependency_head", unresolved: null };

  const fallback = posFallbackHead(tokenIds, tokenById);
  if (fallback) {
    return {
      head: fallback,
      strategy: "pos_fallback",
      unresolved:
        rootCandidates.length === 0
          ? "no_dependency_head_in_mention"
          : "multiple_dependency_head_candidates",
    };
  }
  return { head: tokenIds[0], strategy: "unresolved", unresolved: "empty_mention_tokens" };
}

module.exports = {
  buildChunkHeadMaps,
  buildDependencyObservationMaps,
  posFallbackHead,
  resolveMentionHead,
};
