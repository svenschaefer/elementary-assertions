const { normalizeIds } = require("./determinism");
const { normalizeWikiSurface } = require("./mentions");
const { getTokenWikipediaEvidence, getTokenMetadataProjection } = require("./tokens");

function mentionSurfaceText(mention, tokenById, canonicalText) {
  if (!mention) return "";
  if (mention.span && typeof mention.span.start === "number" && typeof mention.span.end === "number") {
    return String(canonicalText || "").slice(mention.span.start, mention.span.end);
  }
  const tokens = (mention.token_ids || []).map((id) => tokenById.get(id)).filter(Boolean).sort((a, b) => a.i - b.i);
  return tokens.map((t) => t.surface).join(" ");
}

function mergeWikiTitlesInto(target, evidence) {
  if (!target || !evidence || typeof evidence !== "object") return;
  const exactTitles = Array.isArray(evidence.exact_titles) ? evidence.exact_titles : [];
  const prefixTitles = Array.isArray(evidence.prefix_titles) ? evidence.prefix_titles : [];
  for (const title of exactTitles) {
    if (typeof title !== "string") continue;
    if (!target._exactSeen.has(title)) {
      target._exactSeen.add(title);
      target.exact_titles.push(title);
    }
  }
  for (const title of prefixTitles) {
    if (typeof title !== "string") continue;
    if (!target._prefixSeen.has(title)) {
      target._prefixSeen.add(title);
      target.prefix_titles.push(title);
    }
  }
}

function buildWikiTitleEvidenceFromUpstream({ mentions, assertions, tokenById, canonicalText }) {
  const mentionById = new Map((mentions || []).map((m) => [m.id, m]));
  const primaryMentionIds = (mentions || []).filter((m) => m && m.is_primary).map((m) => m.id);
  const predicateMentionIds = (assertions || []).map((a) => a && a.predicate && a.predicate.mention_id).filter(Boolean);
  const targetMentionIds = normalizeIds(primaryMentionIds.concat(predicateMentionIds));

  const byMention = [];
  for (const mentionId of targetMentionIds) {
    const mention = mentionById.get(mentionId);
    if (!mention) continue;
    const aggregate = {
      exact_titles: [],
      prefix_titles: [],
      _exactSeen: new Set(),
      _prefixSeen: new Set(),
    };
    const lexiconEvidence =
      mention.provenance &&
      mention.provenance.lexicon_evidence &&
      typeof mention.provenance.lexicon_evidence === "object"
        ? mention.provenance.lexicon_evidence
        : null;
    if (lexiconEvidence && lexiconEvidence.mwe && typeof lexiconEvidence.mwe === "object") {
      mergeWikiTitlesInto(aggregate, lexiconEvidence.mwe);
    }
    const tokenEvidence = lexiconEvidence && Array.isArray(lexiconEvidence.tokens) ? lexiconEvidence.tokens : [];
    for (const entry of tokenEvidence) {
      if (!entry || !entry.evidence || typeof entry.evidence !== "object") continue;
      mergeWikiTitlesInto(aggregate, entry.evidence);
    }
    const surface = mentionSurfaceText(mention, tokenById, canonicalText);
    byMention.push({
      mention_id: mentionId,
      normalized_surface: normalizeWikiSurface(surface),
      exact_titles: aggregate.exact_titles,
      prefix_titles: aggregate.prefix_titles,
    });
  }
  byMention.sort((a, b) => a.mention_id.localeCompare(b.mention_id));

  const byAssertion = [];
  const byMentionMap = new Map(byMention.map((x) => [x.mention_id, x]));
  for (const a of assertions || []) {
    if (!a || typeof a.id !== "string") continue;
    const m = byMentionMap.get(a.predicate && a.predicate.mention_id);
    if (!m) continue;
    byAssertion.push({
      assertion_id: a.id,
      predicate_mention_id: a.predicate.mention_id,
      exact_titles: Array.isArray(m.exact_titles) ? m.exact_titles : [],
      prefix_titles: Array.isArray(m.prefix_titles) ? m.prefix_titles : [],
    });
  }
  byAssertion.sort((a, b) => a.assertion_id.localeCompare(b.assertion_id));

  return {
    normalization: {
      unicode_form: "NFKC",
      punctuation_map: { apostrophes: "['\\u2018\\u2019\\u02bc]->'", dashes: "[\\u2010-\\u2015]->-" },
      whitespace: "collapse_spaces_trim",
      casefold: "toLowerCase",
    },
    mention_matches: byMention,
    assertion_predicate_matches: byAssertion,
  };
}

