const { failValidation } = require("./errors");
function assertSortedStrings(values, code, message) {
  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i - 1]).localeCompare(String(values[i])) > 0) {
      failValidation(code, message);
    }
  }
}

function buildAssertionMap(doc) {
  return new Map((doc.assertions || []).map((a) => [a && a.id, a]).filter(([id]) => typeof id === "string" && id.length > 0));
}

function buildMentionMap(doc) {
  return new Map((doc.mentions || []).map((m) => [m && m.id, m]).filter(([id]) => typeof id === "string" && id.length > 0));
}

function buildTokenMap(doc) {
  return new Map((doc.tokens || []).map((t) => [t && t.id, t]).filter(([id]) => typeof id === "string" && id.length > 0));
}

function collectAssertionMentionRefs(assertion) {
  const out = new Set();
  for (const entry of (assertion && assertion.arguments) || []) {
    for (const mentionId of (entry && entry.mention_ids) || []) out.add(mentionId);
  }
  for (const entry of (assertion && assertion.modifiers) || []) {
    for (const mentionId of (entry && entry.mention_ids) || []) out.add(mentionId);
  }
  return out;
}

function validateSuppressionEligibility(assertions, assertionById) {
  for (const assertion of assertions || []) {
    const assertionId = String((assertion && assertion.id) || "<unknown>");
    const eligibility = ((((assertion || {}).diagnostics) || {}).suppression_eligibility) || null;
    if (!eligibility || typeof eligibility !== "object") continue;
    const isEligible = Boolean(eligibility.eligible);
    const failureReason = eligibility.failure_reason;
    if (isEligible && failureReason !== null) {
      failValidation(
        "EA_VALIDATE_STRICT_SUPPRESSION_ELIGIBILITY",
        `Strict diagnostics error: assertion ${assertionId} has eligible=true with non-null failure_reason.`
      );
    }
    if (!isEligible && failureReason === null) {
      failValidation(
        "EA_VALIDATE_STRICT_SUPPRESSION_ELIGIBILITY",
        `Strict diagnostics error: assertion ${assertionId} has eligible=false with null failure_reason.`
      );
    }
    if (eligibility.segment_id !== assertion.segment_id) {
      failValidation(
        "EA_VALIDATE_STRICT_SUPPRESSION_ELIGIBILITY",
        `Strict diagnostics error: assertion ${assertionId} suppression_eligibility.segment_id must match assertion.segment_id.`
      );
    }
    if (eligibility.assertion_id !== assertionId) {
      failValidation(
        "EA_VALIDATE_STRICT_SUPPRESSION_ELIGIBILITY",
        `Strict diagnostics error: assertion ${assertionId} suppression_eligibility.assertion_id must match assertion.id.`
      );
    }
    const hostAssertionId = eligibility.chosen_host_assertion_id;
    if (hostAssertionId !== null && (typeof hostAssertionId !== "string" || !assertionById.has(hostAssertionId))) {
      failValidation(
        "EA_VALIDATE_STRICT_SUPPRESSION_ELIGIBILITY",
        `Strict diagnostics error: assertion ${assertionId} suppression_eligibility.chosen_host_assertion_id must reference an existing assertion or be null.`
      );
    }
    for (const key of ["source_non_operator_token_ids", "chosen_host_token_ids", "missing_in_host_token_ids"]) {
      const values = Array.isArray(eligibility[key]) ? eligibility[key] : [];
      assertSortedStrings(
        values,
        "EA_VALIDATE_STRICT_SUPPRESSION_ELIGIBILITY",
        `Strict diagnostics error: assertion ${assertionId} suppression_eligibility.${key} must be sorted.`
      );
    }
    if (failureReason === "no_host" && hostAssertionId !== null) {
      failValidation(
        "EA_VALIDATE_STRICT_SUPPRESSION_ELIGIBILITY",
        `Strict diagnostics error: assertion ${assertionId} with failure_reason=no_host must not set chosen_host_assertion_id.`
      );
    }
  }
}

