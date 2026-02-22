const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const TrainingLogV2Service = require('../src/services/TrainingLogV2Service');

test('TrainingLogV2Service creates run, persists ndjson, and exports structured json', async (t) => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'pose-annotator-logv2-'));
  const projectId = 'logv2_p1';
  const projectRoot = path.join(tmpRoot, projectId);
  await fsp.mkdir(projectRoot, { recursive: true });

  t.after(() => {
    TrainingLogV2Service.activeRuns.delete(projectId);
  });

  const run = TrainingLogV2Service.createRun(projectId, projectRoot, {
    model: 'yolov8n-pose.pt',
    epochs: 2,
    batch: 4
  });
  assert.ok(run.runId);
  assert.equal(run.status, 'starting');

  const evt = TrainingLogV2Service.appendEvent(projectId, {
    source: 'server',
    level: 'info',
    stage: 'bootstrap',
    kind: 'status',
    code: 'TEST_EVENT',
    message: 'test event'
  });
  assert.equal(evt.seq, 1);

  const metric = TrainingLogV2Service.appendMetric(projectId, { epoch: 1, loss: 1.2 }, {
    stage: 'train',
    code: 'TEST_METRIC'
  });
  assert.equal(metric.epoch, 1);
  assert.equal(metric.seq, 2);

  const diagnosis = TrainingLogV2Service.updateDiagnosis(projectId, {
    status: 'failed',
    stage: 'train',
    code: 'TEST_DIAG',
    rootCause: 'test cause',
    evidence: ['line 1', 'line 2'],
    suggestions: ['do A', 'do B']
  });
  assert.equal(diagnosis.code, 'TEST_DIAG');

  TrainingLogV2Service.setStatus(projectId, 'failed');

  assert.ok(fs.existsSync(run.files.events));
  assert.ok(fs.existsSync(run.files.metrics));
  assert.ok(fs.existsSync(run.files.diagnosis));
  assert.ok(fs.existsSync(run.files.manifest));

  const query = TrainingLogV2Service.getEvents(projectId, { cursor: 0, limit: 50 });
  assert.ok(Array.isArray(query.events));
  assert.ok(query.events.length >= 2);
  assert.equal(query.runId, run.runId);
  assert.equal(TrainingLogV2Service.getStatus(projectId).counts.events, 2);
  assert.equal(TrainingLogV2Service.getStatus(projectId).counts.metrics, 1);

  TrainingLogV2Service.activeRuns.delete(projectId);
  const diskQuery = TrainingLogV2Service.getEvents(projectId, {
    runId: run.runId,
    projectRoot,
    cursor: 0,
    limit: 50
  });
  assert.equal(diskQuery.runId, run.runId);
  assert.ok(diskQuery.events.length >= 2);

  const exported = TrainingLogV2Service.exportRun(projectId, { runId: run.runId, format: 'json', projectRoot });
  assert.equal(exported.format, 'json');
  const parsed = JSON.parse(exported.content);
  assert.equal(parsed.manifest.runId, run.runId);
  assert.equal(parsed.diagnosis.current.code, 'TEST_DIAG');
  assert.ok(parsed.events.length >= 2);
  assert.ok(parsed.metrics.length >= 1);
});
