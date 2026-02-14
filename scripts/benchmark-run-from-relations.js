const { performance } = require("node:perf_hooks");
const { runFromRelations } = require("../src");

function minimalRelationsDoc() {
  return {
    seed_id: "seed",
    canonical_text: "Alpha runs quickly.",
    stage: "relations_extracted",
    segments: [{ id: "s1", span: { start: 0, end: 19 }, token_range: { start: 0, end: 3 } }],
    tokens: [
      { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "Alpha", pos: { tag: "NNP", coarse: "NOUN" } },
      { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 10 }, surface: "runs", pos: { tag: "VBZ", coarse: "VERB" } },
      { id: "t3", i: 2, segment_id: "s1", span: { start: 11, end: 18 }, surface: "quickly", pos: { tag: "RB", coarse: "ADV" } },
    ],
    annotations: [
      {
        id: "ann:dep:1",
        kind: "dependency",
        status: "accepted",
        label: "nsubj",
        head: { id: "t2" },
        dep: { id: "t1" },
        sources: [{ name: "relation-extraction", evidence: {} }],
      },
      {
        id: "ann:dep:2",
        kind: "dependency",
        status: "accepted",
        label: "modifier",
        head: { id: "t2" },
        dep: { id: "t3" },
        sources: [{ name: "relation-extraction", evidence: {} }],
      },
    ],
  };
}

function measure(iterations, input) {
  const t0 = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    runFromRelations(input);
  }
  const t1 = performance.now();
  return t1 - t0;
}

const iterations = Number.isFinite(Number(process.argv[2])) ? Number(process.argv[2]) : 250;
const input = minimalRelationsDoc();

runFromRelations(input);
const totalMs = measure(iterations, input);
const perRunMs = totalMs / iterations;

console.log(`benchmark: runFromRelations`);
console.log(`iterations: ${iterations}`);
console.log(`total_ms: ${totalMs.toFixed(3)}`);
console.log(`avg_ms_per_run: ${perRunMs.toFixed(3)}`);
