const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const YAML = require('yaml');

const stepDir = __dirname;
const renderer = path.join(stepDir, 'render-elementary-assertions.js');
const extractor = path.join(stepDir, 'elementary-assertions.js');
const repoRoot = path.resolve(__dirname, '..');

function mkTempSeed(seedId = 'webshop') {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'render-ea-'));
  const artifactsRoot = path.join(tmp, 'artifacts');
  const srcArtifacts = path.join(repoRoot, 'artifacts');
  const srcSeedDir = path.join(srcArtifacts, seedId, 'seed');
  const dstSeedDir = path.join(artifactsRoot, seedId, 'seed');
  fs.mkdirSync(dstSeedDir, { recursive: true });
  fs.copyFileSync(path.join(srcArtifacts, 'seed.schema.json'), path.join(artifactsRoot, 'seed.schema.json'));
  fs.copyFileSync(path.join(srcSeedDir, 'seed.txt'), path.join(dstSeedDir, 'seed.txt'));
  const gen = spawnSync(process.execPath, [extractor, '--seed-id', seedId, '--artifacts-root', artifactsRoot, '--timeout-ms', '15000'], {
    encoding: 'utf8',
    env: { ...process.env, WIKIPEDIA_TITLE_INDEX_ENDPOINT: process.env.WIKIPEDIA_TITLE_INDEX_ENDPOINT || 'http://127.0.0.1:32123' },
  });
  assert.strictEqual(gen.status, 0, `extractor failed: ${gen.stderr || gen.stdout}`);
  return {
    artifactsRoot,
    inPath: path.join(dstSeedDir, 'seed.elementary-assertions.yaml'),
  };
}

function runRenderer(args) {
  return spawnSync(process.execPath, [renderer].concat(args), { encoding: 'utf8' });
}

function commonFlags(inPath) {
  return [
    '--in', inPath,
    '--format', 'txt',
    '--segments', 'true',
    '--mentions', 'true',
    '--coverage', 'true',
    '--debug-ids', 'true',
  ];
}

function writeInlineWikiFixture(inPath, withWiki = true) {
  const text = 'Alpha build cart near shop plain';
  const fixture = {
    schema_version: '1.0.0',
    seed_id: 'fixture',
    stage: 'elementary_assertions',
    canonical_text: text,
    segments: [{ id: 's1', span: { start: 0, end: text.length }, token_range: { start: 0, end: 6 } }],
    tokens: [
      { id: 't1', i: 0, segment_id: 's1', span: { start: 0, end: 5 }, surface: 'Alpha', pos: { tag: 'NNP' } },
      { id: 't2', i: 1, segment_id: 's1', span: { start: 6, end: 11 }, surface: 'build', pos: { tag: 'VB' } },
      { id: 't3', i: 2, segment_id: 's1', span: { start: 12, end: 16 }, surface: 'cart', pos: { tag: 'NN' } },
      { id: 't4', i: 3, segment_id: 's1', span: { start: 17, end: 21 }, surface: 'near', pos: { tag: 'IN' } },
      { id: 't5', i: 4, segment_id: 's1', span: { start: 22, end: 26 }, surface: 'shop', pos: { tag: 'NN' } },
      { id: 't6', i: 5, segment_id: 's1', span: { start: 27, end: 32 }, surface: 'plain', pos: { tag: 'JJ' } },
    ],
    mentions: [
      { id: 'm1', kind: 'token', token_ids: ['t1'], head_token_id: 't1', span: { start: 0, end: 5 }, segment_id: 's1', is_primary: true },
      { id: 'm2', kind: 'token', token_ids: ['t2'], head_token_id: 't2', span: { start: 6, end: 11 }, segment_id: 's1', is_primary: true },
      { id: 'm3', kind: 'token', token_ids: ['t3'], head_token_id: 't3', span: { start: 12, end: 16 }, segment_id: 's1', is_primary: true },
      { id: 'm4', kind: 'token', token_ids: ['t4'], head_token_id: 't4', span: { start: 17, end: 21 }, segment_id: 's1', is_primary: true },
      { id: 'm5', kind: 'token', token_ids: ['t5'], head_token_id: 't5', span: { start: 22, end: 26 }, segment_id: 's1', is_primary: true },
      { id: 'm6', kind: 'token', token_ids: ['t6'], head_token_id: 't6', span: { start: 27, end: 32 }, segment_id: 's1', is_primary: true },
    ],
    assertions: [
      {
        id: 'a1',
        segment_id: 's1',
        predicate: { mention_id: 'm2', head_token_id: 't2' },
        slots: { actor: ['m1'], theme: ['m3'], attr: ['m6'], topic: [], location: ['m5'], other: [] },
        operators: [],
        evidence: { relation_evidence: [{ annotation_id: 'r1', from_token_id: 't2', to_token_id: 't3', label: 'theme' }], token_ids: ['t1', 't2', 't3', 't5', 't6'] },
        diagnostics: { predicate_quality: 'low' },
      },
      {
        id: 'a2',
        segment_id: 's1',
        predicate: { mention_id: 'm5', head_token_id: 't5' },
        slots: { actor: ['m1'], theme: [], attr: [], topic: [], location: [], other: [] },
        operators: [],
        evidence: { relation_evidence: [{ annotation_id: 'r2', from_token_id: 't5', to_token_id: 't1', label: 'actor' }], token_ids: ['t1', 't5'] },
        diagnostics: { predicate_quality: 'ok' },
      },
    ],
    coverage: {
      primary_mention_ids: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'],
      covered_primary_mention_ids: ['m2', 'm3', 'm5'],
      uncovered_primary_mention_ids: ['m1', 'm4', 'm6'],
      unresolved: [{
        kind: 'unresolved_attachment',
        segment_id: 's1',
        mention_id: 'm4',
        mention_ids: ['m4'],
        reason: 'projection_failed',
        evidence: { token_ids: ['t4'], upstream_relation_ids: ['r:u1'] },
      }],
    },
    diagnostics: {
      token_wiki_signal_count: 0,
      mentions_with_lexicon_evidence: 0,
      assertions_with_wiki_signals: 0,
      projected_relation_count: 0,
      dropped_relation_count: 0,
      suppressed_assertions: [{
        id: 'a:s1:m1:suppressed',
        segment_id: 's1',
        predicate: { mention_id: 'm1', head_token_id: 't1' },
        diagnostics: {
          predicate_quality: 'low',
          suppressed_by: {
            kind: 'predicate_redirect',
            target_assertion_id: 'a1',
            reason: 'modality_moved_to_lexical',
            evidence: {
              upstream_relation_ids: ['r:u1'],
              token_ids: ['t1', 't2'],
            },
          },
        },
      }],
      warnings: [],
    },
    wiki_title_evidence: {
      normalization: {
        unicode_form: 'NFKC',
        punctuation_map: { apostrophes: 'x', dashes: 'y' },
        whitespace: 'collapse_spaces_trim',
        casefold: 'toLowerCase',
      },
      mention_matches: withWiki
        ? [
            { mention_id: 'm1', normalized_surface: 'alpha', exact_titles: ['Alpha'], prefix_titles: [] },
            { mention_id: 'm3', normalized_surface: 'cart', exact_titles: ['Cart'], prefix_titles: [] },
            { mention_id: 'm5', normalized_surface: 'shop', exact_titles: [], prefix_titles: ['Shopify'] },
          ]
        : [],
      assertion_predicate_matches: withWiki
        ? [
            { assertion_id: 'a1', predicate_mention_id: 'm2', exact_titles: ['Build'], prefix_titles: ['Builder'] },
            { assertion_id: 'a2', predicate_mention_id: 'm5', exact_titles: [], prefix_titles: ['Shop (retail)'] },
          ]
        : [],
    },
  };
  fs.writeFileSync(inPath, YAML.stringify(fixture, { lineWidth: 0 }), 'utf8');
}