function validateCoordinationGroups(doc, assertionById) {
  const groups = Array.isArray((((doc || {}).diagnostics) || {}).coordination_groups)
    ? doc.diagnostics.coordination_groups
    : [];
  let prevGroupId = null;
  for (const group of groups) {
    const id = String((group && group.id) || "");
    if (prevGroupId && prevGroupId.localeCompare(id) > 0) {
      failValidation(
        "EA_VALIDATE_STRICT_COORDINATION_ORDER",
        "Strict diagnostics error: diagnostics.coordination_groups must be sorted by id."
      );
    }
    prevGroupId = id;

    const memberIds = Array.isArray(group && group.member_assertion_ids) ? group.member_assertion_ids : [];
    assertSortedStrings(
      memberIds,
      "EA_VALIDATE_STRICT_COORDINATION_MEMBER_ORDER",
      "Strict diagnostics error: diagnostics.coordination_groups[*].member_assertion_ids must be sorted."
    );
    for (const assertionId of memberIds) {
      if (!assertionById.has(assertionId)) {
        failValidation(
          "EA_VALIDATE_STRICT_COORDINATION_REFERENCE",
          `Strict diagnostics error: coordination group ${id} references unknown assertion ${assertionId}.`
        );
      }
    }
  }
}

function validateSubjectRoleGaps(doc, assertionById, mentionById, tokenById) {
  const gaps = Array.isArray((((doc || {}).diagnostics) || {}).subject_role_gaps)
    ? doc.diagnostics.subject_role_gaps
    : [];
  let prevKey = null;
  for (const gap of gaps) {
    const assertionId = String((gap && gap.assertion_id) || "");
    const mentionId = String((gap && gap.predicate_mention_id) || "");
    const headTokenId = String((gap && gap.predicate_head_token_id) || "");
    const segmentId = String((gap && gap.segment_id) || "");

    if (!assertionById.has(assertionId)) {
      failValidation(
        "EA_VALIDATE_STRICT_SUBJECT_GAP_REFERENCE",
        `Strict diagnostics error: subject_role_gaps references unknown assertion ${assertionId}.`
      );
    }
    if (!mentionById.has(mentionId)) {
      failValidation(
        "EA_VALIDATE_STRICT_SUBJECT_GAP_REFERENCE",
        `Strict diagnostics error: subject_role_gaps references unknown mention ${mentionId}.`
      );
    }
    if (!tokenById.has(headTokenId)) {
      failValidation(
        "EA_VALIDATE_STRICT_SUBJECT_GAP_REFERENCE",
        `Strict diagnostics error: subject_role_gaps references unknown head token ${headTokenId}.`
      );
    }

    const key = `${segmentId}|${assertionId}|${mentionId}`;
    if (prevKey && prevKey.localeCompare(key) > 0) {
      failValidation(
        "EA_VALIDATE_STRICT_SUBJECT_GAP_ORDER",
        "Strict diagnostics error: diagnostics.subject_role_gaps must be sorted by segment_id/assertion_id/predicate_mention_id."
      );
    }
    prevKey = key;

    const evidence = gap && gap.evidence && typeof gap.evidence === "object" ? gap.evidence : {};
    const tokenIds = Array.isArray(evidence.token_ids) ? evidence.token_ids : [];
    const upstreamRelationIds = Array.isArray(evidence.upstream_relation_ids) ? evidence.upstream_relation_ids : [];
    assertSortedStrings(
      tokenIds,
      "EA_VALIDATE_STRICT_SUBJECT_GAP_EVIDENCE_ORDER",
      "Strict diagnostics error: diagnostics.subject_role_gaps[*].evidence.token_ids must be sorted."
    );
    assertSortedStrings(
      upstreamRelationIds,
      "EA_VALIDATE_STRICT_SUBJECT_GAP_EVIDENCE_ORDER",
      "Strict diagnostics error: diagnostics.subject_role_gaps[*].evidence.upstream_relation_ids must be sorted."
    );

    const assertion = assertionById.get(assertionId);
    const actorEntries = (assertion && assertion.arguments) || [];
    const actorMentionCount = actorEntries
      .filter((entry) => String((entry && entry.role) || "") === "actor")
      .reduce((count, entry) => count + (((entry && entry.mention_ids) || []).length), 0);
    if (actorMentionCount > 0) {
      failValidation(
        "EA_VALIDATE_STRICT_SUBJECT_GAP_ACTOR_CONSISTENCY",
        `Strict diagnostics error: subject_role_gap assertion ${assertionId} must not contain actor role entries.`
      );
    }
  }
}

