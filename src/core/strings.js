function normalizeOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

module.exports = {
  normalizeOptionalString,
};
