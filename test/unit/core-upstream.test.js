const test = require("node:test");
const assert = require("node:assert/strict");

const { annotationHasSource, collectStep11Relations } = require("../../src/core/upstream");

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

test("collectStep11Relations returns accepted dependency relations only", () => {
  const relationsSeed = {
    annotations: [
      {
        id: "ann:dep:1",
        kind: "dependency",
        status: "accepted",
        label: "nsubj",
        head: { id: "t2" },
        dep: { id: "t1" },
        sources: [{ name: "relation-extraction", evidence: { rule: "x" } }],
      },
      {
        id: "ann:dep:2",
        kind: "dependency",
        status: "accepted",
        label: "theme",
        head: { id: "t2" },
        dep: { id: "t3" },
        sources: [{ name: "other", evidence: {} }],
      },
    ],
  };
  const tokenById = new Map([
    ["t1", { id: "t1" }],
    ["t2", { id: "t2" }],
    ["t3", { id: "t3" }],
  ]);

  const out = collectStep11Relations(relationsSeed, tokenById);
  assert.deepEqual(out, [
    {
      id: "ann:dep:1",
      label: "nsubj",
      head_token_id: "t2",
      dep_token_id: "t1",
      evidence: { rule: "x" },
    },
  ]);
});
