function annotationHasSource(annotation, name) {
  return Array.isArray(annotation && annotation.sources) && annotation.sources.some((s) => s && s.name === name);
}

function collectStep11Relations(relationsSeed, tokenById) {
  const out = [];
  const annotations = Array.isArray(relationsSeed && relationsSeed.annotations) ? relationsSeed.annotations : [];
  for (const annotation of annotations) {
    if (!annotation || annotation.kind !== "dependency" || annotation.status !== "accepted") continue;
    if (!annotationHasSource(annotation, "relation-extraction")) continue;
    if (!annotation.head || typeof annotation.head.id !== "string" || !tokenById.has(annotation.head.id)) continue;
    if (!annotation.dep || typeof annotation.dep.id !== "string" || !tokenById.has(annotation.dep.id)) continue;
    out.push({
      id: typeof annotation.id === "string" ? annotation.id : "",
      label: String(annotation.label || ""),
      head_token_id: annotation.head.id,
      dep_token_id: annotation.dep.id,
      evidence:
        (Array.isArray(annotation.sources)
          ? annotation.sources.find((src) => src && src.name === "relation-extraction")
          : null
        )?.evidence || {},
    });
  }
  return out;
}

module.exports = {
  annotationHasSource,
  collectStep11Relations,
};
