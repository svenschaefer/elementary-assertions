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
