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

module.exports = {
  buildChunkHeadMaps,
};
