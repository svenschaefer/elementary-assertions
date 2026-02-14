const test = require("node:test");
const assert = require("node:assert/strict");

const { runCli } = require("../../src/tools");

test("CLI run rejects when neither --text nor --in is provided", async () => {
  await assert.rejects(
    () => runCli(["run"]),
    /exactly one of --text or --in is required; neither provided/i
  );
});

test("CLI run rejects when both --text and --in are provided", async () => {
  await assert.rejects(
    () => runCli(["run", "--text", "Alpha runs.", "--in", "input.txt"]),
    /exactly one of --text or --in is required; both provided/i
  );
});

