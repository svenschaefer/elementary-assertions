const fs = require('fs');
const path = require('path');
const { hasPositiveWikiSignal } = require('./mentions');
const crypto = require('crypto');
const YAML = require('yaml');

function usage() {
  console.error(
    'Usage: node elementary-assertions.js --seed-id <id> [--artifacts-root <path>] [--wti-endpoint <url>] [--timeout-ms <ms>] [--relations-seed-path <json>] [--diagnose-wiki-upstream] [--diagnose-wti-wiring] [--diagnose-coverage-audit]'
  );
}

function arg(args, name) {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return null;
  return args[i + 1];
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

function readText(filePath, label) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Error reading ${label}: ${err && err.message ? err.message : String(err)}`);
  }
}

function loadLinguisticEnricher() {
  try {
    return require('linguistic-enricher');
  } catch (err) {
    throw new Error(
      'Unable to load linguistic-enricher. Install it in the project root (npm i linguistic-enricher).'
    );
  }
}

function readSchemaVersion(artifactsRoot) {
  const schemaPath = path.join(artifactsRoot, 'seed.schema.json');
  const schema = JSON.parse(readText(schemaPath, 'seed.schema.json'));
  if (!schema || typeof schema.schema_version !== 'string' || schema.schema_version.length === 0) {
    throw new Error('seed.schema.json missing schema_version');
  }
  return schema.schema_version;
}

function normalizeOptionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function effectiveTimeoutMs(timeoutMs) {
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 3000;
}

async function ensureWtiEndpointReachable(endpoint, timeoutMs) {
  const normalized = normalizeOptionalString(endpoint);
  if (!normalized) return;
  const url = `${normalized.replace(/\/$/, '')}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs(timeoutMs));
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    throw new Error(`wikipedia-title-index health check failed for ${url}: ${detail}`);
  } finally {
    clearTimeout(timer);
  }
}


function buildSourceInputs(seedDir) {
  const seedTxtPath = path.join(seedDir, 'seed.txt');
  if (!fs.existsSync(seedTxtPath)) {
    throw new Error(`Missing input seed.txt at ${seedTxtPath}`);
  }
  const seedTxt = fs.readFileSync(seedTxtPath, 'utf8');
  return [
    { artifact: 'seed.txt', digest: sha256Hex(seedTxt) },
  ];
}

function buildRunOptions({ wtiEndpoint, timeoutMs }) {
  const runOptions = {
    target: 'relations_extracted',
  };
  if (wtiEndpoint) {
    runOptions.services = { 'wikipedia-title-index': { endpoint: wtiEndpoint } };
  }
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    runOptions.timeoutMs = timeoutMs;
  }
  return runOptions;
}

function buildPipelineTrace(relationsSeed, runOptions, wtiEndpoint) {
  return {
    target: String(runOptions && runOptions.target ? runOptions.target : ''),
    relations_extracted_digest: sha256Hex(JSON.stringify(relationsSeed || {})),
    token_count: Array.isArray(relationsSeed && relationsSeed.tokens) ? relationsSeed.tokens.length : 0,
    annotation_count: Array.isArray(relationsSeed && relationsSeed.annotations) ? relationsSeed.annotations.length : 0,
    wikipedia_title_index_configured: Boolean(normalizeOptionalString(wtiEndpoint)),
  };
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

module.exports = {
  usage,
  arg,
  readText,
  loadLinguisticEnricher,
  readSchemaVersion,
  normalizeOptionalString,
  effectiveTimeoutMs,
  ensureWtiEndpointReachable,
  buildSourceInputs,
  buildRunOptions,
  buildPipelineTrace,
  assertMandatoryWtiEndpoint,
  assertMandatoryWtiUpstreamEvidence,
};
