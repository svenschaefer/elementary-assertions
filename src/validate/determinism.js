const { failValidation } = require("./errors");

function isSortedStrings(arr) {
  for (let i = 1; i < arr.length; i += 1) {
    if (String(arr[i - 1]).localeCompare(String(arr[i])) > 0) return false;
  }
  return true;
}

function ensureSortedStrings(arr, message) {
  if (!isSortedStrings(arr || [])) {
    failValidation("EA_VALIDATE_DETERMINISM_SORT", `Integrity error: ${message}`);
  }
}

function relationEvidenceSortKey(ev) {
  return [
    String((ev && ev.from_token_id) || ""),
    String((ev && ev.to_token_id) || ""),
    String((ev && ev.label) || ""),
    String((ev && (ev.relation_id || ev.annotation_id)) || ""),
    JSON.stringify(ev || {}),
  ].join("|");
}

function argumentRolePriority(role) {
  const r = String(role || "");
  if (r === "actor") return 0;
  if (r === "patient") return 1;
  if (r === "location") return 2;
  if (r === "theme") return 3;
  if (r === "attribute") return 4;
  if (r === "topic") return 5;
  return 10;
}

function modifierRolePriority(role) {
  const r = String(role || "");
  if (r === "recipient") return 0;
  if (r === "modifier") return 1;
  return 10;
}

function roleEntrySortKey(entry, priorityFn) {
  const role = String((entry && entry.role) || "");
  const mentionIds = Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : [];
  const evidence = entry && entry.evidence && typeof entry.evidence === "object" ? entry.evidence : {};
  const relationIds = Array.isArray(evidence.relation_ids) ? evidence.relation_ids : [];
  const tokenIds = Array.isArray(evidence.token_ids) ? evidence.token_ids : [];
  const priority = String(priorityFn(role)).padStart(2, "0");
  return `${priority}|${role}|${JSON.stringify(mentionIds)}|${JSON.stringify(relationIds)}|${JSON.stringify(tokenIds)}`;
}

function validateAssertionDeterminism(assertion, assertionId) {
  const evidence = assertion && assertion.evidence && typeof assertion.evidence === "object" ? assertion.evidence : {};
  const evidenceTokenIds = Array.isArray(evidence.token_ids) ? evidence.token_ids : [];
  ensureSortedStrings(evidenceTokenIds, `assertion ${assertionId} evidence.token_ids must be sorted for determinism.`);

  const relationEvidence = Array.isArray(evidence.relation_evidence) ? evidence.relation_evidence : [];
  for (let i = 1; i < relationEvidence.length; i += 1) {
    const prev = relationEvidenceSortKey(relationEvidence[i - 1]);
    const cur = relationEvidenceSortKey(relationEvidence[i]);
    if (prev.localeCompare(cur) > 0) {
      failValidation("EA_VALIDATE_DETERMINISM_RELATION_EVIDENCE_ORDER", `Integrity error: assertion ${assertionId} evidence.relation_evidence must be sorted for determinism.`);
    }
  }

  for (const entry of assertion.arguments || []) {
    const mids = Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : [];
    ensureSortedStrings(mids, `assertion ${assertionId} arguments[*].mention_ids must be sorted for determinism.`);
    const entryEvidence = entry && entry.evidence && typeof entry.evidence === "object" ? entry.evidence : {};
    ensureSortedStrings(entryEvidence.relation_ids || [], `assertion ${assertionId} arguments[*].evidence.relation_ids must be sorted for determinism.`);
    ensureSortedStrings(entryEvidence.token_ids || [], `assertion ${assertionId} arguments[*].evidence.token_ids must be sorted for determinism.`);
  }

  for (const entry of assertion.modifiers || []) {
    const mids = Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : [];
    ensureSortedStrings(mids, `assertion ${assertionId} modifiers[*].mention_ids must be sorted for determinism.`);
    const entryEvidence = entry && entry.evidence && typeof entry.evidence === "object" ? entry.evidence : {};
    ensureSortedStrings(entryEvidence.relation_ids || [], `assertion ${assertionId} modifiers[*].evidence.relation_ids must be sorted for determinism.`);
    ensureSortedStrings(entryEvidence.token_ids || [], `assertion ${assertionId} modifiers[*].evidence.token_ids must be sorted for determinism.`);
  }

  for (let i = 1; i < assertion.arguments.length; i += 1) {
    const prev = roleEntrySortKey(assertion.arguments[i - 1], argumentRolePriority);
    const cur = roleEntrySortKey(assertion.arguments[i], argumentRolePriority);
    if (prev.localeCompare(cur) > 0) {
      failValidation("EA_VALIDATE_DETERMINISM_ARGUMENT_ORDER", `Integrity error: assertion ${assertionId} arguments must be sorted for determinism.`);
    }
  }
  for (let i = 1; i < assertion.modifiers.length; i += 1) {
    const prev = roleEntrySortKey(assertion.modifiers[i - 1], modifierRolePriority);
    const cur = roleEntrySortKey(assertion.modifiers[i], modifierRolePriority);
    if (prev.localeCompare(cur) > 0) {
      failValidation("EA_VALIDATE_DETERMINISM_MODIFIER_ORDER", `Integrity error: assertion ${assertionId} modifiers must be sorted for determinism.`);
    }
  }

  for (const op of assertion.operators || []) {
    const opEvidence = Array.isArray(op && op.evidence) ? op.evidence : [];
    for (let i = 1; i < opEvidence.length; i += 1) {
      const prev = relationEvidenceSortKey(opEvidence[i - 1]);
      const cur = relationEvidenceSortKey(opEvidence[i]);
      if (prev.localeCompare(cur) > 0) {
        failValidation("EA_VALIDATE_DETERMINISM_OPERATOR_EVIDENCE_ORDER", `Integrity error: assertion ${assertionId} operators[*].evidence must be sorted for determinism.`);
      }
    }
  }
}

module.exports = {
  ensureSortedStrings,
  relationEvidenceSortKey,
  validateAssertionDeterminism,
};