function writeUncoveredContainmentFixture(inPath, mode) {
  const text = 'Alpha beta gamma delta';
  const mentions = [
    { id: 'm:a', kind: 'token', token_ids: ['t1'], head_token_id: 't1', span: { start: 0, end: 5 }, segment_id: 's1', is_primary: true },
    { id: 'm:ab', kind: 'chunk', token_ids: ['t1', 't2'], head_token_id: 't2', span: { start: 0, end: 10 }, segment_id: 's1', is_primary: true },
    { id: 'm:abc', kind: 'chunk', token_ids: ['t1', 't2', 't3'], head_token_id: 't3', span: { start: 0, end: 16 }, segment_id: 's1', is_primary: true },
    { id: 'm:b', kind: 'token', token_ids: ['t2'], head_token_id: 't2', span: { start: 6, end: 10 }, segment_id: 's1', is_primary: true },
    { id: 'm:c', kind: 'token', token_ids: ['t3'], head_token_id: 't3', span: { start: 11, end: 16 }, segment_id: 's1', is_primary: true },
    { id: 'm:d', kind: 'token', token_ids: ['t4'], head_token_id: 't4', span: { start: 17, end: 22 }, segment_id: 's1', is_primary: true },
  ];
  const base = {
    schema_version: '1.0.0',
    seed_id: 'fixture-uncovered',
    stage: 'elementary_assertions',
    canonical_text: text,
    segments: [{ id: 's1', span: { start: 0, end: text.length }, token_range: { start: 0, end: 4 } }],
    tokens: [
      { id: 't1', i: 0, segment_id: 's1', span: { start: 0, end: 5 }, surface: 'Alpha', pos: { tag: 'NN' } },
      { id: 't2', i: 1, segment_id: 's1', span: { start: 6, end: 10 }, surface: 'beta', pos: { tag: 'NN' } },
      { id: 't3', i: 2, segment_id: 's1', span: { start: 11, end: 16 }, surface: 'gamma', pos: { tag: 'NN' } },
      { id: 't4', i: 3, segment_id: 's1', span: { start: 17, end: 22 }, surface: 'delta', pos: { tag: 'NN' } },
    ],
    mentions,
    assertions: [
      {
        id: 'a1',
        segment_id: 's1',
        predicate: { mention_id: 'm:abc', head_token_id: 't3' },
        slots: { actor: ['m:abc'], theme: [], attr: [], topic: [], location: [], other: [] },
        operators: [],
        evidence: { relation_evidence: [{ annotation_id: 'r1', from_token_id: 't3', to_token_id: 't1', label: 'actor' }], token_ids: ['t1', 't2', 't3'] },
        diagnostics: { predicate_quality: 'ok' },
      },
    ],
    coverage: {
      primary_mention_ids: ['m:a', 'm:ab', 'm:abc', 'm:b', 'm:c', 'm:d'],
      covered_primary_mention_ids: mode === 'double' ? ['m:ab', 'm:abc'] : mode === 'none' ? ['m:abc'] : ['m:abc'],
      uncovered_primary_mention_ids: mode === 'none' ? ['m:d'] : ['m:a', 'm:b', 'm:d'],
      unresolved: [
        { kind: 'unresolved_attachment', segment_id: 's1', mention_id: 'm:a', mention_ids: ['m:a'], reason: 'missing_relation', evidence: { token_ids: ['t1'], upstream_relation_ids: [] } },
        { kind: 'unresolved_attachment', segment_id: 's1', mention_id: 'm:b', mention_ids: ['m:b'], reason: 'projection_failed', evidence: { token_ids: ['t2'], upstream_relation_ids: [] } },
        { kind: 'unresolved_attachment', segment_id: 's1', mention_id: 'm:d', mention_ids: ['m:d'], reason: 'missing_relation', evidence: { token_ids: ['t4'], upstream_relation_ids: [] } },
      ],
    },
    diagnostics: { token_wiki_signal_count: 0, mentions_with_lexicon_evidence: 0, assertions_with_wiki_signals: 0, projected_relation_count: 1, dropped_relation_count: 0, suppressed_assertions: [], warnings: [] },
    wiki_title_evidence: { normalization: { unicode_form: 'NFKC', punctuation_map: {}, whitespace: 'collapse_spaces_trim', casefold: 'toLowerCase' }, mention_matches: [], assertion_predicate_matches: [] },
  };
  if (mode === 'double') {
    base.covered_primary_mention_ids = ['m:ab', 'm:abc'];
  } else if (mode === 'none') {
    base.covered_primary_mention_ids = ['m:abc'];
    base.coverage.uncovered_primary_mention_ids = ['m:d'];
    base.coverage.unresolved = [
      { kind: 'unresolved_attachment', segment_id: 's1', mention_id: 'm:d', mention_ids: ['m:d'], reason: 'missing_relation', evidence: { token_ids: ['t4'], upstream_relation_ids: [] } },
    ];
  }
  fs.writeFileSync(inPath, YAML.stringify(base, { lineWidth: 0 }), 'utf8');
}

