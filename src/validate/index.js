const { rejectLegacySlots, validateSchemaShape } = require("./schema");
const { validateIntegrity } = require("./integrity");

function validateElementaryAssertions(doc) {
  rejectLegacySlots(doc);
  validateSchemaShape(doc);
  validateIntegrity(doc);
  return { ok: true };
}

module.exports = {
  validateElementaryAssertions,
};
