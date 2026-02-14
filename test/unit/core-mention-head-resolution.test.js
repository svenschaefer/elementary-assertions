const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildChunkHeadMaps,
  buildDependencyObservationMaps,
  posFallbackHead,
  resolveMentionHead,
} = require("../../src/core/mention-head-resolution");

test("buildChunkHeadMaps indexes accepted chunks and chunk heads", () => {
  const maps = buildChunkHeadMaps({
    annotations: [
      { id: "chunk:1", kind: "chunk", status: "accepted" },
      { kind: "chunk_head", status: "accepted", chunk_id: "chunk:1", head: { id: "t2" } },
      { id: "chunk:2", kind: "chunk", status: "observation" },
    ],
  });

  assert.equal(maps.chunkById.has("chunk:1"), true);
  assert.equal(maps.chunkById.has("chunk:2"), false);
  assert.equal(maps.headByChunkId.get("chunk:1"), "t2");
});

test("buildDependencyObservationMaps indexes non-root dependency observations", () => {
  const tokenById = new Map([
    ["t1", { id: "t1" }],
    ["t2", { id: "t2" }],
    ["t3", { id: "t3" }],
  ]);
  const maps = buildDependencyObservationMaps(
    {
      annotations: [
        { kind: "dependency", status: "observation", dep: { id: "t2" }, head: { id: "t1" } },
        { kind: "dependency", status: "observation", dep: { id: "t3" }, head: { id: "t2" }, is_root: true },
      ],
    },
    tokenById
  );
  assert.deepEqual(maps.incomingInside.get("t2"), ["t1"]);
  assert.deepEqual(maps.outgoingInside.get("t1"), ["t2"]);
  assert.equal(maps.incomingInside.has("t3"), false);
});

test("posFallbackHead prefers noun tail then verb head", () => {
  const tokenById = new Map([
    ["t1", { id: "t1", i: 0, pos: { tag: "VB" } }],
    ["t2", { id: "t2", i: 1, pos: { tag: "NN" } }],
    ["t3", { id: "t3", i: 2, pos: { tag: "NNS" } }],
  ]);
  assert.equal(posFallbackHead(["t1", "t2", "t3"], tokenById), "t3");

  const noNoun = new Map([
    ["t1", { id: "t1", i: 0, pos: { tag: "VBZ" } }],
    ["t2", { id: "t2", i: 1, pos: { tag: "VBD" } }],
  ]);
  assert.equal(posFallbackHead(["t1", "t2"], noNoun), "t1");
});

test("resolveMentionHead prefers explicit then chunk head then dependency root", () => {
  const findSelector = (annotation, type) =>
    (annotation.anchor && Array.isArray(annotation.anchor.selectors)
      ? annotation.anchor.selectors.find((s) => s && s.type === type)
      : null) || null;

  const tokenById = new Map([
    ["t1", { id: "t1", i: 0, pos: { tag: "NN" } }],
    ["t2", { id: "t2", i: 1, pos: { tag: "VB" } }],
  ]);

  const explicit = resolveMentionHead({
    tokenIds: ["t1", "t2"],
    explicitHead: "t2",
    chunkById: new Map(),
    headByChunkId: new Map(),
    incomingInsideMap: new Map(),
    tokenById,
    findSelector,
  });
  assert.equal(explicit.head, "t2");
  assert.equal(explicit.strategy, "explicit");

  const chunk = {
    anchor: { selectors: [{ type: "TokenSelector", token_ids: ["t1", "t2"] }] },
  };
  const chunkHead = resolveMentionHead({
    tokenIds: ["t1", "t2"],
    explicitHead: null,
    chunkById: new Map([["c1", chunk]]),
    headByChunkId: new Map([["c1", "t1"]]),
    incomingInsideMap: new Map(),
    tokenById,
    findSelector,
  });
  assert.equal(chunkHead.head, "t1");
  assert.equal(chunkHead.strategy, "chunk_head");
});
