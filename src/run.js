const { sha256Hex } = require("./core/determinism");
const { buildTokenIndex, buildTokenWikiById } = require("./core/tokens");
const { buildAcceptedAnnotationsInventory, buildMentions } = require("./core/mentions");
const { collectStep11Relations, buildProjectedRelations } = require("./core/projection");
const { buildAssertions } = require("./core/assertions");
const { buildUnresolved, buildDiagnostics } = require("./core/diagnostics");
const { buildWikiTitleEvidenceFromUpstream, buildCoverageDomainMentionIds, buildOutput } = require("./core/output");
const { hasPositiveWikiSignal } = require("./core/mentions");
const { normalizeOptionalString } = require("./core/strings");
const { rejectLegacySlots } = require("./validate/schema");

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
  const tokenIds = new Set();
  for (const token of relationsDoc.tokens) {
    if (token && typeof token.id === "string" && token.id.length > 0) tokenIds.add(token.id);
  }
  for (const annotation of relationsDoc.annotations) {
    if (!annotation || typeof annotation !== "object") continue;
    if (annotation.status !== "accepted") continue;

    if (annotation.kind === "dependency") {
      const headId = annotation && annotation.head && typeof annotation.head.id === "string" ? annotation.head.id : "";
      const depId = annotation && annotation.dep && typeof annotation.dep.id === "string" ? annotation.dep.id : "";
      if (!headId || !depId) {
        throw new Error("runFromRelations accepted dependency annotation is missing head.id or dep.id.");
      }
      if (!tokenIds.has(headId) || !tokenIds.has(depId)) {
        throw new Error("runFromRelations accepted dependency annotation references unknown token id.");
      }
    }

    const selectors =
      annotation &&
      annotation.anchor &&
      Array.isArray(annotation.anchor.selectors)
        ? annotation.anchor.selectors
        : [];
    for (const selector of selectors) {
      if (!selector || typeof selector !== "object") continue;
      if (selector.type === "TokenSelector" && Array.isArray(selector.token_ids)) {
        for (const tokenId of selector.token_ids) {
          if (!tokenIds.has(tokenId)) {
            throw new Error("runFromRelations accepted annotation TokenSelector references unknown token id.");
          }
        }
      }
      if (selector.type === "TextPositionSelector" && selector.span && typeof selector.span === "object") {
        const { start, end } = selector.span;
        if (typeof start !== "number" || typeof end !== "number" || start > end) {
          throw new Error("runFromRelations accepted annotation TextPositionSelector has invalid span.");
        }
      }
    }
  }
  rejectLegacySlots(relationsDoc);
}

function schemaVersionFromRelations(relationsDoc) {
  return typeof relationsDoc.schema_version === "string" && relationsDoc.schema_version.length > 0
    ? relationsDoc.schema_version
    : undefined;
}

function assertMandatoryWtiUpstreamEvidence(relationsSeed) {
  const tokens = Array.isArray(relationsSeed && relationsSeed.tokens) ? relationsSeed.tokens : [];
  let carrierCount = 0;
  let positiveCount = 0;
  for (const token of tokens) {
    if (!token || !token.lexicon || typeof token.lexicon !== "object") continue;
    if (!Object.prototype.hasOwnProperty.call(token.lexicon, "wikipedia_title_index")) continue;
    const carrier = token.lexicon.wikipedia_title_index;
    if (!carrier || typeof carrier !== "object" || Array.isArray(carrier)) {
      throw new Error("WTI evidence missing: linguistic-enricher produced no positive wikipedia_title_index signals.");
    }
    carrierCount += 1;
    if (hasPositiveWikiSignal(carrier)) positiveCount += 1;
  }
  if (carrierCount === 0 || positiveCount === 0) {
    throw new Error("WTI evidence missing: linguistic-enricher produced no positive wikipedia_title_index signals.");
  }
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
  assertMandatoryWtiUpstreamEvidence(relationsSeed);

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
  assertMandatoryWtiUpstreamEvidence,
};
