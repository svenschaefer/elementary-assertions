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

function buildWiringAttribution(doc, counts) {
  const pipeline = ((((doc || {}).sources) || {}).pipeline) || {};
  const endpointConfigured = Boolean(pipeline.wikipedia_title_index_configured);
  const tokenLexiconObserved = Number(counts.tokenLexiconCarrierCount || 0) > 0;
  const evidenceMentionObserved = Number(counts.mentionMatches || 0) > 0;
  const evidencePredicateObserved = Number(counts.predicateMatches || 0) > 0;
  const diagnosticsObserved = Number(counts.diagnosticsMentions || 0) > 0 || Number(counts.diagnosticsAssertions || 0) > 0;
  const observedFamilies = [];
  if (tokenLexiconObserved) observedFamilies.push("token.lexicon.wikipedia_title_index");
  if (evidenceMentionObserved) observedFamilies.push("wiki_title_evidence.mention_matches");
  if (evidencePredicateObserved) observedFamilies.push("wiki_title_evidence.assertion_predicate_matches");
  if (diagnosticsObserved) observedFamilies.push("diagnostics.wiki_signal_counters");

  const requestedFamilies = endpointConfigured
    ? [
      "token.lexicon.wikipedia_title_index",
      "wiki_title_evidence.mention_matches",
      "wiki_title_evidence.assertion_predicate_matches",
      "diagnostics.wiki_signal_counters",
    ]
    : [];

  const missingFamilies = requestedFamilies.filter((family) => !observedFamilies.includes(family));
  return {
    endpoint_configured: endpointConfigured,
    mandatory_endpoint_behavior_active: endpointConfigured,
    per_step: [
      {
        step: "linguistic-enricher",
        requested_signal_families: endpointConfigured ? ["wikipedia_title_index"] : [],
        observed_signal_families: endpointConfigured ? ["wikipedia_title_index_configured"] : [],
      },
      {
        step: "elementary-assertions-pass-through",
        requested_signal_families: requestedFamilies,
        observed_signal_families: observedFamilies,
        missing_signal_families: missingFamilies,
      },
    ],
  };
}

function buildSeedRow(doc, seedId) {
  const pipeline = ((((doc || {}).sources) || {}).pipeline) || {};
  const diagnostics = (((doc || {}).diagnostics) || {});
  const evidence = (((doc || {}).wiki_title_evidence) || {});
  const tokenLexiconCarriers = Array.isArray((doc || {}).tokens)
    ? doc.tokens
      .map((token) => (((token || {}).lexicon) || {}).wikipedia_title_index)
      .filter((carrier) => carrier && typeof carrier === "object")
      .length
    : 0;
  const mentionMatches = Array.isArray(evidence.mention_matches) ? evidence.mention_matches.length : 0;
  const predicateMatches = Array.isArray(evidence.assertion_predicate_matches) ? evidence.assertion_predicate_matches.length : 0;
  const diagnosticsMentions = Number(diagnostics.mentions_with_lexicon_evidence || 0);
  const diagnosticsAssertions = Number(diagnostics.assertions_with_wiki_signals || 0);
  const counts = {
    tokenLexiconCarrierCount: tokenLexiconCarriers,
    mentionMatches,
    predicateMatches,
    diagnosticsMentions,
    diagnosticsAssertions,
  };

  return {
    seed_id: seedId,
    wikipedia_title_index_configured: Boolean(pipeline.wikipedia_title_index_configured),
    diagnostics_mentions_with_lexicon_evidence: diagnosticsMentions,
    diagnostics_assertions_with_wiki_signals: diagnosticsAssertions,
    token_lexicon_wiki_carrier_count: tokenLexiconCarriers,
    wiki_title_evidence_mention_matches: mentionMatches,
    wiki_title_evidence_predicate_matches: predicateMatches,
    has_wiki_title_evidence_payload: mentionMatches > 0 || predicateMatches > 0,
    wiring_attribution: buildWiringAttribution(doc, counts),
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
