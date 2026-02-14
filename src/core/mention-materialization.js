const { deepCloneJson } = require("./determinism");

function getMweHeadEvidence(mwe) {
  if (!Array.isArray(mwe && mwe.sources)) return null;
  const src = mwe.sources.find(
    (entry) =>
      entry &&
      entry.name === "mwe-materialization" &&
      entry.evidence &&
      typeof entry.evidence.head_token_id === "string"
  );
  return src ? src.evidence.head_token_id : null;
}

function getMweLexiconEvidence(mwe) {
  if (!Array.isArray(mwe && mwe.sources)) return null;
  const src = mwe.sources.find(
    (entry) =>
      entry &&
      entry.name === "wikipedia-title-index" &&
      entry.evidence &&
      typeof entry.evidence === "object"
  );
  if (!src) return null;
  return deepCloneJson(src.evidence);
}

module.exports = {
  getMweHeadEvidence,
  getMweLexiconEvidence,
};
