const test = require("node:test");
const assert = require("node:assert/strict");

const { buildCoverageAudit } = require("../../src/core/output");

test("buildCoverageAudit marks slot/operator/transfer mechanisms deterministically", () => {
  const output = {
    mentions: [
      { id: "m:a", is_primary: true, token_ids: ["t1"] },
      { id: "m:b", is_primary: true, token_ids: ["t2"] },
    ],
    assertions: [
      {
        id: "a:1",
        arguments: [{ role: "actor", mention_ids: ["m:a"] }],
        modifiers: [],
        operators: [{ kind: "quantifier", token_id: "t2" }],
        evidence: { token_ids: ["t1", "t2"] },
      },
    ],
    coverage: {
      primary_mention_ids: ["m:a", "m:b"],
      covered_primary_mention_ids: ["m:a", "m:b"],
      unresolved: [{ mention_id: "m:b", reason: "projection_failed" }],
    },
    diagnostics: {
      suppressed_assertions: [{ transferred_mention_ids: ["m:b"] }],
    },
  };

  const rows = buildCoverageAudit(output);
  assert.equal(rows.length, 2);

  const byId = new Map(rows.map((row) => [row.mention_id, row]));
  assert.equal(byId.get("m:a").covered, true);
  assert.ok(byId.get("m:a").covered_by.includes("slot"));

  assert.equal(byId.get("m:b").covered, true);
  assert.ok(byId.get("m:b").covered_by.includes("operator"));
  assert.ok(byId.get("m:b").covered_by.includes("transfer"));
});
