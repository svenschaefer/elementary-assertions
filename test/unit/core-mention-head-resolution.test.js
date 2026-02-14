const test = require("node:test");
const assert = require("node:assert/strict");

const { buildChunkHeadMaps } = require("../../src/core/mention-head-resolution");

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
