const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function npmCommand() {
  if (typeof process.env.npm_execpath === "string" && process.env.npm_execpath.length > 0) {
    return { command: process.execPath, prefixArgs: [process.env.npm_execpath] };
  }
  return {
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    prefixArgs: [],
  };
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.error) {
    throw new Error(
      `Failed to start command: ${command} ${args.join(" ")}\n` +
        `cwd: ${cwd}\n` +
        `error: ${result.error.message}`
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(" ")}\n` +
        `cwd: ${cwd}\n` +
        `stdout:\n${result.stdout || ""}\n` +
        `stderr:\n${result.stderr || ""}`
    );
  }
  return (result.stdout || "").trim();
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const smokeRoot = path.join(repoRoot, "test", "_smoke", `release-smoke-${stamp}`);
  fs.mkdirSync(smokeRoot, { recursive: true });
  const npm = npmCommand();

  const packedFile = run(npm.command, [...npm.prefixArgs, "pack"], repoRoot)
    .split(/\r?\n/)
    .find((line) => line.endsWith(".tgz"));
  if (!packedFile) {
    throw new Error("Could not determine packed tarball filename.");
  }
  const packedPath = path.join(repoRoot, packedFile);
  const outRoot = path.join(smokeRoot, "rendered");

  try {
    run(npm.command, [...npm.prefixArgs, "init", "-y"], smokeRoot);
    run(npm.command, [...npm.prefixArgs, "install", packedPath], smokeRoot);
    run(
      process.execPath,
      [
        path.join(repoRoot, "scripts", "release-smoke-check.js"),
        "--repo-root",
        repoRoot,
        "--smoke-root",
        smokeRoot,
        "--out-root",
        outRoot,
      ],
      smokeRoot
    );
    process.stdout.write(`release smoke check passed\n`);
    process.stdout.write(`smoke_root=${smokeRoot}\n`);
    process.stdout.write(`render_out_root=${outRoot}\n`);
  } finally {
    if (fs.existsSync(packedPath)) {
      fs.unlinkSync(packedPath);
    }
  }
}

main();
