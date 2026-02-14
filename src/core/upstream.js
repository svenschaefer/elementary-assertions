function annotationHasSource(annotation, name) {
  return Array.isArray(annotation && annotation.sources) && annotation.sources.some((s) => s && s.name === name);
}

module.exports = {
  annotationHasSource,
};
