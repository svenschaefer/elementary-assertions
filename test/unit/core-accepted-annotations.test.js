const test = require("node:test");
const assert = require("node:assert/strict");

const {
  toAnnotationSummary,
  buildAcceptedAnnotationsInventory,
} = require("../../src/core/accepted-annotations");

test("toAnnotationSummary returns stable annotation summary", () => {
  const summary = toAnnotationSummary({
    id: "ann:1",
    kind: "mwe",
    status: "accepted",
    label: "topic",
    anchor: {
      selectors: [
        { type: "TokenSelector", token_ids: ["t2", "t1"] },
        { type: "TextPositionSelector", span: { start: 10, end: 20 } },
      ],
    },
    sources: [{ name: "b" }, { name: "a" }],
  });

  assert.deepEqual(summary, {
    id: "ann:1",
    kind: "mwe",
    status: "accepted",
    label: "topic",
    token_ids: ["t1", "t2"],
    span: { start: 10, end: 20 },
    source_names: ["a", "b"],
  });
});

test("buildAcceptedAnnotationsInventory keeps accepted annotations in deterministic order", () => {
  const out = buildAcceptedAnnotationsInventory({
    annotations: [
      {
        id: "ann:2",
        kind: "dependency",
        status: "accepted",
        anchor: { selectors: [{ type: "TextPositionSelector", span: { start: 5, end: 6 } }] },
      },
      {
        id: "ann:1",
        kind: "chunk",
        status: "accepted",
        anchor: { selectors: [{ type: "TextPositionSelector", span: { start: 1, end: 4 } }] },
      },
      {
        id: "ann:3",
        kind: "chunk",
        status: "observation",
        anchor: { selectors: [{ type: "TextPositionSelector", span: { start: 7, end: 8 } }] },
      },
    ],
  });
  assert.deepEqual(out.map((entry) => entry.id), ["ann:1", "ann:2"]);
});
