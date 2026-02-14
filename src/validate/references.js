function ensureUniqueIds(items, label) {
  const ids = (items || []).map((x) => x && x.id).filter((id) => typeof id === "string" && id.length > 0);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Integrity error: duplicate ${label} ids detected.`);
  }
}

function buildReferenceMaps(doc) {
  const tokenById = new Map((doc.tokens || []).map((t) => [t && t.id, t]).filter(([id]) => typeof id === "string" && id.length > 0));
  const mentionById = new Map((doc.mentions || []).map((m) => [m && m.id, m]).filter(([id]) => typeof id === "string" && id.length > 0));
  const assertionById = new Map((doc.assertions || []).map((a) => [a && a.id, a]).filter(([id]) => typeof id === "string" && id.length > 0));
  return { tokenById, mentionById, assertionById };
}

function validateMentionReferences(doc, tokenById) {
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
}

function validateAssertionReferences(assertion, assertionId, mentionById, tokenById) {
  const predMentionId = assertion && assertion.predicate ? assertion.predicate.mention_id : null;
  if (!predMentionId || !mentionById.has(predMentionId)) {
    throw new Error(`Integrity error: assertion ${assertionId} has invalid predicate mention.`);
  }

  if (!Array.isArray(assertion.arguments) || !Array.isArray(assertion.modifiers) || !Array.isArray(assertion.operators)) {
    throw new Error(`Integrity error: assertion ${assertionId} must contain arguments/modifiers/operators arrays.`);
  }

  const evidence = assertion && assertion.evidence && typeof assertion.evidence === "object" ? assertion.evidence : {};
  const evidenceTokenIds = Array.isArray(evidence.token_ids) ? evidence.token_ids : [];
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

  for (const entry of assertion.arguments || []) {
    const mids = Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : [];
    for (const mid of mids) {
      if (!mentionById.has(mid)) {
        throw new Error(`Integrity error: assertion ${assertionId} references unknown mention ${mid}.`);
      }
    }
  }

  for (const entry of assertion.modifiers || []) {
    const mids = Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : [];
    for (const mid of mids) {
      if (!mentionById.has(mid)) {
        throw new Error(`Integrity error: assertion ${assertionId} references unknown mention ${mid}.`);
      }
    }
  }
}

function validateSuppressedReferences(doc, assertionById) {
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
}

module.exports = {
  ensureUniqueIds,
  buildReferenceMaps,
  validateMentionReferences,
  validateAssertionReferences,
  validateSuppressedReferences,
};
