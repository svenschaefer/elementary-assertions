const { ensureSortedStrings } = require("./determinism");

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
      throw new Error(`Integrity error: coverage.covered_primary_mention_ids contains non-primary mention ${id}.`);
    }
  }
  for (const id of uncoveredSet) {
    if (!primarySet.has(id)) {
      throw new Error(`Integrity error: coverage.uncovered_primary_mention_ids contains non-primary mention ${id}.`);
    }
  }
  for (const id of primarySet) {
    const isCovered = coveredSet.has(id);
    const isUncovered = uncoveredSet.has(id);
    if (isCovered === isUncovered) {
      throw new Error(`Integrity error: primary mention ${id} must appear in exactly one of covered or uncovered.`);
    }
  }

  const unresolvedMentionIds = [];
  for (const item of unresolved) {
    if (!item || typeof item.mention_id !== "string" || !mentionById.has(item.mention_id)) {
      throw new Error("Integrity error: coverage.unresolved references unknown mention.");
    }
    unresolvedMentionIds.push(item.mention_id);
  }
  if (new Set(unresolvedMentionIds).size !== unresolvedMentionIds.length) {
    throw new Error("Integrity error: coverage.unresolved contains duplicate mention_id entries.");
  }
  if (unresolvedMentionIds.length !== uncoveredSet.size) {
    throw new Error("Integrity error: coverage.unresolved length must match uncovered_primary_mention_ids length.");
  }
  for (const mentionId of unresolvedMentionIds) {
    if (!uncoveredSet.has(mentionId)) {
      throw new Error(`Integrity error: coverage.unresolved mention ${mentionId} must be in uncovered_primary_mention_ids.`);
    }
  }
}

module.exports = {
  validateCoverage,
};
