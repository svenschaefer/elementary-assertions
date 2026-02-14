const { sha256Hex } = require("./core/determinism");
const { buildTokenIndex, buildTokenWikiById } = require("./core/tokens");
const { buildAcceptedAnnotationsInventory, buildMentions } = require("./core/mentions");
const { collectStep11Relations, buildProjectedRelations } = require("./core/projection");
const { buildAssertions } = require("./core/assertions");
const { buildUnresolved, buildDiagnostics } = require("./core/diagnostics");
const { buildWikiTitleEvidenceFromUpstream, buildCoverageDomainMentionIds, buildOutput } = require("./core/output");

function normalizeOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function effectiveWtiTimeoutMs(timeoutMs) {
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 2000;
}

async function ensureWtiEndpointReachable(endpoint, timeoutMs) {
  const normalized = normalizeOptionalString(endpoint);
  if (!normalized) throw new Error("WTI endpoint is required for runElementaryAssertions.");

  const url = `${normalized.replace(/\/$/, "")}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveWtiTimeoutMs(timeoutMs));
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    throw new Error(`wikipedia-title-index health check failed for ${url}: ${detail}`);
  } finally {
    clearTimeout(timer);
  }
}

function validateNoLegacySlots(doc) {
  const assertions = Array.isArray(doc && doc.assertions) ? doc.assertions : [];
  for (const assertion of assertions) {
    if (assertion && Object.prototype.hasOwnProperty.call(assertion, "slots")) {
      throw new Error("Invalid input: legacy assertions[*].slots is not supported.");
    }
  }
}

function validateRelationsInput(relationsDoc) {
  if (!relationsDoc || typeof relationsDoc !== "object") {
    throw new Error("runFromRelations requires an object input document.");
  }
  if (!Array.isArray(relationsDoc.tokens)) {
    throw new Error("runFromRelations input must include tokens[].");
  }
  if (!Array.isArray(relationsDoc.annotations)) {
    throw new Error("runFromRelations input must include annotations[].");
  }
  if (!Array.isArray(relationsDoc.segments)) {
    throw new Error("runFromRelations input must include segments[].");
  }
  if (typeof relationsDoc.canonical_text !== "string") {
    throw new Error("runFromRelations input must include canonical_text.");
  }
  validateNoLegacySlots(relationsDoc);
}

function schemaVersionFromRelations(relationsDoc) {
  return typeof relationsDoc.schema_version === "string" && relationsDoc.schema_version.length > 0
    ? relationsDoc.schema_version
    : undefined;
}

function buildRunPipelineTrace(relationsSeed, runOptions, wtiEndpoint) {
  return {
    target: String(runOptions && runOptions.target ? runOptions.target : ""),
    relations_extracted_digest: sha256Hex(JSON.stringify(relationsSeed || {})),
    token_count: Array.isArray(relationsSeed && relationsSeed.tokens) ? relationsSeed.tokens.length : 0,
    annotation_count: Array.isArray(relationsSeed && relationsSeed.annotations) ? relationsSeed.annotations.length : 0,
    wikipedia_title_index_configured: Boolean(normalizeOptionalString(wtiEndpoint)),
  };
}

function runFromRelations(relationsDoc, options = {}) {
  validateRelationsInput(relationsDoc);

  const relationsSeed = relationsDoc;
  const schemaVersion = schemaVersionFromRelations(relationsSeed);
  const tokenById = buildTokenIndex(relationsSeed);
  const tokenWikiById = buildTokenWikiById(relationsSeed);
  const acceptedAnnotations = buildAcceptedAnnotationsInventory(relationsSeed);
  const stepRelations = collectStep11Relations(relationsSeed, tokenById);

  const allAnnotations = Array.isArray(relationsSeed.annotations) ? relationsSeed.annotations : [];
  const mweSeed = { annotations: allAnnotations.filter((a) => a && a.kind === "mwe" && a.status === "accepted") };
  const headsSeed = {
    annotations: allAnnotations.filter((a) => a && a.status === "accepted" && (a.kind === "chunk" || a.kind === "chunk_head")),
  };

  const mentionBuild = buildMentions({
    relationsSeed,
    mweSeed,
    headsSeed,
    tokenById,
    tokenWikiById,
  });

  const mentionById = new Map(mentionBuild.mentions.map((m) => [m.id, m]));
  const projectedBuild = buildProjectedRelations(
    stepRelations,
    mentionBuild.tokenToPrimaryMention,
    mentionBuild.tokenToAllMentions,
    mentionById,
    tokenById
  );
  const assertionBuild = buildAssertions({
    projected: projectedBuild.projected,
    mentionById,
    tokenById,
  });

  const coveragePrimaryMentionIds = buildCoverageDomainMentionIds(mentionBuild.mentions, tokenById);
  const uncoveredPrimaryMentionIds = coveragePrimaryMentionIds.filter((id) => !assertionBuild.coveredMentions.has(id));

  const unresolved = buildUnresolved({
    mentions: mentionBuild.mentions,
    unresolvedHeadMap: mentionBuild.unresolvedHeadMap,
    projectedUnresolved: projectedBuild.unresolved,
    mentionById,
    assertions: assertionBuild.assertions,
    projected: projectedBuild.projected,
    uncoveredPrimaryMentionIds,
  });

  const sourceInputs = Array.isArray(options.sourceInputs) ? options.sourceInputs.slice() : [];
  sourceInputs.push({ artifact: "relations_extracted.in_memory", digest: sha256Hex(JSON.stringify(relationsSeed || {})) });

  const wikiTitleEvidence = buildWikiTitleEvidenceFromUpstream({
    mentions: mentionBuild.mentions,
    assertions: assertionBuild.assertions,
    tokenById,
    canonicalText: relationsSeed.canonical_text,
  });

  const diagnostics = buildDiagnostics({
    tokenWikiById,
    mentions: mentionBuild.mentions,
    assertions: assertionBuild.assertions,
    projectedBuild,
    relationsSeed,
    wtiEndpoint: normalizeOptionalString(options.wtiEndpoint),
    suppressedAssertions: assertionBuild.suppressedAssertions,
  });

  return buildOutput({
    schemaVersion,
    relationsSeed,
    mentions: mentionBuild.mentions,
    assertions: assertionBuild.assertions,
    coveredMentions: assertionBuild.coveredMentions,
    unresolved,
    sourceInputs,
    pipelineTrace: buildRunPipelineTrace(relationsSeed, { target: "relations_extracted" }, normalizeOptionalString(options.wtiEndpoint)),
    acceptedAnnotations,
    diagnostics,
    projectedBuild,
    wikiTitleEvidence,
  });
}

async function runElementaryAssertions(text, options = {}) {
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("runElementaryAssertions requires non-empty text.");
  }

  const wtiEndpoint = normalizeOptionalString(
    options && options.services && options.services["wikipedia-title-index"]
      ? options.services["wikipedia-title-index"].endpoint
      : ""
  );

  if (!wtiEndpoint) {
    throw new Error("runElementaryAssertions requires options.services['wikipedia-title-index'].endpoint.");
  }

  await ensureWtiEndpointReachable(wtiEndpoint, options.wtiTimeoutMs);

  let linguisticEnricher;
  try {
    linguisticEnricher = require("linguistic-enricher");
  } catch (err) {
    throw new Error("Unable to load linguistic-enricher. Install it in the project root (npm i linguistic-enricher).");
  }

  const runOptions = {
    target: "relations_extracted",
    services: { "wikipedia-title-index": { endpoint: wtiEndpoint } },
  };
  if (Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) {
    runOptions.timeoutMs = options.timeoutMs;
  }

  const relationsSeed = await linguisticEnricher.runPipeline(text, runOptions);

  return runFromRelations(relationsSeed, {
    sourceInputs: [{ artifact: "seed.text.in_memory", digest: sha256Hex(text) }],
    wtiEndpoint,
  });
}

module.exports = {
  runFromRelations,
  runElementaryAssertions,
  normalizeOptionalString,
  ensureWtiEndpointReachable,
};
