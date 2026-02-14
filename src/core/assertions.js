const { sha256Hex, canonicalizeOperatorsForHash, stableObjectKey, normalizeIds, dedupeAndSortEvidence } = require('./determinism');
const { roleToSlot, isCompareLabel, isQuantifierLabel, chooseBestMentionForToken, buildAssertionWikiSignals, isSubjectRoleLabel } = require('./mentions');
const { buildCoordinationGroups } = require('./projection');
const { mergeOperator } = require('./diagnostics');
const {
  argumentRolePriority,
  modifierRolePriority,
  collectEntryTokenIds,
  canonicalizeRoleEntries,
  collectAssertionMentionRefs,
} = require('./roles');

function isVerbPosTag(tag) {
  return typeof tag === 'string' && /^VB/.test(tag);
}

function isLexicalVerbPos(tag) {
  return tag === 'VB' || tag === 'VBD' || tag === 'VBG' || tag === 'VBN' || tag === 'VBP' || tag === 'VBZ';
}

function classifyPredicateClass(token) {
  const surface = lower(token && token.surface);
  const tag = String((((token || {}).pos) || {}).tag || '').toUpperCase();
  if (isCopulaSurface(surface)) return 'copula';
  if (tag === 'MD' || surface === 'given') return 'auxiliary';
  if (tag === 'IN' || tag === 'TO') return 'preposition';
  if (isLexicalVerbPos(tag)) return 'lexical_verb';
  return 'nominal_head';
}

function isNounLikePosTag(tag) {
  return typeof tag === 'string' && /^(NN|NNS|NNP|NNPS|PRP|PRP\$|CD)$/.test(tag);
}

function isCopulaSurface(surface) {
  const s = String(surface || '').toLowerCase();
  return s === 'is' || s === 'are' || s === 'was' || s === 'were' || s === 'be' || s === 'been' || s === 'being';
}

function lower(s) {
  return String(s || '').toLowerCase();
}

function isLowQualityPredicateToken(token) {
  const surface = lower(token && token.surface);
  const tag = String((((token || {}).pos) || {}).tag || '');
  if (tag === 'MD') return true;
  return surface === 'is' || surface === 'are' || surface === 'am' || surface === 'be' || surface === 'been' || surface === 'being' || surface === 'given';
}

function isMakeSureScaffoldPredicate({ predTok, projected, tokensBySegment }) {
  const predSurface = lower(predTok && predTok.surface);
  if (predSurface !== 'make') return false;
  const hasIncomingClauseLink = projected.some((r) => {
    if (!r || r.dep_token_id !== predTok.id) return false;
    return r.label === 'complement_clause' || r.label === 'xcomp' || r.label === 'ccomp' || r.label === 'purpose';
  });
  if (!hasIncomingClauseLink) return false;
  const segTokens = tokensBySegment.get(predTok.segment_id) || [];
  const idx = segTokens.findIndex((t) => t && t.id === predTok.id);
  if (idx < 0) return false;
  for (let i = idx + 1; i < Math.min(segTokens.length, idx + 4); i += 1) {
    const tok = segTokens[i];
    const s = lower(tok && tok.surface);
    if (!s || s === ',' || s === ';' || s === ':') continue;
    return s === 'sure';
  }
  return false;
}

function roleBucketsAreSemanticallyEmpty(roleBuckets) {
  return (
    Array.isArray(roleBuckets.actor) && roleBuckets.actor.length === 0 &&
    Array.isArray(roleBuckets.theme) && roleBuckets.theme.length === 0 &&
    Array.isArray(roleBuckets.attr) && roleBuckets.attr.length === 0 &&
    Array.isArray(roleBuckets.topic) && roleBuckets.topic.length === 0 &&
    Array.isArray(roleBuckets.location) && roleBuckets.location.length === 0 &&
    Array.isArray(roleBuckets.other) && roleBuckets.other.length === 0
  );
}

function assertionRoleBuckets(assertion) {
  const roleBuckets = { actor: [], theme: [], attr: [], topic: [], location: [], other: [] };
  for (const entry of assertion && Array.isArray(assertion.arguments) ? assertion.arguments : []) {
    const role = String((entry && entry.role) || '');
    const mentionIds = normalizeIds(Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : []);
    if (mentionIds.length === 0) continue;
    if (role === 'actor' || isSubjectRoleLabel(role)) roleBuckets.actor = normalizeIds(roleBuckets.actor.concat(mentionIds));
    else if (role === 'theme') roleBuckets.theme = normalizeIds(roleBuckets.theme.concat(mentionIds));
    else if (role === 'attribute') roleBuckets.attr = normalizeIds(roleBuckets.attr.concat(mentionIds));
    else if (role === 'topic') roleBuckets.topic = normalizeIds(roleBuckets.topic.concat(mentionIds));
    else if (role === 'location') roleBuckets.location = normalizeIds(roleBuckets.location.concat(mentionIds));
    else roleBuckets.other.push({ role, mention_ids: mentionIds });
  }
  for (const entry of assertion && Array.isArray(assertion.modifiers) ? assertion.modifiers : []) {
    const role = String((entry && entry.role) || '');
    const mentionIds = normalizeIds(Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : []);
    if (!role || mentionIds.length === 0) continue;
    roleBuckets.other.push({ role, mention_ids: mentionIds });
  }
  roleBuckets.other = roleBuckets.other
    .map((entry) => ({ role: entry.role, mention_ids: normalizeIds(entry.mention_ids || []) }))
    .filter((entry) => entry.mention_ids.length > 0)
    .sort((a, b) => {
      if (a.role !== b.role) return a.role.localeCompare(b.role);
      return JSON.stringify(a.mention_ids).localeCompare(JSON.stringify(b.mention_ids));
    });
  return roleBuckets;
}

function canonicalizeRoleBuckets(roleBuckets, mentionById) {
  const source = roleBuckets || {};
  const argumentEntries = [];
  const coreMappings = [
    { key: 'actor', role: 'actor' },
    { key: 'theme', role: 'theme' },
    { key: 'attr', role: 'attribute' },
    { key: 'topic', role: 'topic' },
    { key: 'location', role: 'location' },
  ];
  for (const mapping of coreMappings) {
    const mentionIds = normalizeIds(Array.isArray(source[mapping.key]) ? source[mapping.key] : []);
    if (mentionIds.length === 0) continue;
    argumentEntries.push({
      role: mapping.role,
      mention_ids: mentionIds,
      evidence: {
        relation_ids: [],
        token_ids: collectEntryTokenIds(mentionIds, mentionById),
      },
    });
  }

  const modifierEntries = [];
  for (const entry of Array.isArray(source.other) ? source.other : []) {
    const role = String((entry && entry.role) || '').trim();
    const mentionIds = normalizeIds(Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : []);
    if (!role || mentionIds.length === 0) continue;
    modifierEntries.push({
      role,
      mention_ids: mentionIds,
      evidence: {
        relation_ids: [],
        token_ids: collectEntryTokenIds(mentionIds, mentionById),
      },
    });
  }

  return {
    arguments: canonicalizeRoleEntries(argumentEntries, argumentRolePriority),
    modifiers: canonicalizeRoleEntries(modifierEntries, modifierRolePriority),
  };
}

function rolePayloadHashInput(rolePayload) {
  return JSON.stringify({ arguments: rolePayload.arguments, modifiers: rolePayload.modifiers });
}

function applyRoleBucketsToAssertion(assertion, roleBuckets, mentionById) {
  const rolePayload = canonicalizeRoleBuckets(roleBuckets, mentionById);
  assertion.arguments = rolePayload.arguments;
  assertion.modifiers = rolePayload.modifiers;
}

function isClauseBoundaryToken(token) {
  const surface = lower(token && token.surface);
  return (
    surface === '.' ||
    surface === ',' ||
    surface === ';' ||
    surface === ':' ||
    surface === '!' ||
    surface === '?'
  );
}

function assertionClauseWindowKey(assertion, tokenById, tokensBySegment) {
  const segmentId = String((assertion && assertion.segment_id) || '');
  const predTokenId = String((((assertion || {}).predicate) || {}).head_token_id || '');
  if (!segmentId || !predTokenId) return `${segmentId}|window:unknown`;
  const segTokens = tokensBySegment.get(segmentId) || [];
  const idx = segTokens.findIndex((t) => t && t.id === predTokenId);
  if (idx < 0) return `${segmentId}|window:unknown`;
  let left = idx;
  let right = idx;
  while (left - 1 >= 0 && !isClauseBoundaryToken(segTokens[left - 1])) left -= 1;
  while (right + 1 < segTokens.length && !isClauseBoundaryToken(segTokens[right + 1])) right += 1;
  const leftToken = segTokens[left];
  const rightToken = segTokens[right];
  return `${segmentId}|${leftToken ? leftToken.id : String(left)}|${rightToken ? rightToken.id : String(right)}`;
}

function assertionHasBlockingOperators(assertion) {
  const ops = Array.isArray(assertion && assertion.operators) ? assertion.operators : [];
  return ops.some((op) => {
    const kind = String((op && op.kind) || '');
    return kind === 'modality' || kind === 'negation' || kind === 'coordination_group';
  });
}

function addToOtherSlot(host, role, mentionIds, mentionById) {
  if (!host) return false;
  const roleBuckets = assertionRoleBuckets(host);
  const cleaned = normalizeIds((mentionIds || []).filter((id) => typeof id === 'string' && id.length > 0));
  if (cleaned.length === 0) return false;
  if (!Array.isArray(roleBuckets.other)) roleBuckets.other = [];
  const existing = roleBuckets.other.find((o) => o && o.role === role);
  if (!existing) {
    roleBuckets.other.push({ role, mention_ids: cleaned });
    roleBuckets.other.sort((a, b) => String(a.role || '').localeCompare(String(b.role || '')));
    applyRoleBucketsToAssertion(host, roleBuckets, mentionById);
    return true;
  }
  const merged = normalizeIds((existing.mention_ids || []).concat(cleaned));
  if (merged.length === (existing.mention_ids || []).length && merged.every((id, idx) => id === existing.mention_ids[idx])) {
    return false;
  }
  existing.mention_ids = merged;
  roleBuckets.other.sort((a, b) => String(a.role || '').localeCompare(String(b.role || '')));
  applyRoleBucketsToAssertion(host, roleBuckets, mentionById);
  return true;
}

function transferRoleCarrierBucketsToHost(source, host, mentionById) {
  const transferred = new Set();
  const hostRefs = collectAssertionMentionRefs(host);
  const sourceSlots = assertionRoleBuckets(source);
  for (const slotName of ['actor', 'theme', 'attr', 'topic', 'location']) {
    const ids = normalizeIds(((sourceSlots || {})[slotName] || []).filter((id) => typeof id === 'string' && id.length > 0));
    if (ids.length === 0) continue;
    const missing = ids.filter((id) => !hostRefs.has(id));
    if (missing.length === 0) continue;
    if (addToOtherSlot(host, `attached_${slotName}`, missing, mentionById)) {
      transferred.add(slotName);
      for (const id of missing) hostRefs.add(id);
    }
  }
  for (const entry of ((sourceSlots || {}).other || [])) {
    const role = `attached_${String((entry && entry.role) || 'other')}`;
    const ids = normalizeIds((entry && entry.mention_ids) || []);
    if (ids.length === 0) continue;
    const missing = ids.filter((id) => !hostRefs.has(id));
    if (missing.length === 0) continue;
    if (addToOtherSlot(host, role, missing, mentionById)) {
      transferred.add('other');
      for (const id of missing) hostRefs.add(id);
    }
  }
  return normalizeIds(Array.from(transferred));
}
function collectRoleBucketMentionIds(source, includeSlots) {
  const out = new Set();
  const roleBuckets = assertionRoleBuckets(source);
  for (const slotName of includeSlots || []) {
    if (slotName === 'other') {
      for (const entry of roleBuckets.other || []) {
        for (const id of entry.mention_ids || []) out.add(id);
      }
      continue;
    }
    for (const id of roleBuckets[slotName] || []) out.add(id);
  }
  return normalizeIds(Array.from(out));
}

function transferNamedBucketsToHostOther(source, host, mapping, mentionById) {
  const transferredSlots = new Set();
  const transferredMentionIds = new Set();
  const sourceMentionIds = new Set();
  const hostRefs = collectAssertionMentionRefs(host);
  const roleBuckets = assertionRoleBuckets(source);
  for (const mapEntry of mapping || []) {
    const from = String((mapEntry && mapEntry.from) || '');
    const to = String((mapEntry && mapEntry.to) || '');
    if (!from || !to) continue;
    if (from === 'other') {
      for (const entry of roleBuckets.other || []) {
        const ids = normalizeIds((entry && entry.mention_ids) || []);
        if (ids.length === 0) continue;
        for (const id of ids) sourceMentionIds.add(id);
        const missing = ids.filter((id) => !hostRefs.has(id));
        if (missing.length === 0) continue;
        if (addToOtherSlot(host, to, missing, mentionById)) {
          transferredSlots.add('other');
          for (const id of missing) {
            hostRefs.add(id);
            transferredMentionIds.add(id);
          }
        }
      }
      continue;
    }
    const ids = normalizeIds((roleBuckets[from] || []).filter((id) => typeof id === 'string' && id.length > 0));
    if (ids.length === 0) continue;
    for (const id of ids) sourceMentionIds.add(id);
    const missing = ids.filter((id) => !hostRefs.has(id));
    if (missing.length === 0) continue;
    if (addToOtherSlot(host, to, missing, mentionById)) {
      transferredSlots.add(from);
      for (const id of missing) {
        hostRefs.add(id);
        transferredMentionIds.add(id);
      }
    }
  }
  return {
    transferred_buckets: normalizeIds(Array.from(transferredSlots)),
    transferred_mention_ids: normalizeIds(Array.from(sourceMentionIds.size > 0 ? sourceMentionIds : transferredMentionIds)),
  };
}

