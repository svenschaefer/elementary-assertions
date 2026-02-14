function isSortedStrings(arr) {
  for (let i = 1; i < arr.length; i += 1) {
    if (String(arr[i - 1]).localeCompare(String(arr[i])) > 0) return false;
  }
  return true;
}

function ensureSortedStrings(arr, message) {
  if (!isSortedStrings(arr || [])) {
    throw new Error(`Integrity error: ${message}`);
  }
}

function ensureUniqueIds(items, label) {
  const ids = (items || []).map((x) => x && x.id).filter((id) => typeof id === "string" && id.length > 0);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Integrity error: duplicate ${label} ids detected.`);
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

function validateIntegrity(doc) {
  ensureUniqueIds(doc.tokens, "token");
  ensureUniqueIds(doc.mentions, "mention");
  ensureUniqueIds(doc.assertions, "assertion");

  const tokenById = new Map((doc.tokens || []).map((t) => [t && t.id, t]).filter(([id]) => typeof id === "string" && id.length > 0));
  const mentionById = new Map((doc.mentions || []).map((m) => [m && m.id, m]).filter(([id]) => typeof id === "string" && id.length > 0));
  const assertionById = new Map((doc.assertions || []).map((a) => [a && a.id, a]).filter(([id]) => typeof id === "string" && id.length > 0));

  for (const mention of doc.mentions || []) {
    const tokenIds = Array.isArray(mention && mention.token_ids) ? mention.token_ids : [];
    if (new Set(tokenIds).size !== tokenIds.length) {
      throw new Error(`Integrity error: mention ${mention.id} has duplicate token_ids.`);
    }
    for (const tid of tokenIds) {
      if (!tokenById.has(tid)) {
        throw new Error(`Integrity error: mention ${mention.id} references unknown token ${tid}.`);
      }
    }
    const headTokenId = mention && mention.head_token_id;
    if (typeof headTokenId !== "string" || !tokenById.has(headTokenId)) {
      throw new Error(`Integrity error: mention ${mention.id} has invalid head_token_id.`);
    }
    if (!tokenIds.includes(headTokenId)) {
      throw new Error(`Integrity error: mention ${mention.id} head_token_id must be included in token_ids.`);
    }
  }

  for (const assertion of doc.assertions || []) {
    const assertionId = (assertion && assertion.id) || "<unknown>";
    const predMentionId = assertion && assertion.predicate ? assertion.predicate.mention_id : null;
    if (!predMentionId || !mentionById.has(predMentionId)) {
      throw new Error(`Integrity error: assertion ${assertionId} has invalid predicate mention.`);
    }

    if (!Array.isArray(assertion.arguments) || !Array.isArray(assertion.modifiers) || !Array.isArray(assertion.operators)) {
      throw new Error(`Integrity error: assertion ${assertionId} must contain arguments/modifiers/operators arrays.`);
    }

    const evidence = assertion && assertion.evidence && typeof assertion.evidence === "object" ? assertion.evidence : {};
    const evidenceTokenIds = Array.isArray(evidence.token_ids) ? evidence.token_ids : [];
    ensureSortedStrings(evidenceTokenIds, `assertion ${assertionId} evidence.token_ids must be sorted for determinism.`);
    for (const tid of evidenceTokenIds) {
      if (!tokenById.has(tid)) {
        throw new Error(`Integrity error: assertion ${assertionId} evidence.token_ids references unknown token ${tid}.`);
      }
    }

    const relationEvidence = Array.isArray(evidence.relation_evidence) ? evidence.relation_evidence : [];
    for (const relEv of relationEvidence) {
      if (relEv && relEv.from_token_id && !tokenById.has(relEv.from_token_id)) {
        throw new Error(`Integrity error: assertion ${assertionId} relation_evidence references unknown from_token_id.`);
      }
      if (relEv && relEv.to_token_id && !tokenById.has(relEv.to_token_id)) {
        throw new Error(`Integrity error: assertion ${assertionId} relation_evidence references unknown to_token_id.`);
      }
    }
    for (let i = 1; i < relationEvidence.length; i += 1) {
      const prev = relationEvidenceSortKey(relationEvidence[i - 1]);
      const cur = relationEvidenceSortKey(relationEvidence[i]);
      if (prev.localeCompare(cur) > 0) {
        throw new Error(`Integrity error: assertion ${assertionId} evidence.relation_evidence must be sorted for determinism.`);
      }
    }

    for (const entry of assertion.arguments || []) {
      const mids = Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : [];
      ensureSortedStrings(mids, `assertion ${assertionId} arguments[*].mention_ids must be sorted for determinism.`);
      for (const mid of mids) {
        if (!mentionById.has(mid)) {
          throw new Error(`Integrity error: assertion ${assertionId} references unknown mention ${mid}.`);
        }
      }
      const entryEvidence = entry && entry.evidence && typeof entry.evidence === "object" ? entry.evidence : {};
      ensureSortedStrings(entryEvidence.relation_ids || [], `assertion ${assertionId} arguments[*].evidence.relation_ids must be sorted for determinism.`);
      ensureSortedStrings(entryEvidence.token_ids || [], `assertion ${assertionId} arguments[*].evidence.token_ids must be sorted for determinism.`);
    }

    for (const entry of assertion.modifiers || []) {
      const mids = Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : [];
      ensureSortedStrings(mids, `assertion ${assertionId} modifiers[*].mention_ids must be sorted for determinism.`);
      for (const mid of mids) {
        if (!mentionById.has(mid)) {
          throw new Error(`Integrity error: assertion ${assertionId} references unknown mention ${mid}.`);
        }
      }
      const entryEvidence = entry && entry.evidence && typeof entry.evidence === "object" ? entry.evidence : {};
      ensureSortedStrings(entryEvidence.relation_ids || [], `assertion ${assertionId} modifiers[*].evidence.relation_ids must be sorted for determinism.`);
      ensureSortedStrings(entryEvidence.token_ids || [], `assertion ${assertionId} modifiers[*].evidence.token_ids must be sorted for determinism.`);
    }

    for (let i = 1; i < assertion.arguments.length; i += 1) {
      const prev = roleEntrySortKey(assertion.arguments[i - 1], argumentRolePriority);
      const cur = roleEntrySortKey(assertion.arguments[i], argumentRolePriority);
      if (prev.localeCompare(cur) > 0) {
        throw new Error(`Integrity error: assertion ${assertionId} arguments must be sorted for determinism.`);
      }
    }
    for (let i = 1; i < assertion.modifiers.length; i += 1) {
      const prev = roleEntrySortKey(assertion.modifiers[i - 1], modifierRolePriority);
      const cur = roleEntrySortKey(assertion.modifiers[i], modifierRolePriority);
      if (prev.localeCompare(cur) > 0) {
        throw new Error(`Integrity error: assertion ${assertionId} modifiers must be sorted for determinism.`);
      }
    }

    for (const op of assertion.operators || []) {
      const opEvidence = Array.isArray(op && op.evidence) ? op.evidence : [];
      for (let i = 1; i < opEvidence.length; i += 1) {
        const prev = relationEvidenceSortKey(opEvidence[i - 1]);
        const cur = relationEvidenceSortKey(opEvidence[i]);
        if (prev.localeCompare(cur) > 0) {
          throw new Error(`Integrity error: assertion ${assertionId} operators[*].evidence must be sorted for determinism.`);
        }
      }
    }
  }

  const suppressed = Array.isArray((((doc || {}).diagnostics) || {}).suppressed_assertions)
    ? doc.diagnostics.suppressed_assertions
    : [];
  ensureUniqueIds(suppressed, "suppressed assertion");
  let prevSuppressedId = null;
  for (const item of suppressed) {
    const cur = String((item && item.id) || "");
    if (prevSuppressedId && prevSuppressedId.localeCompare(cur) > 0) {
      throw new Error("Integrity error: diagnostics.suppressed_assertions must be sorted by id.");
    }
    prevSuppressedId = cur;
    const targetId = ((((item || {}).diagnostics) || {}).suppressed_by || {}).target_assertion_id;
    if (typeof targetId === "string" && targetId.length > 0 && !assertionById.has(targetId)) {
      throw new Error(`Integrity error: suppressed assertion ${cur} references unknown target_assertion_id.`);
    }
  }

  validateCoverage(doc, mentionById);
}

module.exports = {
  validateIntegrity,
};
