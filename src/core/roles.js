const { normalizeIds } = require('./determinism');
const { isSubjectRoleLabel } = require('./mentions');

function argumentRolePriority(role) {
  const r = String(role || '');
  if (r === 'actor') return 0;
  if (r === 'patient') return 1;
  if (r === 'location') return 2;
  if (r === 'theme') return 3;
  if (r === 'attribute') return 4;
  if (r === 'topic') return 5;
  return 10;
}

function modifierRolePriority(role) {
  const r = String(role || '');
  if (r === 'recipient') return 0;
  if (r === 'modifier') return 1;
  return 10;
}

function canonicalizeRoleEntries(entries, priorityFn) {
  return (entries || [])
    .map((entry) => ({
      role: String((entry && entry.role) || ''),
      mention_ids: normalizeIds(Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : []),
      evidence: {
        relation_ids: normalizeIds(
          Array.isArray(entry && entry.evidence && entry.evidence.relation_ids)
            ? entry.evidence.relation_ids
            : []
        ),
        token_ids: normalizeIds(
          Array.isArray(entry && entry.evidence && entry.evidence.token_ids)
            ? entry.evidence.token_ids
            : []
        ),
      },
    }))
    .filter((entry) => entry.role.length > 0 && entry.mention_ids.length > 0)
    .sort((a, b) => {
      const pa = priorityFn(a.role);
      const pb = priorityFn(b.role);
      if (pa !== pb) return pa - pb;
      if (a.role !== b.role) return a.role.localeCompare(b.role);
      const am = JSON.stringify(a.mention_ids);
      const bm = JSON.stringify(b.mention_ids);
      if (am !== bm) return am.localeCompare(bm);
      const ae = JSON.stringify(a.evidence);
      const be = JSON.stringify(b.evidence);
      return ae.localeCompare(be);
    });
}

function collectEntryTokenIds(mentionIds, mentionById) {
  const tokenIds = [];
  for (const mentionId of mentionIds || []) {
    const mention = mentionById.get(mentionId);
    if (!mention) continue;
    for (const tokenId of mention.token_ids || []) tokenIds.push(tokenId);
  }
  return normalizeIds(tokenIds);
}

function slotToRoleEntries(slots, mentionById) {
  const source = slots || {};
  const argumentsOut = [];
  const modifiersOut = [];

  const coreMappings = [
    { slot: 'actor', role: 'actor' },
    { slot: 'theme', role: 'theme' },
    { slot: 'attr', role: 'attribute' },
    { slot: 'topic', role: 'topic' },
    { slot: 'location', role: 'location' },
  ];

  for (const mapping of coreMappings) {
    const mentionIds = normalizeIds(Array.isArray(source[mapping.slot]) ? source[mapping.slot] : []);
    if (mentionIds.length === 0) continue;
    argumentsOut.push({
      role: mapping.role,
      mention_ids: mentionIds,
      evidence: {
        relation_ids: [],
        token_ids: collectEntryTokenIds(mentionIds, mentionById),
      },
    });
  }

  for (const entry of Array.isArray(source.other) ? source.other : []) {
    const role = String((entry && entry.role) || '').trim();
    const mentionIds = normalizeIds(Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : []);
    if (!role || mentionIds.length === 0) continue;
    modifiersOut.push({
      role,
      mention_ids: mentionIds,
      evidence: {
        relation_ids: [],
        token_ids: collectEntryTokenIds(mentionIds, mentionById),
      },
    });
  }

  return {
    arguments: canonicalizeRoleEntries(argumentsOut, argumentRolePriority),
    modifiers: canonicalizeRoleEntries(modifiersOut, modifierRolePriority),
  };
}

function collectAssertionMentionRefs(assertion) {
  const out = new Set();
  for (const entry of assertion && Array.isArray(assertion.arguments) ? assertion.arguments : []) {
    for (const mentionId of entry.mention_ids || []) out.add(mentionId);
  }
  for (const entry of assertion && Array.isArray(assertion.modifiers) ? assertion.modifiers : []) {
    for (const mentionId of entry.mention_ids || []) out.add(mentionId);
  }
  return out;
}

function projectRolesToSlots(assertion) {
  const slots = { actor: [], theme: [], attr: [], topic: [], location: [], other: [] };
  for (const entry of assertion && Array.isArray(assertion.arguments) ? assertion.arguments : []) {
    const role = String((entry && entry.role) || '');
    const mentionIds = normalizeIds(Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : []);
    if (mentionIds.length === 0) continue;
    if (role === 'actor' || isSubjectRoleLabel(role)) slots.actor = normalizeIds(slots.actor.concat(mentionIds));
    else if (role === 'theme') slots.theme = normalizeIds(slots.theme.concat(mentionIds));
    else if (role === 'attribute') slots.attr = normalizeIds(slots.attr.concat(mentionIds));
    else if (role === 'topic') slots.topic = normalizeIds(slots.topic.concat(mentionIds));
    else if (role === 'location') slots.location = normalizeIds(slots.location.concat(mentionIds));
    else slots.other.push({ role, mention_ids: mentionIds });
  }
  for (const entry of assertion && Array.isArray(assertion.modifiers) ? assertion.modifiers : []) {
    const role = String((entry && entry.role) || '');
    const mentionIds = normalizeIds(Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : []);
    if (!role || mentionIds.length === 0) continue;
    slots.other.push({ role, mention_ids: mentionIds });
  }
  slots.other = slots.other
    .map((entry) => ({ role: entry.role, mention_ids: normalizeIds(entry.mention_ids || []) }))
    .filter((entry) => entry.mention_ids.length > 0)
    .sort((a, b) => {
      if (a.role !== b.role) return a.role.localeCompare(b.role);
      return JSON.stringify(a.mention_ids).localeCompare(JSON.stringify(b.mention_ids));
    });
  return slots;
}

function collectMentionIdsFromRoles(assertion) {
  return normalizeIds(Array.from(collectAssertionMentionRefs(assertion)));
}

module.exports = {
  argumentRolePriority,
  modifierRolePriority,
  canonicalizeRoleEntries,
  collectEntryTokenIds,
  slotToRoleEntries,
  collectAssertionMentionRefs,
  projectRolesToSlots,
  collectMentionIdsFromRoles,
};
