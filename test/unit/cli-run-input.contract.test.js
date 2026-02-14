const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const yaml = require("js-yaml");

const { runCli } = require("../../src/tools");

test("CLI run rejects when no run input source is provided", async () => {
  await assert.rejects(
    () => runCli(["run"]),
    /exactly one of --text, --in, or --relations is required; none provided/i
  );
});

test("CLI run rejects when multiple run input sources are provided", async () => {
  await assert.rejects(
    () => runCli(["run", "--text", "Alpha runs.", "--in", "input.txt"]),
    /exactly one of --text, --in, or --relations is required; multiple provided/i
  );

  await assert.rejects(
    () => runCli(["run", "--text", "Alpha runs.", "--relations", "relations.yaml"]),
    /exactly one of --text, --in, or --relations is required; multiple provided/i
  );
});

test("CLI run supports --relations without requiring WTI endpoint", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ea-cli-relations-"));
  const inPath = path.join(tmpRoot, "relations.yaml");
  const outPath = path.join(tmpRoot, "out.yaml");

  const relationsDoc = {
    seed_id: "seed",
    canonical_text: "Alpha runs.",
    stage: "relations_extracted",
    segments: [{ id: "s1", span: { start: 0, end: 11 }, token_range: { start: 0, end: 2 } }],
    tokens: [
      { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "Alpha", pos: { tag: "NNP", coarse: "NOUN" } },
      { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 10 }, surface: "runs", pos: { tag: "VBZ", coarse: "VERB" } },
    ],
    annotations: [],
  };

  fs.writeFileSync(inPath, yaml.dump(relationsDoc), "utf8");
  await runCli(["run", "--relations", inPath, "--out", outPath]);

  const out = yaml.load(fs.readFileSync(outPath, "utf8"));
  assert.equal(out.stage, "elementary_assertions");
  assert.equal(out.index_basis.text_field, "canonical_text");
  assert.equal(out.index_basis.span_unit, "utf16_code_units");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test("CLI run --relations succeeds when WIKIPEDIA_TITLE_INDEX_ENDPOINT is unset", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ea-cli-relations-noenv-"));
  const inPath = path.join(tmpRoot, "relations.yaml");
  const outPath = path.join(tmpRoot, "out.yaml");

  const relationsDoc = {
    seed_id: "seed",
    canonical_text: "Alpha runs.",
    stage: "relations_extracted",
    segments: [{ id: "s1", span: { start: 0, end: 11 }, token_range: { start: 0, end: 2 } }],
    tokens: [
      { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "Alpha", pos: { tag: "NNP", coarse: "NOUN" } },
      { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 10 }, surface: "runs", pos: { tag: "VBZ", coarse: "VERB" } },
    ],
    annotations: [],
  };

  fs.writeFileSync(inPath, yaml.dump(relationsDoc), "utf8");
  const prevEndpoint = process.env.WIKIPEDIA_TITLE_INDEX_ENDPOINT;
  delete process.env.WIKIPEDIA_TITLE_INDEX_ENDPOINT;
  try {
    await runCli(["run", "--relations", inPath, "--out", outPath]);
  } finally {
    if (typeof prevEndpoint === "string") process.env.WIKIPEDIA_TITLE_INDEX_ENDPOINT = prevEndpoint;
  }

  const out = yaml.load(fs.readFileSync(outPath, "utf8"));
  assert.equal(out.stage, "elementary_assertions");
  assert.equal(out.index_basis.text_field, "canonical_text");
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test("CLI usage includes --relations in run syntax", async () => {
  const chunks = [];
  const origWrite = process.stdout.write;
  process.stdout.write = (chunk) => {
    chunks.push(String(chunk));
    return true;
  };
  try {
    await runCli(["--help"]);
  } finally {
    process.stdout.write = origWrite;
  }
  const helpText = chunks.join("");
  assert.match(helpText, /--relations <path>/i);
  assert.match(helpText, /--text <string> \| --in <path> \| --relations <path>/i);
});

test("CLI run with --relations fails on invalid structured file", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ea-cli-relations-bad-"));
  const inPath = path.join(tmpRoot, "relations.yaml");
  fs.writeFileSync(inPath, "not: [valid", "utf8");

  await assert.rejects(
    () => runCli(["run", "--relations", inPath]),
    /YAMLException|unexpected end/i
  );

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test("CLI run --relations accepts JSON document input", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ea-cli-relations-json-"));
  const inPath = path.join(tmpRoot, "relations.json");
  const outPath = path.join(tmpRoot, "out.yaml");
  const relationsDoc = {
    seed_id: "seed",
    canonical_text: "Alpha runs.",
    stage: "relations_extracted",
    segments: [{ id: "s1", span: { start: 0, end: 11 }, token_range: { start: 0, end: 2 } }],
    tokens: [
      { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "Alpha", pos: { tag: "NNP", coarse: "NOUN" } },
      { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 10 }, surface: "runs", pos: { tag: "VBZ", coarse: "VERB" } },
    ],
    annotations: [],
  };
  fs.writeFileSync(inPath, JSON.stringify(relationsDoc, null, 2), "utf8");

  await runCli(["run", "--relations", inPath, "--out", outPath]);

  const out = yaml.load(fs.readFileSync(outPath, "utf8"));
  assert.equal(out.stage, "elementary_assertions");
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test("CLI run --relations rejects non-object parsed input", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ea-cli-relations-scalar-"));
  const inPath = path.join(tmpRoot, "relations.yaml");
  fs.writeFileSync(inPath, "- just\n- a\n- list\n", "utf8");

  await assert.rejects(
    () => runCli(["run", "--relations", inPath]),
    /tokens\[\]/i
  );

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test("CLI run --relations preserves file-origin provenance metadata", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ea-cli-relations-provenance-"));
  const inPath = path.join(tmpRoot, "relations.yaml");
  const outPath = path.join(tmpRoot, "out.yaml");

  const relationsDoc = {
    seed_id: "seed",
    canonical_text: "Alpha runs.",
    stage: "relations_extracted",
    segments: [{ id: "s1", span: { start: 0, end: 11 }, token_range: { start: 0, end: 2 } }],
    tokens: [
      { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "Alpha", pos: { tag: "NNP", coarse: "NOUN" } },
      { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 10 }, surface: "runs", pos: { tag: "VBZ", coarse: "VERB" } },
    ],
    annotations: [],
  };

  fs.writeFileSync(inPath, yaml.dump(relationsDoc), "utf8");
  await runCli(["run", "--relations", inPath, "--out", outPath]);

  const out = yaml.load(fs.readFileSync(outPath, "utf8"));
  assert.ok(Array.isArray(out.sources.inputs));
  const source = out.sources.inputs[0];
  assert.equal(source.artifact, "seed.relations.yaml");
  assert.equal(source.origin.kind, "file");
  assert.equal(path.resolve(source.origin.path), path.resolve(inPath));

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
