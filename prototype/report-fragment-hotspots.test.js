const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const stepDir = __dirname;
const scriptPath = path.join(stepDir, 'report-fragment-hotspots.js');
const expectedSeedOrder = ['access_control', 'irs', 'prime_factors', 'prime_gen', 'webshop'];

function runReport() {
  return spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });
}

{
  const run1 = runReport();
  assert.strictEqual(run1.status, 0, `report script failed: ${run1.stderr || run1.stdout}`);
  const stdout1 = String(run1.stdout || '');
  const parsed1 = JSON.parse(stdout1);

  assert.ok(parsed1 && typeof parsed1 === 'object' && Array.isArray(parsed1.seeds), 'report must contain seeds array');
  assert.strictEqual(parsed1.seeds.length, 5, 'report must include exactly 5 seeds');
  assert.deepStrictEqual(
    parsed1.seeds.map((x) => x.seed_id),
    expectedSeedOrder,
    'seed order must be stable'
  );

  for (const seed of parsed1.seeds) {
    assert.strictEqual(typeof seed.seed_id, 'string');
    assert.strictEqual(typeof seed.structural_fragment_count, 'number');
    assert.ok(Array.isArray(seed.segments), 'segments must be an array');

    const sortedSegments = seed.segments.map((s) => s.segment_id).slice().sort((a, b) => a.localeCompare(b));
    assert.deepStrictEqual(seed.segments.map((s) => s.segment_id), sortedSegments, `${seed.seed_id} segments must be sorted`);

    for (const seg of seed.segments) {
      assert.strictEqual(typeof seg.segment_id, 'string');
      assert.strictEqual(typeof seg.clause_fragmentation_warning, 'boolean');
      assert.ok(Array.isArray(seg.fragment_assertion_ids), 'fragment_assertion_ids must be array');
      assert.ok(Array.isArray(seg.predicate_class_counts), 'predicate_class_counts must be array');
      assert.ok(Array.isArray(seg.carrier_diagnostics), 'carrier_diagnostics must be array');

      const sortedFragIds = seg.fragment_assertion_ids.slice().sort((a, b) => a.localeCompare(b));
      assert.deepStrictEqual(seg.fragment_assertion_ids, sortedFragIds, 'fragment assertion ids must be sorted');

      const sortedClasses = seg.predicate_class_counts
        .map((x) => x.predicate_class)
        .slice()
        .sort((a, b) => a.localeCompare(b));
      assert.deepStrictEqual(
        seg.predicate_class_counts.map((x) => x.predicate_class),
        sortedClasses,
        'predicate_class_counts must be sorted by class'
      );

      for (const c of seg.predicate_class_counts) {
        assert.strictEqual(typeof c.predicate_class, 'string');
        assert.strictEqual(typeof c.count, 'number');
      }

      const sortedCarrierIds = seg.carrier_diagnostics
        .map((x) => x.assertion_id)
        .slice()
        .sort((a, b) => a.localeCompare(b));
      assert.deepStrictEqual(
        seg.carrier_diagnostics.map((x) => x.assertion_id),
        sortedCarrierIds,
        'carrier_diagnostics must be sorted by assertion_id'
      );

      for (const x of seg.carrier_diagnostics) {
        assert.strictEqual(typeof x.assertion_id, 'string');
        assert.strictEqual(typeof x.predicate_class, 'string');
        assert.strictEqual(typeof x.has_clause_local_lexical_host, 'boolean');
        assert.strictEqual(typeof x.evidence_containment_pass, 'boolean');
        if (x.failure_reason !== null) {
          assert.ok(
            x.failure_reason === 'no_host' || x.failure_reason === 'no_containment' || x.failure_reason === 'has_core_slots',
            `unexpected failure_reason: ${x.failure_reason}`
          );
        }
      }
    }
  }

  const run2 = runReport();
  assert.strictEqual(run2.status, 0, `second report run failed: ${run2.stderr || run2.stdout}`);
  const stdout2 = String(run2.stdout || '');
  assert.strictEqual(stdout1, stdout2, 'report output must be byte-identical across repeated runs');
}

console.log('report-fragment-hotspots tests passed.');