function transferOperatorsToHost(source, host) {
  const sourceOps = Array.isArray(source && source.operators) ? source.operators : [];
  if (sourceOps.length === 0) return [];
  const opMap = new Map();
  for (const op of (host && host.operators) || []) mergeOperator(opMap, op);
  const transferredKinds = new Set();
  for (const op of sourceOps) {
    mergeOperator(opMap, op);
    const kind = String((op && op.kind) || '');
    if (kind) transferredKinds.add(kind);
  }
  host.operators = Array.from(opMap.values()).sort((a, b) => {
    if ((a.kind || '') !== (b.kind || '')) return (a.kind || '').localeCompare(b.kind || '');
    if ((a.value || '') !== (b.value || '')) return (a.value || '').localeCompare(b.value || '');
    if ((a.group_id || '') !== (b.group_id || '')) return (a.group_id || '').localeCompare(b.group_id || '');
    if ((a.token_id || '') !== (b.token_id || '')) return (a.token_id || '').localeCompare(b.token_id || '');
    return (a.role || '').localeCompare(b.role || '');
  });
  return normalizeIds(Array.from(transferredKinds));
}

function dedupeOtherMentionsAgainstCoreBuckets(assertion, mentionById) {
  if (!assertion) return;
  const roleBuckets = assertionRoleBuckets(assertion);
  if (!Array.isArray(roleBuckets.other)) return;
  const core = new Set(
    normalizeIds(
      []
        .concat(roleBuckets.theme || [])
        .concat(roleBuckets.attr || [])
        .concat(roleBuckets.topic || [])
        .concat(roleBuckets.location || [])
    )
  );
  if (core.size === 0) return;
  const cleanedOther = [];
  for (const entry of roleBuckets.other) {
    if (!entry || typeof entry.role !== 'string') continue;
    const kept = normalizeIds((entry.mention_ids || []).filter((id) => !core.has(id)));
    if (kept.length === 0) continue;
    cleanedOther.push({ role: entry.role, mention_ids: kept });
  }
  cleanedOther.sort((a, b) => String(a.role || '').localeCompare(String(b.role || '')));
  roleBuckets.other = cleanedOther;
  applyRoleBucketsToAssertion(assertion, roleBuckets, mentionById);
}

function enforceCoreBucketTokenDisjointness(assertion, mentionById, tokenById) {
  if (!assertion || !assertion.predicate) return;
  const roleBuckets = assertionRoleBuckets(assertion);
  const predMentionId = String((((assertion || {}).predicate) || {}).mention_id || '');
  const predMention = mentionById.get(predMentionId);
  const predHeadTokenId = String((predMention && predMention.head_token_id) || '');
  const predToken = predHeadTokenId ? tokenById.get(predHeadTokenId) : null;
  const predTag = String((((predToken || {}).pos) || {}).tag || '');
  const strictPredicateOverlap = isVerbPosTag(predTag);
  const predicateTokenIds = new Set(Array.isArray(predMention && predMention.token_ids) ? predMention.token_ids : []);
  const reservedTokenIds = new Set(Array.from(predicateTokenIds));
  const prioritySlots = ['actor', 'location', 'theme', 'attr', 'topic'];
  for (const slotName of prioritySlots) {
    const current = normalizeIds((roleBuckets[slotName] || []).filter((id) => typeof id === 'string' && id.length > 0));
    const kept = [];
    for (const mentionId of current) {
      const mention = mentionById.get(mentionId);
      const tokenIds = Array.isArray(mention && mention.token_ids) ? mention.token_ids : [];
      const overlaps = strictPredicateOverlap
        ? tokenIds.some((tid) => reservedTokenIds.has(tid))
        : (tokenIds.length === predicateTokenIds.size && tokenIds.every((tid) => predicateTokenIds.has(tid)));
      if (overlaps) continue;
      kept.push(mentionId);
      for (const tid of tokenIds) reservedTokenIds.add(tid);
    }
    roleBuckets[slotName] = normalizeIds(kept);
  }
  if (!Array.isArray(roleBuckets.other)) {
    roleBuckets.other = [];
    applyRoleBucketsToAssertion(assertion, roleBuckets, mentionById);
    return;
  }
  const cleanedOther = [];
  for (const entry of roleBuckets.other) {
    if (!entry || typeof entry.role !== 'string') continue;
    const ids = normalizeIds((entry.mention_ids || []).filter((id) => typeof id === 'string' && id.length > 0));
    const kept = [];
    for (const mentionId of ids) {
      const mention = mentionById.get(mentionId);
      const tokenIds = Array.isArray(mention && mention.token_ids) ? mention.token_ids : [];
      const overlaps = strictPredicateOverlap
        ? tokenIds.some((tid) => reservedTokenIds.has(tid))
        : (tokenIds.length === predicateTokenIds.size && tokenIds.every((tid) => predicateTokenIds.has(tid)));
      if (overlaps) continue;
      kept.push(mentionId);
      for (const tid of tokenIds) reservedTokenIds.add(tid);
    }
    if (kept.length > 0) cleanedOther.push({ role: entry.role, mention_ids: kept });
  }
  cleanedOther.sort((a, b) => String(a.role || '').localeCompare(String(b.role || '')));
  roleBuckets.other = cleanedOther;
  applyRoleBucketsToAssertion(assertion, roleBuckets, mentionById);
}

function pruneLowCopulaBuckets(assertion, mentionById, tokenById, tokensBySegment) {
  if (!assertion || !assertion.predicate) return;
  const roleBuckets = assertionRoleBuckets(assertion);
  const predicateQuality = String((((assertion || {}).diagnostics) || {}).predicate_quality || '');
  if (predicateQuality !== 'low') return;
  const predMentionId = String((((assertion || {}).predicate) || {}).mention_id || '');
  const predMention = mentionById.get(predMentionId);
  if (!predMention) return;
  const predToken = tokenById.get(predMention.head_token_id);
  if (!predToken || !isCopulaSurface(predToken.surface || '')) return;

  const segmentTokens = tokensBySegment.get(predMention.segment_id) || [];
  const boundarySurfaceSet = new Set(['where', 'that', 'which', 'who', 'whom', 'whose', 'when', 'while']);
  let boundaryI = Number.POSITIVE_INFINITY;
  for (const t of segmentTokens) {
    if (!t || typeof t.i !== 'number' || t.i <= predToken.i) continue;
    const surface = String(t.surface || '').toLowerCase();
    const tag = String((((t || {}).pos) || {}).tag || '').toUpperCase();
    if (boundarySurfaceSet.has(surface) || tag === 'WDT' || tag === 'WP' || tag === 'WP$' || tag === 'WRB') {
      boundaryI = t.i;
      break;
    }
  }

  function mentionTokenBounds(mentionId) {
    const m = mentionById.get(mentionId);
    if (!m || !Array.isArray(m.token_ids)) return null;
    const toks = m.token_ids.map((tid) => tokenById.get(tid)).filter(Boolean);
    if (toks.length === 0) return null;
    const minI = Math.min(...toks.map((t) => t.i));
    const maxI = Math.max(...toks.map((t) => t.i));
    return { minI, maxI, tokenCount: toks.length, spanLen: Number((m.span || {}).end || 0) - Number((m.span || {}).start || 0) };
  }

  function isBeforeBoundary(mentionId) {
    if (!Number.isFinite(boundaryI)) return true;
    const b = mentionTokenBounds(mentionId);
    if (!b) return false;
    return b.maxI < boundaryI;
  }

  const rawThemeIds = normalizeIds((roleBuckets.theme || []).filter((id) => typeof id === 'string' && id.length > 0));
  const themeBeforeBoundary = rawThemeIds.filter((id) => isBeforeBoundary(id));
  const themeCandidates = themeBeforeBoundary.length > 0 ? themeBeforeBoundary : rawThemeIds;
  if (themeCandidates.length > 0) {
    themeCandidates.sort((a, b) => {
      const ba = mentionTokenBounds(a);
      const bb = mentionTokenBounds(b);
      const aMin = ba ? ba.minI : Number.MAX_SAFE_INTEGER;
      const bMin = bb ? bb.minI : Number.MAX_SAFE_INTEGER;
      if (aMin !== bMin) return aMin - bMin;
      const aCount = ba ? ba.tokenCount : Number.MAX_SAFE_INTEGER;
      const bCount = bb ? bb.tokenCount : Number.MAX_SAFE_INTEGER;
      if (aCount !== bCount) return aCount - bCount;
      const aSpan = ba ? ba.spanLen : Number.MAX_SAFE_INTEGER;
      const bSpan = bb ? bb.spanLen : Number.MAX_SAFE_INTEGER;
      if (aSpan !== bSpan) return aSpan - bSpan;
      return a.localeCompare(b);
    });
    roleBuckets.theme = [themeCandidates[0]];
  }

  roleBuckets.attr = normalizeIds((roleBuckets.attr || []).filter((id) => isBeforeBoundary(id)));
  roleBuckets.topic = normalizeIds((roleBuckets.topic || []).filter((id) => isBeforeBoundary(id)));
  roleBuckets.location = normalizeIds((roleBuckets.location || []).filter((id) => isBeforeBoundary(id)));
  if (Array.isArray(roleBuckets.other)) {
    const cleanedOther = [];
    for (const entry of roleBuckets.other) {
      if (!entry || typeof entry.role !== 'string') continue;
      const kept = normalizeIds((entry.mention_ids || []).filter((id) => isBeforeBoundary(id)));
      if (kept.length === 0) continue;
      cleanedOther.push({ role: entry.role, mention_ids: kept });
    }
    cleanedOther.sort((a, b) => String(a.role || '').localeCompare(String(b.role || '')));
    roleBuckets.other = cleanedOther;
  }
  applyRoleBucketsToAssertion(assertion, roleBuckets, mentionById);
}

function trimCatchAllThemeBuckets(assertion, mentionById, tokenById, tokensBySegment) {
  if (!assertion || !assertion.predicate) return;
  const roleBuckets = assertionRoleBuckets(assertion);
  const rawThemeIds = normalizeIds((roleBuckets.theme || []).filter((id) => typeof id === 'string' && id.length > 0));
  if (rawThemeIds.length === 0) return;

  const predMentionId = String((((assertion || {}).predicate) || {}).mention_id || '');
  const predMention = mentionById.get(predMentionId);
  if (!predMention) return;
  const predToken = tokenById.get(predMention.head_token_id);
  const predTag = String((((predToken || {}).pos) || {}).tag || '');
  const predIsVerb = isVerbPosTag(predTag);
  const predTokenIds = new Set([String(predMention.head_token_id || '')].filter((id) => id.length > 0));
  const segTokens = tokensBySegment.get(predMention.segment_id) || [];
  const tokenByI = new Map(segTokens.map((t) => [Number(t.i), t]));

  function mentionInfo(mid) {
    const m = mentionById.get(mid);
    if (!m || !Array.isArray(m.token_ids)) return null;
    const toks = m.token_ids.map((tid) => tokenById.get(tid)).filter(Boolean).sort((a, b) => a.i - b.i);
    if (toks.length === 0) return null;
    const ids = toks.map((t) => t.id);
    const hasVerb = toks.some((t) => isVerbPosTag(String((((t || {}).pos) || {}).tag || '')));
    const hasForeignVerb = toks.some((t) => isVerbPosTag(String((((t || {}).pos) || {}).tag || '')) && !predTokenIds.has(String(t.id || '')));
    const hasClauseMarkers = toks.some((t) => {
      const surf = String(t.surface || '').toLowerCase();
      const tag = String((((t || {}).pos) || {}).tag || '').toUpperCase();
      return surf === 'that' || surf === 'which' || surf === 'who' || surf === 'where' || surf === 'before' || surf === 'while' || surf === ',' || tag === ',';
    });
    return {
      mention: m,
      tokenIds: ids,
      startI: toks[0].i,
      tokenCount: toks.length,
      hasVerb,
      hasForeignVerb,
      hasClauseMarkers,
    };
  }

  function pickTrimmedThemeCandidate(themeInfo) {
    const themeSet = new Set(themeInfo.tokenIds);
    const candidates = [];
    for (const m of mentionById.values()) {
      if (!m || m.segment_id !== predMention.segment_id || m.id === themeInfo.mention.id) continue;
      const mids = Array.isArray(m.token_ids) ? m.token_ids : [];
      if (mids.length === 0) continue;
      if (!mids.every((tid) => themeSet.has(tid))) continue;
      const toks = mids.map((tid) => tokenById.get(tid)).filter(Boolean).sort((a, b) => a.i - b.i);
      if (toks.length === 0) continue;
      const hasVerb = toks.some((t) => isVerbPosTag(String((((t || {}).pos) || {}).tag || '')));
      if (hasVerb) continue;
      const headTok = tokenById.get(m.head_token_id);
      const headTag = String((((headTok || {}).pos) || {}).tag || '');
      if (!isNounLikePosTag(headTag) && headTag !== 'PRP' && headTag !== 'PRP$') continue;
      const minI = toks[0].i;
      const prevTok = tokenByI.get(minI - 1);
      const prevTag = String((((prevTok || {}).pos) || {}).tag || '').toUpperCase();
      const prepPenalty = (prevTag === 'IN' || prevTag === 'TO') ? 1 : 0;
      const preferBeforeForPassive = String((((predToken || {}).pos) || {}).tag || '') === 'VBN';
      const afterPredicate = predToken && Number.isFinite(predToken.i)
        ? (preferBeforeForPassive ? (minI < predToken.i ? 0 : 1) : (minI > predToken.i ? 0 : 1))
        : 1;
      candidates.push({
        mentionId: m.id,
        tokenCount: toks.length,
        prepPenalty,
        afterPredicate,
        startI: minI,
      });
    }
    candidates.sort((a, b) => {
      if (a.afterPredicate !== b.afterPredicate) return a.afterPredicate - b.afterPredicate;
      if (a.prepPenalty !== b.prepPenalty) return a.prepPenalty - b.prepPenalty;
      if (a.tokenCount !== b.tokenCount) return b.tokenCount - a.tokenCount;
      if (a.startI !== b.startI) return a.startI - b.startI;
      return a.mentionId.localeCompare(b.mentionId);
    });
    return candidates.length > 0 ? candidates[0].mentionId : null;
  }

  const cleanedTheme = [];
  for (const mid of rawThemeIds) {
    const info = mentionInfo(mid);
    if (!info) continue;

    if (mid === predMentionId) {
      continue;
    }

    if (predIsVerb && info.hasForeignVerb) {
      continue;
    }

    const oversized = info.tokenCount >= 5 && (info.hasClauseMarkers || info.hasVerb);
    if (oversized) {
      const trimmed = pickTrimmedThemeCandidate(info);
      if (trimmed) cleanedTheme.push(trimmed);
      continue;
    }

    cleanedTheme.push(mid);
  }

  roleBuckets.theme = normalizeIds(cleanedTheme);
  applyRoleBucketsToAssertion(assertion, roleBuckets, mentionById);
}