function isContentPosTag(tag) {
  if (!tag || typeof tag !== "string") return false;
  return /^(NN|NNS|NNP|NNPS|VB|VBD|VBG|VBN|VBP|VBZ|JJ|JJR|JJS|RB|RBR|RBS|CD|PRP|PRP\$|FW|UH)$/.test(tag);
}

function isPunctuationSurface(surface) {
  if (typeof surface !== "string" || surface.length === 0) return false;
  return /^[\p{P}\p{S}]+$/u.test(surface);
}

function buildCoverageDomainMentionIds(mentions, tokenById) {
  const ids = [];
  for (const m of mentions || []) {
    if (!m.is_primary) continue;
    const headTok = tokenById.get(m.head_token_id);
    if (!headTok) continue;
    const tag = headTok.pos && typeof headTok.pos.tag === "string" ? headTok.pos.tag : "";
    if (!isContentPosTag(tag)) continue;
    if (isPunctuationSurface(headTok.surface)) continue;
    ids.push(m.id);
  }
  return normalizeIds(ids);
}

function buildOutput({
  schemaVersion,
  relationsSeed,
  mentions,
  assertions,
  coveredMentions,
  unresolved,
  sourceInputs,
  pipelineTrace,
  acceptedAnnotations,
  diagnostics,
  projectedBuild,
  wikiTitleEvidence,
}) {
  const tokenById = new Map((relationsSeed.tokens || []).map((t) => [t.id, t]));
  const coverageDomain = new Set(buildCoverageDomainMentionIds(mentions, tokenById));
  const primary = normalizeIds(Array.from(coverageDomain));
  const covered = normalizeIds(Array.from(coveredMentions || []).filter((id) => coverageDomain.has(id)));
  const uncovered = primary.filter((id) => !(coveredMentions || new Set()).has(id));

  const normalizedSegments = (relationsSeed.segments || []).map((s) => ({
    id: s.id,
    span: { start: s.span.start, end: s.span.end },
    token_range: {
      start: s.token_range && typeof s.token_range.start === "number" ? s.token_range.start : 0,
      end: s.token_range && typeof s.token_range.end === "number" ? s.token_range.end : 0,
    },
  }));

  const normalizedTokens = (relationsSeed.tokens || []).map((t) => {
    const wikiEvidence = getTokenWikipediaEvidence(t);
    const tokenMeta = getTokenMetadataProjection(t);
    return {
      id: t.id,
      i: t.i,
      segment_id: t.segment_id,
      span: { start: t.span.start, end: t.span.end },
      surface: t.surface,
      ...(t.pos && typeof t.pos.tag === "string"
        ? { pos: { tag: t.pos.tag, ...(typeof t.pos.coarse === "string" ? { coarse: t.pos.coarse } : {}) } }
        : {}),
      ...tokenMeta,
      ...(wikiEvidence ? { lexicon: { wikipedia_title_index: wikiEvidence } } : {}),
    };
  });

  const out = {
    seed_id: relationsSeed.seed_id,
    stage: "elementary_assertions",
    index_basis: { text_field: "canonical_text", span_unit: "utf16_code_units" },
    canonical_text: relationsSeed.canonical_text,
    segments: normalizedSegments,
    tokens: normalizedTokens,
    mentions,
    assertions,
    relation_projection: {
      all_relations: projectedBuild.all || [],
      projected_relations: (projectedBuild.projected || []).map((r) => ({
        relation_id: r.relation_id,
        label: r.label,
        segment_id: r.segment_id,
        head_token_id: r.head_token_id,
        dep_token_id: r.dep_token_id,
        head_mention_id: r.head_mention_id,
        dep_mention_id: r.dep_mention_id,
      })),
      dropped_relations: projectedBuild.dropped || [],
    },
    accepted_annotations: acceptedAnnotations,
    wiki_title_evidence: wikiTitleEvidence,
    diagnostics,
    coverage: {
      primary_mention_ids: primary,
      covered_primary_mention_ids: covered,
      uncovered_primary_mention_ids: uncovered,
      unresolved,
    },
    sources: {
      inputs: sourceInputs,
      pipeline: pipelineTrace,
    },
  };
  if (typeof schemaVersion === "string" && schemaVersion.length > 0) {
    out.schema_version = schemaVersion;
  }
  return out;
}