function writeUsedMentionContainmentFixture(inPath, contained) {
  const text = 'small big phrase';
  const fixture = {
    schema_version: '1.0.0',
    seed_id: 'fixture-used-containment',
    stage: 'elementary_assertions',
    canonical_text: text,
    segments: [{ id: 's1', span: { start: 0, end: text.length }, token_range: { start: 0, end: 3 } }],
    tokens: [
      { id: 't1', i: 0, segment_id: 's1', span: { start: 0, end: 5 }, surface: 'small', pos: { tag: 'NN' } },
      { id: 't2', i: 1, segment_id: 's1', span: { start: 6, end: 9 }, surface: 'big', pos: { tag: 'NN' } },
      { id: 't3', i: 2, segment_id: 's1', span: { start: 10, end: 16 }, surface: 'phrase', pos: { tag: 'NN' } },
    ],
    mentions: [
      { id: 'm:small', kind: 'token', token_ids: ['t1'], head_token_id: 't1', span: { start: 0, end: 5 }, segment_id: 's1', is_primary: true },
      { id: 'm:container', kind: 'chunk', token_ids: contained ? ['t1', 't2'] : ['t2', 't3'], head_token_id: contained ? 't2' : 't3', span: contained ? { start: 0, end: 9 } : { start: 6, end: 16 }, segment_id: 's1', is_primary: false },
      { id: 'm:pred', kind: 'token', token_ids: ['t2'], head_token_id: 't2', span: { start: 6, end: 9 }, segment_id: 's1', is_primary: true },
    ],
    assertions: [
      {
        id: 'a1',
        segment_id: 's1',
        predicate: { mention_id: 'm:pred', head_token_id: 't2' },
        slots: { actor: ['m:container'], theme: [], attr: [], topic: [], location: [], other: [] },
        operators: [],
        evidence: { relation_evidence: [{ annotation_id: 'r1', from_token_id: 't2', to_token_id: contained ? 't1' : 't3', label: 'actor' }], token_ids: contained ? ['t1', 't2'] : ['t2', 't3'] },
        diagnostics: { predicate_quality: 'ok' },
      },
    ],
    coverage: {
      primary_mention_ids: ['m:small', 'm:pred'],
      covered_primary_mention_ids: ['m:pred'],
      uncovered_primary_mention_ids: ['m:small'],
      unresolved: [
        { kind: 'unresolved_attachment', segment_id: 's1', mention_id: 'm:small', mention_ids: ['m:small'], reason: 'missing_relation', evidence: { token_ids: ['t1'], upstream_relation_ids: [] } },
      ],
    },
    diagnostics: { token_wiki_signal_count: 0, mentions_with_lexicon_evidence: 0, assertions_with_wiki_signals: 0, projected_relation_count: 1, dropped_relation_count: 0, suppressed_assertions: [], warnings: [] },
    wiki_title_evidence: { normalization: { unicode_form: 'NFKC', punctuation_map: {}, whitespace: 'collapse_spaces_trim', casefold: 'toLowerCase' }, mention_matches: [], assertion_predicate_matches: [] },
  };
  fs.writeFileSync(inPath, YAML.stringify(fixture, { lineWidth: 0 }), 'utf8');
}

// Test 1: deterministic ordering/output across repeated runs.
{
  const { inPath } = mkTempSeed('webshop');
  const a = runRenderer(commonFlags(inPath));
  const b = runRenderer(commonFlags(inPath));
  assert.strictEqual(a.status, 0, `first render failed: ${a.stderr || a.stdout}`);
  assert.strictEqual(b.status, 0, `second render failed: ${b.stderr || b.stdout}`);
  assert.strictEqual(a.stdout, b.stdout, 'Renderer output must be byte-identical across repeated runs');
}