function buildSuppressionEligibilityTrace({ source, assertions, tokenById, clauseKeyByAssertionId }) {
  const sourceSlots = assertionRoleBuckets(source);
  if (!source || !source.predicate) return null;
  const sourceCls = String((((source || {}).diagnostics) || {}).predicate_class || '');
  if (!(sourceCls === 'preposition' || sourceCls === 'nominal_head' || sourceCls === 'auxiliary' || sourceCls === 'copula')) return null;
  const sourceTok = tokenById.get(source.predicate.head_token_id);
  if (!sourceTok) return null;

  const sourceActorIds = normalizeIds((sourceSlots.actor || []).filter((id) => typeof id === 'string' && id.length > 0));
  const sourceThemeIds = normalizeIds((sourceSlots.theme || []).filter((id) => typeof id === 'string' && id.length > 0));
  const sourceAttrIds = normalizeIds((sourceSlots.attr || []).filter((id) => typeof id === 'string' && id.length > 0));
  const sourceTopicIds = normalizeIds((sourceSlots.topic || []).filter((id) => typeof id === 'string' && id.length > 0));
  const sourceLocationIds = normalizeIds((sourceSlots.location || []).filter((id) => typeof id === 'string' && id.length > 0));
  const sourceOther = Array.isArray(sourceSlots.other) ? sourceSlots.other : [];
  const sourceOps = Array.isArray(source.operators) ? source.operators : [];
  const sourcePredicateMentionId = String((((source || {}).predicate) || {}).mention_id || '');
  const selfShapedActor =
    sourceActorIds.length === 0 ||
    (sourceActorIds.length === 1 && sourceActorIds[0] === sourcePredicateMentionId);
  const noCoreSlots =
    sourceActorIds.length === 0 &&
    sourceThemeIds.length === 0 &&
    sourceAttrIds.length === 0 &&
    sourceTopicIds.length === 0 &&
    sourceLocationIds.length === 0;
  const hasCoreSlots = !noCoreSlots;
  const hasOtherResidue = sourceOther.length > 0;
  const hasAnyOps = sourceOps.length > 0;
  const hasOperatorResidue = hasAnyOps;
  const residueModeValid = hasOtherResidue || hasOperatorResidue;
  const hasBlockingOps = assertionHasBlockingOperators(source);
  const hasCompareQuantOps = sourceOps.some((op) => {
    const kind = String((op && op.kind) || '');
    return kind === 'compare' || kind === 'compare_gt' || kind === 'compare_lt' || kind === 'quantifier';
  });
  const copulaLike = sourceCls === 'copula' || isCopulaSurface(sourceTok.surface || '');
  const nominalEligible =
    sourceCls === 'nominal_head' &&
    (String((((source || {}).diagnostics) || {}).predicate_quality || '') === 'ok' ||
      String((((source || {}).diagnostics) || {}).predicate_quality || '') === 'low') &&
    selfShapedActor &&
    noCoreSlots &&
    residueModeValid;
  const prepositionEligible = sourceCls === 'preposition' && hasAnyOps === false;
  const lowAuxiliaryCarrierEligible =
      sourceCls === 'auxiliary' &&
      String((((source || {}).diagnostics) || {}).predicate_quality || '') === 'low' &&
      selfShapedActor &&
      !hasCompareQuantOps;
  let copulaEligible = false;
  if (copulaLike && String((((source || {}).diagnostics) || {}).predicate_quality || '') === 'low' && !hasCompareQuantOps) {
    const disallowedOps = sourceOps.some((op) => {
      const kind = String((op && op.kind) || '');
      return (
        kind === 'modality' ||
        kind === 'negation' ||
        kind === 'coordination_group' ||
        kind === 'control_inherit_subject' ||
        kind === 'control_propagation'
      );
    });
    const hasAttachableSlots =
      ((sourceSlots.theme || []).length > 0) ||
      ((sourceSlots.attr || []).length > 0) ||
      ((sourceSlots.other || []).length > 0);
    copulaEligible = !disallowedOps && hasAttachableSlots;
  }
  let boundedPrepositionEligible = false;
  if (sourceCls === 'preposition' && noCoreSlots) {
    const disallowedOps = sourceOps.some((op) => {
      const kind = String((op && op.kind) || '');
      return kind === 'modality' || kind === 'negation';
    });
    boundedPrepositionEligible = !disallowedOps;
  }
  const anyEligibleClass = nominalEligible || prepositionEligible || copulaEligible || boundedPrepositionEligible || lowAuxiliaryCarrierEligible;

  const sourceClause = clauseKeyByAssertionId.get(source.id);
  const segmentHostCandidates = (assertions || [])
    .filter((host) => {
      if (!host || host.id === source.id) return false;
      if (host.segment_id !== source.segment_id) return false;
      return String((((host || {}).diagnostics) || {}).predicate_class || '') === 'lexical_verb';
    })
    .map((host) => {
      const hostTok = tokenById.get(host.predicate.head_token_id);
      if (!hostTok) return null;
      return {
        host,
        distance: Math.abs(Number(sourceTok.i) - Number(hostTok.i)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.host.id.localeCompare(b.host.id);
    });
  const clauseHostCandidates = segmentHostCandidates.filter(
    (cand) => clauseKeyByAssertionId.get(cand.host.id) === sourceClause
  );
  let hostPool = clauseHostCandidates;
  if (hostPool.length === 0 && noCoreSlots) {
    hostPool = segmentHostCandidates;
  }
  const chosen = hostPool.length > 0 ? hostPool[0] : null;
  const chosenHost = chosen ? chosen.host : null;

  const sourceEvidenceTokenIds = normalizeIds((((source || {}).evidence || {}).token_ids || []).filter((id) => typeof id === 'string' && id.length > 0));
  const sourceOperatorTokenIds = new Set(
    sourceOps
      .map((op) => String((op && op.token_id) || ''))
      .filter((id) => id.length > 0)
  );
  const sourceEvidenceNonOperatorTokenIds = sourceEvidenceTokenIds.filter((id) => !sourceOperatorTokenIds.has(id));
  const chosenHostTokenIds = normalizeIds((((chosenHost || {}).evidence || {}).token_ids || []).filter((id) => typeof id === 'string' && id.length > 0));
  const hostEvidenceSet = new Set(chosenHostTokenIds);
  const missingInHostTokenIds = sourceEvidenceNonOperatorTokenIds.filter((id) => !hostEvidenceSet.has(id));
  const containmentPass = !!chosenHost && missingInHostTokenIds.length === 0;

  const containmentRequired = boundedPrepositionEligible || (nominalEligible && !noCoreSlots) || (lowAuxiliaryCarrierEligible && !noCoreSlots);
  const blockedByOps = hasBlockingOps && !boundedPrepositionEligible && !lowAuxiliaryCarrierEligible && !nominalEligible;
  const hasTransferableResidue = hasOtherResidue || hasOperatorResidue;
  const eligible =
    anyEligibleClass &&
    !blockedByOps &&
    !hasCoreSlots &&
    !!chosenHost &&
    (!containmentRequired || containmentPass) &&
    hasTransferableResidue;
  let failureReason = null;
  if (!eligible) {
    if (hasCoreSlots) failureReason = 'has_core_slots';
    else if (!chosenHost) failureReason = 'no_host';
    else if (containmentRequired && !containmentPass) failureReason = 'no_containment';
    else failureReason = 'no_containment';
  }
  const chosenHostTok = chosenHost ? tokenById.get(chosenHost.predicate.head_token_id) : null;

  return {
    eligible,
    failure_reason: failureReason,
    candidate_class: sourceCls,
    segment_id: String(source.segment_id || ''),
    assertion_id: String(source.id || ''),
    chosen_host_assertion_id: chosenHost ? String(chosenHost.id || '') : null,
    chosen_host_predicate: chosenHostTok ? String(chosenHostTok.surface || '') : null,
    chosen_host_predicate_class: chosenHost ? String(((((chosenHost || {}).diagnostics) || {}).predicate_class) || '') : null,
    source_non_operator_token_ids: sourceEvidenceNonOperatorTokenIds,
    chosen_host_token_ids: chosenHostTokenIds,
    missing_in_host_token_ids: missingInHostTokenIds,
  };
}

function suppressRoleCarrierAssertions({ assertions, tokenById, tokensBySegment, mentionById }) {
  const out = Array.isArray(assertions) ? assertions.slice() : [];
  const byId = new Map(out.map((a) => [a.id, a]));
  const clauseKeyByAssertionId = new Map();
  const suppressedIds = new Set();
  const traces = [];

  for (const a of out) {
    clauseKeyByAssertionId.set(a.id, assertionClauseWindowKey(a, tokenById, tokensBySegment));
  }

  const candidates = out.slice().sort((a, b) => a.id.localeCompare(b.id));

  for (const source of candidates) {
    if (suppressedIds.has(source.id)) continue;
    if (!byId.has(source.id)) continue;
    const sourceSlots = assertionRoleBuckets(source);
    const sourceCls = String((((source || {}).diagnostics) || {}).predicate_class || '');
    const sourceTok = tokenById.get(source.predicate.head_token_id);
    if (!sourceTok) continue;
    const sourceClause = clauseKeyByAssertionId.get(source.id);
    const segmentHostCandidates = out.filter((host) => {
      if (!host || host.id === source.id) return false;
      if (suppressedIds.has(host.id)) return false;
      if (host.segment_id !== source.segment_id) return false;
      if (String((((host || {}).diagnostics) || {}).predicate_class || '') !== 'lexical_verb') return false;
      return true;
    }).map((host) => {
      const hostTok = tokenById.get(host.predicate.head_token_id);
      if (!hostTok) return null;
      const distance = Math.abs(Number(sourceTok.i) - Number(hostTok.i));
      return { host, hostTok, distance };
    }).filter(Boolean);
    if (segmentHostCandidates.length === 0) continue;
    const hostCandidates = segmentHostCandidates.filter(
      (cand) => clauseKeyByAssertionId.get(cand.host.id) === sourceClause
    );
    hostCandidates.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.host.id.localeCompare(b.host.id);
    });
    const sourceActorIds = normalizeIds((sourceSlots.actor || []).filter((id) => typeof id === 'string' && id.length > 0));
    const sourceThemeIds = normalizeIds((sourceSlots.theme || []).filter((id) => typeof id === 'string' && id.length > 0));
    const sourceAttrIds = normalizeIds((sourceSlots.attr || []).filter((id) => typeof id === 'string' && id.length > 0));
    const sourceTopicIds = normalizeIds((sourceSlots.topic || []).filter((id) => typeof id === 'string' && id.length > 0));
    const sourceLocationIds = normalizeIds((sourceSlots.location || []).filter((id) => typeof id === 'string' && id.length > 0));
    const sourceOther = Array.isArray(sourceSlots.other) ? sourceSlots.other : [];
    const copulaLike = sourceCls === 'copula' || isCopulaSurface(sourceTok.surface || '');
    const sourceOps = Array.isArray(source.operators) ? source.operators : [];
    const hasBlockingOps = assertionHasBlockingOperators(source);
    const hasCompareQuantOps = sourceOps.some((op) => {
      const kind = String((op && op.kind) || '');
      return kind === 'compare' || kind === 'compare_gt' || kind === 'compare_lt' || kind === 'quantifier';
    });
    const hasAnyOps = sourceOps.length > 0;
    const sourcePredicateMentionId = String((((source || {}).predicate) || {}).mention_id || '');
    const selfShapedActor =
      sourceActorIds.length === 0 ||
      (sourceActorIds.length === 1 && sourceActorIds[0] === sourcePredicateMentionId);
    const noCoreSlots =
      sourceActorIds.length === 0 &&
      sourceThemeIds.length === 0 &&
      sourceAttrIds.length === 0 &&
      sourceTopicIds.length === 0 &&
      sourceLocationIds.length === 0;
    const hasOtherResidue = sourceOther.length > 0;
    const hasOperatorResidue = hasAnyOps;
    const residueModeValid = hasOtherResidue || hasOperatorResidue;
    const nominalEligible =
      sourceCls === 'nominal_head' &&
      (String((((source || {}).diagnostics) || {}).predicate_quality || '') === 'ok' ||
        String((((source || {}).diagnostics) || {}).predicate_quality || '') === 'low') &&
      selfShapedActor &&
      noCoreSlots &&
      residueModeValid;
    const prepositionEligible = sourceCls === 'preposition' && hasAnyOps === false;
    const lowAuxiliaryCarrierEligible =
      sourceCls === 'auxiliary' &&
      String((((source || {}).diagnostics) || {}).predicate_quality || '') === 'low' &&
      selfShapedActor &&
      !hasCompareQuantOps;
    let copulaEligible = false;
    if (copulaLike && String((((source || {}).diagnostics) || {}).predicate_quality || '') === 'low' && !hasCompareQuantOps) {
      const disallowedOps = sourceOps.some((op) => {
        const kind = String((op && op.kind) || '');
        return (
          kind === 'modality' ||
          kind === 'negation' ||
          kind === 'coordination_group' ||
          kind === 'control_inherit_subject' ||
          kind === 'control_propagation'
        );
      });
      const hasAttachableSlots =
        ((sourceSlots.theme || []).length > 0) ||
        ((sourceSlots.attr || []).length > 0) ||
        ((sourceSlots.other || []).length > 0);
      copulaEligible = !disallowedOps && hasAttachableSlots;
    }
    let boundedPrepositionEligible = false;
    if (sourceCls === 'preposition' && noCoreSlots) {
      const disallowedOps = sourceOps.some((op) => {
        const kind = String((op && op.kind) || '');
        return kind === 'modality' || kind === 'negation';
      });
      boundedPrepositionEligible = !disallowedOps;
    }
    if (!nominalEligible && !prepositionEligible && !copulaEligible && !boundedPrepositionEligible && !lowAuxiliaryCarrierEligible) continue;
    if (hasBlockingOps && !boundedPrepositionEligible && !lowAuxiliaryCarrierEligible && !nominalEligible) continue;

    const sourceEvidenceTokenIds = normalizeIds((((source || {}).evidence || {}).token_ids || []).filter((id) => typeof id === 'string' && id.length > 0));
    const sourceOperatorTokenIds = new Set(
      sourceOps
        .map((op) => String((op && op.token_id) || ''))
        .filter((id) => id.length > 0)
    );
    const sourceEvidenceNonOperatorTokenIds = sourceEvidenceTokenIds.filter((id) => !sourceOperatorTokenIds.has(id));

    let hostPool = hostCandidates.slice();
    const containmentRequired = boundedPrepositionEligible || (nominalEligible && !noCoreSlots) || (lowAuxiliaryCarrierEligible && !noCoreSlots);
    if (containmentRequired) {
      hostPool = hostPool.filter((cand) => {
        const hostEvidenceIds = new Set(
          normalizeIds((((cand.host || {}).evidence || {}).token_ids || []).filter((id) => typeof id === 'string' && id.length > 0))
        );
        return sourceEvidenceNonOperatorTokenIds.every((id) => hostEvidenceIds.has(id));
      });
      if (hostPool.length === 0 && noCoreSlots) {
        hostPool = segmentHostCandidates.filter((cand) => {
          const hostEvidenceIds = new Set(
            normalizeIds((((cand.host || {}).evidence || {}).token_ids || []).filter((id) => typeof id === 'string' && id.length > 0))
          );
          return sourceEvidenceNonOperatorTokenIds.every((id) => hostEvidenceIds.has(id));
        });
      }
      if (hostPool.length === 0) continue;
      hostPool.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return a.host.id.localeCompare(b.host.id);
      });
    }

    if (hostPool.length === 0) continue;
    let chosen = hostPool[0];
    if (copulaEligible) {
      const scored = hostPool.map((h) => {
        const hostRefs = collectAssertionMentionRefs(h.host);
        const sharedActor = sourceActorIds.some((id) => hostRefs.has(id));
        return { ...h, sharedActor };
      });
      const withShared = scored.filter((x) => x.sharedActor);
      const pool = withShared.length > 0 ? withShared : (sourceActorIds.length === 0 ? scored : []);
      if (pool.length === 0) continue;
      pool.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return a.host.id.localeCompare(b.host.id);
      });
      chosen = pool[0];
    }
    const host = chosen.host;
    if (!host || !byId.has(host.id)) continue;

    let transfer;
    let reason;
    if (copulaEligible) {
      transfer = transferNamedBucketsToHostOther(source, host, [
        { from: 'theme', to: 'attached_copula_theme' },
        { from: 'attr', to: 'attached_copula_attr' },
        { from: 'other', to: 'attached_copula_other' },
      ], mentionById);
      reason = 'copula_bucket_sink_suppressed';
    } else if (nominalEligible) {
      transfer = transferNamedBucketsToHostOther(source, host, [
        { from: 'theme', to: 'attached_theme' },
        { from: 'attr', to: 'attached_attr' },
        { from: 'topic', to: 'attached_topic' },
        { from: 'location', to: 'attached_location' },
        { from: 'other', to: 'attached_other' },
      ], mentionById);
      const transferredOperatorKinds = transferOperatorsToHost(source, host);
      if (transferredOperatorKinds.length > 0) {
        transfer.transferred_buckets = normalizeIds(
          (transfer.transferred_buckets || []).concat(transferredOperatorKinds.map((k) => `operator:${k}`))
        );
      }
      reason = 'role_carrier_suppressed_v2_nominal';
    } else if (lowAuxiliaryCarrierEligible) {
      transfer = transferNamedBucketsToHostOther(source, host, [
        { from: 'theme', to: 'attached_theme' },
        { from: 'attr', to: 'attached_attr' },
        { from: 'topic', to: 'attached_topic' },
        { from: 'location', to: 'attached_location' },
        { from: 'other', to: 'attached_other' },
      ], mentionById);
      const transferredOperatorKinds = transferOperatorsToHost(source, host);
      if (transferredOperatorKinds.length > 0) {
        transfer.transferred_buckets = normalizeIds(
          (transfer.transferred_buckets || []).concat(transferredOperatorKinds.map((k) => 'operator:' + k))
        );
      }
      reason = 'role_carrier_suppressed';
    } else if (boundedPrepositionEligible) {
      transfer = transferNamedBucketsToHostOther(source, host, [
        { from: 'other', to: 'attached_other' },
      ], mentionById);
      const transferredOperatorKinds = transferOperatorsToHost(source, host);
      if (transferredOperatorKinds.length > 0) {
        transfer.transferred_buckets = normalizeIds(
          (transfer.transferred_buckets || []).concat(transferredOperatorKinds.map((k) => 'operator:' + k))
        );
      }
      reason = 'role_carrier_suppressed';
    } else {
      transfer = {
        transferred_buckets: transferRoleCarrierBucketsToHost(source, host, mentionById),
        transferred_mention_ids: collectRoleBucketMentionIds(source, ['actor', 'theme', 'attr', 'topic', 'location', 'other']),
      };
      reason = 'role_carrier_suppressed';
    }
    const hasTransferredMentions = Array.isArray(transfer && transfer.transferred_mention_ids) && transfer.transferred_mention_ids.length > 0;
    const hasTransferredOperatorResidue =
      Array.isArray(transfer && transfer.transferred_buckets) &&
      transfer.transferred_buckets.some((x) => typeof x === 'string' && x.startsWith('operator:'));
    const sourceMentionIds = collectRoleBucketMentionIds(source, ['actor', 'theme', 'attr', 'topic', 'location', 'other']);
    const hostMentionRefs = collectAssertionMentionRefs(host);
    const sourceMentionResidue = sourceMentionIds.filter((id) => !hostMentionRefs.has(id));
    const redundantCarrier =
      (copulaEligible || nominalEligible || lowAuxiliaryCarrierEligible) &&
      sourceMentionResidue.length === 0 &&
      !hasTransferredOperatorResidue;
    if (!transfer || (!hasTransferredMentions && !hasTransferredOperatorResidue && !redundantCarrier)) {
      continue;
    }
    const hostEvidenceTokenIds = new Set((((host || {}).evidence) || {}).token_ids || []);
    for (const tid of ((((source || {}).evidence) || {}).token_ids || [])) hostEvidenceTokenIds.add(tid);
    hostEvidenceTokenIds.add(source.predicate.head_token_id);
    hostEvidenceTokenIds.add(host.predicate.head_token_id);
    if (!host.evidence || typeof host.evidence !== 'object') host.evidence = {};
    host.evidence.token_ids = normalizeIds(Array.from(hostEvidenceTokenIds));

    const tokenIds = new Set((source.evidence && source.evidence.token_ids) || []);
    tokenIds.add(source.predicate.head_token_id);
    tokenIds.add(host.predicate.head_token_id);
    traces.push({
      id: source.id,
      segment_id: source.segment_id,
      predicate: {
        mention_id: source.predicate.mention_id,
        head_token_id: source.predicate.head_token_id,
      },
      diagnostics: {
        predicate_quality: String((((source || {}).diagnostics) || {}).predicate_quality || ''),
        suppressed_by: {
          kind: 'predicate_redirect',
          target_assertion_id: host.id,
          reason,
          evidence: {
            upstream_relation_ids: [],
            token_ids: normalizeIds(Array.from(tokenIds)),
          },
        },
      },
      suppressed_assertion_id: source.id,
      host_assertion_id: host.id,
      reason,
      predicate_class: sourceCls,
      transferred_buckets: transfer.transferred_buckets || [],
      transferred_mention_ids: transfer.transferred_mention_ids || [],
      evidence: {
        token_ids: normalizeIds(Array.from(tokenIds)),
      },
    });
    suppressedIds.add(source.id);
  }

  const kept = out.filter((a) => !suppressedIds.has(a.id));
  traces.sort((a, b) => a.id.localeCompare(b.id));
  return { assertions: kept, suppressedTraces: traces };
}

