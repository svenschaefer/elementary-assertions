const test = require("node:test");
const assert = require("node:assert/strict");

const { toAnnotationSummary } = require("../../src/core/accepted-annotations");

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
