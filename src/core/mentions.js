const { findSelector, normalizeSpanKey, normalizeIds, deepCloneJson } = require('./determinism');
const { annotationHasSource, collectStep11Relations } = require('./upstream');
const { buildTokenIndex, getTokenWikipediaEvidence, buildTokenWikiById, getTokenMetadataProjection } = require('./tokens');
const { getMweHeadEvidence, getMweLexiconEvidence } = require('./mention-materialization');
const { toAnnotationSummary, buildAcceptedAnnotationsInventory } = require('./accepted-annotations');
const { buildChunkHeadMaps, buildDependencyObservationMaps, posFallbackHead, resolveMentionHead } = require('./mention-head-resolution');
const { buildMentionLexiconEvidence, buildAssertionWikiSignals } = require('./mention-evidence');
const { buildMentions } = require('./mention-builder');

function normalizeWikiSurface(surface) {
  if (typeof surface !== 'string') return '';
  return surface
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function hasPositiveWikiSignal(evidence) {
  if (!evidence || typeof evidence !== 'object') return false;
  if (evidence.wiki_exact_match === true) return true;
  if (typeof evidence.wiki_prefix_count === 'number' && evidence.wiki_prefix_count > 0) return true;
  if (
    typeof evidence.wiki_parenthetical_variant_count === 'number' &&
    evidence.wiki_parenthetical_variant_count > 0
  ) {
    return true;
  }
  if (evidence.wiki_hyphen_space_variant_match === true) return true;
  if (evidence.wiki_apostrophe_variant_match === true) return true;
  if (evidence.wiki_singular_plural_variant_match === true) return true;
  if (evidence.wiki_any_signal === true) return true;
  return false;
}

function mentionSortKey(mention) {
  return `${mention.segment_id}|${String(mention.span.start).padStart(8, '0')}|${String(mention.span.end).padStart(8, '0')}|${mention.kind}|${mention.id}`;
}

const SUBJECT_ROLE_LABELS = new Set([
  'actor',
  'agent',
  'subject',
  'subj',
  'nsubj',
  'nsubjpass',
  'csubj',
  'csubjpass',
  'agent_passive',
]);

function isSubjectRoleLabel(role) {
  return SUBJECT_ROLE_LABELS.has(String(role || ''));
}

function roleToSlot(role) {
  if (isSubjectRoleLabel(role)) return { slot: 'actor', role: null };
  if (role === 'theme') return { slot: 'theme', role: null };
  if (role === 'patient') return { slot: 'theme', role: null };
  if (role === 'attribute') return { slot: 'attr', role: null };
  if (role === 'topic') return { slot: 'topic', role: null };
  if (role === 'location') return { slot: 'location', role: null };
  if (role === 'recipient') return { slot: 'other', role: 'recipient' };
  return { slot: 'other', role };
}

function isCompareLabel(label) {
  const l = String(label || '');
  return l === 'compare' || l === 'compare_gt' || l === 'compare_lt';
}

function isQuantifierLabel(label) {
  const l = String(label || '');
  return l === 'quantifier' || l === 'quantifier_scope' || l === 'scope_quantifier';
}

function mentionHasLexiconEvidence(mention) {
  return !!(
    mention &&
    mention.provenance &&
    mention.provenance.lexicon_evidence &&
    typeof mention.provenance.lexicon_evidence === 'object'
  );
}

function compareMentionProjectionPriority(a, b) {
  const aSpanLen = Array.isArray(a && a.token_ids) ? a.token_ids.length : 0;
  const bSpanLen = Array.isArray(b && b.token_ids) ? b.token_ids.length : 0;
  if (aSpanLen !== bSpanLen) return bSpanLen - aSpanLen;
  const aPriority = Number.isFinite(a && a.priority) ? a.priority : Number.MAX_SAFE_INTEGER;
  const bPriority = Number.isFinite(b && b.priority) ? b.priority : Number.MAX_SAFE_INTEGER;
  if (aPriority !== bPriority) return aPriority - bPriority;
  const aLex = mentionHasLexiconEvidence(a) ? 0 : 1;
  const bLex = mentionHasLexiconEvidence(b) ? 0 : 1;
  if (aLex !== bLex) return aLex - bLex;
  return String(a && a.id ? a.id : '').localeCompare(String(b && b.id ? b.id : ''));
}

function chooseBestMentionForToken({ tokenId, segmentId, mentionById, candidateMentionIds, excludeMentionId }) {
  const sourceIds = (candidateMentionIds || [])
    .filter((id) => typeof id === 'string')
    .slice();
  const filteredIds = sourceIds.filter((id) => {
    if (excludeMentionId && id === excludeMentionId) return false;
    const mention = mentionById.get(id);
    if (!mention || mention.segment_id !== segmentId) return false;
    if (mention.suppressed === true) return false;
    return Array.isArray(mention.token_ids) && mention.token_ids.includes(tokenId);
  });
  if (filteredIds.length === 0) {
    return { mention_id: null, candidate_count: 0, chosen_was_first: true };
  }
  const chosenSorted = filteredIds.slice().sort((a, b) => {
    const ma = mentionById.get(a);
    const mb = mentionById.get(b);
    return compareMentionProjectionPriority(ma, mb);
  });
  const chosenId = chosenSorted[0];
  return {
    mention_id: chosenId,
    candidate_count: filteredIds.length,
    chosen_was_first: sourceIds.length > 0 ? sourceIds[0] === chosenId : true,
  };
}

module.exports = {
  normalizeWikiSurface,
  hasPositiveWikiSignal,
  mentionSortKey,
  SUBJECT_ROLE_LABELS,
  isSubjectRoleLabel,
  roleToSlot,
  isCompareLabel,
  isQuantifierLabel,
  mentionHasLexiconEvidence,
  compareMentionProjectionPriority,
  chooseBestMentionForToken,
  getMweHeadEvidence,
  getMweLexiconEvidence,
  toAnnotationSummary,
  buildAcceptedAnnotationsInventory,
  buildMentionLexiconEvidence,
  buildAssertionWikiSignals,
  buildChunkHeadMaps,
  buildDependencyObservationMaps,
  posFallbackHead,
  resolveMentionHead,
  buildMentions,
};


