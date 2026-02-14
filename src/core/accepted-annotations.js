const { findSelector, normalizeIds } = require("./determinism");

function toAnnotationSummary(annotation) {
  const tokenSelector = findSelector(annotation, "TokenSelector");
  const textPos = findSelector(annotation, "TextPositionSelector");
  return {
    id: typeof annotation.id === "string" ? annotation.id : "",
    kind: String(annotation.kind || ""),
    status: String(annotation.status || ""),
    label: typeof annotation.label === "string" ? annotation.label : undefined,
    token_ids: tokenSelector && Array.isArray(tokenSelector.token_ids) ? normalizeIds(tokenSelector.token_ids) : [],
    span:
      textPos && textPos.span && typeof textPos.span.start === "number" && typeof textPos.span.end === "number"
        ? { start: textPos.span.start, end: textPos.span.end }
        : undefined,
    source_names: normalizeIds(
      (Array.isArray(annotation.sources) ? annotation.sources : [])
        .map((s) => (s && typeof s.name === "string" ? s.name : ""))
        .filter(Boolean)
    ),
  };
}

function buildAcceptedAnnotationsInventory(relationsSeed) {
  const annotations = Array.isArray(relationsSeed && relationsSeed.annotations) ? relationsSeed.annotations : [];
  return annotations
    .filter((annotation) => annotation && annotation.status === "accepted")
    .map(toAnnotationSummary)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
      if ((a.span && a.span.start) !== (b.span && b.span.start)) {
        return (a.span ? a.span.start : -1) - (b.span ? b.span.start : -1);
      }
      if ((a.span && a.span.end) !== (b.span && b.span.end)) {
        return (a.span ? a.span.end : -1) - (b.span ? b.span.end : -1);
      }
      return a.id.localeCompare(b.id);
    });
}

module.exports = {
  toAnnotationSummary,
  buildAcceptedAnnotationsInventory,
};
