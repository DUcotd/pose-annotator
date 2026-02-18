const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fsp = require('node:fs/promises');

const PredictionService = require('../src/services/PredictionService');

test('PredictionService status exposes active progress from progress events', async () => {
  const projectId = `pred-status-${Date.now()}`;
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'pose-annotator-pred-'));
  const projectPath = path.join(tmpRoot, 'proj');
  await fsp.mkdir(projectPath, { recursive: true });

  try {
    PredictionService.processes.create(projectId, projectPath);
    PredictionService.processes.setStatus(projectId, 'running');

    PredictionService.predictionStates.set(projectId, {
      totalImages: 10,
      processedImages: 0,
      activeIndex: -1,
      currentImage: null,
      results: [],
      startTime: Date.now()
    });

    PredictionService.handlePredictionProgress(projectId, {
      event: 'progress',
      image: 'a.jpg',
      index: 0,
      total: 10
    }, projectPath);

    const s1 = PredictionService.getStatus(projectId);
    assert.equal(s1.status, 'running');
    assert.equal(s1.progress.processed, 0);
    assert.equal(s1.progress.active, 1);

    PredictionService.handlePredictionProgress(projectId, {
      event: 'result',
      image: 'a.jpg',
      index: 0,
      predictions: []
    }, projectPath);

    const s2 = PredictionService.getStatus(projectId);
    assert.equal(s2.progress.processed, 1);
    assert.equal(s2.progress.active, 1);

    PredictionService.handlePredictionProgress(projectId, {
      event: 'progress',
      image: 'b.jpg',
      index: 1,
      total: 10
    }, projectPath);

    const s3 = PredictionService.getStatus(projectId);
    assert.equal(s3.progress.processed, 1);
    assert.equal(s3.progress.active, 2);
  } finally {
    try {
      PredictionService.processes.setStatus(projectId, 'completed');
    } catch {}
    PredictionService.predictionStates.delete(projectId);
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  }
});

