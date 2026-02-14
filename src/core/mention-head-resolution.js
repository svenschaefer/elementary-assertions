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

module.exports = {
  buildChunkHeadMaps,
  buildDependencyObservationMaps,
  posFallbackHead,
};