function validateFragmentation(doc) {
  const fragmentation = (((doc || {}).diagnostics) || {}).fragmentation;
  if (!fragmentation || typeof fragmentation !== "object") return;
  const perSegment = Array.isArray(fragmentation.per_segment) ? fragmentation.per_segment : [];
  let prevSegmentId = null;
  for (const row of perSegment) {
    const segmentId = String((row && row.segment_id) || "");
    if (prevSegmentId && prevSegmentId.localeCompare(segmentId) > 0) {
      failValidation(
        "EA_VALIDATE_STRICT_FRAGMENTATION_ORDER",
        "Strict diagnostics error: diagnostics.fragmentation.per_segment must be sorted by segment_id."
      );
    }
    prevSegmentId = segmentId;
  }
}

function validateGapSignals(doc) {
  const gapSignals = (((doc || {}).diagnostics) || {}).gap_signals;
  if (!gapSignals || typeof gapSignals !== "object") return;
  for (const key of ["coordination_type_missing", "comparative_gap", "quantifier_scope_gap"]) {
    if (typeof gapSignals[key] !== "boolean") {
      failValidation(
        "EA_VALIDATE_STRICT_GAP_SIGNALS",
        `Strict diagnostics error: diagnostics.gap_signals.${key} must be boolean when gap_signals is present.`
      );
    }
  }
}

