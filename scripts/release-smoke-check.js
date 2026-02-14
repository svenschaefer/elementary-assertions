const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      out[key] = "true";
      continue;
    }
    out[key] = value;
    i += 1;
  }
  return out;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.error) {
    throw new Error(
      `Command failed to start: ${command} ${args.join(" ")}\n` +
        `cwd: ${cwd}\n` +
        `error: ${result.error.message}`
    );
  }
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    throw new Error(
      `Command failed: ${command} ${args.join(" ")}\n` +
        `cwd: ${cwd}\n` +
        (stdout ? `stdout:\n${stdout}\n` : "") +
        (stderr ? `stderr:\n${stderr}\n` : "")
    );
  }
  return result.stdout || "";
}

function listSeedIds(artifactsRoot) {
  return fs
    .readdirSync(artifactsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((seedId) =>
      fs.existsSync(
        path.join(artifactsRoot, seedId, "prototype-reference", "seed.elementary-assertions.yaml")
      )
    )
    .sort((a, b) => a.localeCompare(b));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
  const args = parseArgs(process.argv);
  const repoRoot = args["repo-root"] ? path.resolve(args["repo-root"]) : null;
  const smokeRoot = args["smoke-root"] ? path.resolve(args["smoke-root"]) : process.cwd();
  const outRoot = args["out-root"] ? path.resolve(args["out-root"]) : path.join(smokeRoot, "rendered");

  if (!repoRoot) {
    throw new Error("Missing required argument: --repo-root <path>");
  }
  if (!fs.existsSync(path.join(repoRoot, "test", "artifacts"))) {
    throw new Error(`repo-root does not contain test/artifacts: ${repoRoot}`);
  }

  ensureDir(outRoot);

  const apiKeysRaw = run(
    process.execPath,
    ["-e", "const api=require('elementary-assertions'); console.log(JSON.stringify(Object.keys(api)));"],
    smokeRoot
  ).trim();
  const apiKeys = JSON.parse(apiKeysRaw);
  if (!apiKeys.includes("runFromRelations") || !apiKeys.includes("runElementaryAssertions")) {
    throw new Error(`Unexpected API exports: ${apiKeysRaw}`);
  }

  const cliPath = path.join(smokeRoot, "node_modules", "elementary-assertions", "bin", "elementary-assertions.js");
  if (!fs.existsSync(cliPath)) {
    throw new Error(`Installed CLI not found in smoke workspace: ${cliPath}`);
  }

  run(process.execPath, [cliPath, "--help"], smokeRoot);

  const artifactsRoot = path.join(repoRoot, "test", "artifacts");
  const seedIds = listSeedIds(artifactsRoot);
  if (seedIds.length === 0) throw new Error("No artifact seeds found for smoke render checks.");

  for (const seedId of seedIds) {
    const base = path.join(artifactsRoot, seedId, "prototype-reference");
    const inYaml = path.join(base, "seed.elementary-assertions.yaml");
    const goldenTxt = path.join(base, "seed.elementary-assertions.txt");
    const goldenMd = path.join(base, "seed.elementary-assertions.md");
    const outTxt = path.join(outRoot, `${seedId}.compact.txt`);
    const outMd = path.join(outRoot, `${seedId}.table.md`);

    run(
      process.execPath,
      [cliPath, "render", "--in", inYaml, "--out", outTxt, "--format", "txt", "--layout", "compact"],
      smokeRoot
    );
    run(
      process.execPath,
      [cliPath, "render", "--in", inYaml, "--out", outMd, "--format", "md", "--layout", "table"],
      smokeRoot
    );

    const txtRendered = fs.readFileSync(outTxt, "utf8");
    const txtGolden = fs.readFileSync(goldenTxt, "utf8");
    const mdRendered = fs.readFileSync(outMd, "utf8");
    const mdGolden = fs.readFileSync(goldenMd, "utf8");

    if (txtRendered !== txtGolden) {
      throw new Error(`Render parity mismatch (txt/compact) for seed: ${seedId}`);
    }
    if (mdRendered !== mdGolden) {
      throw new Error(`Render parity mismatch (md/table) for seed: ${seedId}`);
    }
  }

  console.log(`release smoke check passed`);
  console.log(`smoke_root=${smokeRoot}`);
  console.log(`render_out_root=${outRoot}`);
  console.log(`seeds_checked=${seedIds.length}`);
}

main();
