const { rejectLegacySlots, validateSchemaShape } = require("./schema");
const { validateIntegrity } = require("./integrity");
const { ValidationError } = require("./errors");

function validateElementaryAssertions(doc) {
  rejectLegacySlots(doc);
  validateSchemaShape(doc);
  validateIntegrity(doc);
  return { ok: true };
}

module.exports = {
  validateElementaryAssertions,
  ValidationError,
};
