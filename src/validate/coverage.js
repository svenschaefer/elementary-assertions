const { ensureSortedStrings } = require("./determinism");
const { failValidation } = require("./errors");

function isContentPosTag(tag) {
  if (typeof tag !== "string" || tag.length === 0) return false;
  return /^(NN|NNS|NNP|NNPS|VB|VBD|VBG|VBN|VBP|VBZ|JJ|JJR|JJS|RB|RBR|RBS|CD|PRP|PRP\$|FW|UH)$/.test(tag);
}

function isPunctuationSurface(surface) {
  if (typeof surface !== "string" || surface.length === 0) return false;
  return /^[\p{P}\p{S}]+$/u.test(surface);
}

function buildExpectedCoveragePrimarySet(doc) {
  const tokenById = new Map((doc.tokens || []).map((token) => [token.id, token]));
  const expected = new Set();
  for (const mention of doc.mentions || []) {
    if (!mention || mention.is_primary !== true || typeof mention.id !== "string" || mention.id.length === 0) continue;
    const headToken = tokenById.get(mention.head_token_id);
    if (!headToken) continue;
    const tag = headToken.pos && typeof headToken.pos.tag === "string" ? headToken.pos.tag : "";
    if (!isContentPosTag(tag)) continue;
    if (isPunctuationSurface(headToken.surface)) continue;
    expected.add(mention.id);
  }
  return expected;
}

