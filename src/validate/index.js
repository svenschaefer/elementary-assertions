const { rejectLegacySlots, validateSchemaShape, validateSchemaContract } = require("./schema");
const { validateIntegrity } = require("./integrity");
const { ValidationError } = require("./errors");

function validateElementaryAssertions(doc, options = {}) {
  rejectLegacySlots(doc);
  validateSchemaShape(doc);
  validateSchemaContract(doc, options);
  validateIntegrity(doc);
  return { ok: true };
}

module.exports = {
  validateElementaryAssertions,
  ValidationError,
};
