const { failValidation } = require("./errors");

function rejectLegacySlots(doc) {
  const assertions = Array.isArray(doc && doc.assertions) ? doc.assertions : [];
  for (const assertion of assertions) {
    if (assertion && Object.prototype.hasOwnProperty.call(assertion, "slots")) {
      failValidation("EA_VALIDATE_LEGACY_SLOTS", "Invalid input: legacy assertions[*].slots is not supported.");
    }
  }
}

function validateSchemaShape(doc) {
  if (!doc || typeof doc !== "object") failValidation("EA_VALIDATE_DOC_OBJECT", "Document must be an object.");
  if (doc.stage !== "elementary_assertions") failValidation("EA_VALIDATE_STAGE", "Invalid stage: expected elementary_assertions.");
  if (!doc.index_basis || doc.index_basis.text_field !== "canonical_text" || doc.index_basis.span_unit !== "utf16_code_units") {
    failValidation("EA_VALIDATE_INDEX_BASIS", "Invalid index_basis. Expected canonical_text/utf16_code_units.");
  }
  if (!Array.isArray(doc.tokens)) failValidation("EA_VALIDATE_TOKENS_ARRAY", "Invalid document: tokens[] required.");
  if (!Array.isArray(doc.mentions)) failValidation("EA_VALIDATE_MENTIONS_ARRAY", "Invalid document: mentions[] required.");
  if (!Array.isArray(doc.assertions)) failValidation("EA_VALIDATE_ASSERTIONS_ARRAY", "Invalid document: assertions[] required.");
  if (!doc.coverage || typeof doc.coverage !== "object") failValidation("EA_VALIDATE_COVERAGE_OBJECT", "Invalid document: coverage required.");
}

module.exports = {
  rejectLegacySlots,
  validateSchemaShape,
};
