const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const SEED_ORDER = ['access_control', 'irs', 'prime_factors', 'prime_gen', 'webshop'];

function arg(args, name) {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return null;
  return args[i + 1];
}

function readYaml(filePath) {
  return YAML.parse(fs.readFileSync(filePath, 'utf8'));
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
      .map((x) => String(x.segment_id || ''))
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
  const args = process.argv.slice(2);
  const artifactsRoot = arg(args, '--artifacts-root') || path.resolve(__dirname, '..', 'artifacts');
  for (const seedId of SEED_ORDER) {
    const yamlPath = path.join(artifactsRoot, seedId, 'seed', 'seed.elementary-assertions.yaml');
    const doc = readYaml(yamlPath);
    const row = buildSeedMetric(doc, seedId);
    process.stdout.write(`${JSON.stringify(row)}\n`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  SEED_ORDER,
  buildSeedMetric,
};

