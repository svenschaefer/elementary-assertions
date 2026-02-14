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

module.exports = {
  toAnnotationSummary,
};
