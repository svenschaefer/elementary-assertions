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

function positiveWikiSignalTokenIds(doc) {
  const out = new Set();
  const tokens = Array.isArray(doc && doc.tokens) ? doc.tokens : [];
  for (const token of tokens) {
    const tokenId = String((token && token.id) || "");
    if (!tokenId) continue;
    const carrier = ((((token || {}).lexicon) || {}).wikipedia_title_index);
    if (hasPositiveWikiSignal(carrier)) out.add(tokenId);
  }
  return out;
}

function buildMentionRoleClassMap(doc) {
  const out = new Map();
  const assertions = Array.isArray(doc && doc.assertions) ? doc.assertions : [];
  for (const assertion of assertions) {
    const argumentsEntries = Array.isArray((assertion || {}).arguments) ? assertion.arguments : [];
    for (const entry of argumentsEntries) {
      const mentionIds = Array.isArray((entry || {}).mention_ids) ? entry.mention_ids : [];
      for (const mentionId of mentionIds) {
        const key = String(mentionId || "");
        if (!key) continue;
        if (!out.has(key)) out.set(key, new Set());
        out.get(key).add("argument");
      }
    }
    const modifiers = Array.isArray((assertion || {}).modifiers) ? assertion.modifiers : [];
    for (const modifier of modifiers) {
      const mentionIds = Array.isArray((modifier || {}).mention_ids) ? modifier.mention_ids : [];
      for (const mentionId of mentionIds) {
        const key = String(mentionId || "");
        if (!key) continue;
        if (!out.has(key)) out.set(key, new Set());
        out.get(key).add("modifier");
      }
    }
  }
  return out;
}

function mentionRoleClassForId(mentionId, mentionRoleClassMap) {
  const classes = mentionRoleClassMap.get(mentionId);
  if (!classes || classes.size === 0) return "none";
  if (classes.has("argument")) return "argument";
  if (classes.has("modifier")) return "modifier";
  return "none";
}

function canonicalizeFieldPath(pathText) {
  return String(pathText || "").replace(/\[\d+\]/g, "[]");
}

