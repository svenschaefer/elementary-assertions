const { UNRESOLVED_REASON_PRECEDENCE, stableObjectKey, normalizeIds, findSelector } = require('./determinism');
const { hasPositiveWikiSignal, isSubjectRoleLabel, isCompareLabel, isQuantifierLabel } = require('./mentions');
const { normalizeOptionalString } = require('./strings');
const { annotationHasSource } = require('./projection');

function operatorIdentityKey(op) {
  return `${op.kind || ''}|${op.value || ''}|${op.group_id || ''}|${op.role || ''}`;
}

function evidenceSortKey(e) {
  return `${e.from_token_id || ''}|${e.to_token_id || ''}|${e.label || ''}|${e.relation_id || e.annotation_id || ''}`;
}

function dedupeAndSortEvidence(items) {
  const byKey = new Map();
  for (const it of items || []) {
    const k = stableObjectKey(it);
    if (!byKey.has(k)) byKey.set(k, it);
  }
  return Array.from(byKey.values()).sort((a, b) => evidenceSortKey(a).localeCompare(evidenceSortKey(b)));
}

function mergeOperator(opMap, op) {
  const key = operatorIdentityKey(op);
  const existing = opMap.get(key);
  if (!existing) {
    opMap.set(key, {
      ...op,
      evidence: dedupeAndSortEvidence(op.evidence || []),
    });
    return;
  }
  existing.evidence = dedupeAndSortEvidence((existing.evidence || []).concat(op.evidence || []));
}

function pickReasonByPrecedence(candidates) {
  const set = new Set((candidates || []).filter(Boolean));
  for (const reason of UNRESOLVED_REASON_PRECEDENCE) {
    if (set.has(reason)) return reason;
  }
  return 'projection_failed';
}

function classifyUnresolvedReason({
  mentionId,
  predicateQualityByMentionId,
  roleRelationIdsByMention,
  operatorRelationIdsByMention,
  coordMissingTypeIdsByMention,
}) {
  const reasons = [];
  if ((predicateQualityByMentionId.get(mentionId) || '') === 'low') reasons.push('predicate_invalid');
  const roleIds = roleRelationIdsByMention.get(mentionId);
  const operatorIds = operatorRelationIdsByMention.get(mentionId);
  const coordTypeMissingIds = coordMissingTypeIdsByMention.get(mentionId);
  if (coordTypeMissingIds && coordTypeMissingIds.size > 0) reasons.push('coord_type_missing');
  if ((!roleIds || roleIds.size === 0) && operatorIds && operatorIds.size > 0) reasons.push('operator_scope_open');
  if (!roleIds || roleIds.size === 0) reasons.push('missing_relation');
  if (roleIds && roleIds.size > 0) reasons.push('projection_failed');
  return pickReasonByPrecedence(reasons);
}

