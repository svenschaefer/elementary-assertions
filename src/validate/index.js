const { rejectLegacySlots, validateSchemaShape, validateSchemaContract } = require("./schema");
const { validateIntegrity } = require("./integrity");
const { validateDiagnosticsStrict } = require("./diagnostics-strict");
const { ValidationError } = require("./errors");

function validateElementaryAssertions(doc, options = {}) {
  rejectLegacySlots(doc);
  validateSchemaShape(doc);
  validateSchemaContract(doc, options);
  validateIntegrity(doc, options);
  if (options && options.strict) {
    validateDiagnosticsStrict(doc);
  }
  return { ok: true };
}

module.exports = {
  validateElementaryAssertions,
  ValidationError,
};
