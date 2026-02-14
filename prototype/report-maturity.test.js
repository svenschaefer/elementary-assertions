const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const stepDir = __dirname;
const scriptPath = path.join(stepDir, 'report-maturity.js');
const expectedSeedOrder = ['access_control', 'irs', 'prime_factors', 'prime_gen', 'webshop'];

function runScript() {
  return spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });
}

function expectedLabel(level) {
  if (level === 4) return 'Level 4 - Structurally cohesive and fully gap-classified';
  if (level === 3) return 'Level 3 - Operator-closed when upstream supports it';
  if (level === 2) return 'Level 2 - Predicate-stable but gaps remain';
  return 'Level 1 - Deterministic but fragmented';
}

{
  const runA = runScript();
  const runB = runScript();
  assert.strictEqual(runA.status, 0, `first maturity report failed: ${runA.stderr || runA.stdout}`);
  assert.strictEqual(runB.status, 0, `second maturity report failed: ${runB.stderr || runB.stdout}`);
  assert.strictEqual(runA.stdout, runB.stdout, 'maturity report output must be byte-identical across repeated runs');

  const lines = String(runA.stdout || '').trim().split(/\r?\n/).filter(Boolean);
  assert.strictEqual(lines.length, 5, 'maturity report must emit exactly 5 ndjson lines');
  const rows = lines.map((line) => JSON.parse(line));
  assert.deepStrictEqual(rows.map((r) => r.seed_id), expectedSeedOrder, 'seed order must be stable');

  for (const row of rows) {
    assert.ok(Number.isInteger(row.maturity_level), `maturity_level must be integer for ${row.seed_id}`);
    assert.ok(row.maturity_level >= 1 && row.maturity_level <= 4, `maturity_level out of range for ${row.seed_id}`);
    assert.strictEqual(row.maturity_label, expectedLabel(row.maturity_level), `maturity_label mismatch for ${row.seed_id}`);
    assert.strictEqual(typeof row.unresolved_alignment, 'boolean', `unresolved_alignment must be boolean for ${row.seed_id}`);
    assert.strictEqual(typeof row.structural_fragment_count, 'number', `structural_fragment_count must be number for ${row.seed_id}`);
    assert.strictEqual(typeof row.predicate_noise_index, 'number', `predicate_noise_index must be number for ${row.seed_id}`);
    assert.ok(Array.isArray(row.clause_fragmentation_warning_segments), `clause_fragmentation_warning_segments must be array for ${row.seed_id}`);
    assert.ok(row.gap_signals && typeof row.gap_signals === 'object', `gap_signals must be object for ${row.seed_id}`);
    assert.strictEqual(typeof row.gap_signals.coordination_type_missing, 'boolean');
    assert.strictEqual(typeof row.gap_signals.comparative_gap, 'boolean');
    assert.strictEqual(typeof row.gap_signals.quantifier_scope_gap, 'boolean');
    assert.ok(row.coverage && typeof row.coverage === 'object', `coverage must be object for ${row.seed_id}`);
    assert.strictEqual(typeof row.coverage.primary, 'number');
    assert.strictEqual(typeof row.coverage.covered, 'number');
    assert.strictEqual(typeof row.coverage.uncovered, 'number');
    assert.strictEqual(typeof row.coverage.unresolved, 'number');
    assert.strictEqual(
      row.coverage.unresolved,
      row.coverage.uncovered,
      `coverage invariant unresolved==uncovered must hold for ${row.seed_id}`
    );
  }
}

console.log('report-maturity tests passed.');

