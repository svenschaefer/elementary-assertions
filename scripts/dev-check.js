const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const { parseArgs, resolveArtifactsRoot, resolveSeedIds } = require("./dev-artifacts");

const { validateElementaryAssertions } = require("../src/validate");

function loadStructuredFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (filePath.endsWith(".json")) return JSON.parse(raw);
  return yaml.load(raw);
}

function collectGoldenYamlPaths(artifactsRoot) {
  const out = [];
  const entries = fs.readdirSync(artifactsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(artifactsRoot, entry.name, "result-reference", "seed.elementary-assertions.yaml");
    if (fs.existsSync(filePath)) out.push(filePath);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function resolveTargets(args) {
  if (typeof args.in === "string" && args.in.length > 0) {
    return [path.resolve(args.in)];
  }
  const repoRoot = path.resolve(__dirname, "..");
  const artifactsRoot = resolveArtifactsRoot(repoRoot, args);
  const seedIds = resolveSeedIds(artifactsRoot, args);
  if (seedIds.length === 1) {
    return [path.join(artifactsRoot, seedIds[0], "result-reference", "seed.elementary-assertions.yaml")];
  }
  return collectGoldenYamlPaths(artifactsRoot);
}

function inferSeedIdFromPath(targetPath) {
  const normalized = String(targetPath || "");
  const match = normalized.match(/[\\/]test[\\/]artifacts[\\/](.+?)[\\/]result-reference[\\/]/i);
  if (!match) return null;
  return String(match[1] || "") || null;
}

function normalizeInvariantFamily(code, message) {
  const codeText = String(code || "").toUpperCase();
  const messageText = String(message || "").toUpperCase();
  if (codeText.includes("SUPPRESSED")) return "SUPPRESSED_ASSERTION_COHERENCE";
  if (codeText.includes("UNRESOLVED") || codeText.includes("COVERAGE")) return "COVERAGE_UNRESOLVED_REF";
  if (codeText.includes("WIKI") || codeText.includes("WIKIPEDIA")) return "WIKIPEDIA_SIGNAL_COHERENCE";
  if (codeText.includes("WTI")) return "WTI_WIRING_COHERENCE";
  if (
    codeText.includes("DETERMINISM") ||
    codeText.includes("SORT") ||
    codeText.includes("ORDER") ||
    codeText.includes("COORDINATION") ||
    codeText.includes("WARNING")
  ) {
    return "DIAGNOSTICS_SORT";
  }
  if (
    codeText.includes("SUBJECT_GAP") ||
    codeText.includes("GAP_SIGNALS") ||
    codeText.includes("FRAGMENTATION") ||
    codeText.includes("SUPPRESSION_ELIGIBILITY") ||
    messageText.includes("DIAGNOSTICS")
  ) {
    return "DIAGNOSTICS_COHERENCE";
  }
  return "STRICT_VALIDATION";
}

function extractIdByRegex(message, patterns) {
  const text = String(message || "");
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && typeof match[1] === "string" && match[1].length > 0) return match[1];
  }
  return null;
}

function buildReproducerPointer(doc, message, seedId) {
  const mentions = Array.isArray(doc && doc.mentions) ? doc.mentions : [];
  const assertions = Array.isArray(doc && doc.assertions) ? doc.assertions : [];
  const mentionById = new Map(mentions.map((mention) => [mention && mention.id, mention]));
  const assertionById = new Map(assertions.map((assertion) => [assertion && assertion.id, assertion]));
  const mentionId = extractIdByRegex(message, [
    /\b(m:[^\s,.;)]+)/,
    /\bmention(?:_id)?\s+([A-Za-z0-9:_-]+)/i,
  ]);
  const assertionId = extractIdByRegex(message, [
    /\b(a:[^\s,.;)]+)/,
    /\bassertion(?:_id)?\s+([A-Za-z0-9:_-]+)/i,
  ]);
  const segmentIdFromText = extractIdByRegex(message, [/\bsegment(?:_id)?\s+([sS]\d+)\b/, /\b(s\d+)\b/]);
  const mention = mentionId ? mentionById.get(mentionId) : null;
  const assertion = assertionId ? assertionById.get(assertionId) : null;
  const segmentId = segmentIdFromText
    || String((mention && mention.segment_id) || "")
    || String((assertion && assertion.segment_id) || "")
    || null;
  const surface = String(
    (mention && mention.surface)
    || ((((assertion || {}).predicate) || {}).surface)
    || ""
  );
  return {
    seed_id: seedId || null,
    segment_id: segmentId,
    mention_id: mentionId || null,
    assertion_id: assertionId || null,
    surface: surface || null,
  };
}

function suggestedCommandForFamily(family, seedId) {
  const seedArg = seedId ? ` -- --seed ${seedId}` : "";
  if (family === "COVERAGE_UNRESOLVED_REF") return `npm run dev:diagnose:coverage-audit${seedArg}`;
  if (family === "SUPPRESSED_ASSERTION_COHERENCE" || family === "DIAGNOSTICS_COHERENCE" || family === "DIAGNOSTICS_SORT") {
    return `npm run dev:report:hotspots${seedArg}`;
  }
  if (family === "WIKIPEDIA_SIGNAL_COHERENCE") return `npm run dev:diagnose:wiki-upstream${seedArg}`;
  if (family === "WTI_WIRING_COHERENCE") return `npm run dev:diagnose:wti-wiring${seedArg}`;
  return `npm run dev:check${seedArg}`;
}

function main() {
  const args = parseArgs(process.argv);
  const targets = resolveTargets(args);
  if (targets.length === 0) {
    throw new Error("No validation targets found for dev:check.");
  }

  const results = [];
  const failures = [];
  for (const targetPath of targets) {
    const doc = loadStructuredFile(targetPath);
    const seedId = inferSeedIdFromPath(targetPath);
    try {
      validateElementaryAssertions(doc, { strict: true });
      results.push({ path: targetPath, seed_id: seedId, ok: true });
    } catch (err) {
      const code = String((err && err.code) || "EA_VALIDATE_UNKNOWN");
      const message = String((err && err.message) || err || "");
      const invariantFamily = normalizeInvariantFamily(code, message);
      failures.push({
        path: targetPath,
        seed_id: seedId,
        error_code: code,
        invariant_family: invariantFamily,
        reproducer: buildReproducerPointer(doc, message, seedId),
        recommended_next_command: suggestedCommandForFamily(invariantFamily, seedId),
      });
      results.push({ path: targetPath, seed_id: seedId, ok: false, error_code: code });
    }
  }

  if (failures.length > 0) {
    const firstFailureByFamily = new Map();
    for (const failure of failures) {
      if (!firstFailureByFamily.has(failure.invariant_family)) {
        firstFailureByFamily.set(failure.invariant_family, failure);
      }
    }
    const failingFamilies = Array.from(firstFailureByFamily.keys())
      .sort((a, b) => a.localeCompare(b))
      .map((family) => firstFailureByFamily.get(family));
    const report = {
      mode: "strict",
      validated_count: results.filter((result) => result.ok === true).length,
      failed_count: failures.length,
      failing_families: failingFamilies,
      targets: results,
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(1);
  }

  const report = {
    mode: "strict",
    validated_count: results.length,
    targets: results,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main();
