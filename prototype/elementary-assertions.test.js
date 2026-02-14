const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const YAML = require('yaml');
const Ajv2020 = require('ajv/dist/2020');
const {
  analyzeUpstreamWikiEvidence,
  buildRunOptions,
  assertMandatoryWtiUpstreamEvidence,
  buildUnresolved,
  chooseBestMentionForToken,
  choosePredicateUpgradeCandidate,
  mergeModalityCopulaAssertions,
  buildAssertions,
  buildCoverageAudit,
  buildSubjectRoleGaps,
  roleToSlot,
} = require('./elementary-assertions.js');

const stepDir = __dirname;
const repoRoot = path.resolve(__dirname, '..');

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function mkTempArtifacts(seedId) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'step12-'));
  const artifactsRoot = path.join(tmp, 'artifacts');
  const srcArtifacts = path.join(repoRoot, 'artifacts');
  const srcSeedDir = path.join(srcArtifacts, seedId, 'seed');
  const dstSeedDir = path.join(artifactsRoot, seedId, 'seed');

  copyFile(path.join(srcArtifacts, 'seed.schema.json'), path.join(artifactsRoot, 'seed.schema.json'));
  copyFile(path.join(srcSeedDir, 'seed.txt'), path.join(dstSeedDir, 'seed.txt'));
  return { artifactsRoot, seedId, outPath: path.join(dstSeedDir, 'seed.elementary-assertions.yaml') };
}

function runExtractor(artifactsRoot, seedId, extraArgs = [], extraEnv = null) {
  const env = { ...process.env, WIKIPEDIA_TITLE_INDEX_ENDPOINT: 'http://127.0.0.1:32123', ...(extraEnv || {}) };
  const args = [path.join(stepDir, 'elementary-assertions.js'), '--seed-id', seedId, '--artifacts-root', artifactsRoot].concat(extraArgs);
  if (!args.includes('--timeout-ms')) {
    args.push('--timeout-ms', '15000');
  }
  return spawnSync(
    process.execPath,
    args,
    { encoding: 'utf8', env }
  );
}

function runChecker(artifactsRoot, seedId) {
  return spawnSync(
    process.execPath,
    [path.join(stepDir, 'check-elementary-assertions.js'), '--seed-id', seedId, '--artifacts-root', artifactsRoot],
    { encoding: 'utf8' }
  );
}

