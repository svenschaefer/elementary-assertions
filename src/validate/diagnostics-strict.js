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

function validateSuppressionEligibility(assertions) {
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
  for (const gap of gaps) {
    const assertionId = String((gap && gap.assertion_id) || "");
    const mentionId = String((gap && gap.predicate_mention_id) || "");
    const headTokenId = String((gap && gap.predicate_head_token_id) || "");

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

  validateSuppressionEligibility(doc.assertions || []);
  validateCoordinationGroups(doc, assertionById);
  validateSubjectRoleGaps(doc, assertionById, mentionById, tokenById);
}

module.exports = {
  validateDiagnosticsStrict,
};