// Test 2: backward compatibility (no --layout == --layout compact).
{
  const { inPath } = mkTempSeed('webshop');
  const baseline = runRenderer(commonFlags(inPath));
  const compact = runRenderer(commonFlags(inPath).concat(['--layout', 'compact']));
  assert.strictEqual(baseline.status, 0, `baseline render failed: ${baseline.stderr || baseline.stdout}`);
  assert.strictEqual(compact.status, 0, `compact render failed: ${compact.stderr || compact.stdout}`);
  assert.strictEqual(compact.stdout, baseline.stdout, 'Compact layout must be byte-identical to default output');
}

// Test 2b: backward compatibility in md (no --layout == --layout compact).
{
  const { inPath } = mkTempSeed('webshop');
  const args = [
    '--in', inPath,
    '--format', 'md',
    '--segments', 'true',
    '--mentions', 'true',
    '--coverage', 'true',
    '--debug-ids', 'false',
  ];
  const baseline = runRenderer(args);
  const compact = runRenderer(args.concat(['--layout', 'compact']));
  assert.strictEqual(baseline.status, 0, `baseline md render failed: ${baseline.stderr || baseline.stdout}`);
  assert.strictEqual(compact.status, 0, `compact md render failed: ${compact.stderr || compact.stdout}`);
  assert.strictEqual(compact.stdout, baseline.stdout, 'Compact layout must be byte-identical to default md output');
}

// Test 3: referential integrity enforcement.
{
  const { inPath } = mkTempSeed('webshop');
  const d = YAML.parse(fs.readFileSync(inPath, 'utf8'));
  d.mentions[0].token_ids = ['t-does-not-exist'];
  fs.writeFileSync(inPath, YAML.stringify(d, { lineWidth: 0 }), 'utf8');
  const r = runRenderer(commonFlags(inPath));
  assert.notStrictEqual(r.status, 0, 'Renderer must fail for broken mention token reference');
  assert.match(r.stderr, /Fatal:/, 'Renderer should emit concise fatal error');
}

// Test 4: console mode vs file mode.
{
  const { inPath } = mkTempSeed('webshop');
  const outPath = path.join(path.dirname(inPath), 'dump.txt');

  const consoleMode = runRenderer(commonFlags(inPath));
  assert.strictEqual(consoleMode.status, 0, `console mode failed: ${consoleMode.stderr || consoleMode.stdout}`);
  assert.ok(consoleMode.stdout.length > 0, 'Console mode must write to stdout');
  assert.ok(!fs.existsSync(outPath), 'Console mode must not write output file');

  const fileMode = runRenderer(commonFlags(inPath).concat(['--out', outPath]));
  assert.strictEqual(fileMode.status, 0, `file mode failed: ${fileMode.stderr || fileMode.stdout}`);
  assert.strictEqual(fileMode.stdout, '', 'File mode must not write rendered content to stdout');
  assert.ok(fs.existsSync(outPath), 'File mode must write output file');
  const text = fs.readFileSync(outPath, 'utf8');
  assert.ok(text.length > 0, 'Output file must contain rendered content');
}

