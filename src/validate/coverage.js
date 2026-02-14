const { ensureSortedStrings } = require("./determinism");
const { failValidation } = require("./errors");

function validateCoverage(doc, mentionById) {
  const coverage = doc.coverage || {};
  const primary = Array.isArray(coverage.primary_mention_ids) ? coverage.primary_mention_ids : [];
  const covered = Array.isArray(coverage.covered_primary_mention_ids) ? coverage.covered_primary_mention_ids : [];
  const uncovered = Array.isArray(coverage.uncovered_primary_mention_ids) ? coverage.uncovered_primary_mention_ids : [];
  const unresolved = Array.isArray(coverage.unresolved) ? coverage.unresolved : [];

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
}

module.exports = {
  validateCoverage,
};
