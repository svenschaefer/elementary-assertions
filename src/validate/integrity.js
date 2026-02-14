const { validateAssertionDeterminism } = require("./determinism");
const { validateCoverage } = require("./coverage");
const {
  buildSegmentMap,
  validateTokenSegmentAlignment,
  validateMentionSegmentAlignment,
  validateAssertionCrossFieldAlignment,
} = require("./invariants");
const {
  ensureUniqueIds,
  buildReferenceMaps,
  validateMentionReferences,
  validateAssertionReferences,
  validateSuppressedReferences,
} = require("./references");

function validateIntegrity(doc, options = {}) {
  ensureUniqueIds(doc.tokens, "token");
  ensureUniqueIds(doc.mentions, "mention");
  ensureUniqueIds(doc.assertions, "assertion");

  const segmentById = buildSegmentMap(doc);
  const { tokenById, mentionById, assertionById } = buildReferenceMaps(doc);
  validateTokenSegmentAlignment(doc, segmentById);
  validateMentionReferences(doc, tokenById);
  validateMentionSegmentAlignment(doc, segmentById, tokenById);
  validateAssertionCrossFieldAlignment(doc, segmentById, mentionById, tokenById);

  for (const assertion of doc.assertions || []) {
    const assertionId = (assertion && assertion.id) || "<unknown>";
    validateAssertionReferences(assertion, assertionId, mentionById, tokenById);
    validateAssertionDeterminism(assertion, assertionId);
  }

  validateSuppressedReferences(doc, assertionById);
  validateCoverage(doc, mentionById, options);
}

module.exports = {
  validateIntegrity,
};
