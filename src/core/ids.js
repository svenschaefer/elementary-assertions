function normalizeIds(ids) {
  return Array.from(
    new Set((ids || []).filter((id) => typeof id === "string" && id.length > 0))
  ).sort((a, b) => a.localeCompare(b));
}

module.exports = {
  normalizeIds,
};
