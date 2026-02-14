function rejectLegacySlots(doc) {
  const assertions = Array.isArray(doc && doc.assertions) ? doc.assertions : [];
  for (const assertion of assertions) {
    if (assertion && Object.prototype.hasOwnProperty.call(assertion, "slots")) {
      throw new Error("Invalid input: legacy assertions[*].slots is not supported.");
    }
  }
}

function validateSchemaShape(doc) {
  if (!doc || typeof doc !== "object") throw new Error("Document must be an object.");
  if (doc.stage !== "elementary_assertions") throw new Error("Invalid stage: expected elementary_assertions.");
  if (!doc.index_basis || doc.index_basis.text_field !== "canonical_text" || doc.index_basis.span_unit !== "utf16_code_units") {
    throw new Error("Invalid index_basis. Expected canonical_text/utf16_code_units.");
  }
  if (!Array.isArray(doc.tokens)) throw new Error("Invalid document: tokens[] required.");
  if (!Array.isArray(doc.mentions)) throw new Error("Invalid document: mentions[] required.");
  if (!Array.isArray(doc.assertions)) throw new Error("Invalid document: assertions[] required.");
  if (!doc.coverage || typeof doc.coverage !== "object") throw new Error("Invalid document: coverage required.");
}

module.exports = {
  rejectLegacySlots,
  validateSchemaShape,
};