function validateStep12Schema(seedDoc) {
  const schemaPath = path.join(stepDir, 'seed.elementary-assertions.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const ok = validate(seedDoc);
  return { ok, errors: validate.errors || [] };
}

function normalizeApos(s) {
  return String(s || '').replace(/\u2019/g, "'");
}

function assertionSlots(assertion) {
  const slots = { actor: [], theme: [], attr: [], topic: [], location: [], other: [] };
  for (const entry of assertion && Array.isArray(assertion.arguments) ? assertion.arguments : []) {
    const role = String((entry && entry.role) || '');
    const mentionIds = Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : [];
    if (role === 'actor' || role === 'subject' || role === 'nsubj' || role === 'nsubjpass' || role === 'agent') {
      slots.actor = slots.actor.concat(mentionIds);
    } else if (role === 'theme') {
      slots.theme = slots.theme.concat(mentionIds);
    } else if (role === 'attribute') {
      slots.attr = slots.attr.concat(mentionIds);
    } else if (role === 'topic') {
      slots.topic = slots.topic.concat(mentionIds);
    } else if (role === 'location') {
      slots.location = slots.location.concat(mentionIds);
    } else {
      slots.other.push({ role, mention_ids: mentionIds.slice() });
    }
  }
  for (const entry of assertion && Array.isArray(assertion.modifiers) ? assertion.modifiers : []) {
    const role = String((entry && entry.role) || '');
    const mentionIds = Array.isArray(entry && entry.mention_ids) ? entry.mention_ids : [];
    if (!role || mentionIds.length === 0) continue;
    slots.other.push({ role, mention_ids: mentionIds.slice() });
  }
  const uniq = (arr) => Array.from(new Set((arr || []).filter((x) => typeof x === 'string'))).sort((a, b) => a.localeCompare(b));
  slots.actor = uniq(slots.actor);
  slots.theme = uniq(slots.theme);
  slots.attr = uniq(slots.attr);
  slots.topic = uniq(slots.topic);
  slots.location = uniq(slots.location);
  slots.other = slots.other
    .map((o) => ({ role: String((o && o.role) || ''), mention_ids: uniq((o && o.mention_ids) || []) }))
    .filter((o) => o.role && o.mention_ids.length > 0)
    .sort((a, b) => (a.role !== b.role ? a.role.localeCompare(b.role) : JSON.stringify(a.mention_ids).localeCompare(JSON.stringify(b.mention_ids))));
  return slots;
}

function readOutput(outPath) {
  const data = YAML.parse(fs.readFileSync(outPath, 'utf8'));
  if (Array.isArray(data && data.assertions)) {
    for (const a of data.assertions) {
      assert.ok(!(a && Object.prototype.hasOwnProperty.call(a, 'slots')), 'persisted assertions must not contain legacy slots');
    }
  }
  if (Array.isArray(((data || {}).diagnostics || {}).suppressed_assertions)) {
    for (const s of data.diagnostics.suppressed_assertions) {
      assert.ok(!Object.prototype.hasOwnProperty.call(s || {}, 'transferred_slots'), 'suppressed traces must not contain legacy transferred_slots');
      const reason = ((((s || {}).diagnostics || {}).suppressed_by || {}).reason || '');
      assert.notStrictEqual(reason, 'copula_slot_sink_suppressed', 'suppressed traces must not use legacy copula reason');
    }
  }
  return data;
}

(async function runTests() {

// Test 1: golden stability + checker pass.
{
  const { artifactsRoot, seedId, outPath } = mkTempArtifacts('webshop');
  const first = runExtractor(artifactsRoot, seedId);
  assert.strictEqual(first.status, 0, `first extractor run failed: ${first.stderr || first.stdout}`);
  const one = fs.readFileSync(outPath, 'utf8');

  const second = runExtractor(artifactsRoot, seedId);
  assert.strictEqual(second.status, 0, `second extractor run failed: ${second.stderr || second.stdout}`);
  const two = fs.readFileSync(outPath, 'utf8');
  assert.strictEqual(two, one, 'Output YAML must be byte-identical across repeated runs');

  const check = runChecker(artifactsRoot, seedId);
  assert.strictEqual(check.status, 0, `checker failed: ${check.stderr || check.stdout}`);
}

// Test 1b: schema/checker reject injected legacy keys in generated artifact.
{
  const { artifactsRoot, seedId, outPath } = mkTempArtifacts('webshop');
  const run = runExtractor(artifactsRoot, seedId);
  assert.strictEqual(run.status, 0, `extractor failed: ${run.stderr || run.stdout}`);

  const injected = YAML.parse(fs.readFileSync(outPath, 'utf8'));
  assert.ok(Array.isArray(injected.assertions) && injected.assertions.length > 0, 'injected fixture requires at least one assertion');
  assert.ok(
    Array.isArray((((injected || {}).diagnostics || {}).suppressed_assertions)) && injected.diagnostics.suppressed_assertions.length > 0,
    'injected fixture requires at least one suppressed assertion'
  );

  injected.assertions[0].slots = { actor: [], theme: [], attr: [], topic: [], location: [], other: [] };
  injected.diagnostics.suppressed_assertions[0].transferred_slots = ['theme'];
  if (((injected.diagnostics.suppressed_assertions[0] || {}).diagnostics || {}).suppressed_by) {
    injected.diagnostics.suppressed_assertions[0].diagnostics.suppressed_by.reason = 'copula_slot_sink_suppressed';
  }
  if (Object.prototype.hasOwnProperty.call(injected.diagnostics.suppressed_assertions[0], 'reason')) {
    injected.diagnostics.suppressed_assertions[0].reason = 'copula_slot_sink_suppressed';
  }

  fs.writeFileSync(outPath, YAML.stringify(injected, { lineWidth: 0 }), 'utf8');

  const schemaCheck = validateStep12Schema(injected);
  assert.strictEqual(schemaCheck.ok, false, 'schema validation should reject injected legacy keys');

  const check = runChecker(artifactsRoot, seedId);
  assert.notStrictEqual(check.status, 0, 'checker should reject injected legacy keys');
  const stderr = String(check.stderr || '') + String(check.stdout || '');
  assert.ok(stderr.includes('Schema validation failed'), 'checker failure should originate from schema validation');
}

// Test 2: invariants on produced structure.
{
  const { artifactsRoot, seedId, outPath } = mkTempArtifacts('webshop');
  const run = runExtractor(artifactsRoot, seedId);
  assert.strictEqual(run.status, 0, `extractor failed: ${run.stderr || run.stdout}`);
  const data = readOutput(outPath);

  assert.strictEqual(data.stage, 'elementary_assertions');
  assert.ok(Array.isArray(data.mentions) && data.mentions.length > 0, 'mentions must be non-empty');
  assert.ok(Array.isArray(data.assertions) && data.assertions.length > 0, 'assertions must be non-empty');
  assert.ok(data.coverage && Array.isArray(data.coverage.primary_mention_ids), 'coverage.primary_mention_ids must exist');
  assert.ok(data.sources && Array.isArray(data.sources.inputs) && data.sources.inputs.length > 0, 'sources.inputs must exist');
  assert.ok(data.wiki_title_evidence && typeof data.wiki_title_evidence === 'object', 'wiki_title_evidence must exist');
  assert.ok(data.sources && data.sources.pipeline && typeof data.sources.pipeline === 'object', 'sources.pipeline must exist');
  assert.ok(data.relation_projection && typeof data.relation_projection === 'object', 'relation_projection must exist');
  assert.ok(Array.isArray(data.accepted_annotations), 'accepted_annotations must exist');
  assert.ok(data.diagnostics && typeof data.diagnostics === 'object', 'diagnostics must exist');
  assert.ok(
    data.assertions.every((a) => a && a.diagnostics && (a.diagnostics.predicate_quality === 'ok' || a.diagnostics.predicate_quality === 'low')),
    'all assertions should carry diagnostics.predicate_quality'
  );
  assert.ok(
    data.assertions.every((a) => a && a.diagnostics && ['lexical_verb', 'copula', 'auxiliary', 'preposition', 'nominal_head'].includes(a.diagnostics.predicate_class)),
    'all assertions should carry diagnostics.predicate_class'
  );
  assert.ok(data.assertions.some((a) => a.diagnostics.predicate_quality === 'ok'), 'at least one assertion should be predicate_quality=ok');
  assert.ok(data.assertions.some((a) => a.diagnostics.predicate_quality === 'low'), 'at least one assertion should be predicate_quality=low');
  assert.ok(
    data.assertions.some((a) => a.diagnostics.structural_fragment === true),
    'at least one assertion should be flagged diagnostics.structural_fragment=true'
  );
  const carrierFragments = (data.assertions || []).filter((a) => {
    const d = (a || {}).diagnostics || {};
    return d.structural_fragment === true && ['preposition', 'nominal_head', 'auxiliary'].includes(d.predicate_class);
  });
  assert.ok(carrierFragments.length > 0, 'expected at least one carrier structural fragment for diagnostics coverage');
  for (const a of carrierFragments) {
    const se = (((a || {}).diagnostics) || {}).suppression_eligibility;
    assert.ok(se && typeof se === 'object', `carrier fragment ${a.id} should expose diagnostics.suppression_eligibility`);
    assert.strictEqual(typeof se.eligible, 'boolean', 'suppression_eligibility.eligible must be boolean');
    assert.ok(
      se.failure_reason === null || ['no_host', 'no_containment', 'has_core_slots'].includes(se.failure_reason),
      'suppression_eligibility.failure_reason must be null or an expected enum value'
    );
    assert.ok(['preposition', 'nominal_head', 'auxiliary'].includes(se.candidate_class), 'suppression_eligibility.candidate_class must be bounded');
    assert.strictEqual(se.segment_id, a.segment_id, 'suppression_eligibility.segment_id must match assertion segment');
    assert.strictEqual(se.assertion_id, a.id, 'suppression_eligibility.assertion_id must match assertion id');
    for (const key of ['source_non_operator_token_ids', 'chosen_host_token_ids', 'missing_in_host_token_ids']) {
      assert.ok(Array.isArray(se[key]), `suppression_eligibility.${key} must be an array`);
      const sorted = se[key].slice().sort((x, y) => x.localeCompare(y));
      assert.deepStrictEqual(se[key], sorted, `suppression_eligibility.${key} must be sorted deterministically`);
    }
  }
  assert.ok(
    (data.coverage.unresolved || []).every((u) =>
      ['missing_relation', 'projection_failed', 'predicate_invalid', 'operator_scope_open', 'coord_type_missing'].includes(u.reason)
    ),
    'all unresolved items should use the expanded stable reason enum'
  );
  assert.ok(
    (data.coverage.unresolved || []).every((u) => Array.isArray(((u || {}).evidence || {}).upstream_relation_ids)),
    'all unresolved items should include evidence.upstream_relation_ids array'
  );
  assert.ok(Array.isArray(((data.diagnostics || {}).subject_role_gaps)), 'diagnostics.subject_role_gaps should exist as an array');
  const sortedSubjectGaps = (((data.diagnostics || {}).subject_role_gaps) || [])
    .map((g) => `${g.segment_id}|${g.assertion_id}|${g.predicate_mention_id}`)
    .slice()
    .sort((a, b) => a.localeCompare(b));
  assert.deepStrictEqual(
    (((data.diagnostics || {}).subject_role_gaps) || []).map((g) => `${g.segment_id}|${g.assertion_id}|${g.predicate_mention_id}`),
    sortedSubjectGaps,
    'subject_role_gaps should be sorted deterministically'
  );
  assert.ok(Array.isArray((data.diagnostics || {}).suppressed_assertions), 'diagnostics.suppressed_assertions should exist');
  assert.ok(data.diagnostics && data.diagnostics.fragmentation && typeof data.diagnostics.fragmentation === 'object', 'diagnostics.fragmentation should exist');
  assert.ok(Array.isArray(data.diagnostics.fragmentation.per_segment), 'diagnostics.fragmentation.per_segment should be an array');
  assert.ok(typeof data.diagnostics.fragmentation.predicate_noise_index === 'number', 'diagnostics.fragmentation.predicate_noise_index should be numeric');
  assert.ok(data.diagnostics && data.diagnostics.gap_signals && typeof data.diagnostics.gap_signals === 'object', 'diagnostics.gap_signals should exist');
  for (const k of ['coordination_type_missing', 'comparative_gap', 'quantifier_scope_gap']) {
    assert.strictEqual(typeof data.diagnostics.gap_signals[k], 'boolean', `diagnostics.gap_signals.${k} should be boolean`);
  }
  assert.ok(Array.isArray(data.diagnostics.coordination_groups || []), 'diagnostics.coordination_groups should be an array');
  const assertionIds = new Set((data.assertions || []).map((a) => a.id));
  for (const s of (data.diagnostics.suppressed_assertions || [])) {
    const sb = ((s || {}).diagnostics || {}).suppressed_by || {};
    assert.strictEqual(sb.kind, 'predicate_redirect', 'suppressed trace kind must be predicate_redirect');
    assert.ok(
      [
        'predicate_upgraded_to_lexical',
        'modality_moved_to_lexical',
        'role_carrier_suppressed',
        'role_carrier_suppressed_v2_nominal',
        'copula_bucket_sink_suppressed',
      ].includes(sb.reason),
      'suppressed trace reason must be a known deterministic suppression reason'
    );
    assert.ok(assertionIds.has(sb.target_assertion_id), 'suppressed target_assertion_id must reference emitted assertion');
    assert.ok(!assertionIds.has(s.id), 'suppressed assertion id must not be emitted as normal assertion');
    if (sb.reason === 'role_carrier_suppressed') {
      assert.strictEqual(s.reason, 'role_carrier_suppressed', 'role-carrier suppression trace should include top-level reason');
      assert.strictEqual(s.suppressed_assertion_id, s.id, 'suppressed_assertion_id should mirror trace id');
      assert.strictEqual(s.host_assertion_id, sb.target_assertion_id, 'host_assertion_id should mirror target assertion');
      assert.ok(['preposition', 'nominal_head', 'auxiliary'].includes(s.predicate_class), 'role-carrier suppression must target preposition/nominal_head/auxiliary');
      assert.ok(Array.isArray(s.transferred_buckets), 'role-carrier suppression trace should expose transferred_buckets array');
      assert.ok(Array.isArray(((s || {}).evidence || {}).token_ids), 'role-carrier suppression trace should expose evidence.token_ids array');
    }
    if (sb.reason === 'role_carrier_suppressed_v2_nominal' || sb.reason === 'copula_bucket_sink_suppressed') {
      assert.ok(Array.isArray(s.transferred_buckets), 'v2 suppression traces should expose transferred_buckets array');
      assert.ok(Array.isArray(s.transferred_mention_ids), 'v2 suppression traces should expose transferred_mention_ids array');
    }
  }

  const mentionIds = new Set(data.mentions.map((m) => m.id));
  const primarySet = new Set(data.coverage.primary_mention_ids);
  const covered = new Set(data.coverage.covered_primary_mention_ids);
  const uncovered = new Set(data.coverage.uncovered_primary_mention_ids);
  for (const id of primarySet) assert.ok(mentionIds.has(id), `primary mention id not found: ${id}`);
  for (const id of covered) assert.ok(primarySet.has(id), `covered mention is not primary: ${id}`);
  for (const id of uncovered) assert.ok(primarySet.has(id), `uncovered mention is not primary: ${id}`);
  assert.strictEqual(
    (data.coverage.unresolved || []).length,
    data.coverage.uncovered_primary_mention_ids.length,
    'coverage.unresolved length should match uncovered primary mention count'
  );

  const customerPaymentMention = data.mentions.find((m) => normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase() === "customer's payment");
  assert.ok(customerPaymentMention, 'Expected mention span customer\'s payment in webshop');

  assert.ok(data.tokens.some((t) => t.pos && typeof t.pos.coarse === 'string'), 'at least one token should preserve pos.coarse');
  assert.ok(Array.isArray(data.relation_projection.all_relations), 'relation_projection.all_relations must be an array');
  assert.ok(Array.isArray(data.relation_projection.projected_relations), 'relation_projection.projected_relations must be an array');
  assert.ok(Array.isArray(data.relation_projection.dropped_relations), 'relation_projection.dropped_relations must be an array');
  assert.ok(data.accepted_annotations.length > 0, 'accepted_annotations should include accepted upstream annotations');
  assert.ok(typeof data.sources.pipeline.relations_extracted_digest === 'string' && data.sources.pipeline.relations_extracted_digest.length > 0, 'sources.pipeline.relations_extracted_digest must exist');
  assert.ok(
    data.sources.inputs.some((x) => x && x.artifact === 'relations_extracted.in_memory'),
    'sources.inputs should include relations_extracted.in_memory digest'
  );
  assert.strictEqual(
    data.diagnostics.projected_relation_count,
    data.relation_projection.projected_relations.length,
    'diagnostics projected_relation_count should match projection list length'
  );
  assert.strictEqual(
    data.diagnostics.dropped_relation_count,
    data.relation_projection.dropped_relations.length,
    'diagnostics dropped_relation_count should match dropped list length'
  );
  const chunkMentions = data.mentions.filter((m) => m.kind === 'chunk');
  assert.ok(chunkMentions.length > 0, 'accepted chunk spans should be materialized as chunk mentions');
  assert.ok(chunkMentions.every((m) => m.is_primary === false), 'chunk mentions should remain non-primary');
}

// Test 2b: webshop nominal/preposition carrier fragments are not emitted as standalone assertions.
{
  const { artifactsRoot, seedId, outPath } = mkTempArtifacts('webshop');
  const run = runExtractor(artifactsRoot, seedId);
  assert.strictEqual(run.status, 0, `extractor failed: ${run.stderr || run.stdout}`);
  const data = readOutput(outPath);
  const mentionById = new Map((data.mentions || []).map((m) => [m.id, m]));
  const byPredicateText = new Map();
  for (const a of data.assertions || []) {
    const m = mentionById.get((((a || {}).predicate) || {}).mention_id);
    if (!m) continue;
    const txt = normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase();
    byPredicateText.set(txt, a);
  }
  assert.ok(!byPredicateText.has('online store'), 'webshop should not emit standalone nominal modifier-carrier predicate "online store"');
  assert.ok(!byPredicateText.has('into'), 'webshop should not emit standalone preposition predicate "into" without lexical upgrade');
  assert.ok(!byPredicateText.has('items'), 'webshop should not emit standalone nominal modifier-carrier predicate "items"');
  assert.ok(!byPredicateText.has('make'), 'webshop should not emit standalone scaffold predicate "make" in make-sure chain');
}

// Test 3: webshop coverage regression (deterministic semantic projection baseline).
{
  const { artifactsRoot, seedId, outPath } = mkTempArtifacts('webshop');
  const run = runExtractor(artifactsRoot, seedId);
  assert.strictEqual(run.status, 0, `extractor failed: ${run.stderr || run.stdout}`);
  const data = readOutput(outPath);

  assert.strictEqual(data.coverage.primary_mention_ids.length, 28, 'webshop content-primary mention count regression');
  assert.strictEqual(data.coverage.covered_primary_mention_ids.length, 21, 'webshop covered content-primary mention count regression');
  assert.strictEqual(data.coverage.uncovered_primary_mention_ids.length, 7, 'webshop uncovered content-primary mention count regression');

  const mentionById = new Map(data.mentions.map((m) => [m.id, m]));
  const uncoveredTexts = data.coverage.uncovered_primary_mention_ids
    .map((id) => {
      const m = mentionById.get(id);
      return m ? data.canonical_text.slice(m.span.start, m.span.end) : '';
    })
    .filter(Boolean);
  assert.ok(!uncoveredTexts.includes('A'), 'webshop uncovered set should exclude function-token mention "A"');
  assert.ok(!uncoveredTexts.includes('they'), 'webshop uncovered set should exclude pronoun "they" with 1.1.3 upstream');
  assert.ok(!uncoveredTexts.includes('them'), 'webshop uncovered set should exclude pronoun "them" with 1.1.3 upstream');
  assert.ok(!uncoveredTexts.includes('want to buy'), 'webshop uncovered set should exclude "want to buy" after deterministic projection');
  assert.ok(!uncoveredTexts.includes('available'), 'webshop uncovered set should exclude "available" after deterministic copula-attr projection');
  assert.ok(!uncoveredTexts.includes('complete'), 'webshop uncovered set should exclude "complete" after eventive extraction');

  const predicateTexts = data.assertions.map((a) => {
    const m = mentionById.get(a.predicate.mention_id);
    return m ? normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase() : '';
  });
  assert.ok(!predicateTexts.includes('doing'), 'scaffolding predicate "doing" should not be emitted');
  const copulaIsAssertion = data.assertions.find((a) => {
    const m = mentionById.get(a.predicate.mention_id);
    const t = m ? normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase() : '';
    return t === 'is';
  });
  assert.ok(copulaIsAssertion, 'webshop should contain low copula assertion "is"');
  const copulaAttrText = (assertionSlots(copulaIsAssertion).attr || [])
    .map((id) => mentionById.get(id))
    .filter(Boolean)
    .map((m) => normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase());
  assert.deepStrictEqual(copulaAttrText, ['an online store'], 'copula attribute should be constrained to minimal complement');
  assert.ok(!copulaAttrText.some((t) => t.includes('people')), 'copula attribute should exclude relative-clause tail content');

  const needsAssertion = data.assertions.find((a) => {
    const m = mentionById.get(a.predicate.mention_id);
    const t = m ? normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase() : '';
    return t === 'needs';
  });
  assert.ok(needsAssertion, 'webshop should contain predicate assertion "needs"');
  const opKinds = new Set((needsAssertion.operators || []).map((o) => o.kind));
  assert.ok(opKinds.has('control_inherit_subject'), '"needs" should include control_inherit_subject operator');
  assert.ok(opKinds.has('control_propagation'), '"needs" should include control_propagation operator');

  const completeAssertion = data.assertions.find((a) => {
    const m = mentionById.get(a.predicate.mention_id);
    const t = m ? normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase() : '';
    return t === 'complete';
  });
  assert.ok(completeAssertion, 'webshop should contain predicate assertion "complete"');
  const completeThemeText = assertionSlots(completeAssertion).theme
    .map((id) => mentionById.get(id))
    .filter(Boolean)
    .map((m) => normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase());
  assert.ok(completeThemeText.includes('purchase'), '"complete" theme should include "purchase"');

  const takeAssertion = data.assertions.find((a) => {
    const m = mentionById.get(a.predicate.mention_id);
    const t = m ? normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase() : '';
    return t === 'take';
  });
  assert.ok(takeAssertion, '"take" assertion should be materialized as a coordinated action');
  const takeThemeText = assertionSlots(takeAssertion).theme
    .map((id) => mentionById.get(id))
    .filter(Boolean)
    .map((m) => normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase());
  assert.ok(takeThemeText.includes("customer's payment"), '"take" theme should include "customer\'s payment"');

  const keepAssertion = data.assertions.find((a) => {
    const m = mentionById.get(a.predicate.mention_id);
    const t = m ? normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase() : '';
    return t === 'keep';
  });
  assert.ok(keepAssertion, 'webshop should contain predicate assertion "keep"');
  assert.strictEqual((assertionSlots(keepAssertion).theme || []).length, 1, '"keep" should keep a single theme mention');
  const keepThemeText = assertionSlots(keepAssertion).theme
    .map((id) => mentionById.get(id))
    .filter(Boolean)
    .map((m) => normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase());
  assert.ok(
    keepThemeText.some((t) => t.includes('record of the order')),
    '"keep" theme should preserve record-of-order semantics after larger-span projection preference'
  );

  const hasMeansLikeLink = data.assertions.some((a) =>
    Array.isArray(assertionSlots(a).other) &&
    assertionSlots(a).other.some((o) => o && (o.role === 'means' || o.role === 'method'))
  );
  assert.ok(!hasMeansLikeLink, 'means/method linkage should not be invented without explicit Step 11 evidence');
  assert.ok(
    data.assertions.some((a) => a && a.diagnostics && a.diagnostics.slot_projection_choice),
    'at least one assertion should report slot projection candidate diagnostics when precedence overrides source order'
  );

  // Existing semantic coverage baseline must remain stable despite added retention fields.
  const primaryKinds = data.mentions.filter((m) => m.is_primary).map((m) => m.kind);
  assert.ok(primaryKinds.every((k) => k === 'mwe' || k === 'token'), 'primary partition should still be mwe/token only');
}

// Test 3b: prime_gen diagnostic gaps baseline (coordination/comparative/quantifier visibility).
{
  const { artifactsRoot, seedId, outPath } = mkTempArtifacts('prime_gen');
  const run = runExtractor(artifactsRoot, seedId);
  assert.strictEqual(run.status, 0, `extractor failed: ${run.stderr || run.stdout}`);
  const data = readOutput(outPath);
  assert.ok(data.diagnostics && data.diagnostics.gap_signals, 'prime_gen diagnostics.gap_signals should exist');
  for (const k of ['coordination_type_missing', 'comparative_gap', 'quantifier_scope_gap']) {
    assert.strictEqual(typeof data.diagnostics.gap_signals[k], 'boolean', `prime_gen gap_signals.${k} should be boolean`);
  }
  assert.strictEqual(
    data.diagnostics.gap_signals.comparative_gap,
    false,
    'prime_gen comparative gap should close when Stage 11 emits compare_* relations'
  );
  assert.strictEqual(
    data.diagnostics.gap_signals.quantifier_scope_gap,
    false,
    'prime_gen quantifier scope gap should close when Stage 11 emits quantifier relations'
  );
  assert.ok(
    Number(data.diagnostics.fragmentation.predicate_noise_index) <= 0.375,
    'prime_gen predicate_noise_index should not regress above the pre-redirect baseline of 0.375'
  );
  assert.ok(
    Number(data.diagnostics.fragmentation.structural_fragment_count) <= 5,
    'prime_gen structural_fragment_count should not regress above pre-cycle baseline'
  );
  if (
    Number(data.diagnostics.fragmentation.predicate_noise_index) < 0.375 ||
    Number(data.diagnostics.fragmentation.structural_fragment_count) < 5
  ) {
    assert.ok(
      Array.isArray(data.diagnostics.suppressed_assertions) && data.diagnostics.suppressed_assertions.length > 0,
      'prime_gen should carry suppression traces when fragmentation/noise metrics improve'
    );
  }
  const suppressionReasons = new Set((data.diagnostics.suppressed_assertions || []).map((s) => (((s || {}).diagnostics || {}).suppressed_by || {}).reason));
  if (suppressionReasons.has('role_carrier_suppressed_v2_nominal')) {
    assert.ok(true, 'prime_gen includes nominal v2 suppression trace');
  }
  if (suppressionReasons.has('predicate_upgraded_to_lexical')) {
    const mentionById = new Map(data.mentions.map((m) => [m.id, m]));
    const predicateRows = data.assertions.map((a) => {
      const m = mentionById.get(a.predicate.mention_id);
      const text = m ? normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase() : '';
      return { segment_id: a.segment_id, predicate: text };
    });
    assert.ok(
      !predicateRows.some((r) => r.segment_id === 's2' && r.predicate === 'at'),
      'prime_gen s2 should not emit standalone preposition predicate "at" once lexical redirect evidence is available'
    );
    assert.ok(
      predicateRows.some((r) => r.segment_id === 's2' && r.predicate === 'starts'),
      'prime_gen s2 should retain lexical predicate "starts" after preposition redirect'
    );
  }
  {
    const mentionById = new Map(data.mentions.map((m) => [m.id, m]));
    const s1Produces = data.assertions.find((a) => {
      if (a.segment_id !== 's1') return false;
      const m = mentionById.get(a.predicate.mention_id);
      const t = m ? normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase() : '';
      return t === 'produces';
    });
    assert.ok(s1Produces, 'prime_gen s1 should retain lexical predicate "produces"');
    const s1ThemeTexts = (assertionSlots(s1Produces).theme || [])
      .map((id) => mentionById.get(id))
      .filter(Boolean)
      .map((m) => normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase());
    assert.ok(
      s1ThemeTexts.every((t) => !t.includes('produces')),
      'prime_gen s1 theme should not include predicate surface "produces"'
    );
    assert.ok(
      s1ThemeTexts.every((t) => !t.includes('ascending order')),
      'prime_gen s1 theme should not duplicate location surface "ascending order"'
    );
    const s1LocationTexts = (assertionSlots(s1Produces).location || [])
      .map((id) => mentionById.get(id))
      .filter(Boolean)
      .map((m) => normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase());
    assert.ok(
      s1LocationTexts.some((t) => t.includes('ascending order')),
      'prime_gen s1 should preserve location "ascending order"'
    );
  }
  {
    const mentionById = new Map(data.mentions.map((m) => [m.id, m]));
    const s3Assertions = data.assertions.filter((a) => a.segment_id === 's3');
    const s3Predicates = s3Assertions.map((a) => {
      const m = mentionById.get(a.predicate.mention_id);
      return m ? normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase() : '';
    });
    assert.ok(
      !s3Predicates.includes('greater'),
      'prime_gen s3 should suppress standalone nominal comparative carrier predicate "greater"'
    );
    const ensure = s3Assertions.find((a) => {
      const m = mentionById.get(a.predicate.mention_id);
      const t = m ? normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase() : '';
      return t === 'ensure';
    });
    assert.ok(ensure, 'prime_gen s3 should keep lexical host predicate "ensure"');
    assert.ok(
      (ensure.operators || []).some((op) => op.kind === 'compare_gt'),
      'prime_gen s3 should preserve compare_gt on lexical host after nominal suppression'
    );
  }
  {
    const mentionById = new Map(data.mentions.map((m) => [m.id, m]));
    const s2Assertions = data.assertions.filter((a) => a.segment_id === 's2');
    const s2Predicates = s2Assertions.map((a) => {
      const m = mentionById.get(a.predicate.mention_id);
      return m ? normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase() : '';
    });
    assert.ok(
      !s2Predicates.includes('at'),
      'prime_gen s2 should suppress standalone preposition carrier predicate "at" when lexical host containment exists'
    );
    const testsAssertion = s2Assertions.find((a) => {
      const m = mentionById.get(a.predicate.mention_id);
      const t = m ? normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase() : '';
      return t.includes('tests');
    });
    assert.ok(testsAssertion, 'prime_gen s2 should retain tests predicate assertion');
    const nonOtherIds = new Set(
      []
        .concat(assertionSlots(testsAssertion).theme || [])
        .concat(assertionSlots(testsAssertion).attr || [])
        .concat(assertionSlots(testsAssertion).topic || [])
        .concat(assertionSlots(testsAssertion).location || [])
    );
    const otherIds = new Set(
      (assertionSlots(testsAssertion).other || []).flatMap((o) => o.mention_ids || [])
    );
    for (const id of nonOtherIds) {
      assert.ok(!otherIds.has(id), 'slot dedup should remove mention ids from other when already present in theme/attr/topic/location');
    }
  }
  assert.strictEqual(
    data.coverage.uncovered_primary_mention_ids.length,
    (data.coverage.unresolved || []).length,
    'prime_gen unresolved diagnostics should align 1:1 with uncovered primary mentions'
  );
}

// Test 3c: webshop copula bucket-sink suppression (when deterministic host exists).
{
  const { artifactsRoot, seedId, outPath } = mkTempArtifacts('webshop');
  const run = runExtractor(artifactsRoot, seedId);
  assert.strictEqual(run.status, 0, `extractor failed: ${run.stderr || run.stdout}`);
  const data = readOutput(outPath);
  const reasons = (data.diagnostics.suppressed_assertions || [])
    .map((s) => (((s || {}).diagnostics || {}).suppressed_by || {}).reason);
  if (reasons.includes('copula_bucket_sink_suppressed')) {
    const traces = (data.diagnostics.suppressed_assertions || [])
      .filter((s) => ((((s || {}).diagnostics || {}).suppressed_by || {}).reason) === 'copula_bucket_sink_suppressed');
    assert.ok(traces.length >= 1, 'webshop should include at least one copula bucket-sink suppression trace');
    for (const t of traces) {
      assert.ok(Array.isArray(t.transferred_buckets), 'copula bucket-sink traces must include transferred_buckets');
      assert.ok(Array.isArray(t.transferred_mention_ids), 'copula bucket-sink traces must include transferred_mention_ids');
      assert.ok(Array.isArray(((t || {}).evidence || {}).token_ids), 'copula bucket-sink traces must include evidence.token_ids');
    }
  }
  for (const k of ['coordination_type_missing', 'comparative_gap', 'quantifier_scope_gap']) {
    assert.strictEqual(Boolean(((((data || {}).diagnostics || {}).gap_signals || {})[k])), false, `webshop gap signal ${k} should remain false`);
  }
  assert.strictEqual(
    data.coverage.uncovered_primary_mention_ids.length,
    (data.coverage.unresolved || []).length,
    'webshop unresolved diagnostics should align 1:1 with uncovered primary mentions'
  );
}

// Test 3d: predicate/theme token overlap is disallowed also for nominal/MWE predicate surfaces.
{
  {
    const { artifactsRoot, seedId, outPath } = mkTempArtifacts('webshop');
    const run = runExtractor(artifactsRoot, seedId);
    assert.strictEqual(run.status, 0, `extractor failed: ${run.stderr || run.stdout}`);
    const data = readOutput(outPath);
    const mentionById = new Map(data.mentions.map((m) => [m.id, m]));

    const placing = data.assertions.find((a) => {
      const m = mentionById.get((((a || {}).predicate) || {}).mention_id);
      const t = m ? normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase() : '';
      return t === 'placing an order';
    });
    assert.ok(placing, 'webshop should contain "placing an order" assertion');
    const predMention = mentionById.get(placing.predicate.mention_id);
    const predTokenIds = new Set((predMention && predMention.token_ids) || []);
    const themeIds = assertionSlots(placing).theme || [];
    for (const themeId of themeIds) {
      const tm = mentionById.get(themeId);
      const themeTokenIds = (tm && tm.token_ids) || [];
      assert.ok(
        themeTokenIds.every((tid) => !predTokenIds.has(tid)),
        'webshop placing/assertion theme must not include predicate tokens'
      );
    }
  }

  {
    const { artifactsRoot, seedId, outPath } = mkTempArtifacts('prime_factors');
    const run = runExtractor(artifactsRoot, seedId);
    assert.strictEqual(run.status, 0, `extractor failed: ${run.stderr || run.stdout}`);
    const data = readOutput(outPath);
    const mentionById = new Map(data.mentions.map((m) => [m.id, m]));

    const continuesIteratively = data.assertions.find((a) => {
      const m = mentionById.get((((a || {}).predicate) || {}).mention_id);
      const t = m ? normalizeApos(data.canonical_text.slice(m.span.start, m.span.end)).toLowerCase() : '';
      return t === 'continues iteratively';
    });
    assert.ok(continuesIteratively, 'prime_factors should contain "continues iteratively" assertion');
    const predMention = mentionById.get(continuesIteratively.predicate.mention_id);
    const predTokenIds = new Set((predMention && predMention.token_ids) || []);
    const themeIds = assertionSlots(continuesIteratively).theme || [];
    for (const themeId of themeIds) {
      const tm = mentionById.get(themeId);
      const themeTokenIds = (tm && tm.token_ids) || [];
      assert.ok(
        themeTokenIds.every((tid) => !predTokenIds.has(tid)),
        'prime_factors continues-iteratively theme must not include predicate tokens'
      );
    }
  }
}
// Test 5: wikipedia annotations are evidence-only; assertion content remains independent.
{
  const { artifactsRoot, seedId, outPath } = mkTempArtifacts('webshop');
  const baseRun = runExtractor(artifactsRoot, seedId);
  assert.strictEqual(baseRun.status, 0, `base extractor failed: ${baseRun.stderr || baseRun.stdout}`);
  const base = readOutput(outPath);
  const baseAssertions = JSON.stringify(base.assertions);
  base.wiki_title_evidence = {
    normalization: {
      unicode_form: 'NFKC',
      punctuation_map: { apostrophes: 'x', dashes: 'y' },
      whitespace: 'collapse_spaces_trim',
      casefold: 'toLowerCase',
    },
    mention_matches: [{ mention_id: base.mentions[0].id, normalized_surface: 'x', exact_titles: ['X'], prefix_titles: [] }],
    assertion_predicate_matches: [{ assertion_id: base.assertions[0].id, predicate_mention_id: base.assertions[0].predicate.mention_id, exact_titles: ['X'], prefix_titles: [] }],
  };
  assert.strictEqual(JSON.stringify(base.assertions), baseAssertions, 'wiki_title_evidence payload changes must not alter assertions');
}

// Test 6: missing WTI endpoint is a hard failure with exact message.
{
  const { artifactsRoot, seedId } = mkTempArtifacts('webshop');
  const run = runExtractor(artifactsRoot, seedId, [], { WIKIPEDIA_TITLE_INDEX_ENDPOINT: '' });
  assert.strictEqual(run.status, 1, 'extractor should fail when WTI endpoint is missing');
  assert.ok(
    (run.stderr || run.stdout).includes('WTI endpoint is required for Step 12 (wikipedia-title-index service).'),
    'missing endpoint must emit exact mandatory error message'
  );
}

// Test 7: upstream carrier with no positive signals is a hard failure.
{
  const upstreamNoPositive = {
    tokens: [
      { id: 't1', lexicon: { wikipedia_title_index: { wiki_any_signal: false, wiki_prefix_count: 0, wiki_exact_match: false } } },
      { id: 't2', lexicon: { wikipedia_title_index: { wiki_any_signal: false, wiki_prefix_count: 0, wiki_exact_match: false } } },
    ],
  };
  assert.throws(
    () => assertMandatoryWtiUpstreamEvidence(upstreamNoPositive),
    /WTI evidence missing: linguistic-enricher produced no positive wikipedia_title_index signals\./,
    'upstream without positive signal must fail hard'
  );
}

// Test 8: upstream with a positive signal passes mandatory validation.
{
  const upstreamPositive = {
    tokens: [
      { id: 't1', lexicon: { wikipedia_title_index: { wiki_any_signal: false, wiki_prefix_count: 0, wiki_exact_match: false } } },
      { id: 't2', lexicon: { wikipedia_title_index: { wiki_any_signal: true, wiki_prefix_count: 3, wiki_exact_match: false } } },
    ],
  };
  assert.doesNotThrow(
    () => assertMandatoryWtiUpstreamEvidence(upstreamPositive),
    'upstream with at least one positive signal must pass mandatory validation'
  );
}

// Test 8b: unresolved predicate-rooted low-quality classification uses predicate_invalid.
{
  const mentions = [
    {
      id: 'm:s1:0-2:token',
      segment_id: 's1',
      token_ids: ['t1'],
      span: { start: 0, end: 2 },
    },
  ];
  const mentionById = new Map(mentions.map((m) => [m.id, m]));
  const unresolvedHeadMap = new Map([['m:s1:0-2:token', 'no_dependency_head_in_mention']]);
  const unresolved = buildUnresolved({
    mentions,
    unresolvedHeadMap,
    projectedUnresolved: [],
    mentionById,
    assertions: [
      {
        predicate: { mention_id: 'm:s1:0-2:token' },
        diagnostics: { predicate_quality: 'low' },
      },
    ],
    projected: [],
  });
  assert.strictEqual(unresolved.length, 1, 'should produce one unresolved item for fixture');
  assert.strictEqual(unresolved[0].reason, 'predicate_invalid', 'low-quality predicate-rooted unresolved should classify as predicate_invalid');
  assert.ok(Array.isArray(unresolved[0].evidence.upstream_relation_ids), 'unresolved evidence should include upstream_relation_ids array');
  assert.strictEqual(unresolved[0].evidence.upstream_relation_ids.length, 0, 'head unresolved should not invent relation pointers');
  assert.deepStrictEqual(unresolved[0].mention_ids, ['m:s1:0-2:token'], 'unresolved item should include mention_ids list');
}

// Test 8b2: unresolved classification includes operator_scope_open and coord_type_missing with deterministic precedence.
{
  const mentions = [
    { id: 'm:op', kind: 'token', segment_id: 's1', token_ids: ['t1'], span: { start: 0, end: 1 }, is_primary: true },
    { id: 'm:coord', kind: 'token', segment_id: 's1', token_ids: ['t2'], span: { start: 2, end: 3 }, is_primary: true },
    { id: 'm:peer', kind: 'token', segment_id: 's1', token_ids: ['t3'], span: { start: 4, end: 5 }, is_primary: true },
  ];
  const mentionById = new Map(mentions.map((m) => [m.id, m]));
  const unresolved = buildUnresolved({
    mentions,
    unresolvedHeadMap: new Map([
      ['m:op', 'no_dependency_head_in_mention'],
      ['m:coord', 'no_dependency_head_in_mention'],
    ]),
    projectedUnresolved: [],
    mentionById,
    assertions: [],
    projected: [
      { relation_id: 'r:mod', label: 'modality', head_mention_id: 'm:op', dep_mention_id: 'm:peer', evidence: {} },
      { relation_id: 'r:coord', label: 'coordination', head_mention_id: 'm:coord', dep_mention_id: 'm:peer', evidence: {} },
    ],
  });
  const byMention = new Map(unresolved.map((u) => [u.mention_id, u]));
  assert.strictEqual(byMention.get('m:op').reason, 'operator_scope_open', 'operator-only unresolved should classify as operator_scope_open');
  assert.strictEqual(byMention.get('m:coord').reason, 'coord_type_missing', 'coordination without coord type should classify as coord_type_missing');
}

// Test 8b3: unresolved output is deterministic under projected relation iteration order changes.
{
  const mentions = [
    { id: 'm:s1:aa', kind: 'token', segment_id: 's1', token_ids: ['t1'], span: { start: 0, end: 1 }, is_primary: true },
    { id: 'm:s1:bb', kind: 'token', segment_id: 's1', token_ids: ['t2'], span: { start: 2, end: 3 }, is_primary: true },
  ];
  const mentionById = new Map(mentions.map((m) => [m.id, m]));
  const projectedA = [
    { relation_id: 'r:1', label: 'modality', head_mention_id: 'm:s1:aa', dep_mention_id: 'm:s1:bb', evidence: {} },
    { relation_id: 'r:2', label: 'coordination', head_mention_id: 'm:s1:bb', dep_mention_id: 'm:s1:aa', evidence: {} },
  ];
  const projectedB = projectedA.slice().reverse();
  const argsBase = {
    mentions,
    unresolvedHeadMap: new Map([
      ['m:s1:aa', 'no_dependency_head_in_mention'],
      ['m:s1:bb', 'no_dependency_head_in_mention'],
    ]),
    projectedUnresolved: [],
    mentionById,
    assertions: [],
  };
  const outA = buildUnresolved({ ...argsBase, projected: projectedA });
  const outB = buildUnresolved({ ...argsBase, projected: projectedB });
  assert.deepStrictEqual(outA, outB, 'unresolved output must remain identical when projected relation iteration order changes');
}

// Test 8c: predicate upgrade candidate selection prefers modality_unified over copula_frame/clause-link.
{
  const tokenById = new Map([
    ['t1', { id: 't1', i: 1, segment_id: 's1', pos: { tag: 'MD' } }],
    ['t2', { id: 't2', i: 2, segment_id: 's1', pos: { tag: 'VB' } }],
    ['t3', { id: 't3', i: 3, segment_id: 's1', pos: { tag: 'VBZ' } }],
  ]);
  const rels = [
    {
      relation_id: 'r:copula',
      label: 'attribute',
      dep_token_id: 't3',
      evidence: { pattern: 'copula_frame', verb_token_id: 't3' },
    },
    {
      relation_id: 'r:modal',
      label: 'modality',
      dep_token_id: 't1',
      evidence: { pattern: 'modality_unified', chosen_predicate_token_id: 't2' },
    },
    {
      relation_id: 'r:clause',
      label: 'complement_clause',
      dep_token_id: 't3',
      evidence: {},
    },
  ];
  const pick = choosePredicateUpgradeCandidate('t1', rels, tokenById);
  assert.ok(pick, 'upgrade candidate should be selected');
  assert.strictEqual(pick.token_id, 't2', 'modality_unified lexical target should win deterministic class priority');
  assert.deepStrictEqual(pick.upstream_relation_ids, ['r:modal'], 'upgrade candidate should carry deterministic relation pointer');
}

// Test 8d: modality/copula merge suppresses low predicate only with explicit linkage relation.
{
  const tokenById = new Map([
    ['t1', { id: 't1', i: 1, span: { start: 0 }, segment_id: 's1', surface: 'be', pos: { tag: 'VB' } }],
    ['t2', { id: 't2', i: 2, span: { start: 2 }, segment_id: 's1', surface: 'used', pos: { tag: 'VBN' } }],
    ['t3', { id: 't3', i: 0, span: { start: 0 }, segment_id: 's1', surface: 'may', pos: { tag: 'MD' } }],
  ]);
  const mentionById = new Map([
    ['m:be', { id: 'm:be', segment_id: 's1', head_token_id: 't1', token_ids: ['t1'] }],
    ['m:used', { id: 'm:used', segment_id: 's1', head_token_id: 't2', token_ids: ['t2'] }],
  ]);
  const assertions = [
    {
      id: 'a:be',
      segment_id: 's1',
      predicate: { mention_id: 'm:be', head_token_id: 't1' },
      arguments: [],
      modifiers: [],
      operators: [{ kind: 'modality', value: 'may', evidence: [{ annotation_id: 'r:mod', from_token_id: 't1', to_token_id: 't3', label: 'modality' }] }],
      evidence: { relation_evidence: [{ annotation_id: 'r:mod', from_token_id: 't1', to_token_id: 't3', label: 'modality' }], token_ids: ['t1', 't3'] },
      diagnostics: { predicate_quality: 'low' },
    },
    {
      id: 'a:used',
      segment_id: 's1',
      predicate: { mention_id: 'm:used', head_token_id: 't2' },
      arguments: [{ role: 'theme', mention_ids: ['m:used'] }],
      modifiers: [],
      operators: [],
      evidence: { relation_evidence: [{ annotation_id: 'r:x', from_token_id: 't1', to_token_id: 't2', label: 'xcomp' }], token_ids: ['t2'] },
      diagnostics: { predicate_quality: 'ok' },
    },
  ];
  const projected = [
    { relation_id: 'r:x', label: 'xcomp', head_mention_id: 'm:be', dep_mention_id: 'm:used' },
  ];
  const merged = mergeModalityCopulaAssertions({ assertions, projected, mentionById, tokenById });
  assert.strictEqual(merged.assertions.length, 1, 'linked low+modality predicate should be suppressed');
  assert.strictEqual(merged.assertions[0].id, 'a:used', 'lexical assertion should survive');
  assert.ok(
    (merged.assertions[0].operators || []).some((op) => op.kind === 'modality' && op.value === 'may'),
    'surviving lexical assertion should carry moved modality'
  );
  assert.strictEqual(merged.suppressedTraces.length, 1, 'suppression trace should be emitted');
  const trace = merged.suppressedTraces[0];
  assert.strictEqual(trace.diagnostics.suppressed_by.reason, 'modality_moved_to_lexical', 'suppression reason should indicate modality merge');
  assert.deepStrictEqual(trace.diagnostics.suppressed_by.evidence.upstream_relation_ids, ['r:x'], 'trace should point to exact linkage relation');
}

// Test 8e: no explicit linkage relation -> no modality/copula suppression.
{
  const tokenById = new Map([
    ['t1', { id: 't1', i: 1, span: { start: 0 }, segment_id: 's1', surface: 'be', pos: { tag: 'VB' } }],
    ['t2', { id: 't2', i: 2, span: { start: 2 }, segment_id: 's1', surface: 'used', pos: { tag: 'VBN' } }],
    ['t3', { id: 't3', i: 0, span: { start: 0 }, segment_id: 's1', surface: 'may', pos: { tag: 'MD' } }],
  ]);
  const mentionById = new Map([
    ['m:be', { id: 'm:be', segment_id: 's1', head_token_id: 't1', token_ids: ['t1'] }],
    ['m:used', { id: 'm:used', segment_id: 's1', head_token_id: 't2', token_ids: ['t2'] }],
  ]);
  const assertions = [
    {
      id: 'a:be',
      segment_id: 's1',
      predicate: { mention_id: 'm:be', head_token_id: 't1' },
      arguments: [],
      modifiers: [],
      operators: [{ kind: 'modality', value: 'may', evidence: [{ annotation_id: 'r:mod', from_token_id: 't1', to_token_id: 't3', label: 'modality' }] }],
      evidence: { relation_evidence: [{ annotation_id: 'r:mod', from_token_id: 't1', to_token_id: 't3', label: 'modality' }], token_ids: ['t1', 't3'] },
      diagnostics: { predicate_quality: 'low' },
    },
    {
      id: 'a:used',
      segment_id: 's1',
      predicate: { mention_id: 'm:used', head_token_id: 't2' },
      arguments: [{ role: 'theme', mention_ids: ['m:used'] }],
      modifiers: [],
      operators: [],
      evidence: { relation_evidence: [{ annotation_id: 'r:theme', from_token_id: 't2', to_token_id: 't2', label: 'theme' }], token_ids: ['t2'] },
      diagnostics: { predicate_quality: 'ok' },
    },
  ];
  const projected = [];
  const merged = mergeModalityCopulaAssertions({ assertions, projected, mentionById, tokenById });
  assert.strictEqual(merged.assertions.length, 2, 'without linkage relation, both assertions must remain');
  assert.strictEqual(merged.suppressedTraces.length, 0, 'without linkage relation, no suppression trace should be emitted');
}

// Test 8f: token-inside-MWE projection prefers larger span mention.
{
  const mentionById = new Map([
    ['m:tok', { id: 'm:tok', segment_id: 's1', token_ids: ['t2'], priority: 1 }],
    ['m:mwe', { id: 'm:mwe', segment_id: 's1', token_ids: ['t1', 't2'], priority: 0 }],
  ]);
  const pick = chooseBestMentionForToken({
    tokenId: 't2',
    segmentId: 's1',
    mentionById,
    candidateMentionIds: ['m:tok', 'm:mwe'],
    excludeMentionId: null,
  });
  assert.strictEqual(pick.mention_id, 'm:mwe', 'larger-span MWE mention should win over token mention');
  assert.strictEqual(pick.candidate_count, 2, 'candidate count should include both mentions');
  assert.strictEqual(pick.chosen_was_first, false, 'selection should indicate non-first candidate when precedence overrides source order');
}

// Test 8g: equal span chooses lower priority (primary before alternative).
{
  const mentionById = new Map([
    ['m:alt', { id: 'm:alt', segment_id: 's1', token_ids: ['t2'], priority: 2 }],
    ['m:pri', { id: 'm:pri', segment_id: 's1', token_ids: ['t2'], priority: 0 }],
  ]);
  const pick = chooseBestMentionForToken({
    tokenId: 't2',
    segmentId: 's1',
    mentionById,
    candidateMentionIds: ['m:alt', 'm:pri'],
    excludeMentionId: null,
  });
  assert.strictEqual(pick.mention_id, 'm:pri', 'primary mention (lower priority) should win on equal span');
  assert.strictEqual(pick.chosen_was_first, false, 'priority tie-break should be reflected as non-first choice');
}

// Test 8h: lexicon evidence tie-break on equal span and priority.
{
  const mentionById = new Map([
    ['m:nolex', { id: 'm:nolex', segment_id: 's1', token_ids: ['t3'], priority: 1, provenance: {} }],
    ['m:lex', { id: 'm:lex', segment_id: 's1', token_ids: ['t3'], priority: 1, provenance: { lexicon_evidence: { wiki_any_signal: true } } }],
  ]);
  const pick = chooseBestMentionForToken({
    tokenId: 't3',
    segmentId: 's1',
    mentionById,
    candidateMentionIds: ['m:nolex', 'm:lex'],
    excludeMentionId: null,
  });
  assert.strictEqual(pick.mention_id, 'm:lex', 'lexicon-evidenced mention should win when span and priority tie');
  assert.strictEqual(pick.chosen_was_first, false, 'lexicon tie-break should be reflected as non-first choice');
}

// Test 8i: preposition predicate redirects to lexical host when explicit upstream evidence exists.
{
  const tokenById = new Map([
    ['t:at', { id: 't:at', i: 2, segment_id: 's1', surface: 'at', pos: { tag: 'IN' }, span: { start: 7, end: 9 } }],
    ['t:start', { id: 't:start', i: 1, segment_id: 's1', surface: 'starts', pos: { tag: 'VBZ' }, span: { start: 0, end: 6 } }],
    ['t:obj', { id: 't:obj', i: 3, segment_id: 's1', surface: 'value', pos: { tag: 'NN' }, span: { start: 10, end: 15 } }],
  ]);
  const mentionById = new Map([
    ['m:at', { id: 'm:at', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:at'], head_token_id: 't:at', span: { start: 7, end: 9 }, priority: 0, provenance: {} }],
    ['m:start', { id: 'm:start', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:start'], head_token_id: 't:start', span: { start: 0, end: 6 }, priority: 0, provenance: {} }],
    ['m:obj', { id: 'm:obj', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:obj'], head_token_id: 't:obj', span: { start: 10, end: 15 }, priority: 0, provenance: {} }],
  ]);
  const projected = [
    {
      relation_id: 'r:prep',
      label: 'location',
      head_mention_id: 'm:at',
      dep_mention_id: 'm:obj',
      head_token_id: 't:at',
      dep_token_id: 't:obj',
      evidence: { pattern: 'copula_frame', verb_token_id: 't:start' },
    },
  ];
  const out = buildAssertions({ projected, mentionById, tokenById });
  const emittedPredicates = new Set(out.assertions.map((a) => a.predicate.mention_id));
  assert.ok(emittedPredicates.has('m:start'), 'explicit evidence should redirect preposition predicate to lexical host mention');
  assert.ok(!emittedPredicates.has('m:at'), 'redirected preposition predicate should not remain emitted as standalone assertion');
  assert.ok(
    out.suppressedAssertions.some((s) => (((s || {}).diagnostics || {}).suppressed_by || {}).reason === 'predicate_upgraded_to_lexical'),
    'preposition redirect should emit deterministic predicate_upgraded_to_lexical suppression trace'
  );
}

// Test 8j: preposition predicate is dropped when no explicit lexical-link evidence exists.
{
  const tokenById = new Map([
    ['t:at', { id: 't:at', i: 2, segment_id: 's1', surface: 'at', pos: { tag: 'IN' }, span: { start: 7, end: 9 } }],
    ['t:start', { id: 't:start', i: 1, segment_id: 's1', surface: 'starts', pos: { tag: 'VBZ' }, span: { start: 0, end: 6 } }],
    ['t:obj', { id: 't:obj', i: 3, segment_id: 's1', surface: 'value', pos: { tag: 'NN' }, span: { start: 10, end: 15 } }],
  ]);
  const mentionById = new Map([
    ['m:at', { id: 'm:at', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:at'], head_token_id: 't:at', span: { start: 7, end: 9 }, priority: 0, provenance: {} }],
    ['m:start', { id: 'm:start', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:start'], head_token_id: 't:start', span: { start: 0, end: 6 }, priority: 0, provenance: {} }],
    ['m:obj', { id: 'm:obj', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:obj'], head_token_id: 't:obj', span: { start: 10, end: 15 }, priority: 0, provenance: {} }],
  ]);
  const projected = [
    {
      relation_id: 'r:prep',
      label: 'location',
      head_mention_id: 'm:at',
      dep_mention_id: 'm:obj',
      head_token_id: 't:at',
      dep_token_id: 't:obj',
      evidence: {},
    },
  ];
  const out = buildAssertions({ projected, mentionById, tokenById });
  const emittedPredicates = new Set(out.assertions.map((a) => a.predicate.mention_id));
  assert.ok(emittedPredicates.has('m:start'), 'fixture should still emit lexical predicate assertion via normal synthesis/projection flow');
  assert.ok(!emittedPredicates.has('m:at'), 'preposition predicate should be dropped when no lexical upgrade exists');
  assert.ok(
    !out.suppressedAssertions.some((s) => (((s || {}).diagnostics || {}).suppressed_by || {}).reason === 'predicate_upgraded_to_lexical'),
    'without explicit evidence linkage, no predicate_upgraded_to_lexical trace should be emitted'
  );
  assert.ok(
    out.suppressedAssertions
      .filter((s) => s.predicate && s.predicate.mention_id === 'm:at')
      .every((s) => (((s || {}).diagnostics || {}).suppressed_by || {}).reason !== 'predicate_upgraded_to_lexical'),
    'preposition mention may be suppressed for other deterministic reasons, but not via lexical predicate upgrade without explicit evidence'
  );
}

// Test 8j2: nominal predicate is dropped when no explicit lexical-link evidence exists.
{
  const tokenById = new Map([
    ['t:gen', { id: 't:gen', i: 0, segment_id: 's1', surface: 'generator', pos: { tag: 'NN' }, span: { start: 0, end: 9 } }],
    ['t:obj', { id: 't:obj', i: 1, segment_id: 's1', surface: 'numbers', pos: { tag: 'NNS' }, span: { start: 10, end: 17 } }],
  ]);
  const mentionById = new Map([
    ['m:gen', { id: 'm:gen', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:gen'], head_token_id: 't:gen', span: { start: 0, end: 9 }, priority: 0, provenance: {} }],
    ['m:obj', { id: 'm:obj', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:obj'], head_token_id: 't:obj', span: { start: 10, end: 17 }, priority: 0, provenance: {} }],
  ]);
  const projected = [
    {
      relation_id: 'r:theme',
      label: 'theme',
      head_mention_id: 'm:gen',
      dep_mention_id: 'm:obj',
      head_token_id: 't:gen',
      dep_token_id: 't:obj',
      evidence: {},
    },
  ];
  const out = buildAssertions({ projected, mentionById, tokenById });
  const emittedPredicates = new Set(out.assertions.map((a) => a.predicate.mention_id));
  assert.ok(!emittedPredicates.has('m:gen'), 'nominal predicate should be dropped when no lexical upgrade exists');
}

// Test 8j3: nominal predicate redirects to lexical host when explicit upstream evidence exists.
{
  const tokenById = new Map([
    ['t:gen', { id: 't:gen', i: 1, segment_id: 's1', surface: 'generator', pos: { tag: 'NN' }, span: { start: 7, end: 16 } }],
    ['t:start', { id: 't:start', i: 0, segment_id: 's1', surface: 'starts', pos: { tag: 'VBZ' }, span: { start: 0, end: 6 } }],
    ['t:obj', { id: 't:obj', i: 2, segment_id: 's1', surface: 'tests', pos: { tag: 'NNS' }, span: { start: 17, end: 22 } }],
  ]);
  const mentionById = new Map([
    ['m:gen', { id: 'm:gen', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:gen'], head_token_id: 't:gen', span: { start: 7, end: 16 }, priority: 0, provenance: {} }],
    ['m:start', { id: 'm:start', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:start'], head_token_id: 't:start', span: { start: 0, end: 6 }, priority: 0, provenance: {} }],
    ['m:obj', { id: 'm:obj', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:obj'], head_token_id: 't:obj', span: { start: 17, end: 22 }, priority: 0, provenance: {} }],
  ]);
  const projected = [
    {
      relation_id: 'r:theme',
      label: 'theme',
      head_mention_id: 'm:gen',
      dep_mention_id: 'm:obj',
      head_token_id: 't:gen',
      dep_token_id: 't:obj',
      evidence: { pattern: 'copula_frame', verb_token_id: 't:start' },
    },
  ];
  const out = buildAssertions({ projected, mentionById, tokenById });
  const emittedPredicates = new Set(out.assertions.map((a) => a.predicate.mention_id));
  assert.ok(emittedPredicates.has('m:start'), 'explicit evidence should redirect nominal predicate to lexical host mention');
  assert.ok(!emittedPredicates.has('m:gen'), 'redirected nominal predicate should not remain emitted as standalone assertion');
  assert.ok(
    out.suppressedAssertions.some((s) => (((s || {}).diagnostics || {}).suppressed_by || {}).reason === 'predicate_upgraded_to_lexical'),
    'nominal redirect should emit deterministic predicate_upgraded_to_lexical suppression trace'
  );
}

// Test 8j4: synthetic fallback must not emit standalone `make` for make-sure scaffold chains.
{
  const tokenById = new Map([
    ['t:needs', { id: 't:needs', i: 0, segment_id: 's1', surface: 'needs', pos: { tag: 'VBZ' }, span: { start: 0, end: 5 } }],
    ['t:make', { id: 't:make', i: 1, segment_id: 's1', surface: 'make', pos: { tag: 'VB' }, span: { start: 6, end: 10 } }],
    ['t:sure', { id: 't:sure', i: 2, segment_id: 's1', surface: 'sure', pos: { tag: 'JJ' }, span: { start: 11, end: 15 } }],
    ['t:items', { id: 't:items', i: 3, segment_id: 's1', surface: 'items', pos: { tag: 'NNS' }, span: { start: 16, end: 21 } }],
    ['t:are', { id: 't:are', i: 4, segment_id: 's1', surface: 'are', pos: { tag: 'VBP' }, span: { start: 22, end: 25 } }],
    ['t:available', { id: 't:available', i: 5, segment_id: 's1', surface: 'available', pos: { tag: 'JJ' }, span: { start: 26, end: 35 } }],
  ]);
  const mentionById = new Map([
    ['m:needs', { id: 'm:needs', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:needs'], head_token_id: 't:needs', span: { start: 0, end: 5 }, priority: 0, provenance: {} }],
    ['m:make', { id: 'm:make', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:make'], head_token_id: 't:make', span: { start: 6, end: 10 }, priority: 0, provenance: {} }],
    ['m:sure', { id: 'm:sure', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:sure'], head_token_id: 't:sure', span: { start: 11, end: 15 }, priority: 0, provenance: {} }],
    ['m:items', { id: 'm:items', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:items'], head_token_id: 't:items', span: { start: 16, end: 21 }, priority: 0, provenance: {} }],
    ['m:are', { id: 'm:are', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:are'], head_token_id: 't:are', span: { start: 22, end: 25 }, priority: 0, provenance: {} }],
    ['m:available', { id: 'm:available', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:available'], head_token_id: 't:available', span: { start: 26, end: 35 }, priority: 0, provenance: {} }],
  ]);
  const projected = [
    { relation_id: 'r:needs_make', label: 'complement_clause', head_mention_id: 'm:needs', dep_mention_id: 'm:make', head_token_id: 't:needs', dep_token_id: 't:make', segment_id: 's1', evidence: {} },
    { relation_id: 'r:make_sure', label: 'complement_clause', head_mention_id: 'm:make', dep_mention_id: 'm:sure', head_token_id: 't:make', dep_token_id: 't:sure', segment_id: 's1', evidence: {} },
    { relation_id: 'r:sure_are', label: 'complement_clause', head_mention_id: 'm:sure', dep_mention_id: 'm:are', head_token_id: 't:sure', dep_token_id: 't:are', segment_id: 's1', evidence: {} },
    { relation_id: 'r:are_items', label: 'actor', head_mention_id: 'm:are', dep_mention_id: 'm:items', head_token_id: 't:are', dep_token_id: 't:items', segment_id: 's1', evidence: {} },
    { relation_id: 'r:are_attr', label: 'attribute', head_mention_id: 'm:are', dep_mention_id: 'm:available', head_token_id: 't:are', dep_token_id: 't:available', segment_id: 's1', evidence: {} },
  ];
  const out = buildAssertions({ projected, mentionById, tokenById });
  const emittedPredicates = new Set(out.assertions.map((a) => a.predicate.mention_id));
  assert.ok(emittedPredicates.has('m:needs'), 'fixture should keep governing lexical predicate');
  assert.ok(!emittedPredicates.has('m:make'), 'synthetic fallback must not emit standalone make in make-sure scaffold');
}

// Test 8k: coordinated lexical verb gets materialized only with additional non-structural relation evidence.
{
  const tokenById = new Map([
    ['t:sys', { id: 't:sys', i: 0, segment_id: 's1', surface: 'system', pos: { tag: 'NN', coarse: 'NOUN' }, span: { start: 0, end: 6 } }],
    ['t:run', { id: 't:run', i: 1, segment_id: 's1', surface: 'run', pos: { tag: 'VB', coarse: 'VERB' }, span: { start: 7, end: 10 } }],
    ['t:jump', { id: 't:jump', i: 3, segment_id: 's1', surface: 'jump', pos: { tag: 'VB', coarse: 'VERB' }, span: { start: 15, end: 19 } }],
    ['t:task', { id: 't:task', i: 4, segment_id: 's1', surface: 'task', pos: { tag: 'NN', coarse: 'NOUN' }, span: { start: 20, end: 24 } }],
  ]);
  const mentionById = new Map([
    ['m:sys', { id: 'm:sys', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:sys'], head_token_id: 't:sys', span: { start: 0, end: 6 }, priority: 0, provenance: {} }],
    ['m:run', { id: 'm:run', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:run'], head_token_id: 't:run', span: { start: 7, end: 10 }, priority: 0, provenance: {} }],
    ['m:jump', { id: 'm:jump', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:jump'], head_token_id: 't:jump', span: { start: 15, end: 19 }, priority: 0, provenance: {} }],
    ['m:task', { id: 'm:task', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:task'], head_token_id: 't:task', span: { start: 20, end: 24 }, priority: 0, provenance: {} }],
  ]);
  const projected = [
    { relation_id: 'r:theme', label: 'theme', head_mention_id: 'm:run', dep_mention_id: 'm:task', head_token_id: 't:run', dep_token_id: 't:task', segment_id: 's1', evidence: {} },
    { relation_id: 'r:coord', label: 'coordination', head_mention_id: 'm:run', dep_mention_id: 'm:jump', head_token_id: 't:run', dep_token_id: 't:jump', segment_id: 's1', evidence: {} },
    { relation_id: 'r:actor', label: 'actor', head_mention_id: 'm:sys', dep_mention_id: 'm:jump', head_token_id: 't:sys', dep_token_id: 't:jump', segment_id: 's1', evidence: {} },
  ];
  const out = buildAssertions({ projected, mentionById, tokenById });
  const emittedPredicates = new Set(out.assertions.map((a) => a.predicate.mention_id));
  assert.ok(emittedPredicates.has('m:run'), 'fixture should emit base lexical predicate');
  assert.ok(emittedPredicates.has('m:jump'), 'coordinated lexical verb should be materialized when non-structural evidence exists');
}

// Test 8l: subject pronoun projects to actor when explicit subject-role relation exists.
{
  const tokenById = new Map([
    ['t:it', { id: 't:it', i: 0, segment_id: 's1', surface: 'It', pos: { tag: 'PRP', coarse: 'PRON' }, span: { start: 0, end: 2 } }],
    ['t:runs', { id: 't:runs', i: 1, segment_id: 's1', surface: 'runs', pos: { tag: 'VBZ', coarse: 'VERB' }, span: { start: 3, end: 7 } }],
    ['t:fast', { id: 't:fast', i: 2, segment_id: 's1', surface: 'fast', pos: { tag: 'RB', coarse: 'ADV' }, span: { start: 8, end: 12 } }],
  ]);
  const mentionById = new Map([
    ['m:it', { id: 'm:it', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:it'], head_token_id: 't:it', span: { start: 0, end: 2 }, priority: 0, provenance: {} }],
    ['m:runs', { id: 'm:runs', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:runs'], head_token_id: 't:runs', span: { start: 3, end: 7 }, priority: 0, provenance: {} }],
    ['m:fast', { id: 'm:fast', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:fast'], head_token_id: 't:fast', span: { start: 8, end: 12 }, priority: 0, provenance: {} }],
  ]);
  const projected = [
    { relation_id: 'r:subj', label: 'nsubj', head_mention_id: 'm:runs', dep_mention_id: 'm:it', head_token_id: 't:runs', dep_token_id: 't:it', segment_id: 's1', evidence: {} },
    { relation_id: 'r:theme', label: 'theme', head_mention_id: 'm:runs', dep_mention_id: 'm:fast', head_token_id: 't:runs', dep_token_id: 't:fast', segment_id: 's1', evidence: {} },
  ];
  const out = buildAssertions({ projected, mentionById, tokenById });
  assert.strictEqual(out.assertions.length, 1, 'fixture should emit one assertion');
  assert.deepStrictEqual(assertionSlots(out.assertions[0]).actor, ['m:it'], 'pronoun subject relation should project actor');
  assert.ok(out.coveredMentions.has('m:it'), 'pronoun subject mention should be covered when projected as actor');
  const gaps = buildSubjectRoleGaps({ assertions: out.assertions, projected });
  assert.strictEqual(gaps.length, 0, 'explicit subject-role relation should not emit missing_subject_role');
}

// Test 8m: lexical NP subject projects to actor via explicit agent-like relation.
{
  const tokenById = new Map([
    ['t:sys', { id: 't:sys', i: 0, segment_id: 's1', surface: 'System', pos: { tag: 'NN', coarse: 'NOUN' }, span: { start: 0, end: 6 } }],
    ['t:checks', { id: 't:checks', i: 1, segment_id: 's1', surface: 'checks', pos: { tag: 'VBZ', coarse: 'VERB' }, span: { start: 7, end: 13 } }],
    ['t:req', { id: 't:req', i: 2, segment_id: 's1', surface: 'requests', pos: { tag: 'NNS', coarse: 'NOUN' }, span: { start: 14, end: 22 } }],
  ]);
  const mentionById = new Map([
    ['m:sys', { id: 'm:sys', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:sys'], head_token_id: 't:sys', span: { start: 0, end: 6 }, priority: 0, provenance: {} }],
    ['m:checks', { id: 'm:checks', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:checks'], head_token_id: 't:checks', span: { start: 7, end: 13 }, priority: 0, provenance: {} }],
    ['m:req', { id: 'm:req', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:req'], head_token_id: 't:req', span: { start: 14, end: 22 }, priority: 0, provenance: {} }],
  ]);
  const projected = [
    { relation_id: 'r:agent', label: 'agent', head_mention_id: 'm:checks', dep_mention_id: 'm:sys', head_token_id: 't:checks', dep_token_id: 't:sys', segment_id: 's1', evidence: {} },
    { relation_id: 'r:theme', label: 'theme', head_mention_id: 'm:checks', dep_mention_id: 'm:req', head_token_id: 't:checks', dep_token_id: 't:req', segment_id: 's1', evidence: {} },
  ];
  const out = buildAssertions({ projected, mentionById, tokenById });
  assert.deepStrictEqual(assertionSlots(out.assertions[0]).actor, ['m:sys'], 'agent label should map to actor slot');
  assert.ok(out.coveredMentions.has('m:sys'), 'lexical subject mention should be covered when projected as actor');
}

// Test 8n: missing subject-role relation emits missing_subject_role and keeps candidate subject uncovered.
{
  const tokenById = new Map([
    ['t:it', { id: 't:it', i: 0, segment_id: 's1', surface: 'It', pos: { tag: 'PRP', coarse: 'PRON' }, span: { start: 0, end: 2 } }],
    ['t:runs', { id: 't:runs', i: 1, segment_id: 's1', surface: 'runs', pos: { tag: 'VBZ', coarse: 'VERB' }, span: { start: 3, end: 7 } }],
    ['t:task', { id: 't:task', i: 2, segment_id: 's1', surface: 'tasks', pos: { tag: 'NNS', coarse: 'NOUN' }, span: { start: 8, end: 13 } }],
  ]);
  const mentionById = new Map([
    ['m:it', { id: 'm:it', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:it'], head_token_id: 't:it', span: { start: 0, end: 2 }, priority: 0, provenance: {} }],
    ['m:runs', { id: 'm:runs', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:runs'], head_token_id: 't:runs', span: { start: 3, end: 7 }, priority: 0, provenance: {} }],
    ['m:task', { id: 'm:task', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:task'], head_token_id: 't:task', span: { start: 8, end: 13 }, priority: 0, provenance: {} }],
  ]);
  const projected = [
    { relation_id: 'r:theme', label: 'theme', head_mention_id: 'm:runs', dep_mention_id: 'm:task', head_token_id: 't:runs', dep_token_id: 't:task', segment_id: 's1', evidence: {} },
  ];
  const out = buildAssertions({ projected, mentionById, tokenById });
  assert.deepStrictEqual(assertionSlots(out.assertions[0]).actor, [], 'without explicit subject relation actor must stay empty');
  assert.ok(!out.coveredMentions.has('m:it'), 'candidate subject mention should remain uncovered without explicit relation');
  const gaps = buildSubjectRoleGaps({ assertions: out.assertions, projected });
  assert.strictEqual(gaps.length, 1, 'predicate without subject-role evidence should emit one missing_subject_role diagnostic');
  assert.strictEqual(gaps[0].reason, 'missing_subject_role');
  assert.strictEqual(gaps[0].predicate_mention_id, 'm:runs');
}

// Test 8o: coordinated predicates each receive actor when each has explicit subject-role relation.
{
  const tokenById = new Map([
    ['t:it', { id: 't:it', i: 0, segment_id: 's1', surface: 'It', pos: { tag: 'PRP', coarse: 'PRON' }, span: { start: 0, end: 2 } }],
    ['t:starts', { id: 't:starts', i: 1, segment_id: 's1', surface: 'starts', pos: { tag: 'VBZ', coarse: 'VERB' }, span: { start: 3, end: 9 } }],
    ['t:tests', { id: 't:tests', i: 3, segment_id: 's1', surface: 'tests', pos: { tag: 'VBZ', coarse: 'VERB' }, span: { start: 14, end: 19 } }],
    ['t:obj', { id: 't:obj', i: 4, segment_id: 's1', surface: 'numbers', pos: { tag: 'NNS', coarse: 'NOUN' }, span: { start: 20, end: 27 } }],
  ]);
  const mentionById = new Map([
    ['m:it', { id: 'm:it', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:it'], head_token_id: 't:it', span: { start: 0, end: 2 }, priority: 0, provenance: {} }],
    ['m:starts', { id: 'm:starts', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:starts'], head_token_id: 't:starts', span: { start: 3, end: 9 }, priority: 0, provenance: {} }],
    ['m:tests', { id: 'm:tests', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:tests'], head_token_id: 't:tests', span: { start: 14, end: 19 }, priority: 0, provenance: {} }],
    ['m:obj', { id: 'm:obj', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:obj'], head_token_id: 't:obj', span: { start: 20, end: 27 }, priority: 0, provenance: {} }],
  ]);
  const projected = [
    { relation_id: 'r:s1', label: 'nsubj', head_mention_id: 'm:starts', dep_mention_id: 'm:it', head_token_id: 't:starts', dep_token_id: 't:it', segment_id: 's1', evidence: {} },
    { relation_id: 'r:s2', label: 'nsubj', head_mention_id: 'm:tests', dep_mention_id: 'm:it', head_token_id: 't:tests', dep_token_id: 't:it', segment_id: 's1', evidence: {} },
    { relation_id: 'r:t2', label: 'theme', head_mention_id: 'm:tests', dep_mention_id: 'm:obj', head_token_id: 't:tests', dep_token_id: 't:obj', segment_id: 's1', evidence: {} },
    { relation_id: 'r:coord', label: 'coordination', head_mention_id: 'm:starts', dep_mention_id: 'm:tests', head_token_id: 't:starts', dep_token_id: 't:tests', segment_id: 's1', evidence: {} },
  ];
  const outA = buildAssertions({ projected, mentionById, tokenById });
  const outB = buildAssertions({ projected: projected.slice().reverse(), mentionById, tokenById });
  assert.deepStrictEqual(outA.assertions.map((a) => a.id), outB.assertions.map((a) => a.id), 'assertion ordering must be stable across relation order changes');
  for (const a of outA.assertions.filter((x) => x.predicate.mention_id === 'm:starts' || x.predicate.mention_id === 'm:tests')) {
    assert.deepStrictEqual(assertionSlots(a).actor, ['m:it'], 'each coordinated predicate should receive actor from explicit relation');
  }
}

// Test 8p: passive agent-like relation maps to actor while patient stays theme.
{
  const tokenById = new Map([
    ['t:agent', { id: 't:agent', i: 0, segment_id: 's1', surface: 'supervisors', pos: { tag: 'NNS', coarse: 'NOUN' }, span: { start: 0, end: 11 } }],
    ['t:rev', { id: 't:rev', i: 2, segment_id: 's1', surface: 'reviewed', pos: { tag: 'VBN', coarse: 'VERB' }, span: { start: 15, end: 23 } }],
    ['t:pat', { id: 't:pat', i: 3, segment_id: 's1', surface: 'reports', pos: { tag: 'NNS', coarse: 'NOUN' }, span: { start: 24, end: 31 } }],
  ]);
  const mentionById = new Map([
    ['m:agent', { id: 'm:agent', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:agent'], head_token_id: 't:agent', span: { start: 0, end: 11 }, priority: 0, provenance: {} }],
    ['m:rev', { id: 'm:rev', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:rev'], head_token_id: 't:rev', span: { start: 15, end: 23 }, priority: 0, provenance: {} }],
    ['m:pat', { id: 'm:pat', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:pat'], head_token_id: 't:pat', span: { start: 24, end: 31 }, priority: 0, provenance: {} }],
  ]);
  const projected = [
    { relation_id: 'r:agent', label: 'agent', head_mention_id: 'm:rev', dep_mention_id: 'm:agent', head_token_id: 't:rev', dep_token_id: 't:agent', segment_id: 's1', evidence: {} },
    { relation_id: 'r:pat', label: 'patient', head_mention_id: 'm:rev', dep_mention_id: 'm:pat', head_token_id: 't:rev', dep_token_id: 't:pat', segment_id: 's1', evidence: {} },
  ];
  const out = buildAssertions({ projected, mentionById, tokenById });
  assert.deepStrictEqual(assertionSlots(out.assertions[0]).actor, ['m:agent'], 'agent-like relation should map to actor');
  assert.deepStrictEqual(assertionSlots(out.assertions[0]).theme, ['m:pat'], 'patient relation should remain theme');
}

// Test 8q: unknown relation labels never map to actor and trigger missing_subject_role when applicable.
{
  assert.deepStrictEqual(roleToSlot('unknown_rel').slot, 'other', 'unknown relation labels must not map to actor');
  const tokenById = new Map([
    ['t:p', { id: 't:p', i: 0, segment_id: 's1', surface: 'runs', pos: { tag: 'VBZ', coarse: 'VERB' }, span: { start: 0, end: 4 } }],
    ['t:d', { id: 't:d', i: 1, segment_id: 's1', surface: 'quickly', pos: { tag: 'RB', coarse: 'ADV' }, span: { start: 5, end: 12 } }],
  ]);
  const mentionById = new Map([
    ['m:p', { id: 'm:p', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:p'], head_token_id: 't:p', span: { start: 0, end: 4 }, priority: 0, provenance: {} }],
    ['m:d', { id: 'm:d', segment_id: 's1', kind: 'token', is_primary: true, token_ids: ['t:d'], head_token_id: 't:d', span: { start: 5, end: 12 }, priority: 0, provenance: {} }],
  ]);
  const projected = [
    { relation_id: 'r:u', label: 'weird_label', head_mention_id: 'm:p', dep_mention_id: 'm:d', head_token_id: 't:p', dep_token_id: 't:d', segment_id: 's1', evidence: {} },
  ];
  const out = buildAssertions({ projected, mentionById, tokenById });
  assert.deepStrictEqual(assertionSlots(out.assertions[0]).actor, [], 'unknown relation label must not populate actor');
  const gaps = buildSubjectRoleGaps({ assertions: out.assertions, projected });
  assert.strictEqual(gaps.length, 1, 'missing actor with lexical predicate should emit missing_subject_role diagnostic');
}

// Test 9: static guard against disallowed DB/index coupling.
{
  const source = fs.readFileSync(path.join(stepDir, 'elementary-assertions.js'), 'utf8');
  assert.ok(!source.includes('node:sqlite'), 'step12 producer must not import sqlite');
  assert.ok(!source.includes('WIKIPEDIA_INDEX_DB_PATH'), 'step12 producer must not reference index db path');
  assert.ok(!/DatabaseSync/.test(source), 'step12 producer must not use direct db APIs');
  assert.ok(!source.includes('/v1/titles/query'), 'step12 producer must not perform REST title queries');
}

// Test 10: analyzeUpstreamWikiEvidence fixture counts explicit upstream evidence only.
{
  const upstreamFixture = {
    tokens: [
      { id: 'tok:1', lexicon: { wikipedia_title_index: { wiki_any_signal: true, wiki_prefix_count: 1 } } },
      { id: 'tok:2' },
    ],
    annotations: [
      {
        id: 'ann:mwe:1',
        kind: 'mwe',
        status: 'accepted',
        anchor: {
          selectors: [
            { type: 'TokenSelector', token_ids: ['tok:1'] },
            { type: 'TextPositionSelector', span: { start: 0, end: 3 } },
          ],
        },
        sources: [{ name: 'wikipedia-title-index', evidence: { wiki_any_signal: false, wiki_prefix_count: 0 } }],
      },
      {
        id: 'ann:mwe:2',
        kind: 'mwe',
        status: 'accepted',
        anchor: {
          selectors: [
            { type: 'TokenSelector', token_ids: ['tok:2'] },
            { type: 'TextPositionSelector', span: { start: 4, end: 7 } },
          ],
        },
        sources: [{ name: 'mwe-materialization', evidence: { head_token_id: 'tok:2' } }],
      },
      {
        id: 'ann:dep:1',
        kind: 'dependency',
        status: 'accepted',
        head: { id: 'tok:1' },
        dep: { id: 'tok:2' },
        sources: [{ name: 'relation-extraction', evidence: {} }],
      },
    ],
  };

  const stats = analyzeUpstreamWikiEvidence(upstreamFixture);
  assert.strictEqual(stats.evidence_definition, 'positive_signal_only', 'fixture should report positive signal definition');
  assert.strictEqual(stats.total_mentions, 4, 'fixture should expose two token mentions and two mwe mentions');
  assert.strictEqual(stats.mentions_with_wiki_evidence, 1, 'fixture should count only positive wiki signals as evidence');
  assert.strictEqual(stats.mentions_without_wiki_evidence, 3, 'fixture should count non-positive objects as without evidence');
  assert.strictEqual(stats.total_predicates, 1, 'fixture should expose one predicate mention from accepted dependency');
  assert.strictEqual(stats.predicates_with_wiki_evidence, 0, 'fixture predicate should not count false-flag MWE source as evidence');
  assert.strictEqual(stats.predicates_without_wiki_evidence, 1, 'fixture predicate should be missing evidence with false-flag MWE source');
  assert.strictEqual(
    stats.mentions_with_wiki_evidence + stats.mentions_without_wiki_evidence,
    stats.total_mentions,
    'fixture mention counts must be internally consistent'
  );
  assert.strictEqual(
    stats.predicates_with_wiki_evidence + stats.predicates_without_wiki_evidence,
    stats.total_predicates,
    'fixture predicate counts must be internally consistent'
  );
  assert.ok(Array.isArray(stats.sample_missing_mention_ids), 'fixture should return missing mention sample list');
  assert.ok(Array.isArray(stats.sample_missing_predicate_ids), 'fixture should return missing predicate sample list');
}

// Test 10: webshop upstream analysis smoke test has internally consistent counts.
{
  const linguisticEnricher = require('linguistic-enricher');
  const seedPath = path.join(repoRoot, 'artifacts', 'webshop', 'seed', 'seed.txt');
  const seedText = fs.readFileSync(seedPath, 'utf8');
  const upstream = await linguisticEnricher.runPipeline(seedText, { target: 'relations_extracted' });
  const stats = analyzeUpstreamWikiEvidence(upstream);

  assert.ok(stats.total_mentions > 0, 'webshop analysis should expose mentions');
  assert.ok(stats.total_predicates > 0, 'webshop analysis should expose predicates');
  assert.strictEqual(
    stats.mentions_with_wiki_evidence + stats.mentions_without_wiki_evidence,
    stats.total_mentions,
    'webshop mention counts must be internally consistent'
  );
  assert.strictEqual(
    stats.predicates_with_wiki_evidence + stats.predicates_without_wiki_evidence,
    stats.total_predicates,
    'webshop predicate counts must be internally consistent'
  );
}

// Test 11: run options include wikipedia-title-index service when endpoint is configured.
{
  const opts = buildRunOptions({ wtiEndpoint: 'http://127.0.0.1:32123', timeoutMs: 50 });
  assert.ok(opts && opts.services && opts.services['wikipedia-title-index'], 'run options should contain wikipedia service config');
  assert.strictEqual(
    opts.services['wikipedia-title-index'].endpoint,
    'http://127.0.0.1:32123',
    'run options should pass configured endpoint to runPipeline'
  );
}

// Test 13: wiring diagnostic reports endpoint passthrough state.
{
  const { artifactsRoot, seedId } = mkTempArtifacts('webshop');
  const configured = runExtractor(
    artifactsRoot,
    seedId,
    ['--diagnose-wti-wiring', '--wti-endpoint', 'http://127.0.0.1:32123'],
    { WIKIPEDIA_TITLE_INDEX_ENDPOINT: '' }
  );
  assert.strictEqual(configured.status, 0, `wiring diagnose with endpoint failed: ${configured.stderr || configured.stdout}`);
  const configuredJson = JSON.parse(configured.stdout);
  assert.strictEqual(configuredJson.wti_endpoint_configured, true, 'wiring diagnose should report configured endpoint');
  assert.strictEqual(configuredJson.passed_to_runPipeline, true, 'wiring diagnose should report service passthrough');
  assert.strictEqual(configuredJson.endpoint_value, 'http://127.0.0.1:32123', 'wiring diagnose should echo endpoint value');

  const missing = runExtractor(
    artifactsRoot,
    seedId,
    ['--diagnose-wti-wiring'],
    { WIKIPEDIA_TITLE_INDEX_ENDPOINT: '' }
  );
  assert.strictEqual(missing.status, 1, `wiring diagnose without endpoint should fail: ${missing.stderr || missing.stdout}`);
  const missingJson = JSON.parse(missing.stdout);
  assert.strictEqual(missingJson.wti_endpoint_configured, false, 'wiring diagnose should report missing endpoint');
  assert.strictEqual(missingJson.passed_to_runPipeline, false, 'wiring diagnose should report no passthrough without endpoint');
  assert.strictEqual(
    missingJson.mandatory_error,
    'WTI endpoint is required for Step 12 (wikipedia-title-index service).',
    'wiring diagnose should include mandatory policy error when endpoint is missing'
  );
}

// Test 14: upstream wiki diagnostic output includes positive-signal evidence definition.
{
  const { artifactsRoot, seedId } = mkTempArtifacts('webshop');
  const diag = runExtractor(artifactsRoot, seedId, ['--diagnose-wiki-upstream']);
  assert.strictEqual(diag.status, 0, `upstream wiki diagnose failed: ${diag.stderr || diag.stdout}`);
  const out = JSON.parse(diag.stdout);
  assert.strictEqual(out.evidence_definition, 'positive_signal_only', 'diagnose-wiki-upstream should report evidence definition');
}

// Test 14b: coverage audit diagnostic mode emits deterministic primary mention rows.
{
  const { artifactsRoot, seedId } = mkTempArtifacts('prime_gen');
  const out = runExtractor(artifactsRoot, seedId, ['--diagnose-coverage-audit']);
  assert.strictEqual(out.status, 0, `coverage audit diagnose failed: ${out.stderr || out.stdout}`);
  const json = JSON.parse(out.stdout);
  assert.strictEqual(json.seed_id, 'prime_gen', 'coverage audit should include seed id');
  assert.ok(Number.isInteger(json.primary_count) && json.primary_count > 0, 'coverage audit should include primary_count');
  assert.ok(Array.isArray(json.rows) && json.rows.length === json.primary_count, 'coverage audit rows should align with primary_count');
  const ids = json.rows.map((r) => r.mention_id);
  const sorted = ids.slice().sort((a, b) => a.localeCompare(b));
  assert.deepStrictEqual(ids, sorted, 'coverage audit rows must be sorted by mention_id deterministically');
  for (const r of json.rows) {
    assert.strictEqual(typeof r.covered, 'boolean', 'coverage audit row.covered should be boolean');
    assert.ok(Array.isArray(r.covered_by), 'coverage audit row.covered_by should be array');
    if (r.covered) {
      assert.strictEqual(r.uncovered_reason, null, 'covered row should have null uncovered_reason');
    } else {
      assert.strictEqual(typeof r.uncovered_reason, 'string', 'uncovered row should include unresolved reason string');
    }
  }
}

// Test 4: explicit WTI endpoint must be reachable (fail-fast health check).
{
  const { artifactsRoot, seedId } = mkTempArtifacts('webshop');
  const run = spawnSync(
    process.execPath,
    [
      path.join(stepDir, 'elementary-assertions.js'),
      '--seed-id',
      seedId,
      '--artifacts-root',
      artifactsRoot,
      '--wti-endpoint',
      'http://127.0.0.1:1',
      '--timeout-ms',
      '50',
    ],
    { encoding: 'utf8' }
  );
  assert.notStrictEqual(run.status, 0, 'extractor should fail when configured WTI endpoint is unreachable');
  assert.ok(
    /wikipedia-title-index health check failed/i.test(`${run.stderr || ''}\n${run.stdout || ''}`),
    'expected explicit health check failure message for unreachable WTI endpoint'
  );
}

// Test 4b: buildCoverageAudit marks transfer mechanism deterministically.
{
  const output = {
    mentions: [
      { id: 'm:a', is_primary: true, token_ids: ['t1'] },
      { id: 'm:b', is_primary: true, token_ids: ['t2'] },
    ],
    assertions: [
      {
        id: 'a:1',
        arguments: [{ role: 'actor', mention_ids: ['m:a'] }],
        modifiers: [],
        operators: [{ kind: 'quantifier', token_id: 't2' }],
        evidence: { token_ids: ['t1', 't2'] },
      },
    ],
    coverage: {
      primary_mention_ids: ['m:a', 'm:b'],
      covered_primary_mention_ids: ['m:a', 'm:b'],
      unresolved: [{ mention_id: 'm:b', reason: 'projection_failed' }],
    },
    diagnostics: {
      suppressed_assertions: [
        { transferred_mention_ids: ['m:b'] },
      ],
    },
  };
  const rows = buildCoverageAudit(output);
  assert.strictEqual(rows.length, 2, 'coverage audit should include both primary mentions');
  const byId = new Map(rows.map((r) => [r.mention_id, r]));
  assert.ok(byId.get('m:a').covered, 'slot-covered mention should be marked covered');
  assert.ok(byId.get('m:a').covered_by.includes('slot'), 'slot-covered mention should include slot mechanism');
  assert.ok(byId.get('m:b').covered, 'transfer/operator/evidence mention should be marked covered');
  assert.ok(byId.get('m:b').covered_by.includes('operator'), 'token-linked operator should count as coverage mechanism');
  assert.ok(byId.get('m:b').covered_by.includes('transfer'), 'suppressed trace transfer should count as coverage mechanism');
}

console.log('elementary-assertions tests passed.');
})().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});








