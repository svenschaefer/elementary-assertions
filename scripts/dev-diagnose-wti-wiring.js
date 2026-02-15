const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const { parseArgs, resolveArtifactsRoot, resolveSeedIds } = require("./dev-artifacts");
const { runElementaryAssertions, ensureWtiEndpointReachable } = require("../src/run");

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

async function runRuntimeProbe({ repoRoot, artifactsRoot, seedIds, endpoint, wtiTimeoutMs }) {
  if (!endpoint) {
    throw new Error("runtime probe requires --wti-endpoint <url>.");
  }
  if (seedIds.length !== 1) {
    throw new Error("runtime probe requires exactly one seed (use --seed <name>).");
  }
  const seedId = seedIds[0];
  const seedTextPath = path.join(artifactsRoot, seedId, "seed.txt");
  if (!fs.existsSync(seedTextPath)) {
    throw new Error(`runtime probe requires seed text file: ${seedTextPath}`);
  }
  const text = fs.readFileSync(seedTextPath, "utf8");

  await ensureWtiEndpointReachable(endpoint, wtiTimeoutMs);
  const out = await runElementaryAssertions(text, {
    services: { "wikipedia-title-index": { endpoint } },
    wtiTimeoutMs,
  });
  const tokens = Array.isArray(out && out.tokens) ? out.tokens : [];
  const positiveSignals = tokens
    .map((token) => (((token || {}).lexicon) || {}).wikipedia_title_index)
    .filter((carrier) => hasPositiveWikiSignal(carrier)).length;
  if (positiveSignals < 1) {
    throw new Error("runtime probe failed: no positive wikipedia_title_index signal found after runElementaryAssertions.");
  }

  return {
    enabled: true,
    seed_id: seedId,
    endpoint,
    health_check_ok: true,
    run_ok: true,
    output_stage: String((out && out.stage) || ""),
    positive_wiki_signal_count: positiveSignals,
    diagnostics_token_wiki_signal_count: Number((((out || {}).diagnostics) || {}).token_wiki_signal_count || 0),
    pipeline_wti_configured: Boolean(((((out || {}).sources) || {}).pipeline || {}).wikipedia_title_index_configured),
  };
}

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const args = parseArgs(process.argv);
  const artifactsRoot = resolveArtifactsRoot(repoRoot, args);
  const seedIds = resolveSeedIds(artifactsRoot, args);
  const endpoint = typeof args["wti-endpoint"] === "string" ? args["wti-endpoint"] : "";
  const wtiTimeoutMs = Number(args["wti-timeout-ms"] || 0) > 0 ? Number(args["wti-timeout-ms"]) : undefined;
  const runtimeProbeRequested = Boolean(args["runtime-probe"]) || Boolean(endpoint);
  const rows = seedIds.map((seedId) => buildSeedRow(readDoc(artifactsRoot, seedId), seedId));
  const runtime_probe = runtimeProbeRequested
    ? await runRuntimeProbe({ repoRoot, artifactsRoot, seedIds, endpoint, wtiTimeoutMs })
    : { enabled: false };
  process.stdout.write(`${JSON.stringify({ generated_at: new Date().toISOString(), seeds: rows, runtime_probe }, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${String(err && err.message ? err.message : err)}\n`);
  process.exit(1);
});
