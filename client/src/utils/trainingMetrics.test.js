import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTrainingMetric,
  hasCoreMetricValue,
  buildMetricTimeline,
  buildChartSeries,
  getLatestMetricSnapshot
} from './trainingMetrics.js';

test('normalizeTrainingMetric flattens validation_complete metrics aliases', () => {
  const metric = normalizeTrainingMetric({
    event: 'validation_complete',
    metrics: {
      mAP50: 0.33,
      'mAP50-95': 0.21,
      precision: 0.62,
      recall: 0.58,
      'pose_mAP50-95': 0.14
    }
  });

  assert.equal(metric.event, 'validation_complete');
  assert.equal(metric.mAP50, 0.33);
  assert.equal(metric.mAP50_95, 0.21);
  assert.equal(metric.box_precision, 0.62);
  assert.equal(metric.box_recall, 0.58);
  assert.equal(metric.pose_mAP50_95, 0.14);
});

test('normalizeTrainingMetric maps results.csv aliases to canonical fields', () => {
  const metric = normalizeTrainingMetric({
    event: 'results_csv_row',
    epoch: 4,
    'train/box_loss': 0.83,
    'train/pose_loss': 0.44,
    'train/kobj_loss': 0.19,
    'train/cls_loss': 0.52,
    'train/dfl_loss': 0.61,
    'val/box_loss': 0.91,
    'val/pose_loss': 0.53,
    'val/kobj_loss': 0.12,
    'val/cls_loss': 0.41,
    'val/dfl_loss': 0.57,
    'metrics/precision(B)': 0.92,
    'metrics/recall(B)': 0.9,
    'metrics/mAP50(B)': 0.95,
    'metrics/mAP50-95(B)': 0.72,
    'metrics/precision(P)': 0.84,
    'metrics/recall(P)': 0.8,
    'metrics/mAP50(P)': 0.89,
    'metrics/mAP50-95(P)': 0.66,
    'lr/pg0': 0.00022
  });

  assert.equal(metric.box_loss, 0.83);
  assert.equal(metric.pose_loss, 0.44);
  assert.equal(metric.kobj_loss, 0.19);
  assert.equal(metric.cls_loss, 0.52);
  assert.equal(metric.dfl_loss, 0.61);
  assert.equal(metric.val_box_loss, 0.91);
  assert.equal(metric.val_pose_loss, 0.53);
  assert.equal(metric.val_kobj_loss, 0.12);
  assert.equal(metric.val_cls_loss, 0.41);
  assert.equal(metric.val_dfl_loss, 0.57);
  assert.equal(metric.box_precision, 0.92);
  assert.equal(metric.box_recall, 0.9);
  assert.equal(metric.mAP50, 0.95);
  assert.equal(metric.mAP50_95, 0.72);
  assert.equal(metric.pose_precision, 0.84);
  assert.equal(metric.pose_recall, 0.8);
  assert.equal(metric.pose_mAP50, 0.89);
  assert.equal(metric.pose_mAP50_95, 0.66);
  assert.equal(metric.learning_rate, 0.00022);
});

test('buildMetricTimeline merges same epoch records and keeps ordering', () => {
  const timeline = buildMetricTimeline([
    { runId: 'r1', seq: 1, event: 'epoch_end', epoch: 1, totalEpochs: 3, box_loss: 0.5 },
    { runId: 'r1', seq: 2, event: 'validation_row', epoch: 1, mAP50: 0.2 },
    { runId: 'r1', seq: 3, event: 'epoch_end', epoch: 2, totalEpochs: 3, box_loss: 0.4 }
  ]);

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].epoch, 1);
  assert.equal(timeline[0].box_loss, 0.5);
  assert.equal(timeline[0].mAP50, 0.2);
  assert.equal(timeline[1].epoch, 2);
});

test('buildMetricTimeline backfills epoch for validation metrics in stream order', () => {
  const timeline = buildMetricTimeline([
    { runId: 'r1', seq: 10, event: 'epoch_end', epoch: 1, totalEpochs: 20, box_loss: 0.8 },
    { runId: 'r1', seq: 11, event: 'validation_row', mAP50: 0.91, pose_mAP50: 0.72 },
    { runId: 'r1', seq: 20, event: 'epoch_end', epoch: 2, totalEpochs: 20, box_loss: 0.6 },
    { runId: 'r1', seq: 21, event: 'validation_row', mAP50: 0.94, pose_mAP50: 0.77 }
  ]);

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].epoch, 1);
  assert.equal(timeline[0].mAP50, 0.91);
  assert.equal(timeline[0].pose_mAP50, 0.72);
  assert.equal(timeline[1].epoch, 2);
  assert.equal(timeline[1].mAP50, 0.94);
  assert.equal(timeline[1].pose_mAP50, 0.77);
});

