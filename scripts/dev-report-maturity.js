const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

function listSeedIds(artifactsRoot) {
  return fs
    .readdirSync(artifactsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((seedId) => fs.existsSync(path.join(artifactsRoot, seedId, "prototype-reference", "seed.elementary-assertions.yaml")))
    .sort((a, b) => a.localeCompare(b));
}

function readDoc(artifactsRoot, seedId) {
  const yamlPath = path.join(artifactsRoot, seedId, "prototype-reference", "seed.elementary-assertions.yaml");
  return yaml.load(fs.readFileSync(yamlPath, "utf8"));
}

function anyGap(gapSignals) {
  return Boolean(gapSignals.coordination_type_missing || gapSignals.comparative_gap || gapSignals.quantifier_scope_gap);
}

function allGapsFalse(gapSignals) {
  return !anyGap(gapSignals);
}

function classifyMaturity(metrics) {
  const unresolvedAlignment = metrics.unresolved_alignment === true;
  const fragmentCount = metrics.structural_fragment_count;
  const noise = metrics.predicate_noise_index;
  const warningCount = metrics.clause_fragmentation_warning_segments.length;
  const uncovered = metrics.coverage.uncovered;
  const gaps = metrics.gap_signals;

  const level4 =
    unresolvedAlignment && allGapsFalse(gaps) && noise <= 0.25 && fragmentCount === 0 && warningCount === 0 && uncovered === 0;

  const level3 = unresolvedAlignment && allGapsFalse(gaps) && noise <= 0.4 && fragmentCount <= 4 && warningCount <= 2;

  const level2 = unresolvedAlignment && noise <= 0.5 && fragmentCount <= 7 && (anyGap(gaps) || uncovered > 0 || warningCount > 0);

  if (level4) return 4;
  if (level3) return 3;
  if (level2) return 2;
  return 1;
}

function maturityLabel(level) {
  if (level === 4) return "Level 4 - Structurally cohesive and fully gap-classified";
  if (level === 3) return "Level 3 - Operator-closed when upstream supports it";
  if (level === 2) return "Level 2 - Predicate-stable but gaps remain";
  return "Level 1 - Deterministic but fragmented";
}

function buildSeedMaturity(doc, seedId) {
  const diagnostics = doc && doc.diagnostics ? doc.diagnostics : {};
  const fragmentation = diagnostics.fragmentation || {};
  const gapSignals = diagnostics.gap_signals || {};
  const perSegment = Array.isArray(fragmentation.per_segment) ? fragmentation.per_segment : [];
  const coverage = doc && doc.coverage ? doc.coverage : {};
  const coverageObj = {
    primary: Array.isArray(coverage.primary_mention_ids) ? coverage.primary_mention_ids.length : 0,
    covered: Array.isArray(coverage.covered_primary_mention_ids) ? coverage.covered_primary_mention_ids.length : 0,
    uncovered: Array.isArray(coverage.uncovered_primary_mention_ids) ? coverage.uncovered_primary_mention_ids.length : 0,
    unresolved: Array.isArray(coverage.unresolved) ? coverage.unresolved.length : 0,
  };
  const gapObj = {
    coordination_type_missing: Boolean(gapSignals.coordination_type_missing),
    comparative_gap: Boolean(gapSignals.comparative_gap),
    quantifier_scope_gap: Boolean(gapSignals.quantifier_scope_gap),
  };
  const row = {
    seed_id: seedId,
    unresolved_alignment: coverageObj.unresolved === coverageObj.uncovered,
    structural_fragment_count: Number(fragmentation.structural_fragment_count || 0),
    predicate_noise_index: Number(fragmentation.predicate_noise_index || 0),
    clause_fragmentation_warning_segments: perSegment
      .filter((x) => x && x.clause_fragmentation_warning === true)
      .map((x) => String(x.segment_id || ""))
      .filter((x) => x.length > 0),
    gap_signals: gapObj,
    coverage: coverageObj,
  };
  const level = classifyMaturity(row);
  return {
    seed_id: row.seed_id,
    maturity_level: level,
    maturity_label: maturityLabel(level),
    unresolved_alignment: row.unresolved_alignment,
    structural_fragment_count: row.structural_fragment_count,
    predicate_noise_index: row.predicate_noise_index,
    clause_fragmentation_warning_segments: row.clause_fragmentation_warning_segments,
    gap_signals: row.gap_signals,
    coverage: row.coverage,
  };
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const artifactsRoot = path.join(repoRoot, "test", "artifacts");
  const seedIds = listSeedIds(artifactsRoot);
  const rows = seedIds.map((seedId) => buildSeedMaturity(readDoc(artifactsRoot, seedId), seedId));
  process.stdout.write(`${JSON.stringify({ generated_at: new Date().toISOString(), seeds: rows }, null, 2)}\n`);
}

main();