function buildCoverageAudit(output) {
  const mentions = Array.isArray(output && output.mentions) ? output.mentions : [];
  const coverage = ((output || {}).coverage) || {};
  const primaryIds = normalizeIds(Array.isArray(coverage.primary_mention_ids) ? coverage.primary_mention_ids : []);
  const coveredIds = new Set(normalizeIds(Array.isArray(coverage.covered_primary_mention_ids) ? coverage.covered_primary_mention_ids : []));
  const assertions = Array.isArray(output && output.assertions) ? output.assertions : [];
  const unresolved = Array.isArray(coverage.unresolved) ? coverage.unresolved : [];
  const suppressed = Array.isArray((((output || {}).diagnostics) || {}).suppressed_assertions)
    ? output.diagnostics.suppressed_assertions
    : [];

  const unresolvedByMention = new Map();
  for (const u of unresolved) {
    if (!u || typeof u.mention_id !== "string") continue;
    unresolvedByMention.set(u.mention_id, String(u.reason || "other"));
  }

  const coveredBy = new Map();
  function addMechanism(mid, mechanism) {
    if (!mid || !mechanism) return;
    if (!coveredBy.has(mid)) coveredBy.set(mid, new Set());
    coveredBy.get(mid).add(mechanism);
  }

  for (const a of assertions) {
    if (!a || typeof a !== "object") continue;
    if (Object.prototype.hasOwnProperty.call(a, "slots")) {
      throw new Error("Invalid input: legacy assertions[*].slots is not supported.");
    }
    const argEntries = Array.isArray(a.arguments) ? a.arguments : [];
    const modEntries = Array.isArray(a.modifiers) ? a.modifiers : [];
    for (const entry of argEntries) for (const mid of entry.mention_ids || []) addMechanism(mid, "slot");
    for (const entry of modEntries) for (const mid of entry.mention_ids || []) addMechanism(mid, "slot");

    for (const op of a.operators || []) {
      const tid = String((op && op.token_id) || "");
      if (!tid) continue;
      for (const m of mentions) {
        if (!m || !primaryIds.includes(m.id)) continue;
        if ((m.token_ids || []).includes(tid)) addMechanism(m.id, "operator");
      }
    }

    const evTokenIds = normalizeIds((((a || {}).evidence) || {}).token_ids || []);
    if (evTokenIds.length > 0) {
      for (const m of mentions) {
        if (!m || !primaryIds.includes(m.id)) continue;
        const hasEvidence = (m.token_ids || []).some((tid) => evTokenIds.includes(tid));
        if (hasEvidence) addMechanism(m.id, "evidence");
      }
    }
  }

  for (const s of suppressed) {
    for (const mid of s.transferred_mention_ids || []) addMechanism(mid, "transfer");
  }

  const primaryMentions = mentions
    .filter((m) => m && primaryIds.includes(m.id))
    .slice()
    .sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));

  return primaryMentions.map((m) => {
    const mechanisms = normalizeIds(Array.from(coveredBy.get(m.id) || []));
    const covered = coveredIds.has(m.id);
    return {
      mention_id: m.id,
      covered,
      covered_by: covered ? mechanisms : [],
      uncovered_reason: covered ? null : (unresolvedByMention.get(m.id) || "other"),
    };
  });
}

module.exports = {
  mentionSurfaceText,
  mergeWikiTitlesInto,
  buildWikiTitleEvidenceFromUpstream,
  isContentPosTag,
  isPunctuationSurface,
  buildCoverageDomainMentionIds,
  buildOutput,
  buildCoverageAudit,
};
