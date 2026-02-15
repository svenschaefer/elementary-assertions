const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

function listSeedIds(artifactsRoot) {
  return fs
    .readdirSync(artifactsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((seedId) => fs.existsSync(path.join(artifactsRoot, seedId, "result-reference", "seed.elementary-assertions.yaml")))
    .sort((a, b) => a.localeCompare(b));
}

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

  return {
    seed_id: seedId,
    covered_count: covered.length,
    uncovered_count: uncovered.length,
    unresolved_count: unresolved.length,
    unresolved_alignment: uncovered.length === unresolved.length,
    unresolved_by_kind: countBy(unresolved, (item) => String((item && item.kind) || "unknown")),
    unresolved_by_reason: countBy(unresolved, (item) => String((item && item.reason) || "unknown")),
  };
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const artifactsRoot = path.join(repoRoot, "test", "artifacts");
  const seedIds = listSeedIds(artifactsRoot);
  const rows = seedIds.map((seedId) => buildSeedRow(readDoc(artifactsRoot, seedId), seedId));
  process.stdout.write(`${JSON.stringify({ generated_at: new Date().toISOString(), seeds: rows }, null, 2)}\n`);
}

main();
