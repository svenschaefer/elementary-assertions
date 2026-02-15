const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const { parseArgs, resolveArtifactsRoot, resolveSeedIds } = require("./dev-artifacts");
const { buildCoverageAudit } = require("../src/core/output");

function readDoc(artifactsRoot, seedId) {
  const yamlPath = path.join(artifactsRoot, seedId, "result-reference", "seed.elementary-assertions.yaml");
  return yaml.load(fs.readFileSync(yamlPath, "utf8"));
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, count }));
}

function buildSeedRow(doc, seedId) {
  const coverage = (((doc || {}).coverage) || {});
  const unresolved = Array.isArray(coverage.unresolved) ? coverage.unresolved : [];
  const covered = Array.isArray(coverage.covered_primary_mention_ids) ? coverage.covered_primary_mention_ids : [];
  const uncovered = Array.isArray(coverage.uncovered_primary_mention_ids) ? coverage.uncovered_primary_mention_ids : [];
  const mentionById = new Map((doc.mentions || []).map((mention) => [mention && mention.id, mention]));
  const unresolvedByMentionId = new Map(
    unresolved
      .filter((item) => item && typeof item.mention_id === "string" && item.mention_id.length > 0)
      .map((item) => [item.mention_id, item])
  );
  const lexicalHostBySegment = new Map();
  for (const assertion of doc.assertions || []) {
    const segmentId = String((assertion && assertion.segment_id) || "");
    const predicateClass = String(((((assertion || {}).diagnostics) || {}).predicate_class) || "");
    const assertionId = String((assertion && assertion.id) || "");
    if (!segmentId || !assertionId || predicateClass !== "lexical_verb") continue;
    if (!lexicalHostBySegment.has(segmentId)) lexicalHostBySegment.set(segmentId, []);
    lexicalHostBySegment.get(segmentId).push(assertionId);
  }
  const rows = buildCoverageAudit(doc).map((row) => {
    const mention = mentionById.get(row.mention_id);
    const unresolvedItem = unresolvedByMentionId.get(row.mention_id);
    const segmentId = String((mention && mention.segment_id) || "");
    const hostIds = (lexicalHostBySegment.get(segmentId) || []).slice().sort((a, b) => a.localeCompare(b));
    const upstreamRelationIds = Array.isArray((((unresolvedItem || {}).evidence) || {}).upstream_relation_ids)
      ? unresolvedItem.evidence.upstream_relation_ids.slice().sort((a, b) => String(a).localeCompare(String(b)))
      : [];
    return {
      mention_id: row.mention_id,
      segment_id: segmentId,
      covered: row.covered,
      covered_by: row.covered_by,
      unresolved_kind: row.covered ? null : String((unresolvedItem && unresolvedItem.kind) || ""),
      uncovered_reason: row.uncovered_reason,
      missing_edge: row.covered
        ? null
        : {
            unresolved_reason: row.uncovered_reason,
            unresolved_upstream_relation_ids: upstreamRelationIds,
          },
      candidate_host_assertion_ids: row.covered ? [] : hostIds,
    };
  });

  return {
    seed_id: seedId,
    covered_count: covered.length,
    uncovered_count: uncovered.length,
    unresolved_count: unresolved.length,
    unresolved_alignment: uncovered.length === unresolved.length,
    unresolved_by_kind: countBy(unresolved, (item) => String((item && item.kind) || "unknown")),
    unresolved_by_reason: countBy(unresolved, (item) => String((item && item.reason) || "unknown")),
    per_mention: rows,
  };
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const args = parseArgs(process.argv);
  const artifactsRoot = resolveArtifactsRoot(repoRoot, args);
  const seedIds = resolveSeedIds(artifactsRoot, args);
  const rows = seedIds.map((seedId) => buildSeedRow(readDoc(artifactsRoot, seedId), seedId));
  process.stdout.write(`${JSON.stringify({ generated_at: new Date().toISOString(), seeds: rows }, null, 2)}\n`);
}

main();