function validateCoverage(doc, mentionById, options = {}) {
  const coverage = doc.coverage || {};
  const primary = Array.isArray(coverage.primary_mention_ids) ? coverage.primary_mention_ids : [];
  const covered = Array.isArray(coverage.covered_primary_mention_ids) ? coverage.covered_primary_mention_ids : [];
  const uncovered = Array.isArray(coverage.uncovered_primary_mention_ids) ? coverage.uncovered_primary_mention_ids : [];
  const unresolved = Array.isArray(coverage.unresolved) ? coverage.unresolved : [];
  const tokenById = new Map((doc.tokens || []).map((token) => [token && token.id, token]));

  ensureSortedStrings(primary, "coverage.primary_mention_ids must be sorted for determinism.");
  ensureSortedStrings(covered, "coverage.covered_primary_mention_ids must be sorted for determinism.");
  ensureSortedStrings(uncovered, "coverage.uncovered_primary_mention_ids must be sorted for determinism.");

  const primarySet = new Set(primary);
  const coveredSet = new Set(covered);
  const uncoveredSet = new Set(uncovered);

  for (const id of coveredSet) {
    if (!primarySet.has(id)) {
      failValidation("EA_VALIDATE_COVERAGE_NON_PRIMARY_COVERED", `Integrity error: coverage.covered_primary_mention_ids contains non-primary mention ${id}.`);
    }
  }
  for (const id of uncoveredSet) {
    if (!primarySet.has(id)) {
      failValidation("EA_VALIDATE_COVERAGE_NON_PRIMARY_UNCOVERED", `Integrity error: coverage.uncovered_primary_mention_ids contains non-primary mention ${id}.`);
    }
  }
  for (const id of primarySet) {
    const isCovered = coveredSet.has(id);
    const isUncovered = uncoveredSet.has(id);
    if (isCovered === isUncovered) {
      failValidation("EA_VALIDATE_COVERAGE_PARTITION", `Integrity error: primary mention ${id} must appear in exactly one of covered or uncovered.`);
    }
  }

  const unresolvedMentionIds = [];
  for (const item of unresolved) {
    if (!item || typeof item.mention_id !== "string" || !mentionById.has(item.mention_id)) {
      failValidation("EA_VALIDATE_COVERAGE_UNKNOWN_UNRESOLVED_MENTION", "Integrity error: coverage.unresolved references unknown mention.");
    }
    unresolvedMentionIds.push(item.mention_id);
  }
  if (new Set(unresolvedMentionIds).size !== unresolvedMentionIds.length) {
    failValidation("EA_VALIDATE_COVERAGE_DUPLICATE_UNRESOLVED", "Integrity error: coverage.unresolved contains duplicate mention_id entries.");
  }
  if (unresolvedMentionIds.length !== uncoveredSet.size) {
    failValidation("EA_VALIDATE_COVERAGE_UNRESOLVED_LENGTH", "Integrity error: coverage.unresolved length must match uncovered_primary_mention_ids length.");
  }
  for (const mentionId of unresolvedMentionIds) {
    if (!uncoveredSet.has(mentionId)) {
      failValidation("EA_VALIDATE_COVERAGE_UNRESOLVED_MEMBERSHIP", `Integrity error: coverage.unresolved mention ${mentionId} must be in uncovered_primary_mention_ids.`);
    }
  }

  if (options && options.strict) {
    for (const item of unresolved) {
      const mentionId = String((item && item.mention_id) || "");
      const unresolvedSegmentId = String((item && item.segment_id) || "");
      const unresolvedMention = mentionById.get(mentionId);
      if (unresolvedMention && unresolvedMention.segment_id !== unresolvedSegmentId) {
        failValidation(
          "EA_VALIDATE_STRICT_UNRESOLVED_SEGMENT_MISMATCH",
          "Strict validation error: coverage.unresolved[*].segment_id must match referenced mention/token segments."
        );
      }
      const mentionIds = Array.isArray(item && item.mention_ids) ? item.mention_ids : null;
      if (!Array.isArray(mentionIds)) {
        failValidation(
          "EA_VALIDATE_STRICT_UNRESOLVED_MENTION_IDS",
          "Strict validation error: coverage.unresolved[*].mention_ids must be an array."
        );
      }
      const mentionIdSet = new Set();
      let prevMentionRef = null;
      for (const ref of mentionIds) {
        if (typeof ref !== "string" || ref.length === 0) {
          failValidation(
            "EA_VALIDATE_STRICT_UNRESOLVED_MENTION_IDS",
            "Strict validation error: coverage.unresolved[*].mention_ids must contain non-empty string ids."
          );
        }
        if (prevMentionRef !== null && prevMentionRef.localeCompare(ref) > 0) {
          failValidation(
            "EA_VALIDATE_STRICT_UNRESOLVED_MENTION_IDS",
            "Strict validation error: coverage.unresolved[*].mention_ids must be sorted."
          );
        }
        if (mentionIdSet.has(ref)) {
          failValidation(
            "EA_VALIDATE_STRICT_UNRESOLVED_MENTION_IDS",
            "Strict validation error: coverage.unresolved[*].mention_ids must be unique."
          );
        }
        const mention = mentionById.get(ref);
        if (!mention) {
          failValidation(
            "EA_VALIDATE_STRICT_UNRESOLVED_MENTION_REFERENCE",
            "Strict validation error: coverage.unresolved[*].mention_ids must reference existing mentions."
          );
        }
        if (mention.segment_id !== unresolvedSegmentId) {
          failValidation(
            "EA_VALIDATE_STRICT_UNRESOLVED_SEGMENT_MISMATCH",
            "Strict validation error: coverage.unresolved[*].segment_id must match referenced mention/token segments."
          );
        }
        mentionIdSet.add(ref);
        prevMentionRef = ref;
      }
      if (mentionId && !mentionIdSet.has(mentionId)) {
        failValidation(
          "EA_VALIDATE_STRICT_UNRESOLVED_MENTION_IDS",
          "Strict validation error: coverage.unresolved[*].mention_ids must include mention_id."
        );
      }

      const evidence = item && item.evidence && typeof item.evidence === "object" ? item.evidence : {};
      const tokenIds = Array.isArray(evidence.token_ids) ? evidence.token_ids : [];
      let prevTokenId = null;
      for (const tokenId of tokenIds) {
        if (typeof tokenId !== "string" || tokenId.length === 0) {
          failValidation(
            "EA_VALIDATE_STRICT_UNRESOLVED_EVIDENCE_TOKEN_IDS",
            "Strict validation error: coverage.unresolved[*].evidence.token_ids must contain non-empty string token ids."
          );
        }
        const token = tokenById.get(tokenId);
        if (!token) {
          failValidation(
            "EA_VALIDATE_STRICT_UNRESOLVED_EVIDENCE_TOKEN_REFERENCE",
            "Strict validation error: coverage.unresolved[*].evidence.token_ids must reference existing tokens."
          );
        }
        if (token.segment_id !== unresolvedSegmentId) {
          failValidation(
            "EA_VALIDATE_STRICT_UNRESOLVED_SEGMENT_MISMATCH",
            "Strict validation error: coverage.unresolved[*].segment_id must match referenced mention/token segments."
          );
        }
        if (prevTokenId !== null && prevTokenId.localeCompare(tokenId) > 0) {
          failValidation(
            "EA_VALIDATE_STRICT_UNRESOLVED_EVIDENCE_TOKEN_IDS",
            "Strict validation error: coverage.unresolved[*].evidence.token_ids must be sorted."
          );
        }
        prevTokenId = tokenId;
      }

      const upstreamRelationIds = Array.isArray(evidence.upstream_relation_ids) ? evidence.upstream_relation_ids : [];
      let prevUpstreamId = null;
      for (const relationId of upstreamRelationIds) {
        if (typeof relationId !== "string" || relationId.length === 0) {
          failValidation(
            "EA_VALIDATE_STRICT_UNRESOLVED_UPSTREAM_RELATION_IDS",
            "Strict validation error: coverage.unresolved[*].evidence.upstream_relation_ids must contain non-empty string ids."
          );
        }
        if (prevUpstreamId !== null && prevUpstreamId.localeCompare(relationId) > 0) {
          failValidation(
            "EA_VALIDATE_STRICT_UNRESOLVED_UPSTREAM_RELATION_IDS",
            "Strict validation error: coverage.unresolved[*].evidence.upstream_relation_ids must be sorted."
          );
        }
        prevUpstreamId = relationId;
      }
    }

    const expectedPrimary = buildExpectedCoveragePrimarySet(doc);
    if (expectedPrimary.size !== primarySet.size) {
      failValidation(
        "EA_VALIDATE_STRICT_COVERAGE_PRIMARY_SET",
        "Strict validation error: coverage.primary_mention_ids must equal the derived domain-primary mention set."
      );
    }
    for (const mentionId of expectedPrimary) {
      if (!primarySet.has(mentionId)) {
        failValidation(
          "EA_VALIDATE_STRICT_COVERAGE_PRIMARY_SET",
          "Strict validation error: coverage.primary_mention_ids must equal the derived domain-primary mention set."
        );
      }
    }
  }
}

module.exports = {
  validateCoverage,
};
