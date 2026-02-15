const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

function listSeedIds(artifactsRoot) {
  return fs
    .readdirSync(artifactsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((seedId) => fs.existsSync(path.join(artifactsRoot, seedId, "result-reference", "seed.elementary-assertions.yaml")))
    .sort((a, b) => a.localeCompare(b));
}

function readDoc(artifactsRoot, seedId) {
  const yamlPath = path.join(artifactsRoot, seedId, "result-reference", "seed.elementary-assertions.yaml");
  return yaml.load(fs.readFileSync(yamlPath, "utf8"));
}

function hasPositiveWikiSignal(carrier) {
  if (!carrier || typeof carrier !== "object") return false;
  if (carrier.wiki_any_signal === true) return true;
  if (carrier.wiki_exact_match === true) return true;
  return Number(carrier.wiki_prefix_count || 0) > 0;
}

function buildSeedRow(doc, seedId) {
  const tokens = Array.isArray(doc && doc.tokens) ? doc.tokens : [];
  const carriers = tokens
    .map((token) => (((token || {}).lexicon) || {}).wikipedia_title_index)
    .filter((carrier) => carrier && typeof carrier === "object");
  const positiveCount = carriers.filter((carrier) => hasPositiveWikiSignal(carrier)).length;
  const diagnosticsCount = Number(((((doc || {}).diagnostics) || {}).token_wiki_signal_count) || 0);
  return {
    seed_id: seedId,
    token_count: tokens.length,
    wiki_carrier_count: carriers.length,
    positive_wiki_signal_count: positiveCount,
    diagnostics_token_wiki_signal_count: diagnosticsCount,
    diagnostics_alignment: diagnosticsCount === positiveCount,
  };
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const artifactsRoot = path.join(repoRoot, "test", "artifacts");
  const seedIds = listSeedIds(artifactsRoot);
  const rows = seedIds.map((seedId) => buildSeedRow(readDoc(artifactsRoot, seedId), seedId));
  process.stdout.write(`${JSON.stringify({ generated_at: new Date().toISOString(), seeds: rows }, null, 2)}\n`);
}

main();
