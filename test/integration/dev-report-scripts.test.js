const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");

function runNodeScript(relPath) {
  const fullPath = path.join(repoRoot, relPath);
  const result = spawnSync(process.execPath, [fullPath], {
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
