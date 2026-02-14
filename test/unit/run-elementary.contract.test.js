const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { runElementaryAssertions, ensureWtiEndpointReachable, assertMandatoryWtiUpstreamEvidence } = require("../../src/run");

function startServer(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({
        server,
        endpoint: `http://127.0.0.1:${addr.port}`,
      });
    });
    server.on("error", reject);
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

test("runElementaryAssertions requires configured wikipedia-title-index endpoint", async () => {
  await assert.rejects(
    () => runElementaryAssertions("Alpha runs.", {}),
    /requires options\.services\['wikipedia-title-index'\]\.endpoint/i
  );
});

test("ensureWtiEndpointReachable accepts only HTTP 200", async () => {
  const ok = await startServer((req, res) => {
    if (req.url === "/health") {
      res.statusCode = 200;
      res.end("ok");
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });
  try {
    await ensureWtiEndpointReachable(ok.endpoint, 200);
  } finally {
    await closeServer(ok.server);
  }

  const bad = await startServer((req, res) => {
    if (req.url === "/health") {
      res.statusCode = 503;
      res.end("unhealthy");
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });
  try {
    await assert.rejects(
      () => ensureWtiEndpointReachable(bad.endpoint, 200),
      /health check failed/i
    );
  } finally {
    await closeServer(bad.server);
  }
});

test("ensureWtiEndpointReachable does not retry on failure (single /health request)", async () => {
  let healthCount = 0;
  const bad = await startServer((req, res) => {
    if (req.url === "/health") {
      healthCount += 1;
      res.statusCode = 500;
      res.end("boom");
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });
  try {
    await assert.rejects(() => ensureWtiEndpointReachable(bad.endpoint, 200), /health check failed/i);
    assert.equal(healthCount, 1, "WTI health check must fail fast without retries");
  } finally {
    await closeServer(bad.server);
  }
});

test("assertMandatoryWtiUpstreamEvidence rejects missing or non-positive wiki signals", () => {
  assert.throws(
    () => assertMandatoryWtiUpstreamEvidence({ tokens: [{ id: "t1", lexicon: {} }] }),
    /WTI evidence missing/i
  );

  assert.throws(
    () =>
      assertMandatoryWtiUpstreamEvidence({
        tokens: [{ id: "t1", lexicon: { wikipedia_title_index: { wiki_exact_match: false, wiki_prefix_count: 0 } } }],
      }),
    /WTI evidence missing/i
  );
});

test("runElementaryAssertions fails when endpoint is healthy but upstream has no positive WTI evidence", async () => {
  const ok = await startServer((req, res) => {
    if (req.url === "/health") {
      res.statusCode = 200;
      res.end("ok");
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });

  const linguisticEnricherPath = require.resolve("linguistic-enricher");
  const previous = require.cache[linguisticEnricherPath];
  require.cache[linguisticEnricherPath] = {
    id: linguisticEnricherPath,
    filename: linguisticEnricherPath,
    loaded: true,
    exports: {
      runPipeline: async () => ({
        seed_id: "seed",
        canonical_text: "Alpha runs.",
        stage: "relations_extracted",
        segments: [{ id: "s1", span: { start: 0, end: 11 }, token_range: { start: 0, end: 2 } }],
        tokens: [
          { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "Alpha", pos: { tag: "NNP", coarse: "NOUN" } },
          { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 10 }, surface: "runs", pos: { tag: "VBZ", coarse: "VERB" } },
        ],
        annotations: [],
      }),
    },
  };

  try {
    await assert.rejects(
      () =>
        runElementaryAssertions("Alpha runs.", {
          services: { "wikipedia-title-index": { endpoint: ok.endpoint } },
        }),
      /WTI evidence missing/i
    );
  } finally {
    if (previous) {
      require.cache[linguisticEnricherPath] = previous;
    } else {
      delete require.cache[linguisticEnricherPath];
    }
    await closeServer(ok.server);
  }
});
