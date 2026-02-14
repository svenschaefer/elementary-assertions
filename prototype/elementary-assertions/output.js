const { normalizeIds, sha256Hex } = require('./determinism');
const { normalizeWikiSurface, hasPositiveWikiSignal } = require('./mentions');
const { getTokenWikipediaEvidence, getTokenMetadataProjection } = require('./tokens');

function mentionSurfaceText(mention, tokenById, canonicalText) {
  if (!mention) return '';
  if (mention.span && typeof mention.span.start === 'number' && typeof mention.span.end === 'number') {
    return String(canonicalText || '').slice(mention.span.start, mention.span.end);
  }
  const tokens = (mention.token_ids || []).map((id) => tokenById.get(id)).filter(Boolean).sort((a, b) => a.i - b.i);
  return tokens.map((t) => t.surface).join(' ');
}

function assertMandatoryWtiEndpoint(endpoint) {
  if (!normalizeOptionalString(endpoint)) {
    throw new Error('WTI endpoint is required for Step 12 (wikipedia-title-index service).');
  }
}

function assertMandatoryWtiUpstreamEvidence(relationsSeed) {
  const tokens = Array.isArray(relationsSeed && relationsSeed.tokens) ? relationsSeed.tokens : [];
  let carrierCount = 0;
  let positiveCount = 0;
  for (const token of tokens) {
    if (!token || !token.lexicon || typeof token.lexicon !== 'object') continue;
    if (!Object.prototype.hasOwnProperty.call(token.lexicon, 'wikipedia_title_index')) continue;
    const carrier = token.lexicon.wikipedia_title_index;
    if (!carrier || typeof carrier !== 'object' || Array.isArray(carrier)) {
      throw new Error('WTI evidence missing: linguistic-enricher produced no positive wikipedia_title_index signals.');
    }
    carrierCount += 1;
    if (hasPositiveWikiSignal(carrier)) positiveCount += 1;
  }
  if (carrierCount === 0 || positiveCount === 0) {
    throw new Error('WTI evidence missing: linguistic-enricher produced no positive wikipedia_title_index signals.');
  }
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

function mergeWikiTitlesInto(target, evidence) {
  if (!target || !evidence || typeof evidence !== 'object') return;
  const exactTitles = Array.isArray(evidence.exact_titles) ? evidence.exact_titles : [];
  const prefixTitles = Array.isArray(evidence.prefix_titles) ? evidence.prefix_titles : [];
  for (const title of exactTitles) {
    if (typeof title !== 'string') continue;
    if (!target._exactSeen.has(title)) {
      target._exactSeen.add(title);
      target.exact_titles.push(title);
    }
  }
  for (const title of prefixTitles) {
    if (typeof title !== 'string') continue;
    if (!target._prefixSeen.has(title)) {
      target._prefixSeen.add(title);
      target.prefix_titles.push(title);
    }
  }
}

function buildWikiTitleEvidenceFromUpstream({ mentions, assertions, tokenById, canonicalText }) {
  const mentionById = new Map((mentions || []).map((m) => [m.id, m]));
  const primaryMentionIds = (mentions || []).filter((m) => m && m.is_primary).map((m) => m.id);
  const predicateMentionIds = (assertions || []).map((a) => a && a.predicate && a.predicate.mention_id).filter(Boolean);
  const targetMentionIds = normalizeIds(primaryMentionIds.concat(predicateMentionIds));

  const byMention = [];
  for (const mentionId of targetMentionIds) {
    const mention = mentionById.get(mentionId);
    if (!mention) continue;
    const aggregate = {
      exact_titles: [],
      prefix_titles: [],
      _exactSeen: new Set(),
      _prefixSeen: new Set(),
    };
    const lexiconEvidence =
      mention.provenance &&
      mention.provenance.lexicon_evidence &&
      typeof mention.provenance.lexicon_evidence === 'object'
        ? mention.provenance.lexicon_evidence
        : null;
    if (lexiconEvidence && lexiconEvidence.mwe && typeof lexiconEvidence.mwe === 'object') {
      mergeWikiTitlesInto(aggregate, lexiconEvidence.mwe);
    }
    const tokenEvidence = lexiconEvidence && Array.isArray(lexiconEvidence.tokens) ? lexiconEvidence.tokens : [];
    for (const entry of tokenEvidence) {
      if (!entry || !entry.evidence || typeof entry.evidence !== 'object') continue;
      mergeWikiTitlesInto(aggregate, entry.evidence);
    }
    const surface = mentionSurfaceText(mention, tokenById, canonicalText);
    byMention.push({
      mention_id: mentionId,
      normalized_surface: normalizeWikiSurface(surface),
      exact_titles: aggregate.exact_titles,
      prefix_titles: aggregate.prefix_titles,
    });
  }
  byMention.sort((a, b) => a.mention_id.localeCompare(b.mention_id));

  const byAssertion = [];
  const byMentionMap = new Map(byMention.map((x) => [x.mention_id, x]));
  for (const a of assertions || []) {
    if (!a || typeof a.id !== 'string') continue;
    const m = byMentionMap.get(a.predicate && a.predicate.mention_id);
    if (!m) continue;
    byAssertion.push({
      assertion_id: a.id,
      predicate_mention_id: a.predicate.mention_id,
      exact_titles: Array.isArray(m.exact_titles) ? m.exact_titles : [],
      prefix_titles: Array.isArray(m.prefix_titles) ? m.prefix_titles : [],
    });
  }
  byAssertion.sort((a, b) => a.assertion_id.localeCompare(b.assertion_id));

  return {
    normalization: {
      unicode_form: 'NFKC',
      punctuation_map: { apostrophes: "['\\u2018\\u2019\\u02bc]->'", dashes: '[\\u2010-\\u2015]->-' },
      whitespace: 'collapse_spaces_trim',
      casefold: 'toLowerCase',
    },
    mention_matches: byMention,
    assertion_predicate_matches: byAssertion,
  };
}

function isContentPosTag(tag) {
  if (!tag || typeof tag !== 'string') return false;
  return /^(NN|NNS|NNP|NNPS|VB|VBD|VBG|VBN|VBP|VBZ|JJ|JJR|JJS|RB|RBR|RBS|CD|PRP|PRP\$|FW|UH)$/.test(tag);
}

function isPunctuationSurface(surface) {
  if (typeof surface !== 'string' || surface.length === 0) return false;
  return /^[\p{P}\p{S}]+$/u.test(surface);
}

function buildCoverageDomainMentionIds(mentions, tokenById) {
  const ids = [];
  for (const m of mentions) {
    if (!m.is_primary) continue;
    const headTok = tokenById.get(m.head_token_id);
    if (!headTok) continue;
    const tag = headTok.pos && typeof headTok.pos.tag === 'string' ? headTok.pos.tag : '';
    if (!isContentPosTag(tag)) continue;
    if (isPunctuationSurface(headTok.surface)) continue;
    ids.push(m.id);
  }
  return ids.sort();
}

function buildOutput({
  schemaVersion,
  relationsSeed,
  mentions,
  assertions,
  coveredMentions,
  unresolved,
  sourceInputs,
  pipelineTrace,
  acceptedAnnotations,
  diagnostics,
  projectedBuild,
  wikiTitleEvidence,
}) {
  const tokenById = new Map((relationsSeed.tokens || []).map((t) => [t.id, t]));
  const coverageDomain = new Set(buildCoverageDomainMentionIds(mentions, tokenById));
  const primary = Array.from(coverageDomain).sort();
  const covered = Array.from(coveredMentions).filter((id) => coverageDomain.has(id)).sort();
  const uncovered = primary.filter((id) => !coveredMentions.has(id));

  const normalizedSegments = (relationsSeed.segments || []).map((s) => ({
    id: s.id,
    span: { start: s.span.start, end: s.span.end },
    token_range: {
      start: s.token_range && typeof s.token_range.start === 'number' ? s.token_range.start : 0,
      end: s.token_range && typeof s.token_range.end === 'number' ? s.token_range.end : 0,
    },
  }));
  const normalizedTokens = (relationsSeed.tokens || []).map((t) => {
    const wikiEvidence = getTokenWikipediaEvidence(t);
    const tokenMeta = getTokenMetadataProjection(t);
    return {
      id: t.id,
      i: t.i,
      segment_id: t.segment_id,
      span: { start: t.span.start, end: t.span.end },
      surface: t.surface,
      ...(t.pos && typeof t.pos.tag === 'string'
        ? { pos: { tag: t.pos.tag, ...(typeof t.pos.coarse === 'string' ? { coarse: t.pos.coarse } : {}) } }
        : {}),
      ...tokenMeta,
      ...(wikiEvidence ? { lexicon: { wikipedia_title_index: wikiEvidence } } : {}),
    };
  });

  return {
    schema_version: schemaVersion,
    seed_id: relationsSeed.seed_id,
    stage: 'elementary_assertions',
    index_basis: { text_field: 'canonical_text', span_unit: 'utf16_code_units' },
    canonical_text: relationsSeed.canonical_text,
    segments: normalizedSegments,
    tokens: normalizedTokens,
    mentions,
    assertions,
    relation_projection: {
      all_relations: projectedBuild.all || [],
      projected_relations: (projectedBuild.projected || []).map((r) => ({
        relation_id: r.relation_id,
        label: r.label,
        segment_id: r.segment_id,
        head_token_id: r.head_token_id,
        dep_token_id: r.dep_token_id,
        head_mention_id: r.head_mention_id,
        dep_mention_id: r.dep_mention_id,
      })),
      dropped_relations: projectedBuild.dropped || [],
    },
    accepted_annotations: acceptedAnnotations,
    wiki_title_evidence: wikiTitleEvidence,
    diagnostics,
    coverage: {
      primary_mention_ids: primary,
      covered_primary_mention_ids: covered,
      uncovered_primary_mention_ids: uncovered,
      unresolved,
    },
    sources: {
      inputs: sourceInputs,
      pipeline: pipelineTrace,
    },
  };
}

function buildCoverageAudit(output) {
  const mentions = Array.isArray(output && output.mentions) ? output.mentions : [];
  const coverage = (((output || {}).coverage) || {});
  const primaryIds = normalizeIds(Array.isArray(coverage.primary_mention_ids) ? coverage.primary_mention_ids : []);
  const coveredIds = new Set(normalizeIds(Array.isArray(coverage.covered_primary_mention_ids) ? coverage.covered_primary_mention_ids : []));
  const assertions = Array.isArray(output && output.assertions) ? output.assertions : [];
  const unresolved = Array.isArray(coverage.unresolved) ? coverage.unresolved : [];
  const suppressed = Array.isArray((((output || {}).diagnostics) || {}).suppressed_assertions)
    ? output.diagnostics.suppressed_assertions
    : [];
  const mentionById = new Map(mentions.map((m) => [m.id, m]));
  const unresolvedByMention = new Map();
  for (const u of unresolved) {
    if (!u || typeof u.mention_id !== 'string') continue;
    unresolvedByMention.set(u.mention_id, String(u.reason || 'other'));
  }

  const coveredBy = new Map();
  function addMechanism(mid, mechanism) {
    if (!mid || !mechanism) return;
    if (!coveredBy.has(mid)) coveredBy.set(mid, new Set());
    coveredBy.get(mid).add(mechanism);
  }

  for (const a of assertions) {
    if (!a || typeof a !== 'object') continue;
    const argEntries = Array.isArray(a.arguments) ? a.arguments : [];
    const modEntries = Array.isArray(a.modifiers) ? a.modifiers : [];
    if (argEntries.length > 0 || modEntries.length > 0) {
      for (const entry of argEntries) {
        for (const mid of entry.mention_ids || []) addMechanism(mid, 'slot');
      }
      for (const entry of modEntries) {
        for (const mid of entry.mention_ids || []) addMechanism(mid, 'slot');
      }
    } else {
      const slots = a.slots || {};
      for (const slotName of ['actor', 'theme', 'attr', 'topic', 'location']) {
        for (const mid of slots[slotName] || []) addMechanism(mid, 'slot');
      }
      for (const entry of slots.other || []) {
        for (const mid of entry.mention_ids || []) addMechanism(mid, 'slot');
      }
    }
    for (const op of a.operators || []) {
      const tid = String((op && op.token_id) || '');
      if (!tid) continue;
      for (const m of mentions) {
        if (!m || !primaryIds.includes(m.id)) continue;
        if ((m.token_ids || []).includes(tid)) addMechanism(m.id, 'operator');
      }
    }
    const evTokenIds = normalizeIds((((a || {}).evidence) || {}).token_ids || []);
    if (evTokenIds.length > 0) {
      for (const m of mentions) {
        if (!m || !primaryIds.includes(m.id)) continue;
        const hasEvidence = (m.token_ids || []).some((tid) => evTokenIds.includes(tid));
        if (hasEvidence) addMechanism(m.id, 'evidence');
      }
    }
  }
  for (const s of suppressed) {
    for (const mid of s.transferred_mention_ids || []) addMechanism(mid, 'transfer');
  }

  const primaryMentions = mentions
    .filter((m) => m && primaryIds.includes(m.id))
    .slice()
    .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
  const rows = primaryMentions.map((m) => {
    const mechanisms = normalizeIds(Array.from(coveredBy.get(m.id) || []));
    const covered = coveredIds.has(m.id);
    return {
      mention_id: m.id,
      covered,
      covered_by: covered ? mechanisms : [],
      uncovered_reason: covered ? null : (unresolvedByMention.get(m.id) || 'other'),
    };
  });
  return rows;
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const seedId = arg(args, '--seed-id');
    const diagnoseWikiUpstream = args.includes('--diagnose-wiki-upstream');
    const diagnoseWtiWiring = args.includes('--diagnose-wti-wiring');
    const diagnoseCoverageAudit = args.includes('--diagnose-coverage-audit');
    const artifactsRoot = arg(args, '--artifacts-root') || path.resolve(__dirname, '..', 'artifacts');
    const relationsSeedPath = normalizeOptionalString(arg(args, '--relations-seed-path') || '');
    // Precedence: explicit CLI endpoint overrides environment endpoint.
    const wtiEndpoint = normalizeOptionalString(arg(args, '--wti-endpoint') || process.env.WIKIPEDIA_TITLE_INDEX_ENDPOINT || '');
    const timeoutMsArg = arg(args, '--timeout-ms');
    const timeoutMs = timeoutMsArg ? Number(timeoutMsArg) : null;

    if (!seedId) {
      usage();
      process.exit(2);
    }

    const seedDir = path.join(artifactsRoot, seedId, 'seed');
    const outputPath = path.join(seedDir, 'seed.elementary-assertions.yaml');
    const seedTextPath = path.join(seedDir, 'seed.txt');

    if (!fs.existsSync(seedTextPath)) {
      throw new Error(`Missing input seed.txt at ${seedTextPath}`);
    }
    const seedText = readText(seedTextPath, 'seed.txt');
    const runOptions = buildRunOptions({ wtiEndpoint, timeoutMs });
    const passedToRunPipeline = Boolean(
      runOptions.services &&
      runOptions.services['wikipedia-title-index'] &&
      normalizeOptionalString(runOptions.services['wikipedia-title-index'].endpoint)
    );
    if (diagnoseWtiWiring) {
      const missingMandatory = !wtiEndpoint;
      process.stdout.write(
        `${JSON.stringify(
          {
            seed_id: seedId,
            wti_endpoint_configured: Boolean(wtiEndpoint),
            endpoint_value: wtiEndpoint || '',
            passed_to_runPipeline: passedToRunPipeline,
            ...(missingMandatory
              ? { mandatory_error: 'WTI endpoint is required for Step 12 (wikipedia-title-index service).' }
              : {}),
          },
          null,
          2
        )}\n`
      );
      if (missingMandatory) process.exit(1);
      return;
    }
    let relationsSeed = null;
    if (relationsSeedPath) {
      const raw = readText(relationsSeedPath, 'relations seed');
      try {
        relationsSeed = JSON.parse(raw);
      } catch (err) {
        throw new Error(`Failed to parse --relations-seed-path JSON: ${err && err.message ? err.message : String(err)}`);
      }
    } else {
      const linguisticEnricher = loadLinguisticEnricher();
      assertMandatoryWtiEndpoint(wtiEndpoint);
      await ensureWtiEndpointReachable(wtiEndpoint, timeoutMs);
      relationsSeed = await linguisticEnricher.runPipeline(seedText, runOptions);
      assertMandatoryWtiUpstreamEvidence(relationsSeed);
    }
    if (diagnoseWikiUpstream) {
      const summary = analyzeUpstreamWikiEvidence(relationsSeed);
      const out = {
        seed_id: seedId,
        evidence_definition: summary.evidence_definition,
        total_mentions: summary.total_mentions,
        mentions_with_wiki_evidence: summary.mentions_with_wiki_evidence,
        mentions_without_wiki_evidence: summary.mentions_without_wiki_evidence,
        total_predicates: summary.total_predicates,
        predicates_with_wiki_evidence: summary.predicates_with_wiki_evidence,
        predicates_without_wiki_evidence: summary.predicates_without_wiki_evidence,
        sample_missing_mention_ids: summary.sample_missing_mention_ids,
        sample_missing_predicate_ids: summary.sample_missing_predicate_ids,
        wiki_related_fields: summary.wiki_related_fields,
      };
      process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
      return;
    }
    const allAnnotations = Array.isArray(relationsSeed.annotations) ? relationsSeed.annotations : [];
    const mweSeed = {
      annotations: allAnnotations.filter((a) => a && a.kind === 'mwe' && a.status === 'accepted'),
    };
    const headsSeed = {
      annotations: allAnnotations.filter(
        (a) =>
          a &&
          a.status === 'accepted' &&
          (a.kind === 'chunk' || a.kind === 'chunk_head')
      ),
    };

    const schemaVersion = readSchemaVersion(artifactsRoot);
    const tokenById = buildTokenIndex(relationsSeed);
    const tokenWikiById = buildTokenWikiById(relationsSeed);
    const acceptedAnnotations = buildAcceptedAnnotationsInventory(relationsSeed);
    const step11Relations = collectStep11Relations(relationsSeed, tokenById);

    const mentionBuild = buildMentions({
      relationsSeed,
      mweSeed,
      headsSeed,
      tokenById,
      tokenWikiById,
    });
    const mentionById = new Map(mentionBuild.mentions.map((m) => [m.id, m]));
    const projectedBuild = buildProjectedRelations(
      step11Relations,
      mentionBuild.tokenToPrimaryMention,
      mentionBuild.tokenToAllMentions,
      mentionById,
      tokenById
    );
    const assertionBuild = buildAssertions({
      projected: projectedBuild.projected,
      mentionById,
      tokenById,
    });
    const coveragePrimaryMentionIds = buildCoverageDomainMentionIds(mentionBuild.mentions, tokenById);
    const uncoveredPrimaryMentionIds = coveragePrimaryMentionIds.filter((id) => !assertionBuild.coveredMentions.has(id));
    const unresolved = buildUnresolved({
      mentions: mentionBuild.mentions,
      unresolvedHeadMap: mentionBuild.unresolvedHeadMap,
      projectedUnresolved: projectedBuild.unresolved,
      mentionById,
      assertions: assertionBuild.assertions,
      projected: projectedBuild.projected,
      uncoveredPrimaryMentionIds,
    });
    const sourceInputs = buildSourceInputs(seedDir);
    sourceInputs.push({ artifact: 'relations_extracted.in_memory', digest: sha256Hex(JSON.stringify(relationsSeed || {})) });
    if (sourceInputs.length === 0) {
      throw new Error('No input artifacts found for sources.inputs');
    }
    const pipelineTrace = buildPipelineTrace(relationsSeed, runOptions, wtiEndpoint);
    const wikiTitleEvidence = buildWikiTitleEvidenceFromUpstream({
      mentions: mentionBuild.mentions,
      assertions: assertionBuild.assertions,
      tokenById,
      canonicalText: relationsSeed.canonical_text,
    });
    const diagnostics = buildDiagnostics({
      tokenWikiById,
      mentions: mentionBuild.mentions,
      assertions: assertionBuild.assertions,
      projectedBuild,
      relationsSeed,
      wtiEndpoint,
      suppressedAssertions: assertionBuild.suppressedAssertions,
    });

    const output = buildOutput({
      schemaVersion,
      relationsSeed,
      mentions: mentionBuild.mentions,
      assertions: assertionBuild.assertions,
      coveredMentions: assertionBuild.coveredMentions,
      unresolved,
      sourceInputs,
      pipelineTrace,
      acceptedAnnotations,
      diagnostics,
      projectedBuild,
      wikiTitleEvidence,
    });

    if (diagnoseCoverageAudit) {
      const auditRows = buildCoverageAudit(output);
      process.stdout.write(
        `${JSON.stringify(
          {
            seed_id: seedId,
            primary_count: auditRows.length,
            covered_count: auditRows.filter((r) => r.covered).length,
            uncovered_count: auditRows.filter((r) => !r.covered).length,
            rows: auditRows,
          },
          null,
          2
        )}\n`
      );
      return;
    }

    fs.writeFileSync(outputPath, YAML.stringify(output, { lineWidth: 0 }), 'utf8');
  } catch (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exit(1);
  }
}


module.exports = {
  mentionSurfaceText,
  mergeWikiTitlesInto,
  buildWikiTitleEvidenceFromUpstream,
  isContentPosTag,
  isPunctuationSurface,
  buildCoverageDomainMentionIds,
  buildOutput,
  buildCoverageAudit,
};
