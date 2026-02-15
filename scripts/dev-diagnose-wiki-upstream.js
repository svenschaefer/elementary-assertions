const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const { parseArgs, resolveArtifactsRoot, resolveSeedIds } = require("./dev-artifacts");

function readDoc(artifactsRoot, seedId) {
  const yamlPath = path.join(artifactsRoot, seedId, "result-reference", "seed.elementary-assertions.yaml");
  return yaml.load(fs.readFileSync(yamlPath, "utf8"));
}

function readUpstreamDoc(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (String(filePath).toLowerCase().endsWith(".json")) {
    return JSON.parse(raw);
  }
  return yaml.load(raw);
}

function acceptedUpstreamEndpointTokenIds(upstreamDoc) {
  const endpointIds = new Set();
  const annotations = Array.isArray(upstreamDoc && upstreamDoc.annotations) ? upstreamDoc.annotations : [];
  for (const annotation of annotations) {
    if (!annotation || annotation.status !== "accepted" || annotation.kind !== "dependency") continue;
    const headId = String((annotation.head && annotation.head.id) || "");
    const depId = String((annotation.dep && annotation.dep.id) || "");
    if (headId) endpointIds.add(headId);
    if (depId) endpointIds.add(depId);
  }
  return endpointIds;
}

function correlationForSeed(doc, upstreamDoc) {
  if (!upstreamDoc || typeof upstreamDoc !== "object") {
    return {
      enabled: false,
      covered_mentions_with_upstream_endpoints: 0,
      uncovered_missing_upstream_acceptance_count: 0,
      uncovered_present_upstream_unprojected_count: 0,
      sample_missing_upstream_acceptance_mention_ids: [],
      sample_present_upstream_unprojected_mention_ids: [],
    };
  }

  const mentions = Array.isArray(doc && doc.mentions) ? doc.mentions : [];
  const mentionById = new Map(mentions.map((mention) => [mention && mention.id, mention]));
  const coverage = (((doc || {}).coverage) || {});
  const coveredIds = Array.isArray(coverage.covered_primary_mention_ids) ? coverage.covered_primary_mention_ids : [];
  const uncoveredIds = Array.isArray(coverage.uncovered_primary_mention_ids) ? coverage.uncovered_primary_mention_ids : [];
  const endpointTokenIds = acceptedUpstreamEndpointTokenIds(upstreamDoc);

  const mentionTouchesUpstreamEndpoint = (mentionId) => {
    const mention = mentionById.get(mentionId);
    const tokenIds = Array.isArray((mention || {}).token_ids) ? mention.token_ids : [];
    return tokenIds.some((tokenId) => endpointTokenIds.has(String(tokenId)));
  };

  const coveredMentionsWithUpstreamEndpoints = coveredIds.filter((mentionId) => mentionTouchesUpstreamEndpoint(mentionId));
  const uncoveredMissingUpstreamAcceptance = [];
  const uncoveredPresentUpstreamUnprojected = [];
  for (const mentionId of uncoveredIds) {
    if (mentionTouchesUpstreamEndpoint(mentionId)) uncoveredPresentUpstreamUnprojected.push(mentionId);
    else uncoveredMissingUpstreamAcceptance.push(mentionId);
  }

  uncoveredMissingUpstreamAcceptance.sort((a, b) => String(a).localeCompare(String(b)));
  uncoveredPresentUpstreamUnprojected.sort((a, b) => String(a).localeCompare(String(b)));

  return {
    enabled: true,
    accepted_dependency_count: Array.isArray(upstreamDoc.annotations)
      ? upstreamDoc.annotations.filter((annotation) => annotation && annotation.status === "accepted" && annotation.kind === "dependency").length
      : 0,
    accepted_endpoint_token_count: endpointTokenIds.size,
    covered_mentions_with_upstream_endpoints: coveredMentionsWithUpstreamEndpoints.length,
    uncovered_missing_upstream_acceptance_count: uncoveredMissingUpstreamAcceptance.length,
    uncovered_present_upstream_unprojected_count: uncoveredPresentUpstreamUnprojected.length,
    sample_missing_upstream_acceptance_mention_ids: uncoveredMissingUpstreamAcceptance.slice(0, 10),
    sample_present_upstream_unprojected_mention_ids: uncoveredPresentUpstreamUnprojected.slice(0, 10),
  };
}

function hasPositiveWikiSignal(carrier) {
  if (!carrier || typeof carrier !== "object") return false;
  if (carrier.wiki_any_signal === true) return true;
  if (carrier.wiki_exact_match === true) return true;
  return Number(carrier.wiki_prefix_count || 0) > 0;
}

function buildSeedRow(doc, seedId, upstreamDoc) {
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
    correlation: correlationForSeed(doc, upstreamDoc),
  };
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const args = parseArgs(process.argv);
  const artifactsRoot = resolveArtifactsRoot(repoRoot, args);
  const seedIds = resolveSeedIds(artifactsRoot, args);
  const upstreamPath = typeof args.upstream === "string" ? path.resolve(args.upstream) : "";
  const upstreamDoc = upstreamPath ? readUpstreamDoc(upstreamPath) : null;
  const rows = seedIds.map((seedId) => buildSeedRow(readDoc(artifactsRoot, seedId), seedId, upstreamDoc));
  process.stdout.write(`${JSON.stringify({ generated_at: new Date().toISOString(), seeds: rows }, null, 2)}\n`);
}

main();