function buildUnresolved({
  mentions,
  unresolvedHeadMap,
  projectedUnresolved,
  mentionById,
  assertions,
  projected,
  uncoveredPrimaryMentionIds,
}) {
  const predicateQualityByMentionId = new Map();
  for (const a of assertions || []) {
    if (!a || !a.predicate || typeof a.predicate.mention_id !== 'string') continue;
    const q = a.diagnostics && typeof a.diagnostics.predicate_quality === 'string' ? a.diagnostics.predicate_quality : '';
    if (q) predicateQualityByMentionId.set(a.predicate.mention_id, q);
  }

  const roleLabels = new Set(['theme', 'patient', 'attribute', 'topic', 'location', 'recipient']);
  const operatorLabels = new Set(['modality', 'negation', 'coordination', 'complement_clause', 'purpose']);
  const roleRelationIdsByMention = new Map();
  const operatorRelationIdsByMention = new Map();
  const coordMissingTypeIdsByMention = new Map();
  function addRelId(map, mentionId, relationId) {
    if (typeof mentionId !== 'string' || mentionId.length === 0) return;
    if (typeof relationId !== 'string' || relationId.length === 0) return;
    if (!map.has(mentionId)) map.set(mentionId, new Set());
    map.get(mentionId).add(relationId);
  }
  for (const rel of projected || []) {
    if (!rel) continue;
    const relationId = typeof rel.relation_id === 'string' && rel.relation_id.length > 0
      ? rel.relation_id
      : (typeof rel.id === 'string' ? rel.id : '');
    if (roleLabels.has(String(rel.label || '')) || isSubjectRoleLabel(rel.label)) {
      addRelId(roleRelationIdsByMention, rel.head_mention_id, relationId);
    }
    if (
      operatorLabels.has(String(rel.label || '')) ||
      (rel.evidence && (rel.evidence.pattern === 'control_inherit_subject' || rel.evidence.pattern === 'control_propagation'))
    ) {
      addRelId(operatorRelationIdsByMention, rel.head_mention_id, relationId);
    }
    if (String(rel.label || '') === 'coordination') {
      const coordType = rel.evidence && (
        rel.evidence.coord_type ||
        rel.evidence.coordination_type ||
        rel.evidence.coordinator_type
      );
      if (!coordType) {
        addRelId(coordMissingTypeIdsByMention, rel.head_mention_id, relationId);
        addRelId(coordMissingTypeIdsByMention, rel.dep_mention_id, relationId);
      }
    }
  }

  const grouped = new Map();
  const put = (kind, segment_id, mention_id, mention_ids, token_ids, span, upstreamRelationIds) => {
    const reason = classifyUnresolvedReason({
      mentionId: mention_id,
      predicateQualityByMentionId,
      roleRelationIdsByMention,
      operatorRelationIdsByMention,
      coordMissingTypeIdsByMention,
    });
    const k = `${kind}|${segment_id}|${mention_id}|${reason}`;
    if (!grouped.has(k)) {
      grouped.set(k, {
        kind,
        segment_id,
        mention_id,
        mention_ids: new Set(),
        reason,
        token_ids: new Set(),
        upstream_relation_ids: new Set(),
        span: span || null,
      });
    }
    const g = grouped.get(k);
    g.mention_ids.add(mention_id);
    for (const mid of mention_ids || []) {
      if (typeof mid === 'string' && mid.length > 0) g.mention_ids.add(mid);
    }
    for (const t of token_ids) g.token_ids.add(t);
    for (const rid of upstreamRelationIds || []) {
      if (typeof rid === 'string' && rid.length > 0) g.upstream_relation_ids.add(rid);
    }
    if (!g.span && span) g.span = span;
  };

  for (const m of mentions) {
    if (!unresolvedHeadMap.get(m.id)) continue;
    put('unresolved_head', m.segment_id, m.id, [m.id], m.token_ids, m.span, []);
  }

  for (const u of projectedUnresolved) {
    const m = mentionById.get(u.mention_id);
    if (!m) continue;
    const upstreamRelationIds = [];
    if (u.relation && typeof u.relation.relation_id === 'string' && u.relation.relation_id.length > 0) {
      upstreamRelationIds.push(u.relation.relation_id);
    } else if (u.relation && typeof u.relation.id === 'string' && u.relation.id.length > 0) {
      upstreamRelationIds.push(u.relation.id);
    }
    const mentionIds = [u.mention_id];
    if (u.relation && typeof u.relation.head_mention_id === 'string' && u.relation.head_mention_id.length > 0) {
      mentionIds.push(u.relation.head_mention_id);
    }
    if (u.relation && typeof u.relation.dep_mention_id === 'string' && u.relation.dep_mention_id.length > 0) {
      mentionIds.push(u.relation.dep_mention_id);
    }
    put('unresolved_attachment', u.segment_id, u.mention_id, mentionIds, m.token_ids, m.span, upstreamRelationIds);
  }

  for (const uncoveredId of uncoveredPrimaryMentionIds || []) {
    if (typeof uncoveredId !== 'string' || !uncoveredId) continue;
    const m = mentionById.get(uncoveredId);
    if (!m) continue;
    put('unresolved_attachment', m.segment_id, m.id, [m.id], m.token_ids || [], m.span, []);
  }

  const out = Array.from(grouped.values()).map((g) => ({
    kind: g.kind,
    segment_id: g.segment_id,
    mention_id: g.mention_id,
    mention_ids: normalizeIds(Array.from(g.mention_ids)),
    reason: g.reason,
    evidence: {
      token_ids: normalizeIds(Array.from(g.token_ids)),
      upstream_relation_ids: normalizeIds(Array.from(g.upstream_relation_ids)),
      span: g.span || undefined,
    },
  }));
  out.sort((a, b) => {
    if (a.segment_id !== b.segment_id) return a.segment_id.localeCompare(b.segment_id);
    if (a.mention_id !== b.mention_id) return a.mention_id.localeCompare(b.mention_id);
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.reason.localeCompare(b.reason);
  });
  return out;
}

