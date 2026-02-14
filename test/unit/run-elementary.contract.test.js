const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { runElementaryAssertions, ensureWtiEndpointReachable } = require("../../src/run");

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

