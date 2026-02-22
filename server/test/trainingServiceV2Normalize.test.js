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

test('TrainingService classifyError ignores pynvml deprecation warnings', () => {
  const warningLine = 'D:\\miniconda3\\envs\\llm-gpu\\Lib\\site-packages\\torch\\cuda\\__init__.py:63: FutureWarning: The pynvml package is deprecated. Please install nvidia-ml-py instead.';
  const classified = TrainingService.classifyError(warningLine);

  assert.equal(classified.type, 'unknown');
});

test('TrainingService classifyError maps WinError 1455 shm.dll to memory', () => {
  const errLine = 'OSError: [WinError 1455] 页面文件太小，无法完成操作。 Error loading "D:\\miniconda3\\envs\\llm-gpu\\Lib\\site-packages\\torch\\lib\\shm.dll"';
  const classified = TrainingService.classifyError(errLine);

  assert.equal(classified.type, 'memory');
  assert.equal(classified.title, '系统内存不足');
});

test('TrainingService normalizeMetricPayload flattens validation metrics', () => {
  const metric = TrainingService.normalizeMetricPayload({
    event: 'validation_complete',
    metrics: {
      mAP50: 0.31,
      'mAP50-95': 0.21,
      precision: 0.62,
      recall: 0.55,
      'pose_mAP50-95': 0.14
    }
  });

  assert.equal(metric.event, 'validation_complete');
  assert.equal(metric.mAP50, 0.31);
  assert.equal(metric.mAP50_95, 0.21);
  assert.equal(metric.box_precision, 0.62);
  assert.equal(metric.box_recall, 0.55);
  assert.equal(metric.pose_mAP50_95, 0.14);
});

test('TrainingService normalizeMetricPayload flattens epoch context fields', () => {
  const metric = TrainingService.normalizeMetricPayload({
    event: 'epoch_end',
    timestamp: '2026-02-22T12:23:16.977657',
    context: {
      current_epoch: 3,
      epochs: 20,
      totalEpochs: 20,
      box_loss: 1.08,
      pose_loss: 0.58,
      learning_rate: 0.00052,
      eta_seconds: 613,
      train_box_loss: 2.61
    }
  });

  assert.equal(metric.event, 'epoch_end');
  assert.equal(metric.epoch, 3);
  assert.equal(metric.totalEpochs, 20);
  assert.equal(metric.box_loss, 1.08);
  assert.equal(metric.pose_loss, 0.58);
  assert.equal(metric.learning_rate, 0.00052);
  assert.equal(metric.eta_seconds, 613);
});

test('TrainingService normalizeJsonLogToV2 promotes gpu_warning to metric case-insensitively', () => {
  const event = TrainingService.normalizeJsonLogToV2({
    event: 'GPU_WARNING',
    level: 'INFO',
    kind: 'raw'
  });

  assert.equal(event.kind, 'metric');
  assert.equal(event.stage, 'train');
});

test('TrainingService normalizeMetricPayload flattens gpu stats from nested context.stats', () => {
  const metric = TrainingService.normalizeMetricPayload({
    event: 'gpu_warning',
    context: {
      warnings: ['GPU利用率低: 14.0% (可能存在IO瓶颈)'],
      stats: {
        gpu_memory_used_gb: 3.19,
        gpu_memory_total_gb: 6.0,
        gpu_memory_percent: 53.2,
        gpu_utilization_percent: 14,
        gpu_temperature: 69
      }
    }
  });

  assert.equal(metric.event, 'gpu_warning');
  assert.equal(metric.gpu_memory_used_gb, 3.19);
  assert.equal(metric.gpu_memory_total_gb, 6.0);
  assert.equal(metric.gpu_memory_percent, 53.2);
  assert.equal(metric.gpu_utilization_percent, 14);
  assert.equal(metric.gpu_temperature, 69);
  assert.deepEqual(metric.gpu_warnings, ['GPU利用率低: 14.0% (可能存在IO瓶颈)']);
});

test('TrainingService normalizeMetricPayload maps results.csv aliases to canonical metrics', () => {
  const metric = TrainingService.normalizeMetricPayload({
    event: 'results_csv_row',
    epoch: 2,
    'train/box_loss': 1.21,
    'train/pose_loss': 0.92,
    'train/kobj_loss': 0.44,
    'train/cls_loss': 0.33,
    'train/dfl_loss': 0.51,
    'val/box_loss': 1.03,
    'val/pose_loss': 0.61,
    'val/kobj_loss': 0.22,
    'val/cls_loss': 0.49,
    'val/dfl_loss': 0.63,
    'metrics/precision(B)': 0.94,
    'metrics/recall(B)': 0.91,
    'metrics/mAP50(B)': 0.97,
    'metrics/mAP50-95(B)': 0.79,
    'metrics/precision(P)': 0.88,
    'metrics/recall(P)': 0.86,
    'metrics/mAP50(P)': 0.93,
    'metrics/mAP50-95(P)': 0.74,
    'lr/pg0': 0.00031
  });

  assert.equal(metric.box_loss, 1.21);
  assert.equal(metric.pose_loss, 0.92);
  assert.equal(metric.kobj_loss, 0.44);
  assert.equal(metric.cls_loss, 0.33);
  assert.equal(metric.dfl_loss, 0.51);
  assert.equal(metric.val_box_loss, 1.03);
  assert.equal(metric.val_pose_loss, 0.61);
  assert.equal(metric.val_kobj_loss, 0.22);
  assert.equal(metric.val_cls_loss, 0.49);
  assert.equal(metric.val_dfl_loss, 0.63);
  assert.equal(metric.box_precision, 0.94);
  assert.equal(metric.box_recall, 0.91);
  assert.equal(metric.mAP50, 0.97);
  assert.equal(metric.mAP50_95, 0.79);
  assert.equal(metric.pose_precision, 0.88);
  assert.equal(metric.pose_recall, 0.86);
  assert.equal(metric.pose_mAP50, 0.93);
  assert.equal(metric.pose_mAP50_95, 0.74);
  assert.equal(metric.learning_rate, 0.00031);
});

test('TrainingService mapResultsCsvColumn resolves canonical keys from csv headers', () => {
  assert.equal(TrainingService.mapResultsCsvColumn('epoch'), 'epoch');
  assert.equal(TrainingService.mapResultsCsvColumn('train/box_loss'), 'box_loss');
  assert.equal(TrainingService.mapResultsCsvColumn('val/pose_loss'), 'val_pose_loss');
  assert.equal(TrainingService.mapResultsCsvColumn('metrics/mAP50(P)'), 'pose_mAP50');
  assert.equal(TrainingService.mapResultsCsvColumn('metrics/mAP50-95(B)'), 'mAP50_95');
  assert.equal(TrainingService.mapResultsCsvColumn('lr/pg0'), 'learning_rate');
});
