const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");

function runNodeScript(relPath, args = []) {
  const fullPath = path.join(repoRoot, relPath);
  const result = spawnSync(process.execPath, [fullPath].concat(args), {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `script failed: ${relPath}\n${result.stderr || ""}`);
  return String(result.stdout || "").trim();
}

function assertReportShape(raw, label) {
  let data;
  assert.doesNotThrow(() => {
    data = JSON.parse(raw);
  }, `${label} must emit valid JSON`);
  assert.equal(typeof data.generated_at, "string", `${label} must include generated_at`);
  assert.ok(Array.isArray(data.seeds), `${label} must include seeds[]`);
  assert.ok(data.seeds.length > 0, `${label} must emit at least one seed row`);
}

test("dev-report-metrics emits valid JSON report", () => {
  const raw = runNodeScript("scripts/dev-report-metrics.js");
  assertReportShape(raw, "dev-report-metrics");
});

test("dev-report-fragment-hotspots emits valid JSON report", () => {
  const raw = runNodeScript("scripts/dev-report-fragment-hotspots.js");
  assertReportShape(raw, "dev-report-fragment-hotspots");
  const data = JSON.parse(raw);
  for (const seedRow of data.seeds) {
    assert.equal(Array.isArray(seedRow.segments), true);
    for (const segment of seedRow.segments) {
      const carriers = Array.isArray(segment.carrier_diagnostics) ? segment.carrier_diagnostics : [];
      if (!carriers.length) continue;
      const carrier = carriers[0];
      assert.equal(typeof carrier.segment_lens_triage_only, "boolean");
      assert.equal(typeof carrier.has_segment_lexical_host, "boolean");
      assert.equal(typeof carrier.segment_evidence_containment_pass, "boolean");
      assert.equal(Array.isArray(carrier.segment_host_candidate_assertion_ids), true);
      break;
    }
  }
});

test("dev-report-maturity emits valid JSON report", () => {
  const raw = runNodeScript("scripts/dev-report-maturity.js");
  assertReportShape(raw, "dev-report-maturity");
});

test("dev-diagnose-wiki-upstream emits valid JSON report", () => {
  const raw = runNodeScript("scripts/dev-diagnose-wiki-upstream.js");
  assertReportShape(raw, "dev-diagnose-wiki-upstream");
  const data = JSON.parse(raw);
  for (const seedRow of data.seeds) {
    assert.equal(typeof seedRow.correlation, "object");
    assert.equal(seedRow.correlation.enabled, false);
  }
});

test("dev-diagnose-wti-wiring emits valid JSON report", () => {
  const raw = runNodeScript("scripts/dev-diagnose-wti-wiring.js");
  assertReportShape(raw, "dev-diagnose-wti-wiring");
  const data = JSON.parse(raw);
  assert.equal(typeof data.runtime_probe, "object");
  assert.equal(data.runtime_probe.enabled, false);
  for (const seedRow of data.seeds) {
    assert.equal(typeof seedRow.wiring_attribution, "object");
    assert.equal(typeof seedRow.wiring_attribution.endpoint_configured, "boolean");
    assert.equal(typeof seedRow.wiring_attribution.mandatory_endpoint_behavior_active, "boolean");
    assert.equal(Array.isArray(seedRow.wiring_attribution.per_step), true);
  }
});

test("dev-diagnose-coverage-audit emits valid JSON report", () => {
  const raw = runNodeScript("scripts/dev-diagnose-coverage-audit.js");
  assertReportShape(raw, "dev-diagnose-coverage-audit");
  const data = JSON.parse(raw);
  for (const seedRow of data.seeds) {
    assert.equal(Array.isArray(seedRow.per_mention), true, "coverage-audit must include per_mention rows");
    if (seedRow.per_mention.length === 0) continue;
    const row = seedRow.per_mention[0];
    assert.equal(typeof row.mention_id, "string");
    assert.equal(typeof row.segment_id, "string");
    assert.equal(typeof row.covered, "boolean");
    assert.equal(Array.isArray(row.candidate_host_assertion_ids), true);
  }
});

test("dev:reports aggregate emits valid JSON report map", () => {
  const raw = runNodeScript("scripts/dev-reports.js");
  let data;
  assert.doesNotThrow(() => {
    data = JSON.parse(raw);
  }, "dev:reports must emit valid JSON");
  assert.equal(typeof data.generated_at, "string", "dev:reports must include generated_at");
  assert.equal(typeof data.reports, "object", "dev:reports must include reports object");
  const keys = Object.keys(data.reports || {}).sort((a, b) => a.localeCompare(b));
  assert.deepEqual(keys, [
    "diagnose-coverage-audit",
    "diagnose-wiki-upstream",
    "diagnose-wti-wiring",
    "report-fragment-hotspots",
    "report-maturity",
    "report-metrics",
  ]);
});

test("dev report scripts support --seed and --artifacts-root single-seed execution", () => {
  const artifactsRoot = path.join(repoRoot, "test", "artifacts");
  const seedId = "saas";
  const scripts = [
    "scripts/dev-report-metrics.js",
    "scripts/dev-report-fragment-hotspots.js",
    "scripts/dev-report-maturity.js",
    "scripts/dev-diagnose-wiki-upstream.js",
    "scripts/dev-diagnose-wti-wiring.js",
    "scripts/dev-diagnose-coverage-audit.js",
  ];

  for (const relPath of scripts) {
    const raw = runNodeScript(relPath, ["--seed", seedId, "--artifacts-root", artifactsRoot]);
    const data = JSON.parse(raw);
    assert.equal(Array.isArray(data.seeds), true, `${relPath}: seeds must be array`);
    assert.equal(data.seeds.length, 1, `${relPath}: single-seed mode must emit exactly one seed row`);
    assert.equal(data.seeds[0].seed_id, seedId, `${relPath}: emitted seed_id must match requested seed`);
  }
});

test("dev:reports aggregate forwards --seed and --artifacts-root to child reports", () => {
  const artifactsRoot = path.join(repoRoot, "test", "artifacts");
  const seedId = "saas";
  const raw = runNodeScript("scripts/dev-reports.js", ["--seed", seedId, "--artifacts-root", artifactsRoot]);
  const data = JSON.parse(raw);
  for (const report of Object.values(data.reports || {})) {
    assert.equal(Array.isArray(report.seeds), true);
    assert.equal(report.seeds.length, 1);
    assert.equal(report.seeds[0].seed_id, seedId);
  }
});

test("dev-diagnose-wiki-upstream supports --upstream correlation mode", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ea-upstream-"));
  const upstreamPath = path.join(tmpDir, "upstream.json");
  fs.writeFileSync(
    upstreamPath,
    JSON.stringify(
      {
        annotations: [
          {
            id: "r1",
            kind: "dependency",
            status: "accepted",
            head: { id: "nonexistent-token-a" },
            dep: { id: "nonexistent-token-b" },
          },
        ],
      },
      null,
      2
    )
  );

  try {
    const artifactsRoot = path.join(repoRoot, "test", "artifacts");
    const raw = runNodeScript("scripts/dev-diagnose-wiki-upstream.js", [
      "--seed",
      "saas",
      "--artifacts-root",
      artifactsRoot,
      "--upstream",
      upstreamPath,
    ]);
    const data = JSON.parse(raw);
    assert.equal(data.seeds.length, 1);
    assert.equal(data.seeds[0].seed_id, "saas");
    assert.equal(data.seeds[0].correlation.enabled, true);
    assert.equal(typeof data.seeds[0].correlation.uncovered_missing_upstream_acceptance_count, "number");
    assert.equal(typeof data.seeds[0].correlation.uncovered_present_upstream_unprojected_count, "number");
    assert.equal(typeof data.seeds[0].correlation.upstream_wiki_field_inventory, "object");
    assert.equal(Array.isArray(data.seeds[0].correlation.upstream_wiki_field_inventory.object_families), true);
    assert.equal(typeof data.seeds[0].correlation.missing_field_samples, "object");
    assert.equal(typeof data.seeds[0].correlation.missing_field_samples.missing_upstream_acceptance, "object");
    assert.equal(typeof data.seeds[0].correlation.missing_field_samples.present_upstream_dropped_downstream, "object");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("dev-diagnose-wti-wiring runtime probe requires explicit endpoint", () => {
  const fullPath = path.join(repoRoot, "scripts", "dev-diagnose-wti-wiring.js");
  const result = spawnSync(process.execPath, [fullPath, "--runtime-probe", "--seed", "saas"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(String(result.stderr || ""), /runtime probe requires --wti-endpoint/i);
});
