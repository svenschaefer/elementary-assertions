const { failValidation } = require("./errors");

function buildSegmentMap(doc) {
  return new Map((doc.segments || []).map((s) => [s && s.id, s]).filter(([id]) => typeof id === "string" && id.length > 0));
}

function ensureSegmentExists(segmentById, segmentId, code, message) {
  if (typeof segmentId !== "string" || !segmentById.has(segmentId)) {
    failValidation(code, message);
  }
}

function validateTokenSegmentAlignment(doc, segmentById) {
  for (const token of doc.tokens || []) {
    const tokenId = String((token && token.id) || "<unknown>");
    ensureSegmentExists(
      segmentById,
      token && token.segment_id,
      "EA_VALIDATE_UNKNOWN_SEGMENT_REFERENCE",
      `Integrity error: token ${tokenId} references unknown segment_id.`
    );
  }
}

function validateMentionSegmentAlignment(doc, segmentById, tokenById) {
  for (const mention of doc.mentions || []) {
    const mentionId = String((mention && mention.id) || "<unknown>");
    const mentionSegmentId = mention && mention.segment_id;
    ensureSegmentExists(
      segmentById,
      mentionSegmentId,
      "EA_VALIDATE_UNKNOWN_SEGMENT_REFERENCE",
      `Integrity error: mention ${mentionId} references unknown segment_id.`
    );

    const segment = segmentById.get(mentionSegmentId);
    const tokenIds = Array.isArray(mention && mention.token_ids) ? mention.token_ids : [];
    let minStart = Infinity;
    let maxEnd = -Infinity;

    for (const tokenId of tokenIds) {
      const token = tokenById.get(tokenId);
      if (!token) continue;
      if (token.segment_id !== mentionSegmentId) {
        failValidation(
          "EA_VALIDATE_MENTION_SEGMENT_MISMATCH",
          `Integrity error: mention ${mentionId} includes token ${tokenId} from another segment.`
        );
      }
      if (token.span && typeof token.span.start === "number" && token.span.start < minStart) minStart = token.span.start;
      if (token.span && typeof token.span.end === "number" && token.span.end > maxEnd) maxEnd = token.span.end;
    }

    if (mention && mention.head_token_id) {
      const headToken = tokenById.get(mention.head_token_id);
      if (headToken && headToken.segment_id !== mentionSegmentId) {
        failValidation(
          "EA_VALIDATE_MENTION_SEGMENT_MISMATCH",
          `Integrity error: mention ${mentionId} head token is not in mention.segment_id.`
        );
      }
    }

    if (
      segment &&
      mention &&
      mention.span &&
      typeof mention.span.start === "number" &&
      typeof mention.span.end === "number"
    ) {
      if (mention.span.start < segment.span.start || mention.span.end > segment.span.end) {
        failValidation(
          "EA_VALIDATE_MENTION_SPAN_SEGMENT_BOUNDS",
          `Integrity error: mention ${mentionId} span falls outside its segment bounds.`
        );
      }
      if (Number.isFinite(minStart) && Number.isFinite(maxEnd)) {
        if (mention.span.start > minStart || mention.span.end < maxEnd) {
          failValidation(
            "EA_VALIDATE_MENTION_SPAN_TOKEN_COVERAGE",
            `Integrity error: mention ${mentionId} span must cover all mention token spans.`
          );
        }
      }
    }
  }
}

function validateAssertionCrossFieldAlignment(doc, segmentById, mentionById, tokenById) {
  for (const assertion of doc.assertions || []) {
    const assertionId = String((assertion && assertion.id) || "<unknown>");
    const assertionSegmentId = assertion && assertion.segment_id;
    ensureSegmentExists(
      segmentById,
      assertionSegmentId,
      "EA_VALIDATE_UNKNOWN_SEGMENT_REFERENCE",
      `Integrity error: assertion ${assertionId} references unknown segment_id.`
    );

    const predicate = assertion && assertion.predicate && typeof assertion.predicate === "object" ? assertion.predicate : {};
    const predicateMention = mentionById.get(predicate.mention_id);
    if (predicateMention && predicateMention.segment_id !== assertionSegmentId) {
      failValidation(
        "EA_VALIDATE_ASSERTION_SEGMENT_MISMATCH",
        `Integrity error: assertion ${assertionId} predicate mention segment mismatch.`
      );
    }

    if (predicateMention && predicate.head_token_id !== predicateMention.head_token_id) {
      failValidation(
        "EA_VALIDATE_PREDICATE_HEAD_MISMATCH",
        `Integrity error: assertion ${assertionId} predicate.head_token_id does not match mention head token.`
      );
    }

    const predicateHeadToken = tokenById.get(predicate.head_token_id);
    if (predicateHeadToken && predicateHeadToken.segment_id !== assertionSegmentId) {
      failValidation(
        "EA_VALIDATE_ASSERTION_SEGMENT_MISMATCH",
        `Integrity error: assertion ${assertionId} predicate head token segment mismatch.`
      );
    }

    for (const entry of (assertion && assertion.arguments) || []) {
      const mentionIds = Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : [];
      for (const mentionId of mentionIds) {
        const mention = mentionById.get(mentionId);
        if (mention && mention.segment_id !== assertionSegmentId) {
          failValidation(
            "EA_VALIDATE_ASSERTION_SEGMENT_MISMATCH",
            `Integrity error: assertion ${assertionId} argument mention ${mentionId} segment mismatch.`
          );
        }
      }
    }

    for (const entry of (assertion && assertion.modifiers) || []) {
      const mentionIds = Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : [];
      for (const mentionId of mentionIds) {
        const mention = mentionById.get(mentionId);
        if (mention && mention.segment_id !== assertionSegmentId) {
          failValidation(
            "EA_VALIDATE_ASSERTION_SEGMENT_MISMATCH",
            `Integrity error: assertion ${assertionId} modifier mention ${mentionId} segment mismatch.`
          );
        }
      }
    }
  }
}

module.exports = {
  buildSegmentMap,
  validateTokenSegmentAlignment,
  validateMentionSegmentAlignment,
  validateAssertionCrossFieldAlignment,
};
