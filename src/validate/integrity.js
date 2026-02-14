function validateIntegrity(doc) {
  const tokenIds = new Set((doc.tokens || []).map((t) => t && t.id).filter(Boolean));
  const mentionIds = new Set((doc.mentions || []).map((m) => m && m.id).filter(Boolean));

  for (const mention of doc.mentions || []) {
    for (const tid of mention.token_ids || []) {
      if (!tokenIds.has(tid)) {
        throw new Error(`Integrity error: mention ${mention.id} references unknown token ${tid}.`);
      }
    }
  }

  for (const assertion of doc.assertions || []) {
    const predMentionId = assertion && assertion.predicate ? assertion.predicate.mention_id : null;
    if (!predMentionId || !mentionIds.has(predMentionId)) {
      throw new Error(`Integrity error: assertion ${(assertion && assertion.id) || "<unknown>"} has invalid predicate mention.`);
    }

    if (!Array.isArray(assertion.arguments) || !Array.isArray(assertion.modifiers) || !Array.isArray(assertion.operators)) {
      throw new Error(`Integrity error: assertion ${(assertion && assertion.id) || "<unknown>"} must contain arguments/modifiers/operators arrays.`);
    }

    for (const entry of assertion.arguments || []) {
      for (const mid of entry.mention_ids || []) {
        if (!mentionIds.has(mid)) {
          throw new Error(`Integrity error: assertion ${(assertion && assertion.id) || "<unknown>"} references unknown mention ${mid}.`);
        }
      }
    }

    for (const entry of assertion.modifiers || []) {
      for (const mid of entry.mention_ids || []) {
        if (!mentionIds.has(mid)) {
          throw new Error(`Integrity error: assertion ${(assertion && assertion.id) || "<unknown>"} references unknown mention ${mid}.`);
        }
      }
    }
  }
}

module.exports = {
  validateIntegrity,
};