test('buildMetricTimeline keeps mAP values when later same-epoch events omit those fields', () => {
  const timeline = buildMetricTimeline([
    { runId: 'r1', seq: 1, event: 'results_csv_row', epoch: 1, mAP50: 0.91, mAP50_95: 0.73, pose_mAP50: 0.84, pose_mAP50_95: 0.66, box_precision: 0.95, box_recall: 0.94 },
    { runId: 'r1', seq: 2, event: 'gpu_warning', epoch: 1, gpu_memory_percent: 75.1 },
    { runId: 'r1', seq: 3, event: 'results_csv_row', epoch: 2, mAP50: 0.93, mAP50_95: 0.75, pose_mAP50: 0.87, pose_mAP50_95: 0.69, box_precision: 0.97, box_recall: 0.96 }
  ]);

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].epoch, 1);
  assert.equal(timeline[0].mAP50, 0.91);
  assert.equal(timeline[0].mAP50_95, 0.73);
  assert.equal(timeline[0].pose_mAP50, 0.84);
  assert.equal(timeline[0].pose_mAP50_95, 0.66);
  assert.equal(timeline[0].box_precision, 0.95);
  assert.equal(timeline[0].box_recall, 0.94);
});

test('buildChartSeries excludes rows missing target key', () => {
  const series = buildChartSeries([
    { seq: 1, event: 'epoch_end', epoch: 1, box_loss: 0.4 },
    { seq: 2, event: 'performance_benchmark', realtime_fps: 27 },
    { seq: 3, event: 'epoch_end', epoch: 2, box_loss: 0.3 }
  ], 'box_loss');

  assert.equal(series.length, 2);
  assert.equal(series[0].epoch, 1);
  assert.equal(series[1].epoch, 2);
});

test('getLatestMetricSnapshot keeps latest core epoch and fills sparse fields', () => {
  const snapshot = getLatestMetricSnapshot([
    { runId: 'r1', seq: 5, event: 'epoch_end', epoch: 3, totalEpochs: 20, box_loss: 0.31, pose_loss: 0.52 },
    { runId: 'r1', seq: 6, event: 'results_csv_row', val_box_loss: 0.77, val_pose_loss: 0.55 },
    { runId: 'r1', seq: 7, event: 'performance_benchmark', realtime_fps: 29, meets_realtime_requirement: true }
  ]);

  assert.equal(snapshot.epoch, 3);
  assert.equal(snapshot.totalEpochs, 20);
  assert.equal(snapshot.box_loss, 0.31);
  assert.equal(snapshot.pose_loss, 0.52);
  assert.equal(snapshot.val_box_loss, 0.77);
  assert.equal(snapshot.val_pose_loss, 0.55);
  assert.equal(snapshot.realtime_fps, 29);
});

test('hasCoreMetricValue ignores non-metric noise payload', () => {
  assert.equal(hasCoreMetricValue({ event: 'train_starting', message: 'start' }), false);
  assert.equal(hasCoreMetricValue({ event: 'performance_benchmark', realtime_fps: 28 }), true);
});

test('normalizeTrainingMetric recovers epoch fields from raw JSON log payload', () => {
  const raw = '__JSON_LOG__{"event":"epoch_end","timestamp":"2026-02-22T12:23:16.977657","context":{"epoch":3,"totalEpochs":20,"box_loss":1.08,"pose_loss":0.58,"learning_rate":0.00052}}';
  const metric = normalizeTrainingMetric({
    event: 'epoch_end',
    timestamp: '2026-02-22T12:23:16.977657',
    raw
  }, { raw });

  assert.equal(metric.event, 'epoch_end');
  assert.equal(metric.epoch, 3);
  assert.equal(metric.totalEpochs, 20);
  assert.equal(metric.box_loss, 1.08);
  assert.equal(metric.pose_loss, 0.58);
  assert.equal(metric.learning_rate, 0.00052);
});

test('normalizeTrainingMetric flattens gpu stats from context.stats', () => {
  const metric = normalizeTrainingMetric({
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

  assert.equal(metric.gpu_memory_used_gb, 3.19);
  assert.equal(metric.gpu_memory_total_gb, 6.0);
  assert.equal(metric.gpu_memory_percent, 53.2);
  assert.equal(metric.gpu_utilization_percent, 14);
  assert.equal(metric.gpu_temperature, 69);
  assert.deepEqual(metric.gpu_warnings, ['GPU利用率低: 14.0% (可能存在IO瓶颈)']);
});

test('normalizeTrainingMetric recovers nested gpu stats from raw JSON log payload', () => {
  const raw = '__JSON_LOG__{"event":"gpu_warning","context":{"warnings":["GPU利用率低"],"stats":{"gpu_memory_used_gb":4.2,"gpu_memory_total_gb":6,"gpu_memory_percent":70.1}}}';
  const metric = normalizeTrainingMetric({
    event: 'gpu_warning',
    raw
  }, { raw });

  assert.equal(metric.gpu_memory_used_gb, 4.2);
  assert.equal(metric.gpu_memory_total_gb, 6);
  assert.equal(metric.gpu_memory_percent, 70.1);
  assert.deepEqual(metric.gpu_warnings, ['GPU利用率低']);
});
