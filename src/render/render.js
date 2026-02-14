const { validateElementaryAssertions } = require("../validate");
const { rejectLegacySlots } = require("../validate/schema");

function normalizeRenderText(text) {
  if (typeof text !== 'string' || text.length === 0) return text;
  return text;
}

function normalizePossessiveDisplay(text) {
  if (typeof text !== 'string' || text.length === 0) return text;
  return text.replace(/([A-Za-z0-9]) (['\u2019]s)\b/g, '$1$2');
}

function normalizeSegmentDisplay(text, options) {
  if (typeof text !== 'string') return text;
  if (!options || options.layout === 'compact') return text;
  return text.replace(/^\n+/, '').replace(/\n+$/, '');
}

function emptyWikiEvidence() {
  return { exact_titles: [], prefix_titles: [] };
}

function createWikiEvidenceResolver(data) {
  const mentionMap = new Map((((data || {}).wiki_title_evidence || {}).mention_matches || []).map((x) => [x.mention_id, x]));
  const predByAssertion = new Map((((data || {}).wiki_title_evidence || {}).assertion_predicate_matches || []).map((x) => [x.assertion_id, x]));
  const predByMention = new Map((((data || {}).wiki_title_evidence || {}).assertion_predicate_matches || []).map((x) => [x.predicate_mention_id, x]));
  return function getWikiEvidenceForSurface(kind, idOrKey) {
    if (typeof idOrKey !== 'string' || idOrKey.length === 0) return emptyWikiEvidence();
    if (kind === 'mention' || kind === 'slot') return mentionMap.get(idOrKey) || emptyWikiEvidence();
    if (kind === 'predicate') return predByAssertion.get(idOrKey) || predByMention.get(idOrKey) || emptyWikiEvidence();
    return emptyWikiEvidence();
  };
}

function renderSurfaceWithWiki(surfaceText, evidence) {
  const text = String(surfaceText || '');
  const exact = evidence && Array.isArray(evidence.exact_titles) ? evidence.exact_titles.length : 0;
  const prefix = evidence && Array.isArray(evidence.prefix_titles) ? evidence.prefix_titles.length : 0;
  if (exact > 0) return `⟦${text}|wiki:exact⟧`;
  if (prefix > 0) return `⟦${text}|wiki:prefix⟧`;
  return text;
}

function joinTokenText(tokens) {
  const sorted = tokens.slice().sort((a, b) => a.i - b.i);
  return normalizeRenderText(sorted.map((t) => t.surface).join(' '));
}

function normalizeDeterminerDisplay(tokens) {
  const sorted = tokens.slice().sort((a, b) => a.i - b.i);
  if (sorted.length < 2) return null;
  const first = sorted[0] || {};
  const firstCoarse = String((((first || {}).pos) || {}).coarse || '').toUpperCase();
  const firstTag = String((((first || {}).pos) || {}).tag || '').toUpperCase();
  const isDeterminer = firstCoarse === 'DT' || firstTag === 'DT';
  if (!isDeterminer) return null;
  const det = String(first.surface || '').trim();
  if (!det) return null;
  const rest = normalizeRenderText(sorted.slice(1).map((t) => t.surface).join(' '));
  if (!rest) return null;
  return `(${det.toLowerCase()}) ${rest}`;
}

function assertionSortKey(a, mentionById, tokenById) {
  const m = mentionById.get(a.predicate.mention_id);
  const t = m ? tokenById.get(m.head_token_id) : null;
  return [
    a.segment_id || '',
    t && typeof t.i === 'number' ? String(t.i).padStart(8, '0') : '99999999',
    a.id || '',
  ].join('|');
}

const ACTOR_ROLES = new Set(['actor', 'subject', 'agent', 'nsubj', 'nsubjpass', 'csubj', 'csubjpass']);
const ROLE_TO_DISPLAY_COLUMN = new Map([
  ['theme', 'theme'],
  ['attribute', 'attr'],
  ['topic', 'topic'],
  ['location', 'location'],
]);

function normalizeIds(ids) {
  return Array.from(new Set((ids || []).filter((id) => typeof id === 'string' && id.length > 0))).sort((a, b) => a.localeCompare(b));
}

function toViewSlotsFromRoles(assertion) {
  const slots = { actor: [], theme: [], attr: [], topic: [], location: [], other: [] };
  const argumentEntries = Array.isArray(assertion && assertion.arguments) ? assertion.arguments : [];
  const modifierEntries = Array.isArray(assertion && assertion.modifiers) ? assertion.modifiers : [];

  for (const entry of argumentEntries) {
    const role = String((entry && entry.role) || '');
    const mentionIds = normalizeIds((entry && entry.mention_ids) || []);
    if (!role || mentionIds.length === 0) continue;
    if (ACTOR_ROLES.has(role)) {
      slots.actor = normalizeIds(slots.actor.concat(mentionIds));
      continue;
    }
    const mappedColumn = ROLE_TO_DISPLAY_COLUMN.get(role);
    if (mappedColumn) {
      slots[mappedColumn] = normalizeIds(slots[mappedColumn].concat(mentionIds));
      continue;
    }
    slots.other.push({ role, mention_ids: mentionIds });
  }

  for (const entry of modifierEntries) {
    const role = String((entry && entry.role) || '');
    const mentionIds = normalizeIds((entry && entry.mention_ids) || []);
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

function countEntryEvidence(entry) {
  const evidence = (entry && typeof entry === 'object') ? (entry.evidence || {}) : {};
  const relationIds = normalizeIds(Array.isArray(evidence.relation_ids) ? evidence.relation_ids : []);
  const tokenIds = normalizeIds(Array.isArray(evidence.token_ids) ? evidence.token_ids : []);
  return { relationCount: relationIds.length, tokenCount: tokenIds.length };
}

function buildAssertionEvidenceFootnote(assertion) {
  const argumentEntries = Array.isArray(assertion && assertion.arguments) ? assertion.arguments : [];
  const modifierEntries = Array.isArray(assertion && assertion.modifiers) ? assertion.modifiers : [];
  const operators = Array.isArray(assertion && assertion.operators) ? assertion.operators : [];
  const roleEvidence = new Map();

  for (const entry of argumentEntries.concat(modifierEntries)) {
    const role = String((entry && entry.role) || '');
    if (!role) continue;
    const counts = countEntryEvidence(entry);
    const prev = roleEvidence.get(role) || { relationCount: 0, tokenCount: 0 };
    roleEvidence.set(role, {
      relationCount: prev.relationCount + counts.relationCount,
      tokenCount: prev.tokenCount + counts.tokenCount,
    });
  }

  const roleParts = Array.from(roleEvidence.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([role, counts]) => `${role}(r=${counts.relationCount},t=${counts.tokenCount})`);

  let opRelationCount = 0;
  let opTokenCount = 0;
  for (const op of operators) {
    const evidence = (op && typeof op === 'object') ? (op.evidence || []) : [];
    const relationIds = new Set();
    const tokenIds = new Set();
    for (const ev of evidence) {
      if (!ev || typeof ev !== 'object') continue;
      const upstream = Array.isArray(ev.upstream_relation_ids) ? ev.upstream_relation_ids : [];
      const tids = Array.isArray(ev.token_ids) ? ev.token_ids : [];
      for (const id of upstream) relationIds.add(String(id));
      for (const tid of tids) tokenIds.add(String(tid));
    }
    opRelationCount += relationIds.size;
    opTokenCount += tokenIds.size;
  }
  const operatorPart = `operators(r=${opRelationCount},t=${opTokenCount})`;
  return roleParts.length > 0
    ? `${roleParts.join('; ')}; ${operatorPart}`
    : operatorPart;
}

function mentionSort(mentions) {
  mentions.sort((a, b) => {
    if (a.segment_id !== b.segment_id) return a.segment_id.localeCompare(b.segment_id);
    if (a.span.start !== b.span.start) return a.span.start - b.span.start;
    if (a.span.end !== b.span.end) return a.span.end - b.span.end;
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.id.localeCompare(b.id);
  });
  return mentions;
}

function buildIntegrity(data) {
  if (!data || typeof data !== 'object') throw new Error('Input must be a mapping');
  if (!Array.isArray(data.tokens)) throw new Error('Input missing tokens');
  if (!Array.isArray(data.mentions)) throw new Error('Input missing mentions');
  if (!Array.isArray(data.assertions)) throw new Error('Input missing assertions');
  if (!data.coverage || typeof data.coverage !== 'object') throw new Error('Input missing coverage');

  const tokenById = new Map();
  for (const t of data.tokens) {
    if (!t || typeof t.id !== 'string') throw new Error('Token missing id');
    if (typeof t.i !== 'number') throw new Error(`Token ${t.id} missing i`);
    tokenById.set(t.id, t);
  }

  const mentionById = new Map();
  for (const m of data.mentions) {
    if (!m || typeof m.id !== 'string') throw new Error('Mention missing id');
    if (!Array.isArray(m.token_ids) || m.token_ids.length === 0) throw new Error(`Mention ${m.id} missing token_ids`);
    for (const tid of m.token_ids) {
      if (!tokenById.has(tid)) throw new Error(`Mention ${m.id} references unknown token ${tid}`);
    }
    if (typeof m.head_token_id !== 'string') throw new Error(`Mention ${m.id} missing head_token_id`);
    if (!m.token_ids.includes(m.head_token_id)) throw new Error(`Mention ${m.id} head_token_id must be contained in token_ids`);
    mentionById.set(m.id, m);
  }

  for (const a of data.assertions) {
    if (!a || typeof a.id !== 'string') throw new Error('Assertion missing id');
    if (!a.predicate || typeof a.predicate.mention_id !== 'string') throw new Error(`Assertion ${a.id} missing predicate.mention_id`);
    if (!mentionById.has(a.predicate.mention_id)) throw new Error(`Assertion ${a.id} references unknown predicate mention ${a.predicate.mention_id}`);
    const slots = toViewSlotsFromRoles(a);
    const lists = []
      .concat(slots.actor || [])
      .concat(slots.theme || [])
      .concat(slots.attr || [])
      .concat(slots.topic || [])
      .concat(slots.location || [])
      .concat((slots.other || []).flatMap((o) => o.mention_ids || []));
    for (const mid of lists) {
      if (!mentionById.has(mid)) throw new Error(`Assertion ${a.id} references unknown assertion role mention ${mid}`);
    }
    const evTokenIds = (a.evidence && Array.isArray(a.evidence.token_ids)) ? a.evidence.token_ids : [];
    for (const tid of evTokenIds) {
      if (!tokenById.has(tid)) throw new Error(`Assertion ${a.id} evidence.token_ids references unknown token ${tid}`);
    }
  }

  const unresolved = Array.isArray(data.coverage.unresolved) ? data.coverage.unresolved : [];
  for (const u of unresolved) {
    if (!mentionById.has(u.mention_id)) throw new Error(`Unresolved item references unknown mention ${u.mention_id}`);
    const tids = (((u || {}).evidence || {}).token_ids) || [];
    for (const tid of tids) {
      if (!tokenById.has(tid)) throw new Error(`Unresolved item references unknown token ${tid}`);
    }
  }

  return { tokenById, mentionById };
}

function mentionText(mention, tokenById, options) {
  const tokens = mention.token_ids.map((id) => tokenById.get(id)).filter(Boolean);
  if (options && options.normalizeDeterminers) {
    const normalized = normalizeDeterminerDisplay(tokens);
    if (normalized) {
      if (options.layout !== 'compact') return normalizePossessiveDisplay(normalized);
      return normalized;
    }
  }
  const raw = joinTokenText(tokens);
  if (options && options.layout !== 'compact') return normalizePossessiveDisplay(raw);
  return raw;
}

function mentionHeadI(mention, tokenById) {
  const t = tokenById.get(mention.head_token_id);
  return t ? t.i : Number.MAX_SAFE_INTEGER;
}

function mentionCoverageSortKey(mention) {
  const start = Number((mention && mention.span && mention.span.start) || Number.MAX_SAFE_INTEGER);
  const id = String((mention && mention.id) || '');
  return `${String(start).padStart(12, '0')}|${id}`;
}

function sortMentionIdsForCoverage(ids, mentionById) {
  return (ids || []).slice().sort((x, y) => {
    const mx = mentionById.get(x);
    const my = mentionById.get(y);
    if (!mx || !my) return String(x).localeCompare(String(y));
    const kx = mentionCoverageSortKey(mx);
    const ky = mentionCoverageSortKey(my);
    return kx.localeCompare(ky);
  });
}

function collectUsedMentionIdsFromAssertions(assertions) {
  const used = new Set();
  const directMentionKeys = new Set(['mention_id', 'actor', 'theme', 'attr', 'topic', 'location']);
  const visit = (value, keyHint) => {
    if (value === null || value === undefined) return;
    if (typeof value === 'string') {
      if (directMentionKeys.has(String(keyHint || ''))) used.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, keyHint);
      return;
    }
    if (typeof value !== 'object') return;
    for (const [k, v] of Object.entries(value)) {
      if (k === 'mention_id') {
        if (typeof v === 'string' && v.length > 0) used.add(v);
        continue;
      }
      if (k === 'mention_ids' || k === 'transferred_mention_ids') {
        if (Array.isArray(v)) {
          for (const id of v) {
            if (typeof id === 'string' && id.length > 0) used.add(id);
          }
        }
        continue;
      }
      visit(v, k);
    }
  };

  for (const a of assertions || []) {
    if (!a || typeof a !== 'object') continue;
    visit(a, null);
  }
  return used;
}

function formatOperators(ops) {
  if (!Array.isArray(ops) || ops.length === 0) return '';
  const sorted = ops
    .slice()
    .sort((a, b) => {
      const ak = [a.kind || '', a.value || '', a.group_id || '', a.token_id || ''].join('|');
      const bk = [b.kind || '', b.value || '', b.group_id || '', b.token_id || ''].join('|');
      return ak.localeCompare(bk);
    })
    .map((o) => {
      if (o.kind === 'modality') return `modality(${o.value || ''})`;
      if (o.kind === 'negation') return `negation(${o.token_id || ''})`;
      if (o.kind === 'coordination_group') {
        const suffix = o.value ? `:${o.value}` : '';
        return `coordination_group(${o.group_id || ''}${suffix})`;
      }
      if (o.kind === 'compare' || o.kind === 'compare_gt' || o.kind === 'compare_lt') {
        return `${o.kind}(${o.token_id || ''})`;
      }
      if (o.kind === 'quantifier') return `quantifier(${o.value || ''}|${o.token_id || ''})`;
      if (o.kind === 'control_inherit_subject') return 'control_inherit_subject';
      if (o.kind === 'control_propagation') return 'control_propagation';
      return o.kind || 'operator';
    });
  return sorted.join(', ');
}

function sortedSegments(data) {
  return (data.segments || []).slice().sort((a, b) => {
    if (a.span.start !== b.span.start) return a.span.start - b.span.start;
    return a.id.localeCompare(b.id);
  });
}

function buildAssertionRows(data, refs, options) {
  const { tokenById, mentionById } = refs;
  const assertions = (data.assertions || [])
    .slice()
    .sort((a, b) => assertionSortKey(a, mentionById, tokenById).localeCompare(assertionSortKey(b, mentionById, tokenById)));
  const viewSlotOrder = ['actor', 'theme', 'attr', 'topic', 'location', 'other'];

  return assertions.map((a, index) => {
    const predMention = mentionById.get(a.predicate.mention_id);
    const predText = mentionText(predMention, tokenById, options);
    const viewSlots = toViewSlotsFromRoles(a);
    const slotValues = {};
    for (const slot of viewSlotOrder) {
      if (slot !== 'other') {
        const mids = (viewSlots && Array.isArray(viewSlots[slot]) ? viewSlots[slot] : []).slice();
        mids.sort((x, y) => {
          const mx = mentionById.get(x);
          const my = mentionById.get(y);
          const dx = mentionHeadI(mx, tokenById);
          const dy = mentionHeadI(my, tokenById);
          if (dx !== dy) return dx - dy;
          return x.localeCompare(y);
        });
        slotValues[slot] = mids.map((mid) => ({
          mention_id: mid,
          text: mentionText(mentionById.get(mid), tokenById, options),
        }));
      } else {
        const other = (viewSlots && Array.isArray(viewSlots.other) ? viewSlots.other : [])
          .map((o) => ({
            role: o.role,
            mention_ids: (o.mention_ids || []).slice().sort((x, y) => {
              const mx = mentionById.get(x);
              const my = mentionById.get(y);
              const dx = mentionHeadI(mx, tokenById);
              const dy = mentionHeadI(my, tokenById);
              if (dx !== dy) return dx - dy;
              return x.localeCompare(y);
            }),
          }))
          .sort((x, y) => x.role.localeCompare(y.role));
        slotValues.other = other.map((o) => ({
          role: o.role,
          values: o.mention_ids.map((mid) => ({
            mention_id: mid,
            text: mentionText(mentionById.get(mid), tokenById, options),
          })),
        }));
      }
    }

    return {
      ordinal: index + 1,
      assertion: a,
      predText,
      slotValues,
      opsText: formatOperators(a.operators),
      evidenceFootnote: buildAssertionEvidenceFootnote(a),
    };
  });
}

function renderMentions(data, options, refs, lines, md, getWikiEvidenceForSurface) {
  const { tokenById } = refs;
  const mentions = mentionSort((data.mentions || []).slice());
  if (md) lines.push('\n## Mentions');
  else lines.push('\nMentions');

  if (options.layout === 'compact') {
    for (const m of mentions) {
      const text = renderSurfaceWithWiki(
        mentionText(m, tokenById, options),
        getWikiEvidenceForSurface('mention', m.id)
      );
      const headSurface = tokenById.get(m.head_token_id).surface;
      let line = `mention="${text}" kind=${m.kind} is_primary=${m.is_primary} head="${headSurface}"`;
      if (options.debugIds) {
        line += ` id=${m.id} head_token_id=${m.head_token_id} token_ids=[${m.token_ids.join(',')}] span=${m.span.start}-${m.span.end}`;
      }
      lines.push(md ? `- ${line}` : line);
    }
    return;
  }

  const grouped = new Map();
  for (const m of mentions) {
    if (!grouped.has(m.segment_id)) grouped.set(m.segment_id, []);
    grouped.get(m.segment_id).push(m);
  }
  const segmentOrder = Array.from(grouped.keys()).sort();
  for (const segmentId of segmentOrder) {
    const group = grouped.get(segmentId);
    if (md) lines.push(`- Segment ${segmentId}`);
    else lines.push(`Segment ${segmentId}`);
    for (const m of group) {
      const text = renderSurfaceWithWiki(
        mentionText(m, tokenById, options),
        getWikiEvidenceForSurface('mention', m.id)
      );
      const headSurface = tokenById.get(m.head_token_id).surface;
      let line = `${m.span.start}-${m.span.end} ${m.kind} ${text} (head=${headSurface})`;
      if (options.debugIds) {
        line += ` id=${m.id} head_token_id=${m.head_token_id} token_ids=[${m.token_ids.join(',')}]`;
      }
      lines.push(md ? `  - ${line}` : line);
    }
  }
}

function renderAssertionsCompact(rows, options, lines, md, getWikiEvidenceForSurface) {
  const slotOrder = ['actor', 'theme', 'attr', 'topic', 'location', 'other'];
  for (const row of rows) {
    const slotValues = {};
    for (const slot of slotOrder) {
      if (slot !== 'other') {
        slotValues[slot] = row.slotValues[slot].map((v) =>
          renderSurfaceWithWiki(v.text, getWikiEvidenceForSurface('slot', v.mention_id))
        );
      } else {
        slotValues.other = row.slotValues.other.map(
          (o) =>
            `${o.role}:${o.values
              .map((v) => renderSurfaceWithWiki(v.text, getWikiEvidenceForSurface('slot', v.mention_id)))
              .join('|')}`
        );
      }
    }
    const pred = renderSurfaceWithWiki(row.predText, getWikiEvidenceForSurface('predicate', row.assertion.id));
    let line = `pred=${pred} actor=${slotValues.actor.join('|')} theme=${slotValues.theme.join('|')} attr=${slotValues.attr.join('|')} topic=${slotValues.topic.join('|')} location=${slotValues.location.join('|')} other=${slotValues.other.join(';')} ops=${row.opsText}`;
    if (options.debugIds) {
      line = `id=${row.assertion.id} predicate_mention_id=${row.assertion.predicate.mention_id} ` + line;
    }
    lines.push(md ? `- ${line}` : line);
    const evidenceLine = `evidence: ${row.evidenceFootnote}`;
    lines.push(md ? `  - ${evidenceLine}` : `  ${evidenceLine}`);
  }
}

function renderAssertionsReadable(rows, options, lines, md, getWikiEvidenceForSurface) {
  for (const row of rows) {
    const predBase = renderSurfaceWithWiki(row.predText, getWikiEvidenceForSurface('predicate', row.assertion.id));
    const predicateQuality = (((row || {}).assertion || {}).diagnostics || {}).predicate_quality;
    const pred = predicateQuality === 'low' ? `${predBase} (predicate_quality=low)` : predBase;
    const suffix = options.debugIds ? ` [id=${row.assertion.id} predicate_mention_id=${row.assertion.predicate.mention_id}]` : '';
    if (md) {
      lines.push(`- Assertion ${row.ordinal}: ${pred}${suffix}`);
      lines.push(`  - pred: ${pred}`);
      const orderedSlots = ['actor', 'theme', 'attr', 'topic', 'location'];
      for (const slot of orderedSlots) {
        const values = row.slotValues[slot].map((v) =>
          renderSurfaceWithWiki(v.text, getWikiEvidenceForSurface('slot', v.mention_id))
        );
        if (values.length > 0) lines.push(`  - ${slot}: ${values.join(', ')}`);
      }
      if (row.slotValues.other.length > 0) {
        lines.push('  - other:');
        for (const other of row.slotValues.other) {
          const values = other.values.map((v) =>
            renderSurfaceWithWiki(v.text, getWikiEvidenceForSurface('slot', v.mention_id))
          );
          lines.push(`    - ${other.role}: ${values.join(', ')}`);
        }
      }
      if (row.opsText) lines.push(`  - ops: ${row.opsText}`);
      lines.push(`  - evidence: ${row.evidenceFootnote}`);
    } else {
      lines.push(`Assertion ${row.ordinal}: ${pred}${suffix}`);
      lines.push(`pred: ${pred}`);
      const orderedSlots = ['actor', 'theme', 'attr', 'topic', 'location'];
      for (const slot of orderedSlots) {
        const values = row.slotValues[slot].map((v) =>
          renderSurfaceWithWiki(v.text, getWikiEvidenceForSurface('slot', v.mention_id))
        );
        if (values.length > 0) lines.push(`${slot}: ${values.join(', ')}`);
      }
      if (row.slotValues.other.length > 0) {
        lines.push('other:');
        for (const other of row.slotValues.other) {
          const values = other.values.map((v) =>
            renderSurfaceWithWiki(v.text, getWikiEvidenceForSurface('slot', v.mention_id))
          );
          lines.push(`  - ${other.role}: ${values.join(', ')}`);
        }
      }
      if (row.opsText) lines.push(`ops: ${row.opsText}`);
      lines.push(`evidence: ${row.evidenceFootnote}`);
      lines.push('');
    }
  }
  if (!md && lines[lines.length - 1] === '') lines.pop();
}

function renderAssertionsTable(rows, options, lines, getWikiEvidenceForSurface) {
  const initialColumns = [];
  if (options.debugIds) initialColumns.push({ key: 'assertion_id', title: 'assertion_id', always: true });
  initialColumns.push({ key: 'segment_id', title: 'segment_id' });
  initialColumns.push({ key: 'actor', title: 'actor' });
  initialColumns.push({ key: 'predicate', title: 'predicate', always: true });
  initialColumns.push({ key: 'theme', title: 'theme' });
  initialColumns.push({ key: 'attr', title: 'attr' });
  initialColumns.push({ key: 'topic', title: 'topic' });
  initialColumns.push({ key: 'location', title: 'location' });
  initialColumns.push({ key: 'other', title: 'other' });
  initialColumns.push({ key: 'ops', title: 'ops' });
  initialColumns.push({ key: 'evidence', title: 'evidence', always: true });

  const tableRows = rows.map((row) => ({
    assertion_id: row.assertion.id,
    segment_id: row.assertion.segment_id || '',
    predicate: (() => {
      const base = renderSurfaceWithWiki(row.predText, getWikiEvidenceForSurface('predicate', row.assertion.id));
      const predicateQuality = (((row || {}).assertion || {}).diagnostics || {}).predicate_quality;
      return predicateQuality === 'low' ? `${base} (predicate_quality=low)` : base;
    })(),
    actor: row.slotValues.actor.map((v) => renderSurfaceWithWiki(v.text, getWikiEvidenceForSurface('slot', v.mention_id))).join(', '),
    theme: row.slotValues.theme.map((v) => renderSurfaceWithWiki(v.text, getWikiEvidenceForSurface('slot', v.mention_id))).join(', '),
    attr: row.slotValues.attr.map((v) => renderSurfaceWithWiki(v.text, getWikiEvidenceForSurface('slot', v.mention_id))).join(', '),
    topic: row.slotValues.topic.map((v) => renderSurfaceWithWiki(v.text, getWikiEvidenceForSurface('slot', v.mention_id))).join(', '),
    location: row.slotValues.location.map((v) => renderSurfaceWithWiki(v.text, getWikiEvidenceForSurface('slot', v.mention_id))).join(', '),
    other: row.slotValues.other.map((o) => `${o.role}:${o.values.map((v) => renderSurfaceWithWiki(v.text, getWikiEvidenceForSurface('slot', v.mention_id))).join(', ')}`).join(' ; '),
    ops: row.opsText,
    evidence: row.evidenceFootnote,
  }));

  const columns = initialColumns.filter((col) => col.always || tableRows.some((r) => (r[col.key] || '') !== ''));
  const header = '| ' + columns.map((c) => c.title).join(' | ') + ' |';
  const sep = '| ' + columns.map(() => '---').join(' | ') + ' |';
  lines.push(header);
  lines.push(sep);
  for (const row of tableRows) {
    lines.push('| ' + columns.map((c) => String(row[c.key] || '').replace(/\|/g, '\\|')).join(' | ') + ' |');
  }
}
function joinMeaningMentions(mentionIds, refs, options, getWikiEvidenceForSurface) {
  const { mentionById, tokenById } = refs;
  const ids = (mentionIds || []).slice().sort((a, b) => a.localeCompare(b));
  return ids
    .map((mid) => {
      const m = mentionById.get(mid);
      if (!m) return '';
      const base = mentionText(m, tokenById, options);
      return renderSurfaceWithWiki(base, getWikiEvidenceForSurface('slot', mid));
    })
    .filter(Boolean);
}

function joinMeaningMentionsWithWiki(mentionIds, refs, options, getWikiEvidenceForSurface) {
  const values = joinMeaningMentions(mentionIds, refs, options, getWikiEvidenceForSurface);
  const hasWiki = values.some((x) => x.includes('|wiki:exact⟧') || x.includes('|wiki:prefix⟧'));
  return {
    text: values.join(', '),
    hasWiki,
  };
}

function meaningGroup(assertion, predText) {
  const ops = Array.isArray(assertion && assertion.operators) ? assertion.operators : [];
  if (ops.some((o) => o && o.kind === 'coordination_group')) return 'Coordinated Actions';
  const slots = toViewSlotsFromRoles(assertion);
  const hasAttr = Array.isArray(slots?.attr) && slots.attr.length > 0;
  const p = String(predText || '').toLowerCase();
  if (hasAttr || p === 'is' || p === 'are' || p === 'was' || p === 'were') return 'Definitions';
  if (ops.some((o) => o && o.kind === 'modality' && String(o.value || '').toLowerCase() === 'can') || p.includes('want')) return 'Capabilities';
  if (ops.some((o) => o && (o.kind === 'control_inherit_subject' || o.kind === 'control_propagation')) || p === 'need' || p === 'needs' || p === 'must') return 'Requirements';
  return 'Actions';
}

function renderAssertionsMeaning(data, options, refs, lines, md, getWikiEvidenceForSurface) {
  const { mentionById, tokenById } = refs;
  const assertions = (data.assertions || [])
    .slice()
    .sort((a, b) => assertionSortKey(a, mentionById, tokenById).localeCompare(assertionSortKey(b, mentionById, tokenById)));
  const grouped = new Map();
  for (const a of assertions) {
    const predMention = mentionById.get(a.predicate.mention_id);
    const predText = predMention ? mentionText(predMention, tokenById, options) : '';
    const predEvidence = getWikiEvidenceForSurface('predicate', a.id);
    const predRendered = renderSurfaceWithWiki(predText, predEvidence);
    const predHasWiki = predRendered.includes('|wiki:');
    const actor = {
      text: (toViewSlotsFromRoles(a)?.actor || [])
        .slice()
        .sort((x, y) => x.localeCompare(y))
        .map((mid) => {
          const m = mentionById.get(mid);
          return m ? renderSurfaceWithWiki(mentionText(m, tokenById, options), getWikiEvidenceForSurface('slot', mid)) : '';
        })
        .filter(Boolean)
        .join(', '),
    };
    const slots = toViewSlotsFromRoles(a);
    const theme = joinMeaningMentionsWithWiki(slots?.theme || [], refs, options, getWikiEvidenceForSurface);
    const attr = joinMeaningMentionsWithWiki(slots?.attr || [], refs, options, getWikiEvidenceForSurface);
    const location = joinMeaningMentionsWithWiki(slots?.location || [], refs, options, getWikiEvidenceForSurface);
    const item = {
      assertionId: a.id,
      actor: actor.text,
      predicate: predRendered,
      theme: theme.text,
      attr: attr.text,
      location: location.text,
      hasWiki: Boolean(predHasWiki || theme.hasWiki || attr.hasWiki || location.hasWiki),
      deemphasizeCopula: (predText === 'is' || predText === 'are' || predText === 'was' || predText === 'were') && Array.isArray(slots?.attr) && slots.attr.length > 0,
      evidenceFootnote: buildAssertionEvidenceFootnote(a),
    };
    const g = meaningGroup(a, predText);
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g).push(item);
  }
  const order = ['Definitions', 'Capabilities', 'Requirements', 'Coordinated Actions', 'Actions'];
  for (const g of order) {
    const items = grouped.get(g) || [];
    if (items.length === 0) continue;
    if (md) lines.push(`\n### ${g}`);
    else lines.push(`\n${g}`);
    lines.push(md ? '- Actor | Predicate | Theme | Attr | Location | wiki⁺' : 'Actor | Predicate | Theme | Attr | Location | wiki⁺');
    for (const it of items) {
      const pred = it.deemphasizeCopula ? `(copula:${it.predicate})` : it.predicate;
      const line = `${it.actor || '-'} | ${pred || '-'} | ${it.theme || '-'} | ${it.attr || '-'} | ${it.location || '-'} | ${it.hasWiki ? 'wiki✓' : '-'}`;
      lines.push(md ? `- ${line}${options.debugIds ? ` (${it.assertionId})` : ''}` : `${line}${options.debugIds ? ` (${it.assertionId})` : ''}`);
      lines.push(md ? `  - evidence: ${it.evidenceFootnote}` : `  evidence: ${it.evidenceFootnote}`);
    }
  }
}

function renderAssertions(data, options, refs, lines, md) {
  const getWikiEvidenceForSurface = createWikiEvidenceResolver(data);
  if (options.layout === 'meaning') {
    renderAssertionsMeaning(data, options, refs, lines, md, getWikiEvidenceForSurface);
    return;
  }
  const rows = buildAssertionRows(data, refs, options);
  if (options.layout === 'compact') {
    renderAssertionsCompact(rows, options, lines, md, getWikiEvidenceForSurface);
    return;
  }
  if (options.layout === 'readable') {
    renderAssertionsReadable(rows, options, lines, md, getWikiEvidenceForSurface);
    return;
  }
  renderAssertionsTable(rows, options, lines, getWikiEvidenceForSurface);
}

function renderSuppressedAssertions(data, options, lines, md) {
  if (!options.debugIds) return;
  const suppressed = Array.isArray(((data || {}).diagnostics || {}).suppressed_assertions)
    ? data.diagnostics.suppressed_assertions
    : [];
  if (suppressed.length === 0) return;
  const sorted = suppressed.slice().sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
  if (md) lines.push('\n### Suppressed Assertions');
  else lines.push('\nSuppressed Assertions');
  for (const s of sorted) {
    const sb = (((s || {}).diagnostics || {}).suppressed_by) || {};
    const upstreamIds = Array.isArray((((sb || {}).evidence || {}).upstream_relation_ids))
      ? sb.evidence.upstream_relation_ids
      : [];
    const line =
      `id=${s.id} kind=${sb.kind || ''} target_assertion_id=${sb.target_assertion_id || ''} ` +
      `reason=${sb.reason || ''} upstream_relation_ids_len=${upstreamIds.length}`;
    lines.push(md ? `- ${line}` : line);
  }
}

function render(data, options, refs) {
  const { tokenById, mentionById } = refs;
  const getWikiEvidenceForSurface = createWikiEvidenceResolver(data);
  const lines = [];
  const md = options.format === 'md';

  if (md) lines.push('# Elementary Assertions');
  else lines.push('Elementary Assertions');

  if (options.segments) {
    const segments = sortedSegments(data);
    if (md) lines.push('\n## Segments');
    else lines.push('\nSegments');
    for (const s of segments) {
      const rawSlice = normalizeRenderText(data.canonical_text.slice(s.span.start, s.span.end));
      const slice = normalizeSegmentDisplay(rawSlice, options);
      if (md) {
        lines.push(`- Segment ${s.id}`);
        lines.push(`  - SegmentText: "${slice}"`);
      } else {
        lines.push(`Segment ${s.id}`);
        lines.push(`SegmentText: "${slice}"`);
      }
    }
  }

  if (options.mentions) {
    renderMentions(data, options, refs, lines, md, getWikiEvidenceForSurface);
  }

  if (md) lines.push('\n## Assertions');
  else lines.push('\nAssertions');
  renderAssertions(data, options, refs, lines, md);
  renderSuppressedAssertions(data, options, lines, md);

  if (options.coverage) {
    if (md) lines.push('\n## Coverage');
    else lines.push('\nCoverage');
    const c = data.coverage || {};
    const p = Array.isArray(c.primary_mention_ids) ? c.primary_mention_ids : [];
    const covered = Array.isArray(c.covered_primary_mention_ids) ? c.covered_primary_mention_ids : [];
    const uncovered = Array.isArray(c.uncovered_primary_mention_ids) ? c.uncovered_primary_mention_ids : [];
    lines.push(md ? `- primary_mention_ids count: ${p.length}` : `primary_mention_ids count: ${p.length}`);
    lines.push(md ? `- covered_primary_mention_ids count: ${covered.length}` : `covered_primary_mention_ids count: ${covered.length}`);
    lines.push(md ? `- uncovered_primary_mention_ids count: ${uncovered.length}` : `uncovered_primary_mention_ids count: ${uncovered.length}`);

    const unresolved = Array.isArray(c.unresolved) ? c.unresolved : [];
    const unresolvedByMention = new Map();
    for (const u of unresolved) {
      if (!u || typeof u.mention_id !== 'string') continue;
      const prev = unresolvedByMention.get(u.mention_id);
      const prevKey = prev ? `${prev.kind || ''}|${prev.reason || ''}` : '';
      const curKey = `${u.kind || ''}|${u.reason || ''}`;
      if (!prev || curKey.localeCompare(prevKey) < 0) {
        unresolvedByMention.set(u.mention_id, u);
      }
    }
    const usedMentionIds = collectUsedMentionIdsFromAssertions(data.assertions || []);
    const usedMentions = sortMentionIdsForCoverage(Array.from(usedMentionIds), mentionById)
      .map((id) => mentionById.get(id))
      .filter(Boolean);
    const strictlyUncovered = [];
    const containedUncovered = [];
    const uncoveredSorted = sortMentionIdsForCoverage(uncovered, mentionById);
    for (const mid of uncoveredSorted) {
      const m = mentionById.get(mid);
      if (!m) continue;
      const mTokenSet = new Set((m.token_ids || []).map((t) => String(t)));
      const containerIds = [];
      for (const cm of usedMentions) {
        if (!cm || cm.id === mid) continue;
        const cTokenSet = new Set((cm.token_ids || []).map((t) => String(t)));
        let contained = true;
        for (const tid of mTokenSet) {
          if (!cTokenSet.has(tid)) {
            contained = false;
            break;
          }
        }
        if (contained) containerIds.push(cm.id);
      }
      containerIds.sort((a, b) => a.localeCompare(b));
      if (containerIds.length > 0) {
        containedUncovered.push({ mention_id: mid, mention: m, contained_in: containerIds });
      } else {
        strictlyUncovered.push({ mention_id: mid, mention: m, contained_in: [] });
      }
    }

    if (md) lines.push('\n### Strictly Uncovered Primary Mentions');
    else lines.push('\nStrictly Uncovered Primary Mentions');
    for (const item of strictlyUncovered) {
      const m = item.mention;
      const u = unresolvedByMention.get(item.mention_id);
      const reason = String((u && u.reason) || 'unknown');
      const text = renderSurfaceWithWiki(
        mentionText(m, tokenById, options),
        getWikiEvidenceForSurface('mention', m.id)
      );
      const line = `${text} (mention_id=${m.id}, reason=${reason})`;
      lines.push(md ? `- ${line}` : line);
    }

    if (md) lines.push('\n### Contained Uncovered Primary Mentions');
    else lines.push('\nContained Uncovered Primary Mentions');
    for (const item of containedUncovered) {
      const m = item.mention;
      const u = unresolvedByMention.get(item.mention_id);
      const reason = String((u && u.reason) || 'unknown');
      const text = renderSurfaceWithWiki(
        mentionText(m, tokenById, options),
        getWikiEvidenceForSurface('mention', m.id)
      );
      const line = `${text} (mention_id=${m.id}, contained_in=[${item.contained_in.join(',')}], reason=${reason})`;
      lines.push(md ? `- ${line}` : line);
    }
    if (options.renderUncoveredDelta) {
      if (md) lines.push('\n### Uncovered Primary Mentions Summary');
      else lines.push('\nUncovered Primary Mentions Summary');
      lines.push(md ? `- strictly_uncovered_count: ${strictlyUncovered.length}` : `strictly_uncovered_count: ${strictlyUncovered.length}`);
      lines.push(md ? `- contained_uncovered_count: ${containedUncovered.length}` : `contained_uncovered_count: ${containedUncovered.length}`);
    }

    if (md) lines.push('\n### Unresolved');
    else lines.push('\nUnresolved');
    const groups = new Map();
    for (const u of unresolved) {
      const key = `${u.kind}|${u.reason}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(u);
    }
    const gkeys = Array.from(groups.keys()).sort();
    for (const key of gkeys) {
      const [kind, reason] = key.split('|');
      lines.push(md ? `- ${kind} / ${reason}` : `${kind} / ${reason}`);
      const entries = groups.get(key).slice().sort((a, b) => {
        if (a.segment_id !== b.segment_id) return a.segment_id.localeCompare(b.segment_id);
        return a.mention_id.localeCompare(b.mention_id);
      });
      for (const u of entries) {
        const m = mentionById.get(u.mention_id);
        if (!m) continue;
        const unresolvedText = renderSurfaceWithWiki(
          mentionText(m, tokenById, options),
          getWikiEvidenceForSurface('mention', m.id)
        );
        let line = `${unresolvedText} reason=${u.reason}`;
        if (options.debugIds) {
          const tokenIds = Array.isArray((u.evidence || {}).token_ids) ? u.evidence.token_ids : [];
          const tids = tokenIds.join(',');
          const span = (u.evidence || {}).span ? `${u.evidence.span.start}-${u.evidence.span.end}` : '';
          const mentionIds = Array.isArray(u.mention_ids) ? u.mention_ids : [u.mention_id];
          const upstreamIds = Array.isArray((u.evidence || {}).upstream_relation_ids) ? u.evidence.upstream_relation_ids : [];
          const upstreamPart =
            options.layout === 'meaning'
              ? ` upstream_relation_ids=[${upstreamIds.join(',')}]`
              : ` upstream_relation_ids_len=${upstreamIds.length}`;
          const tokenPart =
            options.layout === 'meaning'
              ? ` token_ids=[${tids}] token_ids_len=${tokenIds.length}`
              : ` token_ids_len=${tokenIds.length}`;
          line += ` segment_id=${u.segment_id} mention_id=${u.mention_id} mention_ids=[${mentionIds.join(',')}]${tokenPart} span=${span}${upstreamPart}`;
        }
        lines.push(md ? `  - ${line}` : `  ${line}`);
      }
    }
  }

  return lines.join('\n') + '\n';
}


function renderElementaryAssertions(data, options = {}) {
  rejectLegacySlots(data);
  validateElementaryAssertions(data);
  const format = options.format || "txt";
  const layout = options.layout || "compact";
  if (format !== "txt" && format !== "md") throw new Error("Invalid value for format: expected txt|md");
  if (!["compact", "readable", "table", "meaning"].includes(layout)) throw new Error("Invalid value for layout: expected compact|readable|table|meaning");
  const normalizedOptions = {
    format,
    layout,
    segments: options.segments === undefined ? true : Boolean(options.segments),
    mentions: options.mentions === undefined ? true : Boolean(options.mentions),
    coverage: options.coverage === undefined ? true : Boolean(options.coverage),
    debugIds: options.debugIds === undefined ? false : Boolean(options.debugIds),
    normalizeDeterminers: options.normalizeDeterminers === undefined ? true : Boolean(options.normalizeDeterminers),
    renderUncoveredDelta: options.renderUncoveredDelta === undefined ? false : Boolean(options.renderUncoveredDelta),
  };
  const refs = buildIntegrity(data);
  return render(data, normalizedOptions, refs);
}

module.exports = {
  renderElementaryAssertions,
};

