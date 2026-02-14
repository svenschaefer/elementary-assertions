const { runElementaryAssertions, runFromRelations } = require("../run");
const { validateElementaryAssertions } = require("../validate");
const { renderElementaryAssertions } = require("../render");
const { arg, normalizeOptionalString, parseStrictBoolean, readUtf8, readUtf8WithFileSource, writeUtf8 } = require("./io");

function loadYaml() {
  try {
    return require("js-yaml");
  } catch (err) {
    throw new Error("Unable to load js-yaml. Install dependencies before using CLI file commands.");
  }
}

function usage() {
  return [
    "Usage:",
    "  elementary-assertions run --text <string> | --in <path> | --relations <path> [--out <path>] [--timeout-ms <ms>] [--wti-endpoint <url>] [--wti-timeout-ms <ms]",
    "  elementary-assertions validate --in <path>",
    "  elementary-assertions render --in <path> [--out <path>] --format <txt|md> --layout <compact|readable|table|meaning>",
  ].join("\n");
}

const DEV_DIAGNOSTIC_FLAGS = [
  "--diagnose-wiki-upstream",
  "--diagnose-wti-wiring",
  "--diagnose-coverage-audit",
];

function enforceDevFlagPolicy(args) {
  const hasDev = args.includes("--dev");
  const usedDiagnostics = DEV_DIAGNOSTIC_FLAGS.filter((f) => args.includes(f));
  if (usedDiagnostics.length === 0) return;
  if (!hasDev) {
    throw new Error(`Diagnostic flags require --dev: ${usedDiagnostics.join(", ")}`);
  }
  throw new Error(`Diagnostic flags are developer-only and not available in the public CLI: ${usedDiagnostics.join(", ")}`);
}

function parseRunInput(args) {
  const text = arg(args, "--text");
  const inPath = arg(args, "--in");
  const relationsPath = arg(args, "--relations");
  const hasText = typeof text === "string";
  const hasIn = typeof inPath === "string";
  const hasRelations = typeof relationsPath === "string";
  const inputCount = Number(hasText) + Number(hasIn) + Number(hasRelations);
  if (inputCount > 1) throw new Error("Exactly one of --text, --in, or --relations is required; multiple provided.");
  if (inputCount < 1) throw new Error("Exactly one of --text, --in, or --relations is required; none provided.");
  return { text, inPath, relationsPath };
}

async function runCommand(args) {
  const { text, inPath, relationsPath } = parseRunInput(args);
  const outPath = arg(args, "--out");
  const timeoutMs = Number(arg(args, "--timeout-ms") || 0) || undefined;
  const wtiTimeoutMs = Number(arg(args, "--wti-timeout-ms") || 0) || undefined;
  const endpoint = normalizeOptionalString(arg(args, "--wti-endpoint") || process.env.WIKIPEDIA_TITLE_INDEX_ENDPOINT || "");

  let doc;
  if (typeof relationsPath === "string") {
    const yaml = loadYaml();
    const { text: raw, sourceInput } = readUtf8WithFileSource(relationsPath, "relations input file", "seed.relations.yaml");
    const relationsDoc = yaml.load(raw);
    doc = runFromRelations(relationsDoc, {
      wtiEndpoint: endpoint,
      sourceInputs: [sourceInput],
      suppressDefaultRelationsSource: true,
    });
  } else if (typeof text === "string") {
    doc = await runElementaryAssertions(text, {
      services: { "wikipedia-title-index": { endpoint } },
      timeoutMs,
      wtiTimeoutMs,
    });
  } else {
    const { text: source, sourceInput } = readUtf8WithFileSource(inPath, "input file", "seed.txt");
    doc = await runElementaryAssertions(source, {
      services: { "wikipedia-title-index": { endpoint } },
      timeoutMs,
      wtiTimeoutMs,
      sourceInputs: [sourceInput],
    });
  }

  const yaml = loadYaml();
  const out = yaml.dump(doc, { lineWidth: -1 });
  if (outPath) writeUtf8(outPath, out);
  else process.stdout.write(out);
}

function validateCommand(args) {
  const inPath = arg(args, "--in");
  if (!inPath) throw new Error("validate requires --in <path>");
  const yaml = loadYaml();
  const raw = readUtf8(inPath, "input file");
  const doc = yaml.load(raw);
  validateElementaryAssertions(doc);
  process.stdout.write("ok\n");
}

function renderCommand(args) {
  const inPath = arg(args, "--in");
  if (!inPath) throw new Error("render requires --in <path>");
  const yaml = loadYaml();

  const outPath = arg(args, "--out");
  const format = arg(args, "--format") || "txt";
  const layout = arg(args, "--layout") || "compact";

  const raw = readUtf8(inPath, "input file");
  const doc = yaml.load(raw);

  const options = {
    format,
    layout,
    segments: parseStrictBoolean(arg(args, "--segments") || "true", "--segments"),
    mentions: parseStrictBoolean(arg(args, "--mentions") || "true", "--mentions"),
    coverage: parseStrictBoolean(arg(args, "--coverage") || "true", "--coverage"),
    debugIds: parseStrictBoolean(arg(args, "--debug-ids") || "false", "--debug-ids"),
    normalizeDeterminers: parseStrictBoolean(arg(args, "--normalize-determiners") || "true", "--normalize-determiners"),
    renderUncoveredDelta: parseStrictBoolean(arg(args, "--render-uncovered-delta") || "false", "--render-uncovered-delta"),
  };

  const rendered = renderElementaryAssertions(doc, options);
  if (outPath) writeUtf8(outPath, rendered);
  else process.stdout.write(rendered);
}

async function runCli(argv = process.argv.slice(2)) {
  const [cmd, ...args] = argv;
  if (!cmd || cmd === "--help" || cmd === "-h") {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  if (cmd === "run") {
    enforceDevFlagPolicy(args);
    await runCommand(args);
    return;
  }
  if (cmd === "validate") {
    enforceDevFlagPolicy(args);
    validateCommand(args);
    return;
  }
  if (cmd === "render") {
    enforceDevFlagPolicy(args);
    renderCommand(args);
    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

module.exports = {
  runCli,
  usage,
};
