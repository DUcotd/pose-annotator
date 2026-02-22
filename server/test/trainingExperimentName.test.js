const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const TrainingService = require('../src/services/TrainingService');

test('resolveExperimentName returns base name when runs directory does not exist', () => {
  const result = TrainingService.resolveExperimentName({
    name: 'exp_auto',
    project: path.join('not', 'exists')
  });

  assert.equal(result, 'exp_auto');
});

test('resolveExperimentName increments exp_auto suffix by scanning existing run folders', async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'pose-annotator-runs-'));
  await fsp.mkdir(path.join(tmpRoot, 'exp_auto'), { recursive: true });
  await fsp.mkdir(path.join(tmpRoot, 'exp_auto_1'), { recursive: true });
  await fsp.mkdir(path.join(tmpRoot, 'exp_auto_2'), { recursive: true });
  await fsp.mkdir(path.join(tmpRoot, 'other_run'), { recursive: true });

  const result = TrainingService.resolveExperimentName({
    name: 'exp_auto',
    project: tmpRoot
  });

  assert.equal(result, 'exp_auto_3');
});

test('resolveExperimentName keeps provided name on retry', async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'pose-annotator-runs-retry-'));
  await fsp.mkdir(path.join(tmpRoot, 'exp_auto'), { recursive: true });
  await fsp.mkdir(path.join(tmpRoot, 'exp_auto_1'), { recursive: true });

  const result = TrainingService.resolveExperimentName({
    name: 'exp_auto_1',
    project: tmpRoot
  }, 1);

  assert.equal(result, 'exp_auto_1');
});
