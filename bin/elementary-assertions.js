#!/usr/bin/env node
const { runCli } = require("../src/tools/cli");

runCli().catch((err) => {
  const msg = err && err.message ? err.message : String(err);
  process.stderr.write(`${msg}\n`);
  process.exit(1);
});
