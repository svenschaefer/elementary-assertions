const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");
const schema = require("../schema/seed.elementary-assertions.schema.json");

let cachedValidate = null;

function getSchemaValidator() {
  if (cachedValidate) return cachedValidate;
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });
  addFormats(ajv);
  cachedValidate = ajv.compile(schema);
  return cachedValidate;
}

module.exports = {
  getSchemaValidator,
};