// Test 5: section toggles (default/no-layout path).
{
  const { inPath } = mkTempSeed('webshop');
  const r = runRenderer([
    '--in', inPath,
    '--format', 'md',
    '--segments', 'false',
    '--mentions', 'false',
    '--coverage', 'false',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(r.status, 0, `toggle render failed: ${r.stderr || r.stdout}`);
  assert.ok(r.stdout.includes('## Assertions'), 'Assertions section must always be included');
  assert.ok(!r.stdout.includes('## Segments'), 'Segments section must be omitted when disabled');
  assert.ok(!r.stdout.includes('## Mentions'), 'Mentions section must be omitted when disabled');
  assert.ok(!r.stdout.includes('## Coverage'), 'Coverage section must be omitted when disabled');
  assert.ok(!/id=/.test(r.stdout), 'Raw ids must be omitted when --debug-ids=false');
}

// Test 6: readable layout smoke tests (txt + md).
{
  const { inPath } = mkTempSeed('webshop');
  const txt = runRenderer(commonFlags(inPath).concat(['--layout', 'readable']));
  assert.strictEqual(txt.status, 0, `readable txt failed: ${txt.stderr || txt.stdout}`);
  assert.ok(txt.stdout.includes('\nAssertions\n'), 'Readable txt should include Assertions section');
  assert.ok(txt.stdout.includes('\nAssertion 1:'), 'Readable txt should include assertion block headers');
  assert.ok(txt.stdout.includes('\npred: '), 'Readable txt should include pred lines');

  const md = runRenderer([
    '--in', inPath,
    '--format', 'md',
    '--layout', 'readable',
    '--segments', 'true',
    '--mentions', 'true',
    '--coverage', 'true',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(md.status, 0, `readable md failed: ${md.stderr || md.stdout}`);
  assert.ok(md.stdout.includes('## Assertions'), 'Readable md should include Assertions section');
  assert.ok(md.stdout.includes('- pred:'), 'Readable md should include nested predicate bullets');
}

// Test 7: table layout smoke and deterministic output.
{
  const { inPath } = mkTempSeed('webshop');
  const a = runRenderer([
    '--in', inPath,
    '--format', 'md',
    '--layout', 'table',
    '--segments', 'true',
    '--mentions', 'false',
    '--coverage', 'true',
    '--debug-ids', 'true',
  ]);
  const b = runRenderer([
    '--in', inPath,
    '--format', 'md',
    '--layout', 'table',
    '--segments', 'true',
    '--mentions', 'false',
    '--coverage', 'true',
    '--debug-ids', 'true',
  ]);
  assert.strictEqual(a.status, 0, `table md failed: ${a.stderr || a.stdout}`);
  assert.strictEqual(b.status, 0, `table md repeat failed: ${b.stderr || b.stdout}`);
  assert.ok(a.stdout.includes('|'), 'Table layout should contain table delimiters');
  const tableHeader = a.stdout.split('\n').find((line) => line.startsWith('|') && line.includes('predicate') && line.includes('actor'));
  assert.ok(tableHeader && tableHeader.indexOf('actor') < tableHeader.indexOf('predicate'), 'Table layout should order actor before predicate');
  assert.strictEqual(a.stdout, b.stdout, 'Table layout output must be deterministic across repeated runs');
}

// Test 7b: apostrophe preservation in table markdown output.
{
  const { inPath } = mkTempSeed('webshop');
  const md = runRenderer([
    '--in', inPath,
    '--format', 'md',
    '--layout', 'table',
    '--segments', 'true',
    '--mentions', 'false',
    '--coverage', 'true',
    '--debug-ids', 'true',
  ]);
  assert.strictEqual(md.status, 0, `table md apostrophe render failed: ${md.stderr || md.stdout}`);
  assert.ok(md.stdout.includes('customer’s'), 'Renderer must preserve U+2019 apostrophe');
  assert.ok(!md.stdout.includes('ÔÇ'), 'Renderer must not emit mojibake sequences');
}

// Test 7c: meaning layout groups assertions and shows wiki markers when present.
{
  const { inPath } = mkTempSeed('webshop');
  const d = YAML.parse(fs.readFileSync(inPath, 'utf8'));
  const firstAssertion = d.assertions[0];
  d.wiki_title_evidence = d.wiki_title_evidence || {
    normalization: {
      unicode_form: 'NFKC',
      punctuation_map: { apostrophes: 'x', dashes: 'y' },
      whitespace: 'collapse_spaces_trim',
      casefold: 'toLowerCase',
    },
    mention_matches: [],
    assertion_predicate_matches: [],
  };
  d.wiki_title_evidence.assertion_predicate_matches = [{
    assertion_id: firstAssertion.id,
    predicate_mention_id: firstAssertion.predicate.mention_id,
    exact_titles: ['X'],
    prefix_titles: [],
  }];
  fs.writeFileSync(inPath, YAML.stringify(d, { lineWidth: 0 }), 'utf8');
  const out = runRenderer([
    '--in', inPath,
    '--format', 'md',
    '--layout', 'meaning',
    '--segments', 'true',
    '--mentions', 'false',
    '--coverage', 'true',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(out.status, 0, `meaning layout render failed: ${out.stderr || out.stdout}`);
  assert.ok(out.stdout.includes('### Definitions') || out.stdout.includes('### Requirements') || out.stdout.includes('### Actions'), 'meaning layout should include grouped sections');
  assert.ok(out.stdout.includes('Actor | Predicate | Theme | Attr | Location | wiki⁺'), 'meaning layout should include the semantic row header');
  assert.ok(out.stdout.includes('wiki✓'), 'meaning layout should surface wiki summary marker when matches are present');
  assert.ok(out.stdout.toLowerCase().includes('take'), 'meaning layout should include take action');
  assert.ok(out.stdout.toLowerCase().includes('complete'), 'meaning layout should include complete action');
}

// Test 7d: wiki markers are rendered across all layouts and formats.
{
  const { inPath } = mkTempSeed('webshop');
  writeInlineWikiFixture(inPath, true);
  const layouts = ['compact', 'readable', 'table', 'meaning'];
  const formats = ['txt', 'md'];
  for (const layout of layouts) {
    for (const format of formats) {
      const out = runRenderer([
        '--in', inPath,
        '--format', format,
        '--layout', layout,
        '--segments', 'true',
        '--mentions', 'true',
        '--coverage', 'true',
        '--debug-ids', 'false',
      ]);
      assert.strictEqual(out.status, 0, `${layout}/${format} render failed: ${out.stderr || out.stdout}`);
      assert.ok(/⟦build\\?\|wiki:exact⟧/.test(out.stdout), `${layout}/${format} should show predicate exact marker`);
      assert.ok(/⟦shop\\?\|wiki:prefix⟧/.test(out.stdout), `${layout}/${format} should show prefix marker`);
      assert.ok(/⟦cart\\?\|wiki:exact⟧/.test(out.stdout), `${layout}/${format} should show mention exact marker`);
      assert.ok(!out.stdout.includes('⟦plain|wiki:'), `${layout}/${format} should keep plain text unchanged when no evidence`);
      assert.ok(!out.stdout.includes('wiki:exact⟧|wiki:prefix'), `${layout}/${format} should not duplicate exact/prefix marker`);
      const segmentLine = out.stdout.split('\n').find((line) => line.includes('SegmentText:'));
      assert.ok(segmentLine && !segmentLine.includes('⟦'), `${layout}/${format} SegmentText must remain unwrapped`);
    }
  }
}

// Test 7e: no wiki evidence yields no markers across layouts/formats.
{
  const { inPath } = mkTempSeed('webshop');
  writeInlineWikiFixture(inPath, false);
  const layouts = ['compact', 'readable', 'table', 'meaning'];
  const formats = ['txt', 'md'];
  for (const layout of layouts) {
    for (const format of formats) {
      const out = runRenderer([
        '--in', inPath,
        '--format', format,
        '--layout', layout,
        '--segments', 'true',
        '--mentions', 'true',
        '--coverage', 'true',
        '--debug-ids', 'false',
      ]);
      assert.strictEqual(out.status, 0, `${layout}/${format} no-match render failed: ${out.stderr || out.stdout}`);
      assert.ok(!out.stdout.includes('wiki:exact'), `${layout}/${format} should not emit exact marker without evidence`);
      assert.ok(!out.stdout.includes('wiki:prefix'), `${layout}/${format} should not emit prefix marker without evidence`);
    }
  }
}

// Test 7f: readable/table include low predicate_quality annotation.
{
  const { inPath } = mkTempSeed('webshop');
  writeInlineWikiFixture(inPath, true);
  const readable = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'readable',
    '--segments', 'false',
    '--mentions', 'false',
    '--coverage', 'false',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(readable.status, 0, `readable predicate_quality render failed: ${readable.stderr || readable.stdout}`);
  assert.ok(readable.stdout.includes('predicate_quality=low'), 'Readable layout should annotate low predicate quality');

  const table = runRenderer([
    '--in', inPath,
    '--format', 'md',
    '--layout', 'table',
    '--segments', 'false',
    '--mentions', 'false',
    '--coverage', 'false',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(table.status, 0, `table predicate_quality render failed: ${table.stderr || table.stdout}`);
  assert.ok(table.stdout.includes('predicate_quality=low'), 'Table layout should annotate low predicate quality');
}

// Test 7g: unresolved debug output includes upstream relation pointer count, full list only in meaning layout.
{
  const { inPath } = mkTempSeed('webshop');
  writeInlineWikiFixture(inPath, false);
  const table = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'table',
    '--segments', 'false',
    '--mentions', 'false',
    '--coverage', 'true',
    '--debug-ids', 'true',
  ]);
  assert.strictEqual(table.status, 0, `table unresolved debug render failed: ${table.stderr || table.stdout}`);
  assert.ok(table.stdout.includes('upstream_relation_ids_len=1'), 'Non-meaning debug output should show upstream relation pointer count');
  assert.ok(table.stdout.includes('segment_id=s1'), 'Debug unresolved output should include segment_id');
  assert.ok(table.stdout.includes('mention_ids=[m4]'), 'Debug unresolved output should include mention_ids');
  assert.ok(table.stdout.includes('token_ids_len=1'), 'Non-meaning debug output should include token_ids length');

  const meaning = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'meaning',
    '--segments', 'false',
    '--mentions', 'false',
    '--coverage', 'true',
    '--debug-ids', 'true',
  ]);
  assert.strictEqual(meaning.status, 0, `meaning unresolved debug render failed: ${meaning.stderr || meaning.stdout}`);
  assert.ok(meaning.stdout.includes('upstream_relation_ids=[r:u1]'), 'Meaning debug output should include full upstream relation id list');
  assert.ok(meaning.stdout.includes('token_ids=[t4] token_ids_len=1'), 'Meaning debug output should include full token ids and length');
}

// Test 7h: debug output includes suppressed assertion trace lines.
{
  const { inPath } = mkTempSeed('webshop');
  writeInlineWikiFixture(inPath, false);
  const out = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'readable',
    '--segments', 'false',
    '--mentions', 'false',
    '--coverage', 'false',
    '--debug-ids', 'true',
  ]);
  assert.strictEqual(out.status, 0, `suppressed assertion debug render failed: ${out.stderr || out.stdout}`);
  assert.ok(out.stdout.includes('Suppressed Assertions'), 'Debug render should include suppressed assertions section');
  assert.ok(out.stdout.includes('kind=predicate_redirect'), 'Debug render should include suppression kind');
  assert.ok(out.stdout.includes('target_assertion_id=a1'), 'Debug render should include suppression target assertion id');
  assert.ok(out.stdout.includes('upstream_relation_ids_len=1'), 'Debug render should include upstream relation id count');
}

// Test 8: table layout suppresses globally empty columns.
{
  const { inPath } = mkTempSeed('webshop');
  const d = YAML.parse(fs.readFileSync(inPath, 'utf8'));
  const first = d.assertions[0];
  d.assertions = [
    {
      id: first.id,
      segment_id: first.segment_id,
      predicate: first.predicate,
      slots: { actor: [], theme: [], attr: [], topic: [], location: [], other: [] },
      operators: [],
      evidence: first.evidence,
    },
  ];
  fs.writeFileSync(inPath, YAML.stringify(d, { lineWidth: 0 }), 'utf8');
  const r = runRenderer([
    '--in', inPath,
    '--format', 'md',
    '--layout', 'table',
    '--segments', 'false',
    '--mentions', 'false',
    '--coverage', 'false',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(r.status, 0, `table empty-column render failed: ${r.stderr || r.stdout}`);
  const headerLine = r.stdout.split('\n').find((line) => line.startsWith('|') && line.includes('predicate'));
  assert.ok(headerLine, 'Table header must be present');
  assert.ok(headerLine.includes('predicate'), 'Predicate column must be present');
  assert.ok(!headerLine.includes('actor'), 'Globally empty actor column must be suppressed');
  assert.ok(!headerLine.includes('theme'), 'Globally empty theme column must be suppressed');
  assert.ok(!headerLine.includes('attr'), 'Globally empty attr column must be suppressed');
  assert.ok(!headerLine.includes('topic'), 'Globally empty topic column must be suppressed');
  assert.ok(!headerLine.includes('location'), 'Globally empty location column must be suppressed');
  assert.ok(!headerLine.includes('other'), 'Globally empty other column must be suppressed');
  assert.ok(!headerLine.includes('ops'), 'Globally empty ops column must be suppressed');
}

// Test 9: segment display trimming for readable/table only.
{
  const { inPath } = mkTempSeed('webshop');
  const d = YAML.parse(fs.readFileSync(inPath, 'utf8'));
  d.canonical_text = '\nAlpha\n';
  d.segments = [{ id: 's1', span: { start: 0, end: 7 } }];
  fs.writeFileSync(inPath, YAML.stringify(d, { lineWidth: 0 }), 'utf8');

  const compact = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'compact',
    '--segments', 'true',
    '--mentions', 'false',
    '--coverage', 'false',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(compact.status, 0, `compact segment trim test failed: ${compact.stderr || compact.stdout}`);
  assert.ok(compact.stdout.includes('SegmentText: "\nAlpha\n"'), 'Compact layout must preserve segment newlines');

  const readable = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'readable',
    '--segments', 'true',
    '--mentions', 'false',
    '--coverage', 'false',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(readable.status, 0, `readable segment trim test failed: ${readable.stderr || readable.stdout}`);
  assert.ok(readable.stdout.includes('SegmentText: "Alpha"'), 'Readable layout must trim leading/trailing newlines in segment text');
  assert.ok(!readable.stdout.includes('SegmentText: "\nAlpha\n"'), 'Readable layout must not keep surrounding segment newlines');

  const table = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'table',
    '--segments', 'true',
    '--mentions', 'false',
    '--coverage', 'false',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(table.status, 0, `table segment trim test failed: ${table.stderr || table.stdout}`);
  assert.ok(table.stdout.includes('SegmentText: "Alpha"'), 'Table layout must trim leading/trailing newlines in segment text');
}

// Test 10: possessive spacing normalization for readable/table only.
{
  const { inPath } = mkTempSeed('webshop');
  const d = YAML.parse(fs.readFileSync(inPath, 'utf8'));
  const poss = (d.tokens || []).find((t) => t.id === 't53');
  assert.ok(poss, 'Expected webshop token t53 for possessive marker');
  poss.surface = "'s";
  fs.writeFileSync(inPath, YAML.stringify(d, { lineWidth: 0 }), 'utf8');

  const compact = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'compact',
    '--segments', 'false',
    '--mentions', 'true',
    '--coverage', 'false',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(compact.status, 0, `compact possessive test failed: ${compact.stderr || compact.stdout}`);
  assert.ok(/customer ['’]s payment/.test(compact.stdout), 'Compact layout must keep spaced possessive form');

  const readable = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'readable',
    '--segments', 'false',
    '--mentions', 'true',
    '--coverage', 'false',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(readable.status, 0, `readable possessive test failed: ${readable.stderr || readable.stdout}`);
  assert.ok(/customer['’]s payment/.test(readable.stdout), 'Readable layout must normalize possessive spacing');
  assert.ok(!/customer ['’]s payment/.test(readable.stdout), 'Readable layout must not keep spaced possessive form');

  const table = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'table',
    '--segments', 'false',
    '--mentions', 'false',
    '--coverage', 'false',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(table.status, 0, `table possessive test failed: ${table.stderr || table.stdout}`);
  assert.ok(/customer['’]s payment/.test(table.stdout), 'Table layout must normalize possessive spacing');
}

// Test 11: renderer formats compare/quantifier/coordination-type operators deterministically.
{
  const { inPath } = mkTempSeed('webshop');
  writeInlineWikiFixture(inPath, false);
  const d = YAML.parse(fs.readFileSync(inPath, 'utf8'));
  d.assertions[0].operators = [
    { kind: 'compare_gt', token_id: 't3' },
    { kind: 'quantifier', token_id: 't1', value: 'only' },
    { kind: 'coordination_group', group_id: 'cg:test', value: 'or' },
  ];
  fs.writeFileSync(inPath, YAML.stringify(d, { lineWidth: 0 }), 'utf8');

  const out = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'readable',
    '--segments', 'false',
    '--mentions', 'false',
    '--coverage', 'false',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(out.status, 0, `operator formatting render failed: ${out.stderr || out.stdout}`);
  assert.ok(out.stdout.includes('compare_gt(t3)'), 'Readable layout should render compare operator');
  assert.ok(out.stdout.includes('quantifier(only|t1)'), 'Readable layout should render quantifier operator');
  assert.ok(out.stdout.includes('coordination_group(cg:test:or)'), 'Readable layout should render coordination type in group operator');
}

// Test 12: determiner normalization is optional and on by default.
{
  const { inPath } = mkTempSeed('webshop');
  const baseline = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'readable',
    '--segments', 'false',
    '--mentions', 'true',
    '--coverage', 'false',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(baseline.status, 0, `baseline determiner render failed: ${baseline.stderr || baseline.stdout}`);
  assert.ok(baseline.stdout.includes('(a) WebShop'), 'Default rendering should apply determiner normalization');
  assert.ok(baseline.stdout.includes('(the) shop'), 'Default rendering should parenthesize leading definite article');

  const normalized = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'readable',
    '--segments', 'false',
    '--mentions', 'true',
    '--coverage', 'false',
    '--debug-ids', 'false',
    '--normalize-determiners', 'true',
  ]);
  assert.strictEqual(normalized.status, 0, `normalized determiner render failed: ${normalized.stderr || normalized.stdout}`);
  assert.ok(normalized.stdout.includes('(a) WebShop'), 'Determiner normalization should parenthesize leading indefinite article');
  assert.ok(normalized.stdout.includes('(the) shop'), 'Determiner normalization should parenthesize leading definite article');

  const literal = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'readable',
    '--segments', 'false',
    '--mentions', 'true',
    '--coverage', 'false',
    '--debug-ids', 'false',
    '--normalize-determiners', 'false',
  ]);
  assert.strictEqual(literal.status, 0, `literal determiner render failed: ${literal.stderr || literal.stdout}`);
  assert.ok(literal.stdout.includes('A WebShop'), 'Explicit false should preserve literal determiner surface');
  assert.ok(!literal.stdout.includes('(a) WebShop'), 'Explicit false must disable determiner normalization');
}

// Test 13: coverage rendering splits uncovered into strict vs contained and supports summary counts.
{
  const { inPath } = mkTempSeed('webshop');
  writeUncoveredContainmentFixture(inPath, 'double');
  const out = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'readable',
    '--segments', 'false',
    '--mentions', 'false',
    '--coverage', 'true',
    '--debug-ids', 'false',
    '--render-uncovered-delta', 'true',
  ]);
  assert.strictEqual(out.status, 0, `uncovered split render failed: ${out.stderr || out.stdout}`);
  assert.ok(out.stdout.includes('Strictly Uncovered Primary Mentions'), 'must print strictly uncovered section');
  assert.ok(out.stdout.includes('Contained Uncovered Primary Mentions'), 'must print contained uncovered section');
  assert.ok(out.stdout.includes('Uncovered Primary Mentions Summary'), 'must print uncovered summary when flag enabled');
  assert.ok(out.stdout.includes('strictly_uncovered_count: 1'), 'summary must include strict count');
  assert.ok(out.stdout.includes('contained_uncovered_count: 2'), 'summary must include contained count');
  assert.ok(out.stdout.includes('Alpha (mention_id=m:a, contained_in=[m:abc], reason=missing_relation)'), 'contained uncovered must include used covering mention ids');
  assert.ok(out.stdout.includes('beta (mention_id=m:b, contained_in=[m:abc], reason=projection_failed)'), 'contained uncovered must include reason');
  assert.ok(out.stdout.includes('delta (mention_id=m:d, reason=missing_relation)'), 'strict uncovered must include mention id and reason');
}

// Test 14: uncovered split works with no containment (strict-only list, empty contained section).
{
  const { inPath } = mkTempSeed('webshop');
  writeUncoveredContainmentFixture(inPath, 'none');
  const out = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'compact',
    '--segments', 'false',
    '--mentions', 'false',
    '--coverage', 'true',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(out.status, 0, `uncovered no-containment render failed: ${out.stderr || out.stdout}`);
  assert.ok(out.stdout.includes('Strictly Uncovered Primary Mentions'), 'strict section should render');
  assert.ok(out.stdout.includes('Contained Uncovered Primary Mentions'), 'contained section should render');
  assert.ok(out.stdout.includes('delta (mention_id=m:d, reason=missing_relation)'), 'strict uncovered mention should render');
  assert.ok(!out.stdout.includes('contained_in=['), 'no contained entries should be rendered when none exist');
}

// Test 15: containment uses mentions actually used in assertions, including non-primary mentions.
{
  const { inPath } = mkTempSeed('webshop');
  writeUsedMentionContainmentFixture(inPath, true);
  const out = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'readable',
    '--segments', 'false',
    '--mentions', 'false',
    '--coverage', 'true',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(out.status, 0, `used-mention containment render failed: ${out.stderr || out.stdout}`);
  assert.ok(out.stdout.includes('Contained Uncovered Primary Mentions'), 'contained section should render');
  assert.ok(out.stdout.includes('small (mention_id=m:small, contained_in=[m:container], reason=missing_relation)'), 'uncovered primary mention should be contained via non-primary used mention');
  const strictBlock = out.stdout.split('Strictly Uncovered Primary Mentions')[1].split('Contained Uncovered Primary Mentions')[0];
  assert.ok(!strictBlock.includes('m:small'), 'contained uncovered mention must not be listed under strictly uncovered');
}

// Test 16: if uncovered mention is not contained in any used mention, it remains strictly uncovered.
{
  const { inPath } = mkTempSeed('webshop');
  writeUsedMentionContainmentFixture(inPath, false);
  const out = runRenderer([
    '--in', inPath,
    '--format', 'txt',
    '--layout', 'readable',
    '--segments', 'false',
    '--mentions', 'false',
    '--coverage', 'true',
    '--debug-ids', 'false',
  ]);
  assert.strictEqual(out.status, 0, `used-mention non-containment render failed: ${out.stderr || out.stdout}`);
  assert.ok(out.stdout.includes('Strictly Uncovered Primary Mentions'), 'strict section should render');
  assert.ok(out.stdout.includes('small (mention_id=m:small, reason=missing_relation)'), 'uncovered mention should remain strictly uncovered');
  assert.ok(!out.stdout.includes('contained_in=[m:container]'), 'non-contained mention must not be marked as contained');
}

console.log('render-elementary-assertions tests passed.');
