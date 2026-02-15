const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const artifactsRoot = path.join(repoRoot, "test", "artifacts");

function listSeedIds() {
  return fs
    .readdirSync(artifactsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function getSeedArtifactPaths(seedId) {
  const base = path.join(artifactsRoot, seedId);
  return {
    base,
    seedTxt: path.join(base, "seed.txt"),
    goldenYaml: path.join(base, "result-reference", "seed.elementary-assertions.yaml"),
    goldenTxt: path.join(base, "result-reference", "seed.elementary-assertions.txt"),
    goldenMd: path.join(base, "result-reference", "seed.elementary-assertions.md"),
    goldenMeaningMd: path.join(base, "result-reference", "seed.elementary-assertions.meaning.md"),
  };
}

function readGoldenYamlText(seedId) {
  const paths = getSeedArtifactPaths(seedId);
  return fs.readFileSync(paths.goldenYaml, "utf8");
}

module.exports = {
  artifactsRoot,
  listSeedIds,
  getSeedArtifactPaths,
  readGoldenYamlText,
};
