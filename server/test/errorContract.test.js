const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const createApp = require('../src/app');
const { inferCodeFromLegacyPayload } = require('../src/http/errors');

const startServer = async (app) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
};

test('unknown route returns structured ROUTE_NOT_FOUND envelope', async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'pose-annotator-route-'));
  const app = createApp(path.join(tmpRoot, 'projects'));
  const { server, url } = await startServer(app);

  try {
    const res = await fetch(`${url}/api/not-exists`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'ROUTE_NOT_FOUND');
    assert.equal(body.error.where.path, '/api/not-exists');
    assert.ok(typeof body.error.requestId === 'string');
    assert.ok(typeof body.meta.requestId === 'string');
    assert.equal(body.error.requestId, body.meta.requestId);
    assert.ok((res.headers.get('x-request-id') || '').startsWith('req_'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('system health route returns envelope with capability and route signature', async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'pose-annotator-health-'));
  const app = createApp(path.join(tmpRoot, 'projects'));
  const { server, url } = await startServer(app);

  try {
    const res = await fetch(`${url}/api/system/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.data.responseEnvelope, true);
    assert.equal(body.data.startupMode, 'strict');
    assert.equal(typeof body.data.capabilities, 'object');
    assert.equal(typeof body.data.routeSignature.hash, 'string');
    assert.ok(body.data.routeSignature.routeCount > 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('desktop-only endpoint returns DESKTOP_ONLY_FEATURE in web runtime', async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'pose-annotator-desktop-only-'));
  const app = createApp(path.join(tmpRoot, 'projects'));
  const { server, url } = await startServer(app);

  try {
    const res = await fetch(`${url}/api/utils/select-folder`, { method: 'POST' });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'DESKTOP_ONLY_FEATURE');
    assert.equal(body.error.retryable, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('model validation returns MODEL_INVALID for invalid path', async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'pose-annotator-model-invalid-'));
  const app = createApp(path.join(tmpRoot, 'projects'));
  const { server, url } = await startServer(app);

  try {
    const res = await fetch(`${url}/api/projects/p1/predict/validate-model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelPath: path.join(tmpRoot, 'missing.pt') })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'MODEL_INVALID');
    assert.ok(typeof body.error.hint === 'string' && body.error.hint.length > 0);
    assert.ok(typeof body.error.requestId === 'string');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('diagnostics export returns zip payload', async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'pose-annotator-diag-export-'));
  const app = createApp(path.join(tmpRoot, 'projects'));
  const { server, url } = await startServer(app);

  try {
    const res = await fetch(`${url}/api/system/diagnostics/export`, { method: 'POST' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/zip/);
    const buf = Buffer.from(await res.arrayBuffer());
    assert.ok(buf.length > 100);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('legacy permission errors map to FS_PERMISSION_DENIED', () => {
  const code = inferCodeFromLegacyPayload({ error: 'EACCES: permission denied, open file' }, 500);
  assert.equal(code, 'FS_PERMISSION_DENIED');
});
