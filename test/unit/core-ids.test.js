const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeIds } = require("../../src/core/ids");

test("normalizeIds returns unique sorted non-empty string ids", () => {
  const out = normalizeIds(["b", "a", "b", "", null, "c"]);
  assert.deepEqual(out, ["a", "b", "c"]);
});
