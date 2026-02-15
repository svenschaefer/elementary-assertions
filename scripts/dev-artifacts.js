const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key || !key.startsWith("--")) continue;
    const name = key.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      out[name] = true;
      continue;
    }
    out[name] = value;
    i += 1;
  }
  return out;
}

function resolveArtifactsRoot(repoRoot, args) {
  const raw = typeof args["artifacts-root"] === "string" ? args["artifacts-root"] : path.join(repoRoot, "test", "artifacts");
  return path.resolve(raw);
}

function listSeedIds(artifactsRoot) {
  return fs
    .readdirSync(artifactsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((seedId) => fs.existsSync(path.join(artifactsRoot, seedId, "result-reference", "seed.elementary-assertions.yaml")))
    .sort((a, b) => a.localeCompare(b));
}

function resolveSeedIds(artifactsRoot, args) {
  const seedIds = listSeedIds(artifactsRoot);
  const requestedSeed = typeof args.seed === "string" && args.seed.length > 0 ? args.seed : "";
  if (!requestedSeed) return seedIds;
  if (!seedIds.includes(requestedSeed)) {
    throw new Error(`Unknown seed '${requestedSeed}' under artifacts root: ${artifactsRoot}`);
  }
  return [requestedSeed];
}

module.exports = {
  parseArgs,
  resolveArtifactsRoot,
  listSeedIds,
  resolveSeedIds,
};