function stableJsonSnippet(value, maxLen = 180) {
  function stable(value0) {
    if (Array.isArray(value0)) return value0.map((item) => stable(item));
    if (!value0 || typeof value0 !== "object") return value0;
    const out = {};
    for (const key of Object.keys(value0).sort((a, b) => a.localeCompare(b))) {
      out[key] = stable(value0[key]);
    }
    return out;
  }
  let raw;
  try {
    raw = JSON.stringify(stable(value));
  } catch (_) {
    raw = String(value);
  }
  if (typeof raw !== "string") raw = String(raw);
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, Math.max(0, maxLen - 3))}...`;
}

function isWikiFieldName(name) {
  return /wiki|wikipedia|title_index/i.test(String(name || ""));
}

function familyFromPathParts(pathParts) {
  if (!Array.isArray(pathParts) || pathParts.length === 0) return "root";
  const first = String(pathParts[0] || "");
  return first.includes("[") ? first.slice(0, first.indexOf("[")) : first;
}

function collectUpstreamWikiFieldInventory(upstreamDoc) {
  if (!upstreamDoc || typeof upstreamDoc !== "object") {
    return { enabled: false, object_families: [] };
  }

  const familyFieldPathCounts = new Map();
  const familyCarrierObjects = new Map();
  const fieldPathExampleByFamily = new Map();

  function addFieldPath(family, fieldPath, objectPath, value, sourceId) {
    if (!familyFieldPathCounts.has(family)) familyFieldPathCounts.set(family, new Map());
    const fieldMap = familyFieldPathCounts.get(family);
    fieldMap.set(fieldPath, (fieldMap.get(fieldPath) || 0) + 1);

    if (!familyCarrierObjects.has(family)) familyCarrierObjects.set(family, new Set());
    familyCarrierObjects.get(family).add(objectPath);

    if (!fieldPathExampleByFamily.has(family)) fieldPathExampleByFamily.set(family, new Map());
    const sampleMap = fieldPathExampleByFamily.get(family);
    const existing = sampleMap.get(fieldPath);
    const normalizedSourceId = String(sourceId || "");
    if (!existing || normalizedSourceId.localeCompare(existing.example_source_id) < 0) {
      sampleMap.set(fieldPath, {
        example: stableJsonSnippet(value, 180),
        example_source_id: normalizedSourceId || null,
      });
    }
  }

  function walk(node, pathParts, inheritedSourceId) {
    if (!node || typeof node !== "object") return;
    const family = familyFromPathParts(pathParts);
    const nodeSourceId = (node && typeof node.id === "string" && node.id.length > 0) ? node.id : inheritedSourceId;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        walk(node[i], pathParts.concat(`${pathParts.length ? "" : "root"}[${i}]`), nodeSourceId);
      }
      return;
    }

    const objectPath = canonicalizeFieldPath(pathParts.join("."));
    const keys = Object.keys(node).sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      const value = node[key];
      const fieldPath = canonicalizeFieldPath(pathParts.concat(key).join("."));
      if (isWikiFieldName(key)) addFieldPath(family, fieldPath, objectPath, value, nodeSourceId);
      walk(value, pathParts.concat(key), nodeSourceId);
    }
  }

  walk(upstreamDoc, [], "");

  const objectFamilies = Array.from(familyFieldPathCounts.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((family) => {
      const fieldPaths = Array.from(familyFieldPathCounts.get(family).entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([pathText, count]) => {
          const sample = ((fieldPathExampleByFamily.get(family) || new Map()).get(pathText)) || { example: "", example_source_id: null };
          return {
            path: pathText,
            count,
            example: String(sample.example || ""),
            example_source_id: sample.example_source_id,
          };
        });
      return {
        family,
        carrier_object_count: (familyCarrierObjects.get(family) || new Set()).size,
        field_paths: fieldPaths,
      };
    });

  return {
    enabled: true,
    object_families: objectFamilies,
  };
}

function buildPredicateWikipediaCoverage(doc, upstreamDoc) {
  if (!upstreamDoc || typeof upstreamDoc !== "object") {
    return {
      enabled: false,
      total_predicates_considered: 0,
      predicates_with_wikipedia_signal: 0,
      predicates_missing_wikipedia_signal: 0,
      missing_due_to_no_wikipedia_payload_count: 0,
      missing_due_to_not_eligible_or_not_present_count: 0,
      sample_missing_due_to_no_wikipedia_payload: [],
      sample_missing_due_to_not_eligible_or_not_present: [],
    };
  }

  const endpointTokenIds = acceptedUpstreamEndpointTokenIds(upstreamDoc);
  const downstreamPositiveSignalTokenIds = positiveWikiSignalTokenIds(doc);
  const assertions = Array.isArray(doc && doc.assertions) ? doc.assertions : [];
  const missingNoPayload = [];
  const missingNotEligible = [];
  let withSignal = 0;
  for (const assertion of assertions) {
    const assertionId = String((assertion && assertion.id) || "");
    const predicate = ((assertion || {}).predicate) || {};
    const headTokenId = String(predicate.head_token_id || "");
    const surface = String(predicate.surface || "");
    if (!assertionId || !headTokenId) continue;
    const hasSignal = downstreamPositiveSignalTokenIds.has(headTokenId);
    if (hasSignal) {
      withSignal += 1;
      continue;
    }
    const row = {
      assertion_id: assertionId,
      segment_id: String((assertion && assertion.segment_id) || ""),
      predicate_head_token_id: headTokenId,
      surface,
    };
    if (endpointTokenIds.has(headTokenId)) missingNoPayload.push(row);
    else missingNotEligible.push(row);
  }

  missingNoPayload.sort((a, b) => a.assertion_id.localeCompare(b.assertion_id));
  missingNotEligible.sort((a, b) => a.assertion_id.localeCompare(b.assertion_id));
  const totalPredicates = assertions.filter((assertion) => {
    const predicate = ((assertion || {}).predicate) || {};
    return typeof assertion.id === "string" && assertion.id.length > 0 && typeof predicate.head_token_id === "string" && predicate.head_token_id.length > 0;
  }).length;

  return {
    enabled: true,
    total_predicates_considered: totalPredicates,
    predicates_with_wikipedia_signal: withSignal,
    predicates_missing_wikipedia_signal: missingNoPayload.length + missingNotEligible.length,
    missing_due_to_no_wikipedia_payload_count: missingNoPayload.length,
    missing_due_to_not_eligible_or_not_present_count: missingNotEligible.length,
    sample_missing_due_to_no_wikipedia_payload: missingNoPayload.slice(0, 10),
    sample_missing_due_to_not_eligible_or_not_present: missingNotEligible.slice(0, 10),
  };
}

function buildMentionSample(mention, mentionId, roleClass) {
  const tokenIds = Array.isArray((mention || {}).token_ids) ? mention.token_ids.map((x) => String(x || "")).filter(Boolean) : [];
  return {
    mention_id: mentionId,
    mention_kind: String((mention && mention.kind) || "unknown"),
    role_class: roleClass,
    segment_id: String((mention && mention.segment_id) || ""),
    surface: String((mention && mention.surface) || ""),
    token_ids: tokenIds,
  };
}

function buildPredicateSample(assertion, category) {
  return {
    assertion_id: String((assertion && assertion.id) || ""),
    mention_kind: "predicate",
    role_class: "predicate",
    segment_id: String((assertion && assertion.segment_id) || ""),
    surface: String((((assertion || {}).predicate) || {}).surface || ""),
    predicate_head_token_id: String((((assertion || {}).predicate) || {}).head_token_id || ""),
    category,
  };
}

function stratifySamples(samples) {
  const byRole = new Map();
  const byMentionKind = new Map();
  for (const sample of samples) {
    const role = String(sample.role_class || "none");
    const kind = String(sample.mention_kind || "unknown");
    if (!byRole.has(role)) byRole.set(role, []);
    if (!byMentionKind.has(kind)) byMentionKind.set(kind, []);
    byRole.get(role).push(sample);
    byMentionKind.get(kind).push(sample);
  }

  function mapToObject(map) {
    const out = {};
    for (const key of Array.from(map.keys()).sort((a, b) => a.localeCompare(b))) {
      out[key] = map
        .get(key)
        .slice()
        .sort((a, b) => String(a.mention_id || a.assertion_id || "").localeCompare(String(b.mention_id || b.assertion_id || "")))
        .slice(0, 10);
    }
    return out;
  }

  return {
    by_role_class: mapToObject(byRole),
    by_mention_kind: mapToObject(byMentionKind),
  };
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
      upstream_wikipedia_field_inventory: { enabled: false, object_families: [] },
      predicate_wikipedia_coverage_summary: buildPredicateWikipediaCoverage(doc, upstreamDoc),
      missing_field_samples: {
        missing_upstream_acceptance: { by_role_class: {}, by_mention_kind: {} },
        present_upstream_dropped_downstream: { by_role_class: {}, by_mention_kind: {} },
      },
    };
  }

  const mentions = Array.isArray(doc && doc.mentions) ? doc.mentions : [];
  const mentionById = new Map(mentions.map((mention) => [mention && mention.id, mention]));
  const coverage = (((doc || {}).coverage) || {});
  const coveredIds = Array.isArray(coverage.covered_primary_mention_ids) ? coverage.covered_primary_mention_ids : [];
  const uncoveredIds = Array.isArray(coverage.uncovered_primary_mention_ids) ? coverage.uncovered_primary_mention_ids : [];
  const endpointTokenIds = acceptedUpstreamEndpointTokenIds(upstreamDoc);
  const downstreamPositiveSignalTokenIds = positiveWikiSignalTokenIds(doc);
  const mentionRoleClassMap = buildMentionRoleClassMap(doc);
  const missingUpstreamSamples = [];
  const droppedDownstreamSamples = [];

  const mentionTouchesUpstreamEndpoint = (mentionId) => {
    const mention = mentionById.get(mentionId);
    const tokenIds = Array.isArray((mention || {}).token_ids) ? mention.token_ids : [];
    return tokenIds.some((tokenId) => endpointTokenIds.has(String(tokenId)));
  };
  const mentionTouchesDownstreamSignal = (mentionId) => {
    const mention = mentionById.get(mentionId);
    const tokenIds = Array.isArray((mention || {}).token_ids) ? mention.token_ids : [];
    return tokenIds.some((tokenId) => downstreamPositiveSignalTokenIds.has(String(tokenId)));
  };

  const coveredMentionsWithUpstreamEndpoints = coveredIds.filter((mentionId) => mentionTouchesUpstreamEndpoint(mentionId));
  const uncoveredMissingUpstreamAcceptance = [];
  const uncoveredPresentUpstreamUnprojected = [];
  for (const mentionId of uncoveredIds) {
    const mention = mentionById.get(mentionId);
    const roleClass = mentionRoleClassForId(mentionId, mentionRoleClassMap);
    const upstreamPresent = mentionTouchesUpstreamEndpoint(mentionId);
    const downstreamPresent = mentionTouchesDownstreamSignal(mentionId);
    if (upstreamPresent) uncoveredPresentUpstreamUnprojected.push(mentionId);
    else uncoveredMissingUpstreamAcceptance.push(mentionId);
    if (!upstreamPresent) {
      missingUpstreamSamples.push(buildMentionSample(mention, String(mentionId || ""), roleClass));
      continue;
    }
    if (!downstreamPresent) {
      droppedDownstreamSamples.push(buildMentionSample(mention, String(mentionId || ""), roleClass));
    }
  }

  const assertions = Array.isArray(doc && doc.assertions) ? doc.assertions : [];
  for (const assertion of assertions) {
    const headTokenId = String((((assertion || {}).predicate) || {}).head_token_id || "");
    if (!headTokenId) continue;
    const upstreamPresent = endpointTokenIds.has(headTokenId);
    const downstreamPresent = downstreamPositiveSignalTokenIds.has(headTokenId);
    if (!upstreamPresent) {
      missingUpstreamSamples.push(buildPredicateSample(assertion, "missing_upstream_acceptance"));
      continue;
    }
    if (!downstreamPresent) {
      droppedDownstreamSamples.push(buildPredicateSample(assertion, "present_upstream_dropped_downstream"));
    }
  }

  uncoveredMissingUpstreamAcceptance.sort((a, b) => String(a).localeCompare(String(b)));
  uncoveredPresentUpstreamUnprojected.sort((a, b) => String(a).localeCompare(String(b)));
  missingUpstreamSamples.sort((a, b) => String(a.mention_id || a.assertion_id || "").localeCompare(String(b.mention_id || b.assertion_id || "")));
  droppedDownstreamSamples.sort((a, b) => String(a.mention_id || a.assertion_id || "").localeCompare(String(b.mention_id || b.assertion_id || "")));

  return {
    enabled: true,
    accepted_dependency_count: Array.isArray(upstreamDoc.annotations)
      ? upstreamDoc.annotations.filter((annotation) => annotation && annotation.status === "accepted" && annotation.kind === "dependency").length
      : 0,
    accepted_endpoint_token_count: endpointTokenIds.size,
    downstream_positive_signal_token_count: downstreamPositiveSignalTokenIds.size,
    covered_mentions_with_upstream_endpoints: coveredMentionsWithUpstreamEndpoints.length,
    uncovered_missing_upstream_acceptance_count: uncoveredMissingUpstreamAcceptance.length,
    uncovered_present_upstream_unprojected_count: uncoveredPresentUpstreamUnprojected.length,
    sample_missing_upstream_acceptance_mention_ids: uncoveredMissingUpstreamAcceptance.slice(0, 10),
    sample_present_upstream_unprojected_mention_ids: uncoveredPresentUpstreamUnprojected.slice(0, 10),
    upstream_wikipedia_field_inventory: collectUpstreamWikiFieldInventory(upstreamDoc),
    predicate_wikipedia_coverage_summary: buildPredicateWikipediaCoverage(doc, upstreamDoc),
    missing_field_samples: {
      missing_upstream_acceptance: stratifySamples(missingUpstreamSamples),
      present_upstream_dropped_downstream: stratifySamples(droppedDownstreamSamples),
    },
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
    wikipedia_carrier_count: carriers.length,
    positive_wikipedia_signal_count: positiveCount,
    diagnostics_token_wikipedia_signal_count: diagnosticsCount,
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
