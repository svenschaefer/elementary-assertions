const test = require("node:test");
const assert = require("node:assert/strict");

const { annotationHasSource } = require("../../src/core/upstream");

test("annotationHasSource matches named source only", () => {
  const ann = {
    sources: [
      { name: "relation-extraction" },
      { name: "wikipedia-title-index" },
    ],
  };
  assert.equal(annotationHasSource(ann, "relation-extraction"), true);
  assert.equal(annotationHasSource(ann, "wikipedia-title-index"), true);
  assert.equal(annotationHasSource(ann, "other"), false);
  assert.equal(annotationHasSource(null, "relation-extraction"), false);
});
