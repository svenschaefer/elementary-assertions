// Usage: node check-elementary-assertions.js --seed-id <id> [--artifacts-root <path>]
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

function usage() {
  console.error('Usage: node check-elementary-assertions.js --seed-id <id> [--artifacts-root <path>]');
}

function arg(args, name) {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return null;
  return args[i + 1];
}

function readText(filePath, label) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Error reading ${label}: ${err && err.message ? err.message : String(err)}`);
  }
}

function readJson(filePath, label) {
  try {
    return JSON.parse(readText(filePath, label));
  } catch (err) {
    throw new Error(`Error parsing ${label}: ${err && err.message ? err.message : String(err)}`);
  }
}

function readYaml(filePath, label) {
  try {
    return YAML.parse(readText(filePath, label));
  } catch (err) {
    throw new Error(`Error parsing ${label}: ${err && err.message ? err.message : String(err)}`);
  }
}

function schemaValidate(schema, data) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(data)) {
    const errText = ajv.errorsText(validate.errors, { separator: '\n' });
    throw new Error(`Schema validation failed:\n${errText}`);
  }
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function isSortedStrings(arr) {
  for (let i = 1; i < arr.length; i += 1) {
    if (String(arr[i - 1]).localeCompare(String(arr[i])) > 0) return false;
  }
  return true;
}

function relationEvidenceSortKey(ev) {
  return `${ev.from_token_id || ''}|${ev.to_token_id || ''}|${ev.label || ''}|${ev.relation_id || ev.annotation_id || ''}`;
}

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

function roleEntrySortKey(entry, priorityFn) {
  const role = String((entry && entry.role) || '');
  const mentionIds = Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : [];
  const evidence = entry && entry.evidence && typeof entry.evidence === 'object' ? entry.evidence : {};
  const relationIds = Array.isArray(evidence.relation_ids) ? evidence.relation_ids : [];
  const tokenIds = Array.isArray(evidence.token_ids) ? evidence.token_ids : [];
  const priority = String(priorityFn(role)).padStart(2, '0');
  return `${priority}|${role}|${JSON.stringify(mentionIds)}|${JSON.stringify(relationIds)}|${JSON.stringify(tokenIds)}`;
}

function collectAssertionMentionRefs(assertion) {
  const out = new Set();
  for (const entry of (assertion && assertion.arguments) || []) {
    for (const id of entry.mention_ids || []) out.add(id);
  }
  for (const entry of (assertion && assertion.modifiers) || []) {
    for (const id of entry.mention_ids || []) out.add(id);
  }
  return out;
}

function checkIntegrity(data) {
  const tokenById = new Map((data.tokens || []).map((t) => [t.id, t]));
  const mentionById = new Map((data.mentions || []).map((m) => [m.id, m]));
  const assertionById = new Map((data.assertions || []).map((a) => [a.id, a]));

  if (tokenById.size !== (data.tokens || []).length) throw new Error('Duplicate token ids detected');
  if (mentionById.size !== (data.mentions || []).length) throw new Error('Duplicate mention ids detected');
  if (assertionById.size !== (data.assertions || []).length) throw new Error('Duplicate assertion ids detected');

  for (const m of data.mentions || []) {
    const tids = uniq(m.token_ids || []);
    if (tids.length !== (m.token_ids || []).length) throw new Error(`Mention ${m.id} has duplicate token_ids`);
    for (const tid of tids) {
      if (!tokenById.has(tid)) throw new Error(`Mention ${m.id} references missing token ${tid}`);
      const tok = tokenById.get(tid);
      if (tok.segment_id !== m.segment_id) throw new Error(`Mention ${m.id} token ${tid} segment mismatch`);
    }
    if (!tokenById.has(m.head_token_id)) throw new Error(`Mention ${m.id} head_token_id missing in tokens`);
    if (!tids.includes(m.head_token_id)) throw new Error(`Mention ${m.id} head_token_id not inside mention token_ids`);
  }

  for (const a of data.assertions || []) {
    if (!mentionById.has(a.predicate.mention_id)) throw new Error(`Assertion ${a.id} predicate mention missing`);
    const pm = mentionById.get(a.predicate.mention_id);
    if (pm.segment_id !== a.segment_id) throw new Error(`Assertion ${a.id} segment_id differs from predicate mention`);
    if (pm.head_token_id !== a.predicate.head_token_id) throw new Error(`Assertion ${a.id} predicate head mismatch`);

    const mentionRefs = []
      .concat((a.arguments || []).flatMap((entry) => entry.mention_ids || []))
      .concat((a.modifiers || []).flatMap((entry) => entry.mention_ids || []));
    for (const mid of mentionRefs) {
      if (!mentionById.has(mid)) throw new Error(`Assertion ${a.id} references missing mention ${mid}`);
    }

    for (const ev of a.evidence.relation_evidence || []) {
      if (!tokenById.has(ev.from_token_id)) throw new Error(`Assertion ${a.id} evidence missing from_token ${ev.from_token_id}`);
      if (!tokenById.has(ev.to_token_id)) throw new Error(`Assertion ${a.id} evidence missing to_token ${ev.to_token_id}`);
    }
    for (const tid of a.evidence.token_ids || []) {
      if (!tokenById.has(tid)) throw new Error(`Assertion ${a.id} evidence token_ids missing token ${tid}`);
    }
    if (!isSortedStrings(a.evidence.token_ids || [])) {
      throw new Error(`Assertion ${a.id} evidence.token_ids must be sorted for determinism`);
    }
    const relEvidence = a.evidence.relation_evidence || [];
    for (let i = 1; i < relEvidence.length; i += 1) {
      const prev = relationEvidenceSortKey(relEvidence[i - 1]);
      const cur = relationEvidenceSortKey(relEvidence[i]);
      if (prev.localeCompare(cur) > 0) {
        throw new Error(`Assertion ${a.id} evidence.relation_evidence must be sorted for determinism`);
      }
    }
    for (const roleEntry of a.arguments || []) {
      if (!isSortedStrings(roleEntry.mention_ids || [])) {
        throw new Error(`Assertion ${a.id} arguments[*].mention_ids must be sorted for determinism`);
      }
      const ev = roleEntry.evidence || {};
      if (!isSortedStrings(ev.relation_ids || [])) {
        throw new Error(`Assertion ${a.id} arguments[*].evidence.relation_ids must be sorted for determinism`);
      }
      if (!isSortedStrings(ev.token_ids || [])) {
        throw new Error(`Assertion ${a.id} arguments[*].evidence.token_ids must be sorted for determinism`);
      }
    }
    for (const roleEntry of a.modifiers || []) {
      if (!isSortedStrings(roleEntry.mention_ids || [])) {
        throw new Error(`Assertion ${a.id} modifiers[*].mention_ids must be sorted for determinism`);
      }
      const ev = roleEntry.evidence || {};
      if (!isSortedStrings(ev.relation_ids || [])) {
        throw new Error(`Assertion ${a.id} modifiers[*].evidence.relation_ids must be sorted for determinism`);
      }
      if (!isSortedStrings(ev.token_ids || [])) {
        throw new Error(`Assertion ${a.id} modifiers[*].evidence.token_ids must be sorted for determinism`);
      }
    }
    const argEntries = a.arguments || [];
    for (let i = 1; i < argEntries.length; i += 1) {
      const prev = roleEntrySortKey(argEntries[i - 1], argumentRolePriority);
      const cur = roleEntrySortKey(argEntries[i], argumentRolePriority);
      if (prev.localeCompare(cur) > 0) {
        throw new Error(`Assertion ${a.id} arguments must be sorted for determinism`);
      }
    }
    const modEntries = a.modifiers || [];
    for (let i = 1; i < modEntries.length; i += 1) {
      const prev = roleEntrySortKey(modEntries[i - 1], modifierRolePriority);
      const cur = roleEntrySortKey(modEntries[i], modifierRolePriority);
      if (prev.localeCompare(cur) > 0) {
        throw new Error(`Assertion ${a.id} modifiers must be sorted for determinism`);
      }
    }
    for (const op of a.operators || []) {
      const opEvidence = Array.isArray(op.evidence) ? op.evidence : [];
      for (let i = 1; i < opEvidence.length; i += 1) {
        const prev = relationEvidenceSortKey(opEvidence[i - 1]);
        const cur = relationEvidenceSortKey(opEvidence[i]);
        if (prev.localeCompare(cur) > 0) {
          throw new Error(`Assertion ${a.id} operators[*].evidence must be sorted for determinism`);
        }
      }
    }

    if (a.diagnostics && Object.prototype.hasOwnProperty.call(a.diagnostics, 'predicate_quality')) {
      const q = a.diagnostics.predicate_quality;
      if (q !== 'ok' && q !== 'low') {
        throw new Error(`Assertion ${a.id} has invalid diagnostics.predicate_quality=${String(q)}`);
      }
    }
    if (a.diagnostics && Object.prototype.hasOwnProperty.call(a.diagnostics, 'predicate_class')) {
      const c = a.diagnostics.predicate_class;
      if (!['lexical_verb', 'copula', 'auxiliary', 'preposition', 'nominal_head'].includes(c)) {
        throw new Error(`Assertion ${a.id} has invalid diagnostics.predicate_class=${String(c)}`);
      }
    }
    if (a.diagnostics && Object.prototype.hasOwnProperty.call(a.diagnostics, 'structural_fragment')) {
      if (typeof a.diagnostics.structural_fragment !== 'boolean') {
        throw new Error(`Assertion ${a.id} diagnostics.structural_fragment must be boolean`);
      }
    }
    if (a.diagnostics && Object.prototype.hasOwnProperty.call(a.diagnostics, 'slot_projection_choice')) {
      const choice = a.diagnostics.slot_projection_choice;
      if (!choice || typeof choice !== 'object') {
        throw new Error(`Assertion ${a.id} diagnostics.slot_projection_choice must be an object when present`);
      }
      if (!Number.isInteger(choice.candidate_count) || choice.candidate_count < 2) {
        throw new Error(`Assertion ${a.id} diagnostics.slot_projection_choice.candidate_count must be an integer >= 2`);
      }
      if (typeof choice.chosen_mention_id !== 'string' || !mentionById.has(choice.chosen_mention_id)) {
        throw new Error(`Assertion ${a.id} diagnostics.slot_projection_choice.chosen_mention_id must reference an existing mention`);
      }
    }
    if (a.diagnostics && Object.prototype.hasOwnProperty.call(a.diagnostics, 'suppression_eligibility')) {
      const se = a.diagnostics.suppression_eligibility;
      if (!se || typeof se !== 'object') {
        throw new Error(`Assertion ${a.id} diagnostics.suppression_eligibility must be an object when present`);
      }
      if (typeof se.eligible !== 'boolean') {
        throw new Error(`Assertion ${a.id} diagnostics.suppression_eligibility.eligible must be boolean`);
      }
      if (se.failure_reason !== null && !['no_host', 'no_containment', 'has_core_slots'].includes(se.failure_reason)) {
        throw new Error(`Assertion ${a.id} diagnostics.suppression_eligibility.failure_reason must be null|no_host|no_containment|has_core_slots`);
      }
      if (!['preposition', 'nominal_head', 'auxiliary'].includes(se.candidate_class)) {
        throw new Error(`Assertion ${a.id} diagnostics.suppression_eligibility.candidate_class must be preposition|nominal_head|auxiliary`);
      }
      if (se.segment_id !== a.segment_id) {
        throw new Error(`Assertion ${a.id} diagnostics.suppression_eligibility.segment_id must match assertion segment_id`);
      }
      if (se.assertion_id !== a.id) {
        throw new Error(`Assertion ${a.id} diagnostics.suppression_eligibility.assertion_id must match assertion id`);
      }
      if (se.chosen_host_assertion_id !== null) {
        if (typeof se.chosen_host_assertion_id !== 'string' || !assertionById.has(se.chosen_host_assertion_id)) {
          throw new Error(`Assertion ${a.id} diagnostics.suppression_eligibility.chosen_host_assertion_id must reference existing assertion or be null`);
        }
      }
      for (const k of ['source_non_operator_token_ids', 'chosen_host_token_ids', 'missing_in_host_token_ids']) {
        if (!Array.isArray(se[k])) {
          throw new Error(`Assertion ${a.id} diagnostics.suppression_eligibility.${k} must be an array`);
        }
        if (!isSortedStrings(se[k])) {
          throw new Error(`Assertion ${a.id} diagnostics.suppression_eligibility.${k} must be sorted for determinism`);
        }
      }
      if (se.eligible === true && se.failure_reason !== null) {
        throw new Error(`Assertion ${a.id} diagnostics.suppression_eligibility.failure_reason must be null when eligible=true`);
      }
      if (se.failure_reason === 'no_host' && se.chosen_host_assertion_id !== null) {
        throw new Error(`Assertion ${a.id} diagnostics.suppression_eligibility.no_host must not include chosen_host_assertion_id`);
      }
    }
  }

  const suppressedAssertions = Array.isArray((data.diagnostics || {}).suppressed_assertions)
    ? data.diagnostics.suppressed_assertions
    : [];
  const suppressedIds = new Set();
  let prevSuppressedId = null;
  for (const s of suppressedAssertions) {
    if (!s || typeof s.id !== 'string') throw new Error('Suppressed assertion trace missing id');
    if (suppressedIds.has(s.id)) throw new Error(`Duplicate suppressed assertion id detected: ${s.id}`);
    suppressedIds.add(s.id);
    if (prevSuppressedId && prevSuppressedId.localeCompare(s.id) > 0) {
      throw new Error('suppressed_assertions must be sorted by id');
    }
    prevSuppressedId = s.id;
    const diag = s.diagnostics || {};
    const sb = diag.suppressed_by || {};
    if (diag.predicate_quality && diag.predicate_quality !== 'ok' && diag.predicate_quality !== 'low') {
      throw new Error(`Suppressed assertion ${s.id} has invalid diagnostics.predicate_quality=${String(diag.predicate_quality)}`);
    }
    if (sb.kind !== 'predicate_redirect') throw new Error(`Suppressed assertion ${s.id} has invalid suppressed_by.kind`);
    if (
      sb.reason !== 'predicate_upgraded_to_lexical' &&
      sb.reason !== 'modality_moved_to_lexical' &&
      sb.reason !== 'role_carrier_suppressed' &&
      sb.reason !== 'role_carrier_suppressed_v2_nominal' &&
      sb.reason !== 'copula_bucket_sink_suppressed'
    ) {
      throw new Error(`Suppressed assertion ${s.id} has invalid suppressed_by.reason`);
    }
    if (!assertionById.has(sb.target_assertion_id)) {
      throw new Error(`Suppressed assertion ${s.id} target_assertion_id does not exist: ${sb.target_assertion_id}`);
    }
    const upstreamIds = (((sb || {}).evidence || {}).upstream_relation_ids);
    if (upstreamIds !== undefined && !Array.isArray(upstreamIds)) {
      throw new Error(`Suppressed assertion ${s.id} suppressed_by.evidence.upstream_relation_ids must be an array when present`);
    }
    if (sb.reason === 'modality_moved_to_lexical') {
      if (!Array.isArray(upstreamIds) || upstreamIds.length === 0) {
        throw new Error(`Suppressed assertion ${s.id} modality_moved_to_lexical requires non-empty upstream_relation_ids`);
      }
      const tokenIds = (((sb || {}).evidence || {}).token_ids);
      if (!Array.isArray(tokenIds) || tokenIds.length < 2) {
        throw new Error(`Suppressed assertion ${s.id} modality_moved_to_lexical requires evidence.token_ids with source/target predicate tokens`);
      }
      const targetAssertion = assertionById.get(sb.target_assertion_id);
      if (!tokenIds.includes(s.predicate.head_token_id) || !tokenIds.includes(targetAssertion.predicate.head_token_id)) {
        throw new Error(`Suppressed assertion ${s.id} modality_moved_to_lexical evidence.token_ids must include source and target predicate head tokens`);
      }
    }
    if (sb.reason === 'role_carrier_suppressed') {
      const tokenIds = (((sb || {}).evidence || {}).token_ids);
      if (!Array.isArray(tokenIds) || tokenIds.length < 2) {
        throw new Error(`Suppressed assertion ${s.id} role_carrier_suppressed requires evidence.token_ids with source/target predicate tokens`);
      }
      const targetAssertion = assertionById.get(sb.target_assertion_id);
      if (!tokenIds.includes(s.predicate.head_token_id) || !tokenIds.includes(targetAssertion.predicate.head_token_id)) {
        throw new Error(`Suppressed assertion ${s.id} role_carrier_suppressed evidence.token_ids must include source and target predicate head tokens`);
      }
      if (Object.prototype.hasOwnProperty.call(s, 'suppressed_assertion_id') && s.suppressed_assertion_id !== s.id) {
        throw new Error(`Suppressed assertion ${s.id} suppressed_assertion_id must equal id`);
      }
      if (Object.prototype.hasOwnProperty.call(s, 'host_assertion_id') && s.host_assertion_id !== sb.target_assertion_id) {
        throw new Error(`Suppressed assertion ${s.id} host_assertion_id must equal suppressed_by.target_assertion_id`);
      }
      if (Object.prototype.hasOwnProperty.call(s, 'predicate_class')) {
        if (!['preposition', 'nominal_head', 'auxiliary'].includes(s.predicate_class)) {
          throw new Error(`Suppressed assertion ${s.id} predicate_class must be preposition|nominal_head|auxiliary for role_carrier_suppressed`);
        }
      }
      if (Object.prototype.hasOwnProperty.call(s, 'transferred_buckets')) {
        if (!Array.isArray(s.transferred_buckets)) {
          throw new Error(`Suppressed assertion ${s.id} transferred_buckets must be an array when present`);
        }
        if (!isSortedStrings(s.transferred_buckets)) {
          throw new Error(`Suppressed assertion ${s.id} transferred_buckets must be sorted for determinism`);
        }
      }
      if (Object.prototype.hasOwnProperty.call(s, 'reason') && s.reason !== 'role_carrier_suppressed') {
        throw new Error(`Suppressed assertion ${s.id} top-level reason must match suppressed_by.reason`);
      }
    }
    if (
      sb.reason === 'role_carrier_suppressed_v2_nominal' ||
      sb.reason === 'copula_bucket_sink_suppressed'
    ) {
      const targetAssertion = assertionById.get(sb.target_assertion_id);
      const tokenIds = (((sb || {}).evidence || {}).token_ids);
      if (!Array.isArray(tokenIds) || tokenIds.length < 2) {
        throw new Error(`Suppressed assertion ${s.id} ${sb.reason} requires evidence.token_ids with source/target predicate tokens`);
      }
      if (!tokenIds.includes(s.predicate.head_token_id) || !tokenIds.includes(targetAssertion.predicate.head_token_id)) {
        throw new Error(`Suppressed assertion ${s.id} ${sb.reason} evidence.token_ids must include source and target predicate head tokens`);
      }
      if (!Array.isArray(s.transferred_buckets) || !isSortedStrings(s.transferred_buckets)) {
        throw new Error(`Suppressed assertion ${s.id} ${sb.reason} requires sorted transferred_buckets`);
      }
      if (!Array.isArray(s.transferred_mention_ids) || !isSortedStrings(s.transferred_mention_ids)) {
        throw new Error(`Suppressed assertion ${s.id} ${sb.reason} requires sorted transferred_mention_ids`);
      }
      if (Object.prototype.hasOwnProperty.call(s, 'reason') && s.reason !== sb.reason) {
        throw new Error(`Suppressed assertion ${s.id} top-level reason must match suppressed_by.reason`);
      }
      if (sb.reason === 'role_carrier_suppressed_v2_nominal') {
        if (s.predicate_class !== 'nominal_head') {
          throw new Error(`Suppressed assertion ${s.id} role_carrier_suppressed_v2_nominal requires predicate_class=nominal_head`);
        }
      }
      if (sb.reason === 'copula_bucket_sink_suppressed') {
        if (s.predicate_class !== 'copula' && s.predicate_class !== 'auxiliary') {
          throw new Error(`Suppressed assertion ${s.id} copula_bucket_sink_suppressed requires predicate_class copula|auxiliary`);
        }
      }
      const hostRefs = collectAssertionMentionRefs(targetAssertion);
      for (const mid of s.transferred_mention_ids) {
        if (!hostRefs.has(mid)) {
          throw new Error(`Suppressed assertion ${s.id} ${sb.reason} violates meaning-neutral invariant: missing transferred mention ${mid} on host ${targetAssertion.id}`);
        }
      }
    }
  }

  const primary = new Set((data.coverage.primary_mention_ids || []));
  const covered = new Set((data.coverage.covered_primary_mention_ids || []));
  const uncovered = new Set((data.coverage.uncovered_primary_mention_ids || []));
  if (!isSortedStrings(data.coverage.primary_mention_ids || [])) throw new Error('coverage.primary_mention_ids must be sorted for determinism');
  if (!isSortedStrings(data.coverage.covered_primary_mention_ids || [])) throw new Error('coverage.covered_primary_mention_ids must be sorted for determinism');
  if (!isSortedStrings(data.coverage.uncovered_primary_mention_ids || [])) throw new Error('coverage.uncovered_primary_mention_ids must be sorted for determinism');
  const actualPrimary = new Set((data.mentions || []).filter((m) => m.is_primary).map((m) => m.id));

  for (const id of primary) if (!actualPrimary.has(id)) throw new Error(`coverage.primary_mention_ids includes non-primary mention ${id}`);
  for (const id of covered) if (!primary.has(id)) throw new Error(`coverage.covered_primary_mention_ids includes non-primary mention ${id}`);
  for (const id of uncovered) if (!primary.has(id)) throw new Error(`coverage.uncovered_primary_mention_ids includes non-primary mention ${id}`);
  for (const id of primary) {
    const c = covered.has(id);
    const u = uncovered.has(id);
    if (c === u) throw new Error(`Primary mention ${id} must appear in exactly one of covered/uncovered`);
  }

  const unresolvedReasonEnum = new Set([
    'missing_relation',
    'projection_failed',
    'predicate_invalid',
    'operator_scope_open',
    'coord_type_missing',
  ]);
  for (const u of data.coverage.unresolved || []) {
    if (!mentionById.has(u.mention_id)) throw new Error(`Unresolved item references missing mention ${u.mention_id}`);
    const m = mentionById.get(u.mention_id);
    if (m.segment_id !== u.segment_id) throw new Error(`Unresolved item segment mismatch for mention ${u.mention_id}`);
    if (!unresolvedReasonEnum.has(u.reason)) throw new Error(`Unresolved item has invalid reason: ${u.reason}`);
    if (Object.prototype.hasOwnProperty.call(u, 'mention_ids')) {
      if (!Array.isArray(u.mention_ids)) throw new Error(`Unresolved item mention_ids must be an array for mention ${u.mention_id}`);
      if (!u.mention_ids.includes(u.mention_id)) throw new Error(`Unresolved item mention_ids must include mention_id for mention ${u.mention_id}`);
      if (!isSortedStrings(u.mention_ids)) throw new Error(`Unresolved item mention_ids must be sorted for mention ${u.mention_id}`);
      for (const mid of u.mention_ids) {
        if (!mentionById.has(mid)) throw new Error(`Unresolved item mention_ids references missing mention ${mid}`);
      }
    }
    for (const tid of u.evidence.token_ids || []) {
      if (!tokenById.has(tid)) throw new Error(`Unresolved item token id missing: ${tid}`);
    }
    if (!isSortedStrings((u.evidence || {}).token_ids || [])) {
      throw new Error(`Unresolved item token_ids must be sorted for mention ${u.mention_id}`);
    }
    if (Object.prototype.hasOwnProperty.call(u.evidence || {}, 'upstream_relation_ids')) {
      if (!Array.isArray(u.evidence.upstream_relation_ids)) {
        throw new Error(`Unresolved item upstream_relation_ids must be an array for mention ${u.mention_id}`);
      }
      if (!isSortedStrings(u.evidence.upstream_relation_ids)) {
        throw new Error(`Unresolved item upstream_relation_ids must be sorted for mention ${u.mention_id}`);
      }
      for (const rid of u.evidence.upstream_relation_ids) {
        if (typeof rid !== 'string' || rid.length === 0) {
          throw new Error(`Unresolved item upstream_relation_ids contains invalid value for mention ${u.mention_id}`);
        }
      }
    }
  }

  const unresolvedMentionIds = (data.coverage.unresolved || []).map((u) => u.mention_id);
  if (new Set(unresolvedMentionIds).size !== unresolvedMentionIds.length) {
    throw new Error('coverage.unresolved must not contain duplicate mention_id entries');
  }
  if (unresolvedMentionIds.length !== uncovered.size) {
    throw new Error('coverage.unresolved length must match coverage.uncovered_primary_mention_ids length');
  }
  for (const mid of unresolvedMentionIds) {
    if (!uncovered.has(mid)) throw new Error(`coverage.unresolved mention_id must be uncovered primary: ${mid}`);
  }

  if (Object.prototype.hasOwnProperty.call(data.diagnostics || {}, 'fragmentation')) {
    const f = data.diagnostics.fragmentation;
    if (!f || typeof f !== 'object') throw new Error('diagnostics.fragmentation must be an object when present');
    if (!Number.isInteger(f.structural_fragment_count) || f.structural_fragment_count < 0) {
      throw new Error('diagnostics.fragmentation.structural_fragment_count must be a non-negative integer');
    }
    if (typeof f.predicate_noise_index !== 'number' || f.predicate_noise_index < 0) {
      throw new Error('diagnostics.fragmentation.predicate_noise_index must be a non-negative number');
    }
    if (!Array.isArray(f.per_segment)) throw new Error('diagnostics.fragmentation.per_segment must be an array');
    let prevSeg = null;
    for (const seg of f.per_segment) {
      if (typeof seg.segment_id !== 'string' || seg.segment_id.length === 0) {
        throw new Error('diagnostics.fragmentation.per_segment[*].segment_id must be a non-empty string');
      }
      if (prevSeg && prevSeg.localeCompare(seg.segment_id) > 0) {
        throw new Error('diagnostics.fragmentation.per_segment must be sorted by segment_id');
      }
      prevSeg = seg.segment_id;
      for (const k of ['predicate_assertion_count', 'lexical_verb_count', 'tolerated_auxiliary_count', 'structural_fragment_count']) {
        if (!Number.isInteger(seg[k]) || seg[k] < 0) {
          throw new Error(`diagnostics.fragmentation.per_segment[*].${k} must be a non-negative integer`);
        }
      }
      if (typeof seg.clause_fragmentation_warning !== 'boolean') {
        throw new Error('diagnostics.fragmentation.per_segment[*].clause_fragmentation_warning must be boolean');
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(data.diagnostics || {}, 'gap_signals')) {
    const g = data.diagnostics.gap_signals;
    if (!g || typeof g !== 'object') throw new Error('diagnostics.gap_signals must be an object when present');
    for (const k of ['coordination_type_missing', 'comparative_gap', 'quantifier_scope_gap']) {
      if (typeof g[k] !== 'boolean') throw new Error(`diagnostics.gap_signals.${k} must be boolean`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(data.diagnostics || {}, 'coordination_groups')) {
    const groups = data.diagnostics.coordination_groups;
    if (!Array.isArray(groups)) throw new Error('diagnostics.coordination_groups must be an array when present');
    let prevId = null;
    for (const g of groups) {
      if (!g || typeof g.id !== 'string' || g.id.length === 0) throw new Error('diagnostics.coordination_groups[*].id must be a non-empty string');
      if (prevId && prevId.localeCompare(g.id) > 0) throw new Error('diagnostics.coordination_groups must be sorted by id');
      prevId = g.id;
      if (!Array.isArray(g.member_assertion_ids)) throw new Error(`diagnostics.coordination_groups[${g.id}].member_assertion_ids must be an array`);
      if (!isSortedStrings(g.member_assertion_ids)) throw new Error(`diagnostics.coordination_groups[${g.id}].member_assertion_ids must be sorted`);
      for (const aid of g.member_assertion_ids) {
        if (!assertionById.has(aid)) throw new Error(`diagnostics.coordination_groups[${g.id}] references unknown assertion id ${aid}`);
      }
      if (!(g.type === null || typeof g.type === 'string')) {
        throw new Error(`diagnostics.coordination_groups[${g.id}].type must be string or null`);
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(data.diagnostics || {}, 'subject_role_gaps')) {
    const gaps = data.diagnostics.subject_role_gaps;
    if (!Array.isArray(gaps)) throw new Error('diagnostics.subject_role_gaps must be an array when present');
    let prevKey = null;
    for (const g of gaps) {
      if (!g || typeof g !== 'object') throw new Error('diagnostics.subject_role_gaps[*] must be an object');
      if (typeof g.segment_id !== 'string' || g.segment_id.length === 0) {
        throw new Error('diagnostics.subject_role_gaps[*].segment_id must be a non-empty string');
      }
      if (typeof g.assertion_id !== 'string' || g.assertion_id.length === 0 || !assertionById.has(g.assertion_id)) {
        throw new Error('diagnostics.subject_role_gaps[*].assertion_id must reference an existing assertion');
      }
      if (typeof g.predicate_mention_id !== 'string' || g.predicate_mention_id.length === 0 || !mentionById.has(g.predicate_mention_id)) {
        throw new Error('diagnostics.subject_role_gaps[*].predicate_mention_id must reference an existing mention');
      }
      if (typeof g.predicate_head_token_id !== 'string' || g.predicate_head_token_id.length === 0 || !tokenById.has(g.predicate_head_token_id)) {
        throw new Error('diagnostics.subject_role_gaps[*].predicate_head_token_id must reference an existing token');
      }
      if (g.reason !== 'missing_subject_role') {
        throw new Error('diagnostics.subject_role_gaps[*].reason must be missing_subject_role');
      }
      if (!g.evidence || typeof g.evidence !== 'object') {
        throw new Error('diagnostics.subject_role_gaps[*].evidence must be an object');
      }
      if (!Array.isArray(g.evidence.token_ids) || !isSortedStrings(g.evidence.token_ids)) {
        throw new Error('diagnostics.subject_role_gaps[*].evidence.token_ids must be a sorted array');
      }
      if (!Array.isArray(g.evidence.upstream_relation_ids) || !isSortedStrings(g.evidence.upstream_relation_ids)) {
        throw new Error('diagnostics.subject_role_gaps[*].evidence.upstream_relation_ids must be a sorted array');
      }
      for (const tid of g.evidence.token_ids) {
        if (!tokenById.has(tid)) throw new Error(`diagnostics.subject_role_gaps token id missing: ${tid}`);
      }
      for (const rid of g.evidence.upstream_relation_ids) {
        if (typeof rid !== 'string' || rid.length === 0) {
          throw new Error('diagnostics.subject_role_gaps upstream relation ids must be non-empty strings');
        }
      }
      const a = assertionById.get(g.assertion_id);
      const actorIds = ((a || {}).arguments || [])
        .filter((entry) => String((entry && entry.role) || '') === 'actor')
        .flatMap((entry) => entry.mention_ids || []);
      if (actorIds.length > 0) {
        throw new Error(`diagnostics.subject_role_gaps assertion ${g.assertion_id} must have empty actor`);
      }
      const key = `${g.segment_id}|${g.assertion_id}|${g.predicate_mention_id}`;
      if (prevKey && prevKey.localeCompare(key) > 0) {
        throw new Error('diagnostics.subject_role_gaps must be sorted by segment_id/assertion_id/predicate_mention_id');
      }
      prevKey = key;
    }
  }
}

(function main() {
  try {
    const args = process.argv.slice(2);
    const seedId = arg(args, '--seed-id');
    const artifactsRoot = arg(args, '--artifacts-root') || path.resolve(__dirname, '..', 'artifacts');

    if (!seedId) {
      usage();
      process.exit(2);
    }

    const schemaPath = path.join(__dirname, 'seed.elementary-assertions.schema.json');
    const seedPath = path.join(artifactsRoot, seedId, 'seed', 'seed.elementary-assertions.yaml');
    const globalSchemaPath = path.join(artifactsRoot, 'seed.schema.json');

    const schema = readJson(schemaPath, 'seed.elementary-assertions.schema.json');
    const seed = readYaml(seedPath, 'seed.elementary-assertions.yaml');
    const globalSchema = readJson(globalSchemaPath, 'seed.schema.json');
    schemaValidate(schema, seed);

    if (!globalSchema.schema_version) throw new Error('seed.schema.json missing schema_version');
    if (seed.schema_version !== globalSchema.schema_version) {
      throw new Error(`schema_version mismatch: seed=${seed.schema_version} schema=${globalSchema.schema_version}`);
    }
    if (seed.stage !== 'elementary_assertions') {
      throw new Error(`stage mismatch: expected elementary_assertions, got ${seed.stage}`);
    }

    checkIntegrity(seed);
    console.log(`Elementary assertions validation OK (${seed.assertions.length} assertions, ${seed.mentions.length} mentions)`);
  } catch (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exit(1);
  }
})();