function buildSubjectRoleGaps({ assertions, projected }) {
  const subjectRelsByPredicate = new Map();
  for (const rel of projected || []) {
    if (!rel || !isSubjectRoleLabel(rel.label)) continue;
    const predMentionId = String(rel.head_mention_id || '');
    if (!predMentionId) continue;
    if (!subjectRelsByPredicate.has(predMentionId)) subjectRelsByPredicate.set(predMentionId, new Set());
    const rid = String(rel.relation_id || rel.id || '');
    if (rid) subjectRelsByPredicate.get(predMentionId).add(rid);
  }
  const out = [];
  for (const a of assertions || []) {
    if (!a || !a.predicate || typeof a.predicate.mention_id !== 'string') continue;
    const predicateClass = String((((a || {}).diagnostics) || {}).predicate_class || '');
    if (predicateClass !== 'lexical_verb') continue;
    const actorIds = normalizeIds(((a || {}).arguments || []).filter((entry) => String((entry && entry.role) || '') === 'actor').flatMap((entry) => entry.mention_ids || []));
    if (actorIds.length > 0) continue;
    const predMentionId = a.predicate.mention_id;
    const relIds = normalizeIds(Array.from(subjectRelsByPredicate.get(predMentionId) || []));
    if (relIds.length > 0) continue;
    const tokenIds = normalizeIds([String(a.predicate.head_token_id || '')].filter(Boolean));
    out.push({
      segment_id: String(a.segment_id || ''),
      assertion_id: String(a.id || ''),
      predicate_mention_id: predMentionId,
      predicate_head_token_id: String(a.predicate.head_token_id || ''),
      reason: 'missing_subject_role',
      evidence: {
        token_ids: tokenIds,
        upstream_relation_ids: [],
      },
    });
  }
  out.sort((a, b) => {
    if (a.segment_id !== b.segment_id) return a.segment_id.localeCompare(b.segment_id);
    if (a.assertion_id !== b.assertion_id) return a.assertion_id.localeCompare(b.assertion_id);
    return a.predicate_mention_id.localeCompare(b.predicate_mention_id);
  });
  return out;
}

