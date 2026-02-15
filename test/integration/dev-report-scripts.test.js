const test = require("node:test");
const assert = require("node:assert/strict");
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
});

test("dev-report-maturity emits valid JSON report", () => {
  const raw = runNodeScript("scripts/dev-report-maturity.js");
  assertReportShape(raw, "dev-report-maturity");
});

test("dev-diagnose-wiki-upstream emits valid JSON report", () => {
  const raw = runNodeScript("scripts/dev-diagnose-wiki-upstream.js");
  assertReportShape(raw, "dev-diagnose-wiki-upstream");
});

test("dev-diagnose-wti-wiring emits valid JSON report", () => {
  const raw = runNodeScript("scripts/dev-diagnose-wti-wiring.js");
  assertReportShape(raw, "dev-diagnose-wti-wiring");
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
