const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const createApp = require('../src/app');
const TrainingLogV2Service = require('../src/services/TrainingLogV2Service');

const startServer = async (app) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
};

test('training v2 routes expose status/events/export for active run', async (t) => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'pose-annotator-v2-routes-'));
  const projectsDir = path.join(tmpRoot, 'projects');
  const projectId = 'route_p1';
  const projectRoot = path.join(projectsDir, projectId);
  await fsp.mkdir(projectRoot, { recursive: true });

  TrainingLogV2Service.createRun(projectId, projectRoot, { epochs: 5 });
  TrainingLogV2Service.appendEvent(projectId, {
    source: 'server',
    level: 'info',
    stage: 'bootstrap',
    kind: 'status',
    code: 'BOOT',
    message: 'booting'
  });
  TrainingLogV2Service.appendMetric(projectId, { epoch: 1, mAP50: 0.12 }, {
    stage: 'train',
    code: 'EPOCH_END'
  });
  TrainingLogV2Service.updateDiagnosis(projectId, {
    status: 'warning',
    stage: 'train',
    code: 'WARN_IO',
    rootCause: 'io slow',
    evidence: ['workers too low'],
    suggestions: ['increase workers']
  });

  t.after(() => {
    TrainingLogV2Service.activeRuns.delete(projectId);
  });

  const app = createApp(projectsDir);
  const { server, url } = await startServer(app);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const statusRes = await fetch(`${url}/api/projects/${projectId}/train/v2/status`);
  assert.equal(statusRes.status, 200);
  const statusEnvelope = await statusRes.json();
  assert.equal(statusEnvelope.ok, true);
  const status = statusEnvelope.data;
  assert.equal(status.status, 'starting');
  assert.ok(status.runId);
  assert.ok(Array.isArray(status.previewEvents));
  assert.ok(typeof statusEnvelope.meta.requestId === 'string');

  const eventsRes = await fetch(`${url}/api/projects/${projectId}/train/v2/events?runId=${encodeURIComponent(status.runId)}&cursor=0&limit=10`);
  assert.equal(eventsRes.status, 200);
  const eventsEnvelope = await eventsRes.json();
  assert.equal(eventsEnvelope.ok, true);
  const eventsPayload = eventsEnvelope.data;
  assert.ok(Array.isArray(eventsPayload.events));
  assert.ok(eventsPayload.events.length >= 2);
  assert.equal(eventsPayload.runId, status.runId);

  const exportRes = await fetch(`${url}/api/projects/${projectId}/train/v2/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format: 'json', runId: status.runId })
  });
  assert.equal(exportRes.status, 200);
  assert.match(exportRes.headers.get('content-type') || '', /application\/json/);
  const exportText = await exportRes.text();
  const parsed = JSON.parse(exportText);
  const exportJson = parsed?.ok === true ? parsed.data : parsed;
  assert.equal(exportJson.manifest.runId, status.runId);
  assert.ok(Array.isArray(exportJson.events));
});
