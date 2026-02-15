const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPORT_SCRIPTS = [
  "dev-report-metrics.js",
  "dev-report-fragment-hotspots.js",
  "dev-report-maturity.js",
  "dev-diagnose-wiki-upstream.js",
  "dev-diagnose-wti-wiring.js",
  "dev-diagnose-coverage-audit.js",
];

function runScript(repoRoot, scriptName) {
  const scriptPath = path.join(repoRoot, "scripts", scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.error) {
    throw new Error(`Failed to run ${scriptName}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `Failed to run ${scriptName} (exit ${result.status}).\n` +
      `${String(result.stderr || "").trim()}`
    );
  }
  let payload = null;
  try {
    payload = JSON.parse(String(result.stdout || ""));
  } catch (err) {
    throw new Error(`Failed to parse JSON output from ${scriptName}: ${err.message}`);
  }
  return payload;
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const reports = {};
  for (const scriptName of REPORT_SCRIPTS) {
    const key = scriptName.replace(/^dev-/, "").replace(/\.js$/, "");
    reports[key] = runScript(repoRoot, scriptName);
  }
  process.stdout.write(`${JSON.stringify({ generated_at: new Date().toISOString(), reports }, null, 2)}\n`);
}

main();
