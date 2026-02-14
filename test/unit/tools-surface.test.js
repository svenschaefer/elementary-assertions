const test = require("node:test");
const assert = require("node:assert/strict");

test("tools entry exports runCli and usage", () => {
  const tools = require("../../src/tools");
  assert.equal(typeof tools.runCli, "function");
  assert.equal(typeof tools.usage, "function");
});

test("CLI usage documents public commands", () => {
  const { usage } = require("../../src/tools");
  const text = usage();
  assert.match(text, /\brun\b/);
  assert.match(text, /\bvalidate\b/);
  assert.match(text, /\brender\b/);
});

