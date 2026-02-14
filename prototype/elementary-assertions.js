// Usage:
// node elementary-assertions.js --seed-id <id> [--artifacts-root <path>] [--wti-endpoint <url>] [--timeout-ms <ms>]
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const {
  usage,
  arg,
  readText,
  loadLinguisticEnricher,
  readSchemaVersion,
  normalizeOptionalString,
  ensureWtiEndpointReachable,
  buildSourceInputs,
  buildRunOptions,
  buildPipelineTrace,
  assertMandatoryWtiEndpoint,
  assertMandatoryWtiUpstreamEvidence,
} = require('./elementary-assertions/io');
const { sha256Hex } = require('./elementary-assertions/determinism');
const { buildTokenIndex, buildTokenWikiById } = require('./elementary-assertions/tokens');
const {
  hasPositiveWikiSignal,
  roleToSlot,
  chooseBestMentionForToken,
  buildAcceptedAnnotationsInventory,
  buildMentions,
} = require('./elementary-assertions/mentions');
const { collectStep11Relations, buildProjectedRelations } = require('./elementary-assertions/projection');
const {
  isLowQualityPredicateToken,
  choosePredicateUpgradeCandidate,
  mergeModalityCopulaAssertions,
  buildAssertions,
} = require('./elementary-assertions/assertions');
const {
  buildUnresolved,
  buildSubjectRoleGaps,
  buildDiagnostics,
  collectWikiFieldDiagnostics,
  analyzeUpstreamWikiEvidence,
} = require('./elementary-assertions/diagnostics');
const {
  buildWikiTitleEvidenceFromUpstream,
  buildCoverageDomainMentionIds,
  buildOutput,
  buildCoverageAudit,
} = require('./elementary-assertions/output');

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

if (require.main === module) {
  main();
}

module.exports = {
  analyzeUpstreamWikiEvidence,
  collectWikiFieldDiagnostics,
  buildRunOptions,
  hasPositiveWikiSignal,
  assertMandatoryWtiUpstreamEvidence,
  isLowQualityPredicateToken,
  chooseBestMentionForToken,
  choosePredicateUpgradeCandidate,
  mergeModalityCopulaAssertions,
  buildAssertions,
  buildUnresolved,
  buildCoverageAudit,
  buildSubjectRoleGaps,
  roleToSlot,
};
