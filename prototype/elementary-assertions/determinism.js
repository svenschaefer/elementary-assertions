const crypto = require('crypto');

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

function findSelector(annotation, type) {
  if (!annotation || !annotation.anchor || !Array.isArray(annotation.anchor.selectors)) return null;
  return annotation.anchor.selectors.find((s) => s && s.type === type) || null;
}

function normalizeSpanKey(span) {
  return `${span.start}-${span.end}`;
}

function normalizeIds(ids) {
  return Array.from(new Set(ids)).sort();
}

function canonicalizeSlotObject(slots) {
  const out = {
    actor: normalizeIds((slots && slots.actor) || []),
    theme: normalizeIds((slots && slots.theme) || []),
    attr: normalizeIds((slots && slots.attr) || []),
    topic: normalizeIds((slots && slots.topic) || []),
    location: normalizeIds((slots && slots.location) || []),
    other: Array.isArray(slots && slots.other)
      ? slots.other
        .map((o) => ({
          role: String((o && o.role) || ''),
          mention_ids: normalizeIds((o && o.mention_ids) || []),
        }))
        .sort((a, b) => {
          if (a.role !== b.role) return a.role.localeCompare(b.role);
          return JSON.stringify(a.mention_ids).localeCompare(JSON.stringify(b.mention_ids));
        })
      : [],
  };
  return out;
}

function canonicalizeOperatorsForHash(ops) {
  return (ops || [])
    .map((op) => ({
      kind: op.kind,
      value: op.value || undefined,
      token_id: op.token_id || undefined,
      group_id: op.group_id || undefined,
      evidence: dedupeAndSortEvidence(op.evidence || []),
    }))
    .sort((a, b) => {
      if (String(a.kind || '') !== String(b.kind || '')) return String(a.kind || '').localeCompare(String(b.kind || ''));
      if (String(a.value || '') !== String(b.value || '')) return String(a.value || '').localeCompare(String(b.value || ''));
      if (String(a.token_id || '') !== String(b.token_id || '')) return String(a.token_id || '').localeCompare(String(b.token_id || ''));
      if (String(a.group_id || '') !== String(b.group_id || '')) return String(a.group_id || '').localeCompare(String(b.group_id || ''));
      return JSON.stringify(a.evidence || []).localeCompare(JSON.stringify(b.evidence || []));
    });
}

function stableObjectKey(obj) {
  const keys = Object.keys(obj || {}).sort();
  return keys.map((k) => `${k}:${JSON.stringify(obj[k])}`).join('|');
}

function deepCloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

const UNRESOLVED_REASON_PRECEDENCE = [
  'predicate_invalid',
  'coord_type_missing',
  'operator_scope_open',
  'missing_relation',
  'projection_failed',
];


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


module.exports = {
  sha256Hex,
  findSelector,
  normalizeSpanKey,
  normalizeIds,
  canonicalizeSlotObject,
  canonicalizeOperatorsForHash,
  stableObjectKey,
  deepCloneJson,
  UNRESOLVED_REASON_PRECEDENCE,
  evidenceSortKey,
  dedupeAndSortEvidence,
};
