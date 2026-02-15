const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");

test("dev:check validates golden references in strict mode", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "dev-check.js"), "--artifacts-root", path.join(repoRoot, "test", "artifacts")],
    { cwd: repoRoot, encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.mode, "strict");
  assert.ok(Number(payload.validated_count) > 0);
});

test("dev:check supports --seed with --artifacts-root", () => {
  const artifactsRoot = path.join(repoRoot, "test", "artifacts");
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "dev-check.js"), "--artifacts-root", artifactsRoot, "--seed", "saas"],
    { cwd: repoRoot, encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.mode, "strict");
  assert.equal(payload.validated_count, 1);
  assert.equal(Array.isArray(payload.targets), true);
  assert.equal(payload.targets.length, 1);
  assert.equal(String(payload.targets[0].path).includes(path.join("saas", "result-reference")), true);
});