function choosePredicateUpgradeCandidate(currentPredicateTokenId, assertionRelations, tokenById) {
  const currentTok = tokenById.get(currentPredicateTokenId);
  if (!currentTok) return null;

  const byToken = new Map();
  const rels = Array.isArray(assertionRelations) ? assertionRelations : [];
  const clauseLinkLabels = new Set(['complement_clause', 'xcomp']);

  function consider(tokenId, cls, relationId) {
    if (typeof tokenId !== 'string' || tokenId.length === 0) return;
    if (tokenId === currentPredicateTokenId) return;
    const tok = tokenById.get(tokenId);
    if (!tok) return;
    if (tok.segment_id !== currentTok.segment_id) return;
    const tag = String((((tok || {}).pos) || {}).tag || '');
    if (!isLexicalVerbPos(tag)) return;
    if (!byToken.has(tokenId)) {
      byToken.set(tokenId, { token_id: tokenId, class_priority: cls, upstream_relation_ids: new Set() });
    }
    const item = byToken.get(tokenId);
    if (cls < item.class_priority) item.class_priority = cls;
    if (typeof relationId === 'string' && relationId.length > 0) item.upstream_relation_ids.add(relationId);
  }

  for (const rel of rels) {
    if (!rel || typeof rel !== 'object') continue;
    const ev = rel.evidence && typeof rel.evidence === 'object' ? rel.evidence : {};
    const relId = typeof rel.relation_id === 'string' ? rel.relation_id : '';
    if (ev.pattern === 'modality_unified' && typeof ev.chosen_predicate_token_id === 'string') {
      consider(ev.chosen_predicate_token_id, 1, relId);
    }
    if (ev.pattern === 'copula_frame' && typeof ev.verb_token_id === 'string') {
      consider(ev.verb_token_id, 2, relId);
    }
    if (clauseLinkLabels.has(String(rel.label || ''))) {
      consider(rel.dep_token_id, 3, relId);
    }
  }

  const candidates = Array.from(byToken.values()).sort((a, b) => {
    if (a.class_priority !== b.class_priority) return a.class_priority - b.class_priority;
    const ta = tokenById.get(a.token_id);
    const tb = tokenById.get(b.token_id);
    if (ta.i !== tb.i) return ta.i - tb.i;
    return a.token_id.localeCompare(b.token_id);
  });
  if (candidates.length === 0) return null;
  const selected = candidates[0];
  return {
    token_id: selected.token_id,
    upstream_relation_ids: normalizeIds(Array.from(selected.upstream_relation_ids)),
  };
}

