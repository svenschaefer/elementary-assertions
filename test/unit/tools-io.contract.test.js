const test = require("node:test");
const assert = require("node:assert/strict");

const { parseStrictBoolean } = require("../../src/tools/io");

test("parseStrictBoolean accepts only true|false case-insensitively", () => {
  assert.equal(parseStrictBoolean("true", "--x"), true);
  assert.equal(parseStrictBoolean("TRUE", "--x"), true);
  assert.equal(parseStrictBoolean("False", "--x"), false);
});

test("parseStrictBoolean rejects 1/0, yes/no, and empty/bare values", () => {
  assert.throws(() => parseStrictBoolean("1", "--x"), /expected true\|false/i);
  assert.throws(() => parseStrictBoolean("0", "--x"), /expected true\|false/i);
  assert.throws(() => parseStrictBoolean("yes", "--x"), /expected true\|false/i);
  assert.throws(() => parseStrictBoolean("no", "--x"), /expected true\|false/i);
  assert.throws(() => parseStrictBoolean("", "--x"), /expected true\|false/i);
});

