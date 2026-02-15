const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const { parseArgs, resolveArtifactsRoot, resolveSeedIds } = require("./dev-artifacts");

const FRAGMENT_CARRIER_CLASSES = new Set(["preposition", "auxiliary", "nominal_head"]);

function readDoc(artifactsRoot, seedId) {
  const yamlPath = path.join(artifactsRoot, seedId, "result-reference", "seed.elementary-assertions.yaml");
  return yaml.load(fs.readFileSync(yamlPath, "utf8"));
}

function normalizeIds(xs) {
  return Array.from(new Set((xs || []).filter((x) => typeof x === "string" && x.length > 0))).sort((a, b) => a.localeCompare(b));
}

function isLexicalHost(host) {
  return String((((host || {}).diagnostics) || {}).predicate_class || "") === "lexical_verb";
}

function tokenIndexById(doc) {
  const out = new Map();
  for (const t of (doc && doc.tokens) || []) {
    if (!t || typeof t.id !== "string") continue;
    const i = Number(t.i);
    if (Number.isFinite(i)) out.set(t.id, i);
  }
  return out;
}

function isClauseBoundaryToken(token) {
  const surface = String((token && token.surface) || "").toLowerCase();
  return surface === "." || surface === "," || surface === ";" || surface === ":" || surface === "!" || surface === "?";
}

function tokensBySegment(doc) {
  const out = new Map();
  for (const t of (doc && doc.tokens) || []) {
    if (!t || typeof t.segment_id !== "string") continue;
    if (!out.has(t.segment_id)) out.set(t.segment_id, []);
    out.get(t.segment_id).push(t);
  }
  for (const arr of out.values()) {
    arr.sort((a, b) => Number(a.i) - Number(b.i));
  }
  return out;
}

function assertionClauseWindowKey(assertion, segTokensById) {
  const segmentId = String((assertion && assertion.segment_id) || "");
  const predTokenId = String((((assertion || {}).predicate) || {}).head_token_id || "");
  if (!segmentId || !predTokenId) return `${segmentId}|window:unknown`;
  const segTokens = segTokensById.get(segmentId) || [];
  const idx = segTokens.findIndex((t) => t && t.id === predTokenId);
  if (idx < 0) return `${segmentId}|window:unknown`;
  let left = idx;
  let right = idx;
  while (left - 1 >= 0 && !isClauseBoundaryToken(segTokens[left - 1])) left -= 1;
  while (right + 1 < segTokens.length && !isClauseBoundaryToken(segTokens[right + 1])) right += 1;
  const leftToken = segTokens[left];
  const rightToken = segTokens[right];
  return `${segmentId}|${leftToken ? leftToken.id : String(left)}|${rightToken ? rightToken.id : String(right)}`;
}

function hasEvidenceContainment(source, host) {
  const sourceOps = Array.isArray(source && source.operators) ? source.operators : [];
  const sourceEvidenceTokenIds = normalizeIds(((((source || {}).evidence) || {}).token_ids || []));
  const sourceOperatorTokenIds = new Set(sourceOps.map((op) => String((op && op.token_id) || "")).filter((id) => id.length > 0));
  const sourceEvidenceNonOperator = sourceEvidenceTokenIds.filter((id) => !sourceOperatorTokenIds.has(id));
  const hostEvidence = new Set(normalizeIds(((((host || {}).evidence) || {}).token_ids || [])));
  return sourceEvidenceNonOperator.every((id) => hostEvidence.has(id));
}

function hasCoreRoles(assertion) {
  const argumentsEntries = Array.isArray((assertion || {}).arguments) ? assertion.arguments : [];
  for (const entry of argumentsEntries) {
    const role = String((entry && entry.role) || "");
    const mentionIds = Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : [];
    if (!mentionIds.length) continue;
    if (role === "actor" || role === "theme" || role === "attribute" || role === "topic" || role === "location") {
      return true;
    }
  }
  return false;
}

