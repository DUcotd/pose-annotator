const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const settings = require('../src/config/settings');
const createApp = require('../src/app');

const startServer = async (app) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
};

test('settings.save writes valid JSON atomically (no tmp/bak left)', async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'pose-annotator-settings-'));
  const configPath = path.join(tmpRoot, 'settings.json');
  process.env.POSE_ANNOTATOR_SETTINGS_PATH = configPath;

  assert.equal(fs.existsSync(configPath), false);
  assert.equal(settings.save({ pythonPath: null, projectsDir: null }), true);

  const txt = await fsp.readFile(configPath, 'utf8');
  assert.doesNotThrow(() => JSON.parse(txt));

  const entries = await fsp.readdir(tmpRoot);
  assert.equal(entries.some(n => n.includes('.tmp_')), false);
  assert.equal(entries.some(n => n.includes('.bak_')), false);
});

test('settings endpoints validate input and keep backward-compatible fields', async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'pose-annotator-settings-api-'));
  const configPath = path.join(tmpRoot, 'settings.json');
  const projectsDir = path.join(tmpRoot, 'projects');
  await fsp.mkdir(projectsDir, { recursive: true });
  process.env.POSE_ANNOTATOR_SETTINGS_PATH = configPath;

  const app = createApp(projectsDir);
  const { server, url } = await startServer(app);

  try {
    const getRes = await fetch(`${url}/api/settings`);
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.ok, true);
    assert.equal(getBody.data.success, true);
    assert.ok(typeof getBody.meta.requestId === 'string');
    assert.equal(typeof getBody, 'object');

    const badRes = await fetch(`${url}/api/settings/projects-dir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectsDir: path.join(tmpRoot, 'not-exist') })
    });
    assert.equal(badRes.status, 400);
    const badBody = await badRes.json();
    assert.equal(badBody.ok, false);
    assert.equal(badBody.error.code, 'VALIDATION_ERROR');
    assert.ok(typeof badBody.error.requestId === 'string');

    const okRes = await fetch(`${url}/api/settings/projects-dir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectsDir })
    });
    assert.equal(okRes.status, 200);
    const okBody = await okRes.json();
    assert.equal(okBody.ok, true);
    assert.equal(okBody.data.success, true);
    assert.equal(okBody.data.projectsDir, projectsDir);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