function mergeModalityCopulaAssertions({ assertions, projected, mentionById, tokenById }) {
  const linkLabels = new Set(['complement_clause', 'xcomp']);
  const byAssertionId = new Map((assertions || []).map((a) => [a.id, a]));
  const suppressedById = new Set();
  const suppressedTraces = [];

  function findLinkRelationIds(fromMentionId, toMentionId) {
    const out = [];
    for (const rel of projected || []) {
      if (!rel || !linkLabels.has(String(rel.label || ''))) continue;
      const direct = rel.head_mention_id === fromMentionId && rel.dep_mention_id === toMentionId;
      const reverse = rel.head_mention_id === toMentionId && rel.dep_mention_id === fromMentionId;
      if (!direct && !reverse) continue;
      if (typeof rel.relation_id === 'string' && rel.relation_id.length > 0) out.push(rel.relation_id);
    }
    return normalizeIds(out);
  }

  function modalityOperators(a) {
    return (Array.isArray(a && a.operators) ? a.operators : []).filter((op) => op && op.kind === 'modality');
  }

  function nonModalityOperators(a) {
    return (Array.isArray(a && a.operators) ? a.operators : []).filter((op) => op && op.kind !== 'modality');
  }

  const candidates = (assertions || []).filter((a) => {
    if (!a || !a.predicate || typeof a.predicate.mention_id !== 'string') return false;
    const q = (((a || {}).diagnostics || {}).predicate_quality) || '';
    if (q !== 'low') return false;
    const predMention = mentionById.get(a.predicate.mention_id);
    const predTok = predMention ? tokenById.get(predMention.head_token_id) : null;
    if (!isLowQualityPredicateToken(predTok)) return false;
    if (modalityOperators(a).length === 0) return false;
    if (nonModalityOperators(a).length > 0) return false;
    if (!roleBucketsAreSemanticallyEmpty(assertionRoleBuckets(a))) return false;
    return true;
  }).sort((a, b) => a.id.localeCompare(b.id));

  for (const source of candidates) {
    if (suppressedById.has(source.id)) continue;
    const sourcePredMention = mentionById.get(source.predicate.mention_id);
    const sourceHeadTok = sourcePredMention ? tokenById.get(sourcePredMention.head_token_id) : null;
    if (!sourcePredMention || !sourceHeadTok) continue;

    const targetCandidates = [];
    for (const target of assertions || []) {
      if (!target || target.id === source.id) continue;
      if (suppressedById.has(target.id)) continue;
      if (target.segment_id !== source.segment_id) continue;
      const tq = (((target || {}).diagnostics || {}).predicate_quality) || '';
      if (tq === 'low') continue;
      const targetMention = mentionById.get(target.predicate.mention_id);
      const targetTok = targetMention ? tokenById.get(targetMention.head_token_id) : null;
      const targetTag = String((((targetTok || {}).pos) || {}).tag || '');
      if (!targetTok || !isLexicalVerbPos(targetTag)) continue;
      const linkageIds = findLinkRelationIds(source.predicate.mention_id, target.predicate.mention_id);
      if (linkageIds.length === 0) continue;
      targetCandidates.push({
        target,
        targetMention,
        targetTok,
        linkageIds,
      });
    }

    targetCandidates.sort((a, b) => {
      if (a.targetTok.i !== b.targetTok.i) return a.targetTok.i - b.targetTok.i;
      if (a.targetTok.id !== b.targetTok.id) return a.targetTok.id.localeCompare(b.targetTok.id);
      return a.target.id.localeCompare(b.target.id);
    });
    if (targetCandidates.length === 0) continue;
    const chosen = targetCandidates[0];

    const mergedOps = new Map();
    for (const op of chosen.target.operators || []) {
      mergeOperator(mergedOps, op);
    }
    for (const op of modalityOperators(source)) {
      mergeOperator(mergedOps, op);
    }
    chosen.target.operators = Array.from(mergedOps.values())
      .map((op) => ({ ...op, evidence: dedupeAndSortEvidence(op.evidence || []) }))
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        if ((a.value || '') !== (b.value || '')) return (a.value || '').localeCompare(b.value || '');
        if ((a.group_id || '') !== (b.group_id || '')) return (a.group_id || '').localeCompare(b.group_id || '');
        if ((a.token_id || '') !== (b.token_id || '')) return (a.token_id || '').localeCompare(b.token_id || '');
        return (a.role || '').localeCompare(b.role || '');
      });

    const tokenIds = new Set([
      source.predicate.head_token_id,
      chosen.target.predicate.head_token_id,
    ]);
    for (const op of modalityOperators(source)) {
      for (const ev of op.evidence || []) {
        if (ev && typeof ev.to_token_id === 'string') tokenIds.add(ev.to_token_id);
      }
    }
    suppressedById.add(source.id);
    suppressedTraces.push({
      id: source.id,
      segment_id: source.segment_id,
      predicate: {
        mention_id: source.predicate.mention_id,
        head_token_id: source.predicate.head_token_id,
      },
      diagnostics: {
        predicate_quality: (((source || {}).diagnostics || {}).predicate_quality) || 'low',
        suppressed_by: {
          kind: 'predicate_redirect',
          target_assertion_id: chosen.target.id,
          reason: 'modality_moved_to_lexical',
          evidence: {
            upstream_relation_ids: chosen.linkageIds,
            token_ids: normalizeIds(Array.from(tokenIds)),
          },
        },
      },
    });
  }

  const kept = (assertions || []).filter((a) => !suppressedById.has(a.id));
  kept.sort((a, b) => {
    if (a.segment_id !== b.segment_id) return a.segment_id.localeCompare(b.segment_id);
    const pa = tokenById.get(a.predicate.head_token_id);
    const pb = tokenById.get(b.predicate.head_token_id);
    if (pa.span.start !== pb.span.start) return pa.span.start - pb.span.start;
    return a.id.localeCompare(b.id);
  });
  suppressedTraces.sort((a, b) => a.id.localeCompare(b.id));

  return { assertions: kept, suppressedTraces };
}