function buildSeedReport(doc, seedId) {
  const assertions = Array.isArray(doc && doc.assertions) ? doc.assertions.slice() : [];
  assertions.sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
  const segTokensById = tokensBySegment(doc);
  const clauseKeyByAssertionId = new Map(assertions.map((a) => [String(a.id || ""), assertionClauseWindowKey(a, segTokensById)]));
  const bySegment = new Map();
  for (const a of assertions) {
    const seg = String((a && a.segment_id) || "");
    if (!seg) continue;
    if (!bySegment.has(seg)) bySegment.set(seg, []);
    bySegment.get(seg).push(a);
  }

  const warningBySegment = new Map();
  const perSegment = Array.isArray((((doc || {}).diagnostics || {}).fragmentation || {}).per_segment)
    ? doc.diagnostics.fragmentation.per_segment
    : [];
  for (const x of perSegment) {
    const sid = String((x && x.segment_id) || "");
    if (!sid) continue;
    warningBySegment.set(sid, Boolean(x && x.clause_fragmentation_warning === true));
  }

  const tokenIndex = tokenIndexById(doc);
  const segments = Array.from(bySegment.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((segmentId) => {
      const segAssertions = bySegment.get(segmentId) || [];
      const fragmentAssertions = segAssertions
        .filter((a) => Boolean((((a || {}).diagnostics) || {}).structural_fragment === true))
        .sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
      const fragmentAssertionIds = fragmentAssertions.map((a) => a.id);

      const countMap = new Map();
      for (const a of fragmentAssertions) {
        const cls = String((((a || {}).diagnostics) || {}).predicate_class || "");
        countMap.set(cls, (countMap.get(cls) || 0) + 1);
      }
      const predicateClassCounts = Array.from(countMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([predicate_class, count]) => ({ predicate_class, count }));

      const carriers = fragmentAssertions
        .filter((a) => FRAGMENT_CARRIER_CLASSES.has(String((((a || {}).diagnostics) || {}).predicate_class || "")))
        .map((source) => {
          const sourceClass = String((((source || {}).diagnostics) || {}).predicate_class || "");
          const sourceI = tokenIndex.get(String((((source || {}).predicate) || {}).head_token_id || ""));
          const hosts = segAssertions
            .filter((h) => {
              if (!h || h.id === source.id || !isLexicalHost(h)) return false;
              return clauseKeyByAssertionId.get(String(h.id || "")) === clauseKeyByAssertionId.get(String(source.id || ""));
            })
            .map((h) => ({ id: String(h.id || ""), i: tokenIndex.get(String((((h || {}).predicate) || {}).head_token_id || "")), host: h }))
            .sort((a, b) => {
              const da = Number.isFinite(sourceI) && Number.isFinite(a.i) ? Math.abs(sourceI - a.i) : Number.MAX_SAFE_INTEGER;
              const db = Number.isFinite(sourceI) && Number.isFinite(b.i) ? Math.abs(sourceI - b.i) : Number.MAX_SAFE_INTEGER;
              if (da !== db) return da - db;
              return a.id.localeCompare(b.id);
            });
          const hasClauseHost = hosts.length > 0;
          const clauseContainmentPass = hasClauseHost && hosts.some((h) => hasEvidenceContainment(source, h.host));
          let failureReason = null;
          if (hasCoreRoles(source)) failureReason = "has_core_roles";
          else if (!hasClauseHost) failureReason = "no_host";
          else if (!clauseContainmentPass) failureReason = "no_containment";
          return {
            assertion_id: String(source.id || ""),
            predicate_class: sourceClass,
            has_clause_local_lexical_host: hasClauseHost,
            evidence_containment_pass: clauseContainmentPass,
            failure_reason: failureReason,
          };
        })
        .sort((a, b) => a.assertion_id.localeCompare(b.assertion_id));

      return {
        segment_id: segmentId,
        clause_fragmentation_warning: warningBySegment.get(segmentId) === true,
        fragment_assertion_ids: fragmentAssertionIds,
        predicate_class_counts: predicateClassCounts,
        carrier_diagnostics: carriers,
      };
    });

  return {
    seed_id: seedId,
    structural_fragment_count: Number((((doc || {}).diagnostics || {}).fragmentation || {}).structural_fragment_count || 0),
    segments,
  };
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const args = parseArgs(process.argv);
  const artifactsRoot = resolveArtifactsRoot(repoRoot, args);
  const seedIds = resolveSeedIds(artifactsRoot, args);
  const rows = seedIds.map((seedId) => buildSeedReport(readDoc(artifactsRoot, seedId), seedId));
  process.stdout.write(`${JSON.stringify({ generated_at: new Date().toISOString(), seeds: rows }, null, 2)}\n`);
}

main();
