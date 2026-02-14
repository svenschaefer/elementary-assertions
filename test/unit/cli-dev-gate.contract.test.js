const test = require("node:test");
const assert = require("node:assert/strict");

const { runCli } = require("../../src/tools");

test("CLI rejects diagnostic flags without --dev", async () => {
  await assert.rejects(
    () => runCli(["run", "--text", "Alpha runs.", "--diagnose-wiki-upstream"]),
    /require --dev/i
  );
});

test("CLI treats diagnostic flags as developer-only even with --dev", async () => {
  await assert.rejects(
    () => runCli(["run", "--dev", "--text", "Alpha runs.", "--diagnose-wti-wiring"]),
    /developer-only/i
  );
});

