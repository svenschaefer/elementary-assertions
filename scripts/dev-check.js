const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const { validateElementaryAssertions } = require("../src/validate");

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      out[name] = true;
      continue;
    }
    out[name] = value;
    i += 1;
  }
  return out;
}

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
    const filePath = path.join(artifactsRoot, entry.name, "prototype-reference", "seed.elementary-assertions.yaml");
    if (fs.existsSync(filePath)) out.push(filePath);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function resolveTargets(args) {
  if (typeof args.in === "string" && args.in.length > 0) {
    return [path.resolve(args.in)];
  }
  const artifactsRoot = path.resolve(args["artifacts-root"] || path.join("test", "artifacts"));
  return collectGoldenYamlPaths(artifactsRoot);
}

function main() {
  const args = parseArgs(process.argv);
  const targets = resolveTargets(args);
  if (targets.length === 0) {
    throw new Error("No validation targets found for dev:check.");
  }

  const results = [];
  for (const targetPath of targets) {
    const doc = loadStructuredFile(targetPath);
    validateElementaryAssertions(doc, { strict: true });
    results.push({ path: targetPath, ok: true });
  }

  const report = {
    mode: "strict",
    validated_count: results.length,
    targets: results,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main();