function buildDiagnostics({ tokenWikiById, mentions, assertions, projectedBuild, relationsSeed, wtiEndpoint, suppressedAssertions }) {
  const mentionWithLexicon = mentions.filter(
    (m) => m && m.provenance && m.provenance.lexicon_evidence && typeof m.provenance.lexicon_evidence === 'object'
  ).length;
  const assertionsWithWiki = assertions.filter(
    (a) => a && a.evidence && a.evidence.wiki_signals && typeof a.evidence.wiki_signals === 'object'
  ).length;
  const warnings = [];
  if (normalizeOptionalString(wtiEndpoint) && tokenWikiById.size === 0) {
    warnings.push('wti_configured_but_no_token_wiki_signals');
  }
  if ((projectedBuild.dropped || []).length > 0) {
    warnings.push('relation_projection_drops_present');
  }
  const projected = projectedBuild.projected || [];
  const coordTypeMissing = projected.some((r) => {
    if (!r || String(r.label || '') !== 'coordination') return false;
    const ev = r.evidence || {};
    return !(
      (typeof ev.coord_type === 'string' && ev.coord_type.length > 0) ||
      (typeof ev.coordination_type === 'string' && ev.coordination_type.length > 0) ||
      (typeof ev.coordinator_type === 'string' && ev.coordinator_type.length > 0)
    );
  });
  const compareRelPresent = projected.some((r) => isCompareLabel(r && r.label));
  const quantifierRelPresent = projected.some((r) => isQuantifierLabel(r && r.label));
  const segTokens = new Map();
  for (const t of (relationsSeed && relationsSeed.tokens) || []) {
    if (!t || typeof t.segment_id !== 'string') continue;
    if (!segTokens.has(t.segment_id)) segTokens.set(t.segment_id, []);
    segTokens.get(t.segment_id).push(String(t.surface || '').toLowerCase());
  }
  const comparativeSurfacePresent = Array.from(segTokens.values()).some((arr) =>
    arr.includes('than') && arr.some((s) => s === 'greater' || s === 'less' || s === 'more' || s === 'fewer')
  );
  const quantifierSurfaceSet = new Set(['each', 'every', 'all', 'some', 'no', 'only']);
  const quantifierSurfacePresent = Array.from(segTokens.values()).some((arr) => arr.some((s) => quantifierSurfaceSet.has(s)));
  if (coordTypeMissing) warnings.push('coordination_type_missing');
  if (comparativeSurfacePresent && !compareRelPresent) warnings.push('comparative_gap');
  if (quantifierSurfacePresent && !quantifierRelPresent) warnings.push('quantifier_scope_gap');
  const coordGroups = new Map();
  for (const a of assertions || []) {
    for (const op of (a.operators || [])) {
      if (!op || op.kind !== 'coordination_group' || typeof op.group_id !== 'string') continue;
      if (!coordGroups.has(op.group_id)) {
        coordGroups.set(op.group_id, {
          id: op.group_id,
          type: typeof op.value === 'string' && op.value.length > 0 ? op.value : null,
          member_assertion_ids: new Set(),
        });
      }
      const g = coordGroups.get(op.group_id);
      g.member_assertion_ids.add(a.id);
      if (!g.type && typeof op.value === 'string' && op.value.length > 0) g.type = op.value;
    }
  }
  const coordinationGroups = Array.from(coordGroups.values())
    .map((g) => ({
      id: g.id,
      type: g.type,
      member_assertion_ids: normalizeIds(Array.from(g.member_assertion_ids)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const perSegmentMap = new Map();
  for (const a of assertions || []) {
    if (!a || typeof a.segment_id !== 'string') continue;
    if (!perSegmentMap.has(a.segment_id)) {
      perSegmentMap.set(a.segment_id, {
        segment_id: a.segment_id,
        predicate_assertion_count: 0,
        lexical_verb_count: 0,
        tolerated_auxiliary_count: 0,
        structural_fragment_count: 0,
        clause_fragmentation_warning: false,
      });
    }
    const bucket = perSegmentMap.get(a.segment_id);
    bucket.predicate_assertion_count += 1;
    const predicateClass = String((((a || {}).diagnostics) || {}).predicate_class || '');
    if (predicateClass === 'lexical_verb') bucket.lexical_verb_count += 1;
    if (predicateClass === 'auxiliary' || predicateClass === 'copula') bucket.tolerated_auxiliary_count += 1;
    if ((((a || {}).diagnostics) || {}).structural_fragment === true) bucket.structural_fragment_count += 1;
  }
  const perSegment = Array.from(perSegmentMap.values())
    .map((x) => ({
      ...x,
      clause_fragmentation_warning:
        x.predicate_assertion_count > (x.lexical_verb_count + x.tolerated_auxiliary_count),
    }))
    .sort((a, b) => a.segment_id.localeCompare(b.segment_id));
  const structuralFragmentCount = perSegment.reduce((n, x) => n + x.structural_fragment_count, 0);
  const totalAssertions = (assertions || []).length;
  const noiseCount = (assertions || []).filter((a) => {
    const cls = String((((a || {}).diagnostics) || {}).predicate_class || '');
    return cls === 'preposition' || cls === 'nominal_head';
  }).length;
  const predicateNoiseIndex = totalAssertions > 0 ? Number((noiseCount / totalAssertions).toFixed(6)) : 0;
  const subjectRoleGaps = buildSubjectRoleGaps({
    assertions,
    projected,
  });
  return {
    token_wiki_signal_count: tokenWikiById.size,
    mentions_with_lexicon_evidence: mentionWithLexicon,
    assertions_with_wiki_signals: assertionsWithWiki,
    projected_relation_count: (projectedBuild.projected || []).length,
    dropped_relation_count: (projectedBuild.dropped || []).length,
    fragmentation: {
      structural_fragment_count: structuralFragmentCount,
      predicate_noise_index: predicateNoiseIndex,
      per_segment: perSegment,
    },
    gap_signals: {
      coordination_type_missing: coordTypeMissing,
      comparative_gap: comparativeSurfacePresent && !compareRelPresent,
      quantifier_scope_gap: quantifierSurfacePresent && !quantifierRelPresent,
    },
    coordination_groups: coordinationGroups,
    subject_role_gaps: subjectRoleGaps,
    suppressed_assertions: Array.isArray(suppressedAssertions) ? suppressedAssertions : [],
    warnings: normalizeIds(warnings),
  };
}


function collectWikiFieldDiagnostics(inputDoc) {
  const terms = ['wiki', 'wikipedia', 'title_index', 'lexicon'];
  const buckets = new Map();

  function normalizePath(p) {
    return p.replace(/\[\d+\]/g, '[]');
  }

  function summarizeValue(value) {
    try {
      const raw = JSON.stringify(value);
      if (typeof raw !== 'string') return String(value);
      return raw.length > 180 ? `${raw.slice(0, 177)}...` : raw;
    } catch (_) {
      return String(value);
    }
  }

  function visit(node, pathPrefix) {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        visit(node[i], `${pathPrefix}[${i}]`);
      }
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const key of Object.keys(node)) {
      const value = node[key];
      const path = pathPrefix ? `${pathPrefix}.${key}` : key;
      const keyLower = String(key).toLowerCase();
      if (terms.some((term) => keyLower.includes(term))) {
        const bucketKey = normalizePath(path);
        const existing = buckets.get(bucketKey) || { path: bucketKey, count: 0, example: '' };
        existing.count += 1;
        if (!existing.example) existing.example = summarizeValue(value);
        buckets.set(bucketKey, existing);
      }
      visit(value, path);
    }
  }

  visit(inputDoc, '');
  return Array.from(buckets.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function analyzeUpstreamWikiEvidence(inputDoc) {
  const tokens = Array.isArray(inputDoc && inputDoc.tokens) ? inputDoc.tokens : [];
  const annotations = Array.isArray(inputDoc && inputDoc.annotations) ? inputDoc.annotations : [];
  const acceptedMwes = annotations.filter((a) => a && a.kind === 'mwe' && a.status === 'accepted');

  const mentionEvidence = new Map();
  const mentionOrder = [];
  for (const t of tokens) {
    if (!t || typeof t.id !== 'string') continue;
    const mentionId = `token:${t.id}`;
    mentionOrder.push(mentionId);
    const has = hasPositiveWikiSignal(
      t && t.lexicon && typeof t.lexicon === 'object' ? t.lexicon.wikipedia_title_index : null
    );
    mentionEvidence.set(mentionId, has);
  }
  for (const mwe of acceptedMwes) {
    const annId = typeof mwe.id === 'string' ? mwe.id : '';
    if (!annId) continue;
    const mentionId = `mwe:${annId}`;
    mentionOrder.push(mentionId);
    const has =
      Array.isArray(mwe.sources) &&
      mwe.sources.some((s) => s && s.name === 'wikipedia-title-index' && hasPositiveWikiSignal(s.evidence));
    mentionEvidence.set(mentionId, has);
  }

  const mweByToken = new Map();
  const sortedMwes = acceptedMwes
    .map((mwe) => {
      const ts = findSelector(mwe, 'TokenSelector');
      const ids = ts && Array.isArray(ts.token_ids) ? normalizeIds(ts.token_ids) : [];
      const ps = findSelector(mwe, 'TextPositionSelector');
      const spanStart = ps && ps.span && typeof ps.span.start === 'number' ? ps.span.start : Number.MAX_SAFE_INTEGER;
      return {
        id: typeof mwe.id === 'string' ? mwe.id : '',
        token_ids: ids,
        len: ids.length,
        spanStart,
      };
    })
    .filter((x) => x.id && x.len > 0)
    .sort((a, b) => {
      if (b.len !== a.len) return b.len - a.len;
      if (a.spanStart !== b.spanStart) return a.spanStart - b.spanStart;
      return a.id.localeCompare(b.id);
    });
  for (const mwe of sortedMwes) {
    for (const tid of mwe.token_ids) {
      if (!mweByToken.has(tid)) mweByToken.set(tid, []);
      mweByToken.get(tid).push(`mwe:${mwe.id}`);
    }
  }

  const deps = annotations.filter((a) => a && a.kind === 'dependency' && a.status === 'accepted' && annotationHasSource(a, 'relation-extraction'));
  const predicateIds = normalizeIds(
    deps
      .map((d) => (d && d.head && typeof d.head.id === 'string' ? d.head.id : ''))
      .filter(Boolean)
      .map((tid) => {
        const mweMentions = mweByToken.get(tid) || [];
        if (mweMentions.length > 0) return mweMentions[0];
        return `token:${tid}`;
      })
  );

  const missingMentions = mentionOrder.filter((id) => !mentionEvidence.get(id));
  const predicatesWith = predicateIds.filter((id) => mentionEvidence.get(id));
  const predicatesWithout = predicateIds.filter((id) => !mentionEvidence.get(id));

  return {
    evidence_definition: 'positive_signal_only',
    total_mentions: mentionOrder.length,
    mentions_with_wiki_evidence: mentionOrder.length - missingMentions.length,
    mentions_without_wiki_evidence: missingMentions.length,
    total_predicates: predicateIds.length,
    predicates_with_wiki_evidence: predicatesWith.length,
    predicates_without_wiki_evidence: predicatesWithout.length,
    sample_missing_mention_ids: missingMentions.slice(0, 10),
    sample_missing_predicate_ids: predicatesWithout.slice(0, 10),
    wiki_related_fields: collectWikiFieldDiagnostics(inputDoc),
  };
}


module.exports = {
  operatorIdentityKey,
  mergeOperator,
  pickReasonByPrecedence,
  classifyUnresolvedReason,
  buildUnresolved,
  buildSubjectRoleGaps,
  buildDiagnostics,
  collectWikiFieldDiagnostics,
  analyzeUpstreamWikiEvidence,
};
