const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeOptionalString } = require("../../src/core/strings");

test("normalizeOptionalString trims strings and normalizes non-strings to empty", () => {
  assert.equal(normalizeOptionalString("  abc  "), "abc");
  assert.equal(normalizeOptionalString(""), "");
  assert.equal(normalizeOptionalString(null), "");
  assert.equal(normalizeOptionalString(undefined), "");
  assert.equal(normalizeOptionalString(42), "");
});
