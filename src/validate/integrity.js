const { validateAssertionDeterminism } = require("./determinism");
const { validateCoverage } = require("./coverage");
const {
  ensureUniqueIds,
  buildReferenceMaps,
  validateMentionReferences,
  validateAssertionReferences,
  validateSuppressedReferences,
} = require("./references");

function validateIntegrity(doc) {
  ensureUniqueIds(doc.tokens, "token");
  ensureUniqueIds(doc.mentions, "mention");
  ensureUniqueIds(doc.assertions, "assertion");

  const { tokenById, mentionById, assertionById } = buildReferenceMaps(doc);
  validateMentionReferences(doc, tokenById);

  for (const assertion of doc.assertions || []) {
    const assertionId = (assertion && assertion.id) || "<unknown>";
    validateAssertionReferences(assertion, assertionId, mentionById, tokenById);
    validateAssertionDeterminism(assertion, assertionId);
  }

  validateSuppressedReferences(doc, assertionById);
  validateCoverage(doc, mentionById);
}

module.exports = {
  validateIntegrity,
};
