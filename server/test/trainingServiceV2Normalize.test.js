const test = require('node:test');
const assert = require('node:assert/strict');

const TrainingService = require('../src/services/TrainingService');

test('TrainingService normalizeJsonLogToV2 keeps metric semantics', () => {
  const event = TrainingService.normalizeJsonLogToV2({
    event: 'epoch_end',
    level: 'INFO',
    message: 'epoch done',
    epoch: 1
  });

  assert.equal(event.kind, 'metric');
  assert.equal(event.stage, 'train');
  assert.equal(event.code, 'EPOCH_END');
  assert.equal(event.message, 'epoch done');
});

test('TrainingService normalizeLineToEventV2 maps stderr raw line', () => {
  const event = TrainingService.normalizeLineToEventV2('RuntimeError: test', 'py_stderr', {
    stage: 'train',
    code: 'STDERR_LINE'
  });

  assert.equal(event.source, 'py_stderr');
  assert.equal(event.stage, 'train');
  assert.equal(event.code, 'STDERR_LINE');
  assert.match(event.message, /RuntimeError/);
});

test('TrainingService mapErrorTypeToCode maps known classifier keys', () => {
  assert.equal(TrainingService.mapErrorTypeToCode('oom'), 'CUDA_OOM');
  assert.equal(TrainingService.mapErrorTypeToCode('yaml_error'), 'DATASET_YAML_ERROR');
  assert.equal(TrainingService.mapErrorTypeToCode('custom_reason'), 'CUSTOM_REASON_ERROR');
});