function validateSuppressedAssertionsStrict(doc, assertionById) {
  const suppressed = Array.isArray((((doc || {}).diagnostics) || {}).suppressed_assertions)
    ? doc.diagnostics.suppressed_assertions
    : [];
  for (const item of suppressed) {
    const suppressedId = String((item && item.id) || "");
    const predicate = item && item.predicate && typeof item.predicate === "object" ? item.predicate : {};
    const diagnostics = item && item.diagnostics && typeof item.diagnostics === "object" ? item.diagnostics : {};
    const suppressedBy = diagnostics && diagnostics.suppressed_by && typeof diagnostics.suppressed_by === "object"
      ? diagnostics.suppressed_by
      : {};
    const targetAssertionId = String(suppressedBy.target_assertion_id || "");
    const targetAssertion = assertionById.get(targetAssertionId);
    const targetPredicateHeadTokenId = String(((((targetAssertion || {}).predicate) || {}).head_token_id) || "");
    const sourcePredicateHeadTokenId = String(predicate.head_token_id || "");
    const reason = String(suppressedBy.reason || "");

    if (Object.prototype.hasOwnProperty.call(item || {}, "suppressed_assertion_id")) {
      if (item.suppressed_assertion_id !== suppressedId) {
        failValidation(
          "EA_VALIDATE_STRICT_SUPPRESSED_SEMANTICS",
          `Strict diagnostics error: suppressed assertion ${suppressedId} has mismatching suppressed_assertion_id.`
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(item || {}, "host_assertion_id")) {
      if (item.host_assertion_id !== targetAssertionId) {
        failValidation(
          "EA_VALIDATE_STRICT_SUPPRESSED_SEMANTICS",
          `Strict diagnostics error: suppressed assertion ${suppressedId} host_assertion_id must match diagnostics.suppressed_by.target_assertion_id.`
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(item || {}, "reason")) {
      if (item.reason !== reason) {
        failValidation(
          "EA_VALIDATE_STRICT_SUPPRESSED_SEMANTICS",
          `Strict diagnostics error: suppressed assertion ${suppressedId} top-level reason must match diagnostics.suppressed_by.reason.`
        );
      }
    }

    const suppressedByEvidence = suppressedBy && suppressedBy.evidence && typeof suppressedBy.evidence === "object"
      ? suppressedBy.evidence
      : {};
    const topLevelEvidence = item && item.evidence && typeof item.evidence === "object" ? item.evidence : {};
    const suppressedByTokenIds = Array.isArray(suppressedByEvidence.token_ids) ? suppressedByEvidence.token_ids : [];
    const topLevelTokenIds = Array.isArray(topLevelEvidence.token_ids) ? topLevelEvidence.token_ids : [];
    const transferredBuckets = Array.isArray(item && item.transferred_buckets) ? item.transferred_buckets : [];
    const transferredMentionIds = Array.isArray(item && item.transferred_mention_ids) ? item.transferred_mention_ids : [];

    assertSortedStrings(
      suppressedByTokenIds,
      "EA_VALIDATE_STRICT_SUPPRESSED_SEMANTICS",
      `Strict diagnostics error: suppressed assertion ${suppressedId} suppressed_by.evidence.token_ids must be sorted.`
    );
    assertSortedStrings(
      topLevelTokenIds,
      "EA_VALIDATE_STRICT_SUPPRESSED_SEMANTICS",
      `Strict diagnostics error: suppressed assertion ${suppressedId} evidence.token_ids must be sorted.`
    );
    assertSortedStrings(
      transferredBuckets,
      "EA_VALIDATE_STRICT_SUPPRESSED_SEMANTICS",
      `Strict diagnostics error: suppressed assertion ${suppressedId} transferred_buckets must be sorted.`
    );
    assertSortedStrings(
      transferredMentionIds,
      "EA_VALIDATE_STRICT_SUPPRESSED_SEMANTICS",
      `Strict diagnostics error: suppressed assertion ${suppressedId} transferred_mention_ids must be sorted.`
    );

    const reasonsRequiringHeadEvidence = new Set([
      "modality_moved_to_lexical",
      "role_carrier_suppressed",
      "role_carrier_suppressed_v2_nominal",
      "copula_bucket_sink_suppressed",
    ]);
    if (reasonsRequiringHeadEvidence.has(reason)) {
      if (suppressedByTokenIds.length < 2) {
        failValidation(
          "EA_VALIDATE_STRICT_SUPPRESSED_SEMANTICS",
          `Strict diagnostics error: suppressed assertion ${suppressedId} reason=${reason} requires token_ids evidence with source/target predicate tokens.`
        );
      }
      if (!suppressedByTokenIds.includes(sourcePredicateHeadTokenId) || !suppressedByTokenIds.includes(targetPredicateHeadTokenId)) {
        failValidation(
          "EA_VALIDATE_STRICT_SUPPRESSED_SEMANTICS",
          `Strict diagnostics error: suppressed assertion ${suppressedId} reason=${reason} token_ids evidence must include source and target predicate head tokens.`
        );
      }
    }

    if (reason === "role_carrier_suppressed_v2_nominal") {
      if (String(item && item.predicate_class) !== "nominal_head") {
        failValidation(
          "EA_VALIDATE_STRICT_SUPPRESSED_SEMANTICS",
          `Strict diagnostics error: suppressed assertion ${suppressedId} reason=role_carrier_suppressed_v2_nominal requires predicate_class=nominal_head.`
        );
      }
    }

    if (reason === "copula_bucket_sink_suppressed") {
      const predicateClass = String(item && item.predicate_class);
      if (predicateClass !== "copula" && predicateClass !== "auxiliary") {
        failValidation(
          "EA_VALIDATE_STRICT_SUPPRESSED_SEMANTICS",
          `Strict diagnostics error: suppressed assertion ${suppressedId} reason=copula_bucket_sink_suppressed requires predicate_class copula|auxiliary.`
        );
      }
    }

    if (reason === "role_carrier_suppressed_v2_nominal" || reason === "copula_bucket_sink_suppressed") {
      if (!Array.isArray(item && item.transferred_buckets) || !Array.isArray(item && item.transferred_mention_ids)) {
        failValidation(
          "EA_VALIDATE_STRICT_SUPPRESSED_SEMANTICS",
          `Strict diagnostics error: suppressed assertion ${suppressedId} reason=${reason} requires transferred_buckets and transferred_mention_ids arrays.`
        );
      }
      const hostMentionRefs = targetAssertion ? collectAssertionMentionRefs(targetAssertion) : new Set();
      for (const mentionId of transferredMentionIds) {
        if (!hostMentionRefs.has(mentionId)) {
          failValidation(
            "EA_VALIDATE_STRICT_SUPPRESSED_SEMANTICS",
            `Strict diagnostics error: suppressed assertion ${suppressedId} transferred mention ${mentionId} must exist in host assertion mention refs.`
          );
        }
      }
    }
  }
}

function validateDiagnosticsStrict(doc) {
  const assertionById = buildAssertionMap(doc);
  const mentionById = buildMentionMap(doc);
  const tokenById = buildTokenMap(doc);
  const warnings = Array.isArray((((doc || {}).diagnostics) || {}).warnings) ? doc.diagnostics.warnings : [];
  assertSortedStrings(
    warnings,
    "EA_VALIDATE_STRICT_WARNING_ORDER",
    "Strict diagnostics error: diagnostics.warnings must be sorted."
  );

  validateSuppressionEligibility(doc.assertions || [], assertionById);
  validateFragmentation(doc);
  validateGapSignals(doc);
  validateCoordinationGroups(doc, assertionById);
  validateSubjectRoleGaps(doc, assertionById, mentionById, tokenById);
  validateSuppressedAssertionsStrict(doc, assertionById);
}

module.exports = {
  validateDiagnosticsStrict,
};