function buildAssertions({ projected, mentionById, tokenById }) {
  const byPredicate = new Map();
  for (const p of projected) {
    if (!byPredicate.has(p.head_mention_id)) byPredicate.set(p.head_mention_id, []);
    byPredicate.get(p.head_mention_id).push(p);
  }
  const coordGroups = buildCoordinationGroups(projected);
  const coordEvidenceByMention = new Map();
  for (const p of projected) {
    if (p.label !== 'coordination') continue;
    const evidenceItem = {
      annotation_id: p.relation_id || 'r:unknown',
      from_token_id: p.head_token_id,
      to_token_id: p.dep_token_id,
      label: p.label,
    };
    for (const mentionId of [p.head_mention_id, p.dep_mention_id]) {
      if (!coordEvidenceByMention.has(mentionId)) coordEvidenceByMention.set(mentionId, []);
      coordEvidenceByMention.get(mentionId).push(evidenceItem);
    }
  }

  const assertions = [];
  const suppressedAssertions = [];
  const coveredMentions = new Set();
  const tokenMentionIds = new Map();
  for (const m of mentionById.values()) {
    for (const tid of m.token_ids || []) {
      if (!tokenMentionIds.has(tid)) tokenMentionIds.set(tid, []);
      tokenMentionIds.get(tid).push(m.id);
    }
  }
  for (const ids of tokenMentionIds.values()) ids.sort((a, b) => a.localeCompare(b));

  const bySegment = new Map();
  for (const t of tokenById.values()) {
    if (!bySegment.has(t.segment_id)) bySegment.set(t.segment_id, []);
    bySegment.get(t.segment_id).push(t);
  }
  for (const arr of bySegment.values()) arr.sort((a, b) => a.i - b.i);

  const primaryMentionsBySegment = new Map();
  for (const m of mentionById.values()) {
    if (!m || !m.is_primary) continue;
    if (!primaryMentionsBySegment.has(m.segment_id)) primaryMentionsBySegment.set(m.segment_id, []);
    primaryMentionsBySegment.get(m.segment_id).push(m);
  }
  for (const arr of primaryMentionsBySegment.values()) {
    arr.sort((a, b) => {
      if (a.span.start !== b.span.start) return a.span.start - b.span.start;
      if (a.span.end !== b.span.end) return a.span.end - b.span.end;
      return a.id.localeCompare(b.id);
    });
  }

  const projectedMentionIds = new Set();
  for (const p of projected) {
    projectedMentionIds.add(p.head_mention_id);
    projectedMentionIds.add(p.dep_mention_id);
  }

  const coordEdges = projected.filter((p) => p.label === 'coordination');
  const coordEvidenceByGroup = new Map();
  for (const edge of coordEdges) {
    const gid = coordGroups.get(edge.head_mention_id) || coordGroups.get(edge.dep_mention_id);
    if (!gid) continue;
    if (!coordEvidenceByGroup.has(gid)) coordEvidenceByGroup.set(gid, []);
    coordEvidenceByGroup.get(gid).push({
      annotation_id: edge.relation_id || 'r:unknown',
      from_token_id: edge.head_token_id,
      to_token_id: edge.dep_token_id,
      label: edge.label,
    });
  }

  function mentionStartI(mention) {
    const ids = Array.isArray(mention && mention.token_ids) ? mention.token_ids : [];
    const toks = ids.map((id) => tokenById.get(id)).filter(Boolean);
    if (toks.length === 0) return Number.MAX_SAFE_INTEGER;
    return Math.min(...toks.map((t) => t.i));
  }

  function mentionHasVerbToken(mention) {
    const ids = Array.isArray(mention && mention.token_ids) ? mention.token_ids : [];
    return ids.some((id) => isVerbPosTag((((tokenById.get(id) || {}).pos) || {}).tag));
  }

  function chooseThemeMentionForPredicateToken(predTok, existingIds) {
    const segMentions = primaryMentionsBySegment.get(predTok.segment_id) || [];
    const used = new Set(existingIds || []);
    const candidates = segMentions.filter((m) => {
      if (used.has(m.id) || m.id === `m:${predTok.segment_id}:${predTok.span.start}-${predTok.span.end}:token`) return false;
      if (!m.span || m.span.start < predTok.span.end) return false;
      const startI = mentionStartI(m);
      if (!Number.isFinite(startI) || startI - predTok.i > 8) return false;
      const headTok = tokenById.get(m.head_token_id);
      const headTag = String((((headTok || {}).pos) || {}).tag || '');
      if (m.kind === 'mwe' || isNounLikePosTag(headTag)) return true;
      return false;
    });
    candidates.sort((a, b) => {
      const aSpanLen = Array.isArray(a && a.token_ids) ? a.token_ids.length : Number.MAX_SAFE_INTEGER;
      const bSpanLen = Array.isArray(b && b.token_ids) ? b.token_ids.length : Number.MAX_SAFE_INTEGER;
      if (aSpanLen !== bSpanLen) return aSpanLen - bSpanLen;
      const da = Math.abs(mentionStartI(a) - predTok.i);
      const db = Math.abs(mentionStartI(b) - predTok.i);
      if (da !== db) return da - db;
      if (a.span.start !== b.span.start) return a.span.start - b.span.start;
      return a.id.localeCompare(b.id);
    });
    return candidates.length > 0 ? candidates[0] : null;
  }

  const spatialPrepMap = new Set(['in', 'into', 'on', 'onto', 'at', 'to', 'from', 'inside', 'within', 'under', 'over', 'near']);
  function chooseLocationMentionForPredicateToken(predTok, existingIds) {
    const segToks = bySegment.get(predTok.segment_id) || [];
    const idx = segToks.findIndex((t) => t.id === predTok.id);
    if (idx < 0) return null;
    const used = new Set(existingIds || []);
    for (let i = idx + 1; i < Math.min(segToks.length, idx + 9); i += 1) {
      const t = segToks[i];
      const surface = String(t.surface || '').toLowerCase();
      const tag = String((((t || {}).pos) || {}).tag || '');
      if (tag !== 'IN' || !spatialPrepMap.has(surface)) continue;
      const segMentions = primaryMentionsBySegment.get(predTok.segment_id) || [];
      const cands = segMentions.filter((m) => {
        if (used.has(m.id)) return false;
        const startI = mentionStartI(m);
        if (!Number.isFinite(startI) || startI <= t.i || startI - t.i > 5) return false;
        const headTok = tokenById.get(m.head_token_id);
        const headTag = String((((headTok || {}).pos) || {}).tag || '');
        return m.kind === 'mwe' || isNounLikePosTag(headTag);
      });
      cands.sort((a, b) => {
        const aSpanLen = Array.isArray(a && a.token_ids) ? a.token_ids.length : Number.MAX_SAFE_INTEGER;
        const bSpanLen = Array.isArray(b && b.token_ids) ? b.token_ids.length : Number.MAX_SAFE_INTEGER;
        if (aSpanLen !== bSpanLen) return aSpanLen - bSpanLen;
        const da = mentionStartI(a) - t.i;
        const db = mentionStartI(b) - t.i;
        if (da !== db) return da - db;
        return a.id.localeCompare(b.id);
      });
      if (cands.length > 0) return cands[0];
    }
    return null;
  }

  function mentionOverlapsTokenSet(mentionId, tokenIdSet) {
    if (!mentionId || !tokenIdSet || tokenIdSet.size === 0) return false;
    const mention = mentionById.get(mentionId);
    if (!mention || !Array.isArray(mention.token_ids)) return false;
    return mention.token_ids.some((tid) => tokenIdSet.has(tid));
  }

  function chooseMentionForToken(tokenId, segmentId, excludeMentionId, excludeTokenIds, preferMinimalSpan) {
    const candidateMentionIds = (tokenMentionIds.get(tokenId) || []).filter((id) => {
      if (!excludeTokenIds || excludeTokenIds.size === 0) return true;
      return !mentionOverlapsTokenSet(id, excludeTokenIds);
    });
    return chooseBestMentionForToken({
      tokenId,
      segmentId,
      mentionById,
      candidateMentionIds,
      excludeMentionId: excludeMentionId || null,
      preferMinimalSpan: preferMinimalSpan === true,
    });
  }

  const predicateIds = Array.from(byPredicate.keys()).sort((a, b) => {
    const ma = mentionById.get(a);
    const mb = mentionById.get(b);
    if (ma.segment_id !== mb.segment_id) return ma.segment_id.localeCompare(mb.segment_id);
    if (ma.span.start !== mb.span.start) return ma.span.start - mb.span.start;
    return a.localeCompare(b);
  });

  for (const predId of predicateIds) {
    const originalPredMention = mentionById.get(predId);
    if (!originalPredMention) continue;
    const rels = byPredicate.get(predId) || [];
    rels.sort((a, b) => {
      const ta = tokenById.get(a.dep_token_id);
      const tb = tokenById.get(b.dep_token_id);
      if (ta.span.start !== tb.span.start) return ta.span.start - tb.span.start;
      if (a.label !== b.label) return a.label.localeCompare(b.label);
      return a.relation_id.localeCompare(b.relation_id);
    });

    let effectivePredMention = originalPredMention;
    let effectivePredId = predId;
    let suppressionPointer = null;
    let predicateUpgradeApplied = false;
    const originalPredTok = tokenById.get(originalPredMention.head_token_id);
    const originalPredicateClass = classifyPredicateClass(originalPredTok);
    if (
      isLowQualityPredicateToken(originalPredTok) ||
      originalPredicateClass === 'preposition' ||
      originalPredicateClass === 'nominal_head'
    ) {
      const upgrade = choosePredicateUpgradeCandidate(originalPredMention.head_token_id, rels, tokenById);
      if (upgrade && typeof upgrade.token_id === 'string') {
        const upgradeMentionId = chooseMentionForToken(
          upgrade.token_id,
          originalPredMention.segment_id,
          null,
          null,
          false
        ).mention_id;
        const upgradeMention = upgradeMentionId ? mentionById.get(upgradeMentionId) : null;
        if (upgradeMention) {
          effectivePredMention = upgradeMention;
          effectivePredId = upgradeMention.id;
          predicateUpgradeApplied = true;
          suppressionPointer = {
            kind: 'predicate_redirect',
            reason: 'predicate_upgraded_to_lexical',
            upstream_relation_ids: upgrade.upstream_relation_ids || [],
          };
        }
      }
    }
    if (originalPredicateClass === 'preposition' && !predicateUpgradeApplied) {
      continue;
    }
    if (isMakeSureScaffoldPredicate({ predTok: originalPredTok, projected, tokensBySegment: bySegment })) {
      coveredMentions.add(predId);
      continue;
    }

    const roleBuckets = {
      actor: [],
      theme: [],
      attr: [],
      topic: [],
      location: [],
      other: [],
    };
    const otherRoleMap = new Map();
    const operatorsByKey = new Map();
    const evidenceItems = [];
    const evidenceTokenIds = new Set(effectivePredMention.token_ids);
    const effectivePredTokForOverlap = tokenById.get(effectivePredMention.head_token_id);
    const effectivePredTagForOverlap = String((((effectivePredTokForOverlap || {}).pos) || {}).tag || '');
    const predicateTokenIdSet = isVerbPosTag(effectivePredTagForOverlap)
      ? new Set(effectivePredMention.token_ids || [])
      : new Set();
    const applyStrictThemeClauseGate = effectivePredTagForOverlap === 'VBN';
    let bucketProjectionChoice = null;
    const segTokensForClause = bySegment.get(effectivePredMention.segment_id) || [];
    const predIdxForClause = segTokensForClause.findIndex((t) => t && t.id === effectivePredMention.head_token_id);
    let clauseLeftI = Number.NEGATIVE_INFINITY;
    let clauseRightI = Number.POSITIVE_INFINITY;
    if (predIdxForClause >= 0) {
      let left = predIdxForClause;
      let right = predIdxForClause;
      while (left - 1 >= 0 && !isClauseBoundaryToken(segTokensForClause[left - 1])) left -= 1;
      while (right + 1 < segTokensForClause.length && !isClauseBoundaryToken(segTokensForClause[right + 1])) right += 1;
      clauseLeftI = Number(segTokensForClause[left].i);
      clauseRightI = Number(segTokensForClause[right].i);
    }
    function mentionInsidePredicateClause(mentionId) {
      const mention = mentionById.get(mentionId);
      if (!mention || !Array.isArray(mention.token_ids) || mention.token_ids.length === 0) return true;
      for (const tid of mention.token_ids) {
        const tok = tokenById.get(tid);
        if (!tok || typeof tok.i !== 'number') continue;
        if (tok.i < clauseLeftI || tok.i > clauseRightI) return false;
      }
      return true;
    }

    for (const r of rels) {
      const evidenceItem = {
        annotation_id: r.relation_id || 'r:unknown',
        from_token_id: r.head_token_id,
        to_token_id: r.dep_token_id,
        label: r.label,
      };
      evidenceItems.push(evidenceItem);
      evidenceTokenIds.add(r.dep_token_id);
      const depMentionPick = chooseMentionForToken(
        r.dep_token_id,
        effectivePredMention.segment_id,
        effectivePredId,
        predicateTokenIdSet,
        true
      );
      const depMentionIdFromPick = depMentionPick && typeof depMentionPick.mention_id === 'string'
        ? depMentionPick.mention_id
        : null;
      const depMentionIdFromRelation = typeof r.dep_mention_id === 'string' ? r.dep_mention_id : null;
      let depMentionIdForSlot = depMentionIdFromPick || depMentionIdFromRelation;
      if (mentionOverlapsTokenSet(depMentionIdForSlot, predicateTokenIdSet)) {
        depMentionIdForSlot = null;
      }
      const depMention = depMentionIdForSlot ? mentionById.get(depMentionIdForSlot) : null;
      if (depMention) {
        for (const tid of depMention.token_ids) evidenceTokenIds.add(tid);
      }

      if (r.label === 'modality') {
        const t = tokenById.get(r.dep_token_id);
        mergeOperator(operatorsByKey, {
          kind: 'modality',
          value: t ? t.surface : '',
          evidence: [evidenceItem],
        });
        if (depMentionIdForSlot) coveredMentions.add(depMentionIdForSlot);
        continue;
      }
      if (r.label === 'negation') {
        mergeOperator(operatorsByKey, {
          kind: 'negation',
          token_id: r.dep_token_id,
          evidence: [evidenceItem],
        });
        if (depMentionIdForSlot) coveredMentions.add(depMentionIdForSlot);
        continue;
      }
      if (r.label === 'coordination') {
      const gid = coordGroups.get(effectivePredId) || `cg:${sha256Hex(`${effectivePredId}|${depMentionIdForSlot}`).slice(0, 12)}`;
        const coordType = r.evidence && (
          r.evidence.coord_type ||
          r.evidence.coordination_type ||
          r.evidence.coordinator_type
        );
        mergeOperator(operatorsByKey, {
          kind: 'coordination_group',
          group_id: gid,
          value: typeof coordType === 'string' && coordType.length > 0 ? String(coordType).toLowerCase() : undefined,
          evidence: [evidenceItem],
        });
        if (depMentionIdForSlot) coveredMentions.add(depMentionIdForSlot);
        continue;
      }
      if (isCompareLabel(r.label)) {
        mergeOperator(operatorsByKey, {
          kind: r.label,
          token_id: r.dep_token_id,
          evidence: [evidenceItem],
        });
        if (depMentionIdForSlot) coveredMentions.add(depMentionIdForSlot);
        continue;
      }
      if (isQuantifierLabel(r.label)) {
        const depTok = tokenById.get(r.dep_token_id);
        mergeOperator(operatorsByKey, {
          kind: 'quantifier',
          token_id: r.dep_token_id,
          value: depTok && typeof depTok.surface === 'string' ? depTok.surface.toLowerCase() : '',
          evidence: [evidenceItem],
        });
        if (depMentionIdForSlot) coveredMentions.add(depMentionIdForSlot);
        continue;
      }
      if (r.label === 'complement_clause' || (r.evidence && r.evidence.pattern === 'control_inherit_subject')) {
        mergeOperator(operatorsByKey, {
          kind: 'control_inherit_subject',
          evidence: [evidenceItem],
        });
      }
      if (r.label === 'purpose' || (r.evidence && r.evidence.pattern === 'control_propagation')) {
        mergeOperator(operatorsByKey, {
          kind: 'control_propagation',
          evidence: [evidenceItem],
        });
      }

      const map = roleToSlot(r.label);
      if (
        depMentionPick.candidate_count >= 2 &&
        depMentionIdForSlot &&
        depMentionPick.chosen_was_first === false &&
        !bucketProjectionChoice
      ) {
        bucketProjectionChoice = {
          candidate_count: depMentionPick.candidate_count,
          chosen_mention_id: depMentionIdForSlot,
        };
      }
      if (!depMentionIdForSlot) {
        continue;
      }
      if (map.slot === 'theme' && applyStrictThemeClauseGate && !mentionInsidePredicateClause(depMentionIdForSlot)) {
        continue;
      }
      if (map.slot === 'other') {
        const key = map.role || r.label;
        if (!otherRoleMap.has(key)) otherRoleMap.set(key, new Set());
        otherRoleMap.get(key).add(depMentionIdForSlot);
      } else {
        roleBuckets[map.slot].push(depMentionIdForSlot);
      }
      coveredMentions.add(depMentionIdForSlot);
    }

    if (coordGroups.has(effectivePredId)) {
      mergeOperator(operatorsByKey, {
        kind: 'coordination_group',
        group_id: coordGroups.get(effectivePredId),
        evidence: dedupeAndSortEvidence(coordEvidenceByMention.get(effectivePredId) || []),
      });
    }

    roleBuckets.actor = normalizeIds(roleBuckets.actor);
    roleBuckets.theme = normalizeIds(roleBuckets.theme);
    roleBuckets.attr = normalizeIds(roleBuckets.attr);
    roleBuckets.topic = normalizeIds(roleBuckets.topic);
    roleBuckets.location = normalizeIds(roleBuckets.location);
    roleBuckets.other = Array.from(otherRoleMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([role, ids]) => ({ role, mention_ids: normalizeIds(Array.from(ids)) }));

    const copulaSet = new Set(['is', 'are', 'was', 'were', 'be', 'been', 'being']);
    if (roleBuckets.attr.length === 0 && roleBuckets.theme.length === 0) {
      const predTok = tokenById.get(effectivePredMention.head_token_id);
      const predSurface = String(predTok && predTok.surface ? predTok.surface : '').toLowerCase();
      if (predTok && copulaSet.has(predSurface)) {
        const segTokens = bySegment.get(predTok.segment_id) || [];
        const idx = segTokens.findIndex((t) => t.id === predTok.id);
        if (idx >= 0) {
          const lookahead = segTokens.slice(idx + 1, idx + 4);
          const jj = lookahead.find((t) => /^(JJ|JJR|JJS)$/.test(String((t.pos || {}).tag || '')));
          if (jj) {
            const midPick = chooseMentionForToken(
              jj.id,
              effectivePredMention.segment_id,
              effectivePredId,
              predicateTokenIdSet,
              true
            );
            const mid = midPick && typeof midPick.mention_id === 'string' ? midPick.mention_id : null;
            if (mid) {
              roleBuckets.attr.push(mid);
              coveredMentions.add(mid);
            }
          }
        }
      }
    }

    {
      const predTok = tokenById.get(effectivePredMention.head_token_id);
      const predSurface = String(predTok && predTok.surface ? predTok.surface : '').toLowerCase();
      const predTag = String((((predTok || {}).pos) || {}).tag || '');
      if (predTok && isVerbPosTag(predTag) && !isCopulaSurface(predSurface)) {
        if (roleBuckets.theme.length === 0) {
          const theme = chooseThemeMentionForPredicateToken(predTok, roleBuckets.actor.concat(roleBuckets.attr, roleBuckets.topic, roleBuckets.location));
          if (theme && projectedMentionIds.has(theme.id)) {
            roleBuckets.theme = normalizeIds(roleBuckets.theme.concat([theme.id]));
            coveredMentions.add(theme.id);
          }
        }
        if (roleBuckets.location.length === 0) {
          const location = chooseLocationMentionForPredicateToken(predTok, roleBuckets.actor.concat(roleBuckets.theme, roleBuckets.attr, roleBuckets.topic));
          if (location && projectedMentionIds.has(location.id)) {
            roleBuckets.location = normalizeIds(roleBuckets.location.concat([location.id]));
            coveredMentions.add(location.id);
          }
        }
      }
    }
    const predTokForDiagnostics = tokenById.get(effectivePredMention.head_token_id);
    const workingAssertion = {
      predicate: { mention_id: effectivePredId },
      diagnostics: { predicate_quality: isLowQualityPredicateToken(predTokForDiagnostics) ? 'low' : 'ok' },
    };
    applyRoleBucketsToAssertion(workingAssertion, {
      actor: roleBuckets.actor.slice(),
      theme: roleBuckets.theme.slice(),
      attr: roleBuckets.attr.slice(),
      topic: roleBuckets.topic.slice(),
      location: roleBuckets.location.slice(),
      other: roleBuckets.other.map((o) => ({ role: o.role, mention_ids: (o.mention_ids || []).slice() })),
    }, mentionById);
    enforceCoreBucketTokenDisjointness(workingAssertion, mentionById, tokenById);
    pruneLowCopulaBuckets(workingAssertion, mentionById, tokenById, bySegment);
    trimCatchAllThemeBuckets(workingAssertion, mentionById, tokenById, bySegment);
    const workingSlots = assertionRoleBuckets(workingAssertion);
    roleBuckets.actor = normalizeIds(workingSlots.actor || []);
    roleBuckets.theme = normalizeIds(workingSlots.theme || []);
    roleBuckets.attr = normalizeIds(workingSlots.attr || []);
    roleBuckets.topic = normalizeIds(workingSlots.topic || []);
    roleBuckets.location = normalizeIds(workingSlots.location || []);
    roleBuckets.other = Array.isArray(workingSlots.other)
      ? workingSlots.other.map((o) => ({ role: o.role, mention_ids: normalizeIds(o.mention_ids || []) }))
      : [];
    const dedupOps = Array.from(operatorsByKey.values())
      .map((op) => ({
        ...op,
        evidence: dedupeAndSortEvidence(op.evidence || []),
      }))
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        if ((a.value || '') !== (b.value || '')) return (a.value || '').localeCompare(b.value || '');
        if ((a.group_id || '') !== (b.group_id || '')) return (a.group_id || '').localeCompare(b.group_id || '');
        if ((a.token_id || '') !== (b.token_id || '')) return (a.token_id || '').localeCompare(b.token_id || '');
        return (a.role || '').localeCompare(b.role || '');
      });

    evidenceItems.sort((a, b) => {
      if (a.from_token_id !== b.from_token_id) return a.from_token_id.localeCompare(b.from_token_id);
      if (a.to_token_id !== b.to_token_id) return a.to_token_id.localeCompare(b.to_token_id);
      if (a.label !== b.label) return a.label.localeCompare(b.label);
      return a.annotation_id.localeCompare(b.annotation_id);
    });
    const dedupEvidence = [];
    const seenEvidence = new Set();
    for (const e of evidenceItems) {
      const k = JSON.stringify(e);
      if (seenEvidence.has(k)) continue;
      seenEvidence.add(k);
      dedupEvidence.push(e);
    }
    if (dedupEvidence.length === 0) continue;
    const wikiSignals = buildAssertionWikiSignals({
      predicateMentionId: effectivePredId,
      relations: rels,
      mentionById,
    });

    const predTok = tokenById.get(effectivePredMention.head_token_id);
    const predPos = predTok && predTok.pos && typeof predTok.pos.tag === 'string' ? predTok.pos.tag : '';
    const hasOnlyThemeBucket =
      roleBuckets.actor.length === 0 &&
      roleBuckets.attr.length === 0 &&
      roleBuckets.topic.length === 0 &&
      roleBuckets.location.length === 0 &&
      roleBuckets.other.length === 0 &&
      roleBuckets.theme.length > 0;
    const scaffoldGerundTokenPredicate =
      effectivePredMention.kind === 'token' &&
      predPos === 'VBG' &&
      hasOnlyThemeBucket &&
      dedupOps.length === 0;
    if (scaffoldGerundTokenPredicate) {
      continue;
    }
    const nominalCoordScaffoldPredicate =
      !isVerbPosTag(predPos) &&
      roleBucketsAreSemanticallyEmpty(roleBuckets) &&
      dedupOps.length > 0 &&
      dedupOps.every((op) => op.kind === 'coordination_group');
    if (nominalCoordScaffoldPredicate) {
      continue;
    }
    const nominalFragmentPredicate =
      originalPredicateClass === 'nominal_head' &&
      !isVerbPosTag(predPos) &&
      dedupOps.length === 0 &&
      (
        hasOnlyThemeBucket ||
        roleBucketsAreSemanticallyEmpty(roleBuckets) ||
        (
          roleBuckets.actor.length === 0 &&
          roleBuckets.theme.length === 0 &&
          roleBuckets.attr.length === 0 &&
          roleBuckets.topic.length === 0 &&
          roleBuckets.location.length === 0 &&
          roleBuckets.other.length > 0 &&
          roleBuckets.other.every((entry) => String((entry && entry.role) || '') === 'modifier')
        )
      );
    if (nominalFragmentPredicate) {
      continue;
    }

    const rolePayloadForHash = canonicalizeRoleBuckets(roleBuckets, mentionById);
    const rolesForHash = rolePayloadHashInput(rolePayloadForHash);
    const opsForHash = JSON.stringify(canonicalizeOperatorsForHash(dedupOps));
    const id = `a:${effectivePredMention.segment_id}:${effectivePredId}:${sha256Hex(`${rolesForHash}|${opsForHash}`).slice(0, 12)}`;
    let sourceSuppressedAssertion = null;
    if (suppressionPointer) {
      const sourceId = `a:${originalPredMention.segment_id}:${predId}:${sha256Hex(`${rolesForHash}|${opsForHash}`).slice(0, 12)}`;
      sourceSuppressedAssertion = {
        id: sourceId,
        segment_id: originalPredMention.segment_id,
        predicate: {
          mention_id: predId,
          head_token_id: originalPredMention.head_token_id,
        },
        diagnostics: {
          predicate_quality: isLowQualityPredicateToken(originalPredTok) ? 'low' : 'ok',
          suppressed_by: {
            kind: 'predicate_redirect',
            target_assertion_id: id,
            reason: 'predicate_upgraded_to_lexical',
            evidence: {
              upstream_relation_ids: normalizeIds(suppressionPointer.upstream_relation_ids || []),
              token_ids: normalizeIds([originalPredMention.head_token_id, effectivePredMention.head_token_id]),
            },
          },
        },
      };
    }

    assertions.push({
      id,
      segment_id: effectivePredMention.segment_id,
      predicate: {
        mention_id: effectivePredId,
        head_token_id: effectivePredMention.head_token_id,
      },
      arguments: rolePayloadForHash.arguments,
      modifiers: rolePayloadForHash.modifiers,
      operators: dedupOps,
      evidence: {
        relation_evidence: dedupEvidence,
        token_ids: normalizeIds(Array.from(evidenceTokenIds)),
        wiki_signals: wikiSignals || undefined,
      },
      diagnostics: {
        predicate_quality: isLowQualityPredicateToken(predTok) ? 'low' : 'ok',
        slot_projection_choice: bucketProjectionChoice || undefined,
      },
    });
    if (sourceSuppressedAssertion) suppressedAssertions.push(sourceSuppressedAssertion);

    coveredMentions.add(effectivePredId);
  }

  const assertedPredicateMentionIds = new Set(assertions.map((a) => a.predicate.mention_id));
  const syntheticPredicates = Array.from(mentionById.values())
    .filter((m) => m && m.is_primary && m.kind === 'token')
    .filter((m) => !assertedPredicateMentionIds.has(m.id))
    .sort((a, b) => {
      if (a.segment_id !== b.segment_id) return a.segment_id.localeCompare(b.segment_id);
      if (a.span.start !== b.span.start) return a.span.start - b.span.start;
      return a.id.localeCompare(b.id);
    });

  for (const predMention of syntheticPredicates) {
    const predTok = tokenById.get(predMention.head_token_id);
    if (!predTok) continue;
    const predTag = String((((predTok || {}).pos) || {}).tag || '');
    const predSurface = String(predTok.surface || '').toLowerCase();
    if ((!isVerbPosTag(predTag) && predSurface !== 'complete') || isCopulaSurface(predSurface)) continue;
    if (predTag === 'VBG') continue;
    if (isMakeSureScaffoldPredicate({ predTok, projected, tokensBySegment: bySegment })) {
      coveredMentions.add(predMention.id);
      continue;
    }

    const roleBuckets = { actor: [], theme: [], attr: [], topic: [], location: [], other: [] };
    const themeMention = chooseThemeMentionForPredicateToken(predTok, []);
    if (themeMention) roleBuckets.theme = [themeMention.id];
    const locationMention = chooseLocationMentionForPredicateToken(predTok, roleBuckets.theme);
    if (locationMention) roleBuckets.location = [locationMention.id];

    const hasSupportingSlotEvidence =
      roleBuckets.theme.some((id) => projectedMentionIds.has(id)) ||
      roleBuckets.location.some((id) => projectedMentionIds.has(id));
    const predicateTouchesProjectedGraph = projected.some((r) => r && (r.head_token_id === predTok.id || r.dep_token_id === predTok.id));
    if (!hasSupportingSlotEvidence && !predicateTouchesProjectedGraph) continue;

    const operatorsByKey = new Map();
    let coordGroupId = null;
    for (const themeId of roleBuckets.theme) {
      const gid = coordGroups.get(themeId);
      if (gid) {
        coordGroupId = gid;
        break;
      }
    }
    if (coordGroupId) {
      mergeOperator(operatorsByKey, {
        kind: 'coordination_group',
        group_id: coordGroupId,
        evidence: dedupeAndSortEvidence(coordEvidenceByGroup.get(coordGroupId) || []),
      });
    }
    const dedupOps = Array.from(operatorsByKey.values())
      .map((op) => ({ ...op, evidence: dedupeAndSortEvidence(op.evidence || []) }))
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        return (a.group_id || '').localeCompare(b.group_id || '');
      });

    const evidenceTokenIds = new Set(predMention.token_ids || []);
    for (const mid of roleBuckets.theme.concat(roleBuckets.location)) {
      const m = mentionById.get(mid);
      if (!m) continue;
      for (const tid of m.token_ids || []) evidenceTokenIds.add(tid);
      coveredMentions.add(mid);
    }

    const wikiSignals = buildAssertionWikiSignals({
      predicateMentionId: predMention.id,
      relations: [],
      mentionById,
    });
    const syntheticTargetMentionId =
      roleBuckets.theme[0] || roleBuckets.location[0] || roleBuckets.actor[0] || roleBuckets.attr[0] || roleBuckets.topic[0] || null;
    const syntheticTargetMention = syntheticTargetMentionId ? mentionById.get(syntheticTargetMentionId) : null;
    const syntheticTargetTokenId =
      syntheticTargetMention && Array.isArray(syntheticTargetMention.token_ids) && syntheticTargetMention.token_ids.length > 0
        ? syntheticTargetMention.token_ids[0]
        : predMention.head_token_id;
    const syntheticRelationEvidence = [{
      annotation_id: `synthetic:step12:${predMention.head_token_id}`,
      from_token_id: predMention.head_token_id,
      to_token_id: syntheticTargetTokenId,
      label: 'synthetic_support',
    }];
    const rolePayloadForHash = canonicalizeRoleBuckets(roleBuckets, mentionById);
    const rolesForHash = rolePayloadHashInput(rolePayloadForHash);
    const opsForHash = JSON.stringify(canonicalizeOperatorsForHash(dedupOps));
    const id = `a:${predMention.segment_id}:${predMention.id}:${sha256Hex(`${rolesForHash}|${opsForHash}`).slice(0, 12)}`;
    assertions.push({
      id,
      segment_id: predMention.segment_id,
      predicate: {
        mention_id: predMention.id,
        head_token_id: predMention.head_token_id,
      },
      arguments: rolePayloadForHash.arguments,
      modifiers: rolePayloadForHash.modifiers,
      operators: dedupOps,
      evidence: {
        relation_evidence: syntheticRelationEvidence,
        token_ids: normalizeIds(Array.from(evidenceTokenIds)),
        wiki_signals: wikiSignals || undefined,
      },
      diagnostics: {
        predicate_quality: isLowQualityPredicateToken(predTok) ? 'low' : 'ok',
      },
    });
    coveredMentions.add(predMention.id);
  }

  for (const a of assertions) {
    if (!a || !a.predicate) continue;
    const predTok = tokenById.get(a.predicate.head_token_id);
    const predicateClass = classifyPredicateClass(predTok);
    if (!a.diagnostics || typeof a.diagnostics !== 'object') a.diagnostics = {};
    a.diagnostics.predicate_class = predicateClass;
  }

  assertions.sort((a, b) => {
    if (a.segment_id !== b.segment_id) return a.segment_id.localeCompare(b.segment_id);
    const pa = tokenById.get(a.predicate.head_token_id);
    const pb = tokenById.get(b.predicate.head_token_id);
    if (pa.span.start !== pb.span.start) return pa.span.start - pb.span.start;
    return a.id.localeCompare(b.id);
  });

  const merged = mergeModalityCopulaAssertions({
    assertions,
    projected,
    mentionById,
    tokenById,
  });

  for (const s of merged.suppressedTraces || []) {
    if (s && s.predicate && typeof s.predicate.mention_id === 'string') {
      coveredMentions.delete(s.predicate.mention_id);
    }
  }

  const roleCarrierSuppressed = suppressRoleCarrierAssertions({
    assertions: merged.assertions,
    tokenById,
    tokensBySegment: bySegment,
    mentionById,
  });

  const finalAssertions = roleCarrierSuppressed.assertions.slice();
  for (const a of finalAssertions) {
    dedupeOtherMentionsAgainstCoreBuckets(a, mentionById);
  }
  const assertedHeadTokenIds = new Set(
    finalAssertions
      .map((a) => String((((a || {}).predicate) || {}).head_token_id || ''))
      .filter((id) => id.length > 0)
  );
  const relationRefsByTokenId = new Map();
  const coordinationRefsByTokenId = new Map();
  const structuralOnlyLabels = new Set(['coordination', 'punctuation', 'complement_clause']);
  for (const rel of projected || []) {
    if (!rel || typeof rel !== 'object') continue;
    const label = String(rel.label || '');
    const headTokenId = String(rel.head_token_id || '');
    const depTokenId = String(rel.dep_token_id || '');
    if (headTokenId) {
      if (!relationRefsByTokenId.has(headTokenId)) relationRefsByTokenId.set(headTokenId, []);
      relationRefsByTokenId.get(headTokenId).push(rel);
      if (label === 'coordination') {
        if (!coordinationRefsByTokenId.has(headTokenId)) coordinationRefsByTokenId.set(headTokenId, []);
        coordinationRefsByTokenId.get(headTokenId).push(rel);
      }
    }
    if (depTokenId) {
      if (!relationRefsByTokenId.has(depTokenId)) relationRefsByTokenId.set(depTokenId, []);
      relationRefsByTokenId.get(depTokenId).push(rel);
      if (label === 'coordination') {
        if (!coordinationRefsByTokenId.has(depTokenId)) coordinationRefsByTokenId.set(depTokenId, []);
        coordinationRefsByTokenId.get(depTokenId).push(rel);
      }
    }
  }

  const tokenCandidatesForVerbAnchors = Array.from(relationRefsByTokenId.keys())
    .map((id) => tokenById.get(id))
    .filter(Boolean)
    .filter((tok) => {
      const tag = String((((tok || {}).pos) || {}).tag || '');
      const coarse = String((((tok || {}).pos) || {}).coarse || '').toUpperCase();
      return isLexicalVerbPos(tag) || coarse === 'VERB';
    })
    .sort((a, b) => {
      if (a.segment_id !== b.segment_id) return a.segment_id.localeCompare(b.segment_id);
      if (a.i !== b.i) return a.i - b.i;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });

  for (const tok of tokenCandidatesForVerbAnchors) {
    const tokenId = String(tok.id || '');
    if (!tokenId || assertedHeadTokenIds.has(tokenId)) continue;
    const refs = relationRefsByTokenId.get(tokenId) || [];
    const semanticRefs = refs.filter((r) => !structuralOnlyLabels.has(String(r.label || '')));
    if (semanticRefs.length === 0) continue;
    const coordRefs = coordinationRefsByTokenId.get(tokenId) || [];
    if (coordRefs.length === 0) continue;
    const coordPeerHasAssertion = coordRefs.some((r) => {
      const peerTokenId = r.head_token_id === tokenId ? r.dep_token_id : r.head_token_id;
      return assertedHeadTokenIds.has(String(peerTokenId || ''));
    });
    if (!coordPeerHasAssertion) continue;

    const predPick = chooseBestMentionForToken({
      tokenId,
      segmentId: tok.segment_id,
      mentionById,
      candidateMentionIds: tokenMentionIds.get(tokenId) || [],
      excludeMentionId: null,
      preferMinimalSpan: false,
    });
    const predMentionId = predPick && typeof predPick.mention_id === 'string' ? predPick.mention_id : null;
    const predMention = predMentionId ? mentionById.get(predMentionId) : null;
    if (!predMention) continue;
    const predTokenIdSet = new Set(predMention.token_ids || []);
    if (finalAssertions.some((a) => String((((a || {}).predicate) || {}).mention_id || '') === predMentionId)) {
      assertedHeadTokenIds.add(tokenId);
      continue;
    }

    const roleBuckets = {
      actor: [],
      theme: [],
      attr: [],
      topic: [],
      location: [],
      other: [],
    };
    const otherRoleMap = new Map();
    const operatorsByKey = new Map();
    const evidenceTokenIds = new Set([tokenId]);
    const evidenceItems = [];

    for (const r of semanticRefs) {
      const headTokenId = String(r.head_token_id || '');
      const depTokenId = String(r.dep_token_id || '');
      const evidenceItem = {
        annotation_id: r.relation_id || 'r:unknown',
        from_token_id: headTokenId,
        to_token_id: depTokenId,
        label: String(r.label || ''),
      };
      evidenceItems.push(evidenceItem);
      if (headTokenId) evidenceTokenIds.add(headTokenId);
      if (depTokenId) evidenceTokenIds.add(depTokenId);

      if (headTokenId !== tokenId) {
        continue;
      }

      const depMentionPick = chooseBestMentionForToken({
        tokenId: depTokenId,
        segmentId: tok.segment_id,
        mentionById,
        candidateMentionIds: tokenMentionIds.get(depTokenId) || [],
        excludeMentionId: predMentionId,
        preferMinimalSpan: true,
      });
      const depMentionIdFromPick = depMentionPick && typeof depMentionPick.mention_id === 'string'
        ? depMentionPick.mention_id
        : null;
      const depMentionIdFromRelation = typeof r.dep_mention_id === 'string' ? r.dep_mention_id : null;
      let depMentionIdForSlot = depMentionIdFromPick || depMentionIdFromRelation;
      if (mentionOverlapsTokenSet(depMentionIdForSlot, predTokenIdSet)) {
        depMentionIdForSlot = null;
      }
      if (!depMentionIdForSlot || depMentionIdForSlot === predMentionId) continue;
      const map = roleToSlot(r.label);
      if (map.slot === 'other') {
        if (!otherRoleMap.has(map.role || r.label)) otherRoleMap.set(map.role || r.label, new Set());
        otherRoleMap.get(map.role || r.label).add(depMentionIdForSlot);
      } else {
        roleBuckets[map.slot].push(depMentionIdForSlot);
      }
      coveredMentions.add(depMentionIdForSlot);
    }

    for (const r of coordRefs) {
      const evidenceItem = {
        annotation_id: r.relation_id || 'r:unknown',
        from_token_id: r.head_token_id,
        to_token_id: r.dep_token_id,
        label: r.label,
      };
      mergeOperator(operatorsByKey, {
        kind: 'coordination_group',
        group_id: coordGroups.get(predMentionId) || `cg:${sha256Hex(`${predMentionId}|${r.relation_id || evidenceItem.from_token_id || ''}`).slice(0, 12)}`,
        value: undefined,
        evidence: [evidenceItem],
      });
    }

    roleBuckets.actor = normalizeIds(roleBuckets.actor);
    roleBuckets.theme = normalizeIds(roleBuckets.theme);
    roleBuckets.attr = normalizeIds(roleBuckets.attr);
    roleBuckets.topic = normalizeIds(roleBuckets.topic);
    roleBuckets.location = normalizeIds(roleBuckets.location);
    roleBuckets.other = Array.from(otherRoleMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([role, ids]) => ({ role, mention_ids: normalizeIds(Array.from(ids)) }));
    const workingAssertion = {
      predicate: { mention_id: predMentionId },
    };
    applyRoleBucketsToAssertion(workingAssertion, {
      actor: roleBuckets.actor.slice(),
      theme: roleBuckets.theme.slice(),
      attr: roleBuckets.attr.slice(),
      topic: roleBuckets.topic.slice(),
      location: roleBuckets.location.slice(),
      other: roleBuckets.other.map((o) => ({ role: o.role, mention_ids: (o.mention_ids || []).slice() })),
    }, mentionById);
    enforceCoreBucketTokenDisjointness(workingAssertion, mentionById, tokenById);
    trimCatchAllThemeBuckets(workingAssertion, mentionById, tokenById, bySegment);
    const workingSlots = assertionRoleBuckets(workingAssertion);
    roleBuckets.actor = normalizeIds(workingSlots.actor || []);
    roleBuckets.theme = normalizeIds(workingSlots.theme || []);
    roleBuckets.attr = normalizeIds(workingSlots.attr || []);
    roleBuckets.topic = normalizeIds(workingSlots.topic || []);
    roleBuckets.location = normalizeIds(workingSlots.location || []);
    roleBuckets.other = Array.isArray(workingSlots.other)
      ? workingSlots.other.map((o) => ({ role: o.role, mention_ids: normalizeIds(o.mention_ids || []) }))
      : [];
    const dedupOps = Array.from(operatorsByKey.values())
      .map((op) => ({ ...op, evidence: dedupeAndSortEvidence(op.evidence || []) }))
      .sort((a, b) => {
        if ((a.kind || '') !== (b.kind || '')) return (a.kind || '').localeCompare(b.kind || '');
        if ((a.value || '') !== (b.value || '')) return (a.value || '').localeCompare(b.value || '');
        if ((a.group_id || '') !== (b.group_id || '')) return (a.group_id || '').localeCompare(b.group_id || '');
        if ((a.token_id || '') !== (b.token_id || '')) return (a.token_id || '').localeCompare(b.token_id || '');
        return (a.role || '').localeCompare(b.role || '');
      });

    evidenceItems.sort((a, b) => {
      if (a.from_token_id !== b.from_token_id) return a.from_token_id.localeCompare(b.from_token_id);
      if (a.to_token_id !== b.to_token_id) return a.to_token_id.localeCompare(b.to_token_id);
      if (a.label !== b.label) return a.label.localeCompare(b.label);
      return a.annotation_id.localeCompare(b.annotation_id);
    });
    const seenEvidence = new Set();
    const dedupEvidence = [];
    for (const e of evidenceItems) {
      const k = JSON.stringify(e);
      if (seenEvidence.has(k)) continue;
      seenEvidence.add(k);
      dedupEvidence.push(e);
    }
    if (dedupEvidence.length === 0) continue;

    const rolePayloadForHash = canonicalizeRoleBuckets(roleBuckets, mentionById);
    const rolesForHash = rolePayloadHashInput(rolePayloadForHash);
    const opsForHash = JSON.stringify(canonicalizeOperatorsForHash(dedupOps));
    const id = `a:${predMention.segment_id}:${predMention.id}:${sha256Hex(`${rolesForHash}|${opsForHash}`).slice(0, 12)}`;
    finalAssertions.push({
      id,
      segment_id: predMention.segment_id,
      predicate: {
        mention_id: predMention.id,
        head_token_id: predMention.head_token_id,
      },
      arguments: rolePayloadForHash.arguments,
      modifiers: rolePayloadForHash.modifiers,
      operators: dedupOps,
      evidence: {
        relation_evidence: dedupEvidence,
        token_ids: normalizeIds(Array.from(evidenceTokenIds)),
      },
      diagnostics: {
        predicate_quality: isLowQualityPredicateToken(tok) ? 'low' : 'ok',
      },
    });
    assertedHeadTokenIds.add(tokenId);
    coveredMentions.add(predMention.id);
  }

  const lexicalPredicateBySegment = new Set();
  for (const a of finalAssertions) {
    if (!a || !a.predicate) continue;
    const predTok = tokenById.get(a.predicate.head_token_id);
    const predicateClass = classifyPredicateClass(predTok);
    if (!a.diagnostics || typeof a.diagnostics !== 'object') a.diagnostics = {};
    a.diagnostics.predicate_class = predicateClass;
    if (predicateClass === 'lexical_verb') lexicalPredicateBySegment.add(a.segment_id);
  }
  for (const a of finalAssertions) {
    if (!a || !a.predicate) continue;
    const predicateClass = String((((a || {}).diagnostics) || {}).predicate_class || '');
    a.diagnostics.structural_fragment =
      (predicateClass === 'preposition' || predicateClass === 'nominal_head') &&
      lexicalPredicateBySegment.has(a.segment_id);
  }
  const clauseKeyByAssertionId = new Map();
  for (const a of finalAssertions) {
    clauseKeyByAssertionId.set(a.id, assertionClauseWindowKey(a, tokenById, bySegment));
  }
  for (const a of finalAssertions) {
    if (!a || !a.diagnostics || a.diagnostics.structural_fragment !== true) continue;
    const cls = String(a.diagnostics.predicate_class || '');
    if (!(cls === 'preposition' || cls === 'nominal_head' || cls === 'auxiliary')) continue;
    const trace = buildSuppressionEligibilityTrace({
      source: a,
      assertions: finalAssertions,
      tokenById,
      clauseKeyByAssertionId,
    });
    if (trace) {
      a.diagnostics.suppression_eligibility = trace;
    }
  }
  finalAssertions.sort((a, b) => {
    if (a.segment_id !== b.segment_id) return a.segment_id.localeCompare(b.segment_id);
    const pa = tokenById.get(a.predicate.head_token_id);
    const pb = tokenById.get(b.predicate.head_token_id);
    if (pa.span.start !== pb.span.start) return pa.span.start - pb.span.start;
    return a.id.localeCompare(b.id);
  });

  const combinedSuppressed = suppressedAssertions
    .concat(merged.suppressedTraces || [])
    .concat(roleCarrierSuppressed.suppressedTraces || []);
  combinedSuppressed.sort((a, b) => a.id.localeCompare(b.id));

  return { assertions: finalAssertions, coveredMentions, suppressedAssertions: combinedSuppressed };
}


module.exports = {
  isVerbPosTag,
  isLexicalVerbPos,
  classifyPredicateClass,
  isNounLikePosTag,
  isCopulaSurface,
  lower,
  isLowQualityPredicateToken,
  roleBucketsAreSemanticallyEmpty,
  isClauseBoundaryToken,
  assertionClauseWindowKey,
  assertionHasBlockingOperators,
  collectAssertionMentionRefs,
  addToOtherSlot,
  transferRoleCarrierBucketsToHost,
  collectRoleBucketMentionIds,
  transferNamedBucketsToHostOther,
  transferOperatorsToHost,
  dedupeOtherMentionsAgainstCoreBuckets,
  enforceCoreBucketTokenDisjointness,
  pruneLowCopulaBuckets,
  buildSuppressionEligibilityTrace,
  suppressRoleCarrierAssertions,
  choosePredicateUpgradeCandidate,
  mergeModalityCopulaAssertions,
  buildAssertions,
};



