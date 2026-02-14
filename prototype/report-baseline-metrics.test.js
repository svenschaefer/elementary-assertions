const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const stepDir = __dirname;
const scriptPath = path.join(stepDir, 'report-baseline-metrics.js');
const expectedSeedOrder = ['access_control', 'irs', 'prime_factors', 'prime_gen', 'webshop'];

{
  const run = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });
  assert.strictEqual(run.status, 0, `report script failed: ${run.stderr || run.stdout}`);
  const lines = String(run.stdout || '').trim().split(/\r?\n/).filter(Boolean);
  assert.strictEqual(lines.length, 5, 'report must emit exactly 5 ndjson lines');

  const rows = lines.map((line) => JSON.parse(line));
  assert.deepStrictEqual(rows.map((r) => r.seed_id), expectedSeedOrder, 'seed order must be stable');

  for (const row of rows) {
    assert.strictEqual(typeof row.seed_id, 'string');
    assert.strictEqual(typeof row.structural_fragment_count, 'number');
    assert.strictEqual(typeof row.predicate_noise_index, 'number');
    assert.ok(Array.isArray(row.clause_fragmentation_warning_segments));
    assert.ok(row.coverage && typeof row.coverage === 'object');
    assert.strictEqual(typeof row.coverage.primary, 'number');
    assert.strictEqual(typeof row.coverage.covered, 'number');
    assert.strictEqual(typeof row.coverage.uncovered, 'number');
    assert.strictEqual(typeof row.coverage.unresolved, 'number');
    assert.ok(row.gap_signals && typeof row.gap_signals === 'object');
    assert.strictEqual(typeof row.gap_signals.coordination_type_missing, 'boolean');
    assert.strictEqual(typeof row.gap_signals.comparative_gap, 'boolean');
    assert.strictEqual(typeof row.gap_signals.quantifier_scope_gap, 'boolean');
    assert.strictEqual(
      row.coverage.unresolved,
      row.coverage.uncovered,
      `coverage invariant unresolved==uncovered must hold for ${row.seed_id}`
    );
  }
}

console.log('report-baseline-metrics tests passed.');

