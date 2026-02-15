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

function buildSeedMetric(doc, seedId) {
  const diagnostics = doc && doc.diagnostics ? doc.diagnostics : {};
  const fragmentation = diagnostics.fragmentation || {};
  const gapSignals = diagnostics.gap_signals || {};
  const perSegment = Array.isArray(fragmentation.per_segment) ? fragmentation.per_segment : [];
  const coverage = doc && doc.coverage ? doc.coverage : {};
  return {
    seed_id: seedId,
    structural_fragment_count: Number(fragmentation.structural_fragment_count || 0),
    predicate_noise_index: Number(fragmentation.predicate_noise_index || 0),
    clause_fragmentation_warning_segments: perSegment
      .filter((x) => x && x.clause_fragmentation_warning === true)
      .map((x) => String(x.segment_id || ""))
      .filter((x) => x.length > 0),
    coverage: {
      primary: Array.isArray(coverage.primary_mention_ids) ? coverage.primary_mention_ids.length : 0,
      covered: Array.isArray(coverage.covered_primary_mention_ids) ? coverage.covered_primary_mention_ids.length : 0,
      uncovered: Array.isArray(coverage.uncovered_primary_mention_ids) ? coverage.uncovered_primary_mention_ids.length : 0,
      unresolved: Array.isArray(coverage.unresolved) ? coverage.unresolved.length : 0,
    },
    gap_signals: {
      coordination_type_missing: Boolean(gapSignals.coordination_type_missing),
      comparative_gap: Boolean(gapSignals.comparative_gap),
      quantifier_scope_gap: Boolean(gapSignals.quantifier_scope_gap),
    },
  };
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const artifactsRoot = path.join(repoRoot, "test", "artifacts");
  const seedIds = listSeedIds(artifactsRoot);
  const rows = seedIds.map((seedId) => buildSeedMetric(readDoc(artifactsRoot, seedId), seedId));
  process.stdout.write(`${JSON.stringify({ generated_at: new Date().toISOString(), seeds: rows }, null, 2)}\n`);
}

main();
