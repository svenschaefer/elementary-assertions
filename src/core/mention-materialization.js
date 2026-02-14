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

module.exports = {
  getMweHeadEvidence,
};
