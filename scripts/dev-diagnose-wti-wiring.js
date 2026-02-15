const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const { parseArgs, resolveArtifactsRoot, resolveSeedIds } = require("./dev-artifacts");

function readDoc(artifactsRoot, seedId) {
  const yamlPath = path.join(artifactsRoot, seedId, "result-reference", "seed.elementary-assertions.yaml");
  return yaml.load(fs.readFileSync(yamlPath, "utf8"));
}

function buildSeedRow(doc, seedId) {
  const pipeline = ((((doc || {}).sources) || {}).pipeline) || {};
  const diagnostics = (((doc || {}).diagnostics) || {});
  const evidence = (((doc || {}).wiki_title_evidence) || {});
  const mentionMatches = Array.isArray(evidence.mention_matches) ? evidence.mention_matches.length : 0;
  const predicateMatches = Array.isArray(evidence.assertion_predicate_matches) ? evidence.assertion_predicate_matches.length : 0;

  return {
    seed_id: seedId,
    wikipedia_title_index_configured: Boolean(pipeline.wikipedia_title_index_configured),
    diagnostics_mentions_with_lexicon_evidence: Number(diagnostics.mentions_with_lexicon_evidence || 0),
    diagnostics_assertions_with_wiki_signals: Number(diagnostics.assertions_with_wiki_signals || 0),
    wiki_title_evidence_mention_matches: mentionMatches,
    wiki_title_evidence_predicate_matches: predicateMatches,
    has_wiki_title_evidence_payload: mentionMatches > 0 || predicateMatches > 0,
  };
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const args = parseArgs(process.argv);
  const artifactsRoot = resolveArtifactsRoot(repoRoot, args);
  const seedIds = resolveSeedIds(artifactsRoot, args);
  const rows = seedIds.map((seedId) => buildSeedRow(readDoc(artifactsRoot, seedId), seedId));
  process.stdout.write(`${JSON.stringify({ generated_at: new Date().toISOString(), seeds: rows }, null, 2)}\n`);
}

main();
