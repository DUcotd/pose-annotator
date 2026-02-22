const CORE_NUMERIC_KEYS = [
  'epoch',
  'epochs',
  'totalEpochs',
  'box_loss',
  'pose_loss',
  'kobj_loss',
  'cls_loss',
  'dfl_loss',
  'train_loss',
  'mAP50',
  'mAP50_95',
  'pose_mAP50',
  'pose_mAP50_95',
  'box_precision',
  'box_recall',
  'pose_precision',
  'pose_recall',
  'learning_rate',
  'lr0',
  'lrf',
  'eta_seconds',
  'gpu_memory_used_gb',
  'gpu_memory_total_gb',
  'gpu_memory_percent',
  'gpu_utilization_percent',
  'gpu_temperature',
  'gpu_power_draw',
  'avg_memory_percent',
  'max_memory_percent',
  'avg_utilization_percent',
  'max_utilization_percent',
  'realtime_fps'
];

const EVENT_KEYS_WITHOUT_EPOCH = new Set([
  'performance_benchmark',
  'per_keypoint_metrics',
  'visual_validation',
  'gpu_summary',
  'validation_complete',
  'validation_metrics'
]);

const VALIDATION_SCALAR_KEYS = [
  'mAP50',
  'mAP50_95',
  'pose_mAP50',
  'pose_mAP50_95',
  'box_precision',
  'box_recall',
  'pose_precision',
  'pose_recall'
];

const pickObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseGpuMem = (value) => {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/([\d.]+)\s*G/i);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeEventName = (value) => String(value || '').trim().toLowerCase();

const tryParseRawJsonLog = (raw) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) return {};
  const marker = '__JSON_LOG__';
  const markerIndex = raw.indexOf(marker);
  const payload = markerIndex >= 0 ? raw.slice(markerIndex + marker.length).trim() : raw.trim();
  if (!payload) return {};
  try {
    const parsed = JSON.parse(payload);
    return pickObject(parsed);
  } catch {
    return {};
  }
};

const resolveTimeMs = (data, meta = {}) => {
  const direct = toNumber(data.time);
  if (direct !== undefined) return direct;

  const candidates = [
    data.ts,
    data.timestamp,
    data.time,
    meta.ts,
    meta.timestamp
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const parsed = Date.parse(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }

  return Date.now();
};

export const normalizeTrainingMetric = (rawMetric, meta = {}) => {
  const root = pickObject(rawMetric);
  const details = pickObject(root.details);
  const rootContext = pickObject(root.context);
  const rootStats = pickObject(root.stats);
  const detailsStats = pickObject(details.stats);
  const nestedRootMetrics = pickObject(root.metrics);
  const nestedDetailsMetrics = pickObject(details.metrics);
  const detailsContext = pickObject(details.context);
  const rootContextStats = pickObject(rootContext.stats);
  const detailsContextStats = pickObject(detailsContext.stats);
  const nestedRootContextMetrics = pickObject(rootContext.metrics);
  const nestedDetailsContextMetrics = pickObject(detailsContext.metrics);
  const rawLogPayload = tryParseRawJsonLog(root.raw ?? meta.raw);
  const rawContext = pickObject(rawLogPayload.context);
  const rawStats = pickObject(rawLogPayload.stats);
  const rawContextStats = pickObject(rawContext.stats);
  const nestedRawMetrics = pickObject(rawLogPayload.metrics);
  const nestedRawContextMetrics = pickObject(rawContext.metrics);

  const merged = {
    ...rawStats,
    ...rawContextStats,
    ...rootStats,
    ...detailsStats,
    ...rootContextStats,
    ...detailsContextStats,
    ...rawContext,
    ...rootContext,
    ...detailsContext,
    ...details,
    ...rawLogPayload,
    ...root,
    ...nestedRootMetrics,
    ...nestedDetailsMetrics,
    ...nestedRootContextMetrics,
    ...nestedDetailsContextMetrics,
    ...nestedRawMetrics,
    ...nestedRawContextMetrics
  };

  const event = String(
    merged.event ||
      meta.event ||
      merged.code ||
      meta.code ||
      'metric'
  );

  const normalized = {
    runId: merged.runId || meta.runId || null,
    seq: toNumber(merged.seq) ?? toNumber(meta.seq),
    ts: merged.ts || merged.timestamp || meta.ts || null,
    event,
    eventKey: normalizeEventName(event),
    code: merged.code || meta.code || event,
    stage: merged.stage || meta.stage || null
  };

  CORE_NUMERIC_KEYS.forEach((key) => {
    const value = toNumber(merged[key]);
    if (value !== undefined) normalized[key] = value;
  });

  if (normalized.epoch === undefined) {
    normalized.epoch = toNumber(merged.current_epoch);
  }
  if (normalized.epoch === undefined) {
    normalized.epoch = toNumber(merged.currentEpoch);
  }

  if (normalized.totalEpochs === undefined) {
    normalized.totalEpochs = toNumber(merged.total_epochs) ?? toNumber(merged.epochs);
  }

  if (normalized.mAP50 === undefined) {
    normalized.mAP50 = toNumber(merged.map50);
  }
  if (normalized.mAP50_95 === undefined) {
    normalized.mAP50_95 =
      toNumber(merged['mAP50-95']) ??
      toNumber(merged['map50_95']) ??
      toNumber(merged['map50-95']) ??
      toNumber(merged.map);
  }
  if (normalized.pose_mAP50_95 === undefined) {
    normalized.pose_mAP50_95 =
      toNumber(merged['pose_mAP50-95']) ??
      toNumber(merged['pose_map50_95']) ??
      toNumber(merged.pose_map);
  }
  if (normalized.box_precision === undefined) {
    normalized.box_precision = toNumber(merged.precision) ?? toNumber(merged.box_p);
  }
  if (normalized.box_recall === undefined) {
    normalized.box_recall = toNumber(merged.recall) ?? toNumber(merged.box_r);
  }

  if (normalized.gpu_memory_used_gb === undefined) {
    normalized.gpu_memory_used_gb = parseGpuMem(merged.gpu_mem);
  }
  if (normalized.box_loss === undefined) {
    const trainBoxLoss = toNumber(merged.train_box_loss);
    if (trainBoxLoss !== undefined) normalized.box_loss = trainBoxLoss;
  }
  if (normalized.pose_loss === undefined) {
    const trainPoseLoss = toNumber(merged.train_pose_loss);
    if (trainPoseLoss !== undefined) normalized.pose_loss = trainPoseLoss;
  }
  if (normalized.kobj_loss === undefined) {
    const trainKobjLoss = toNumber(merged.train_kobj_loss);
    if (trainKobjLoss !== undefined) normalized.kobj_loss = trainKobjLoss;
  }
  if (normalized.cls_loss === undefined) {
    const trainClsLoss = toNumber(merged.train_cls_loss);
    if (trainClsLoss !== undefined) normalized.cls_loss = trainClsLoss;
  }
  if (normalized.dfl_loss === undefined) {
    const trainDflLoss = toNumber(merged.train_dfl_loss);
    if (trainDflLoss !== undefined) normalized.dfl_loss = trainDflLoss;
  }

  if (merged.latency && typeof merged.latency === 'object') {
    normalized.latency = merged.latency;
  }
  if (merged.throughput && typeof merged.throughput === 'object') {
    normalized.throughput = merged.throughput;
  }
  if (merged.keypoints && Array.isArray(merged.keypoints)) {
    normalized.keypoints = merged.keypoints;
  }
  if (merged.samples && Array.isArray(merged.samples)) {
    normalized.samples = merged.samples;
  }
  if (typeof merged.output_dir === 'string') {
    normalized.output_dir = merged.output_dir;
  }
  if (typeof merged.meets_realtime_requirement === 'boolean') {
    normalized.meets_realtime_requirement = merged.meets_realtime_requirement;
  }
  if (Array.isArray(merged.gpu_warnings)) {
    normalized.gpu_warnings = merged.gpu_warnings;
  } else if (Array.isArray(merged.warnings)) {
    normalized.gpu_warnings = merged.warnings;
  }

  normalized.time = resolveTimeMs(merged, meta);
  return normalized;
};

export const hasCoreMetricValue = (metric) => {
  if (!metric || typeof metric !== 'object') return false;

  const hasAnyCoreNumber = CORE_NUMERIC_KEYS.some((key) => toNumber(metric[key]) !== undefined);
  if (hasAnyCoreNumber) return true;

  const eventKey = normalizeEventName(metric.event || metric.eventKey);
  if (EVENT_KEYS_WITHOUT_EPOCH.has(eventKey)) return true;
  if (Array.isArray(metric.keypoints) || Array.isArray(metric.samples)) return true;
  if (metric.latency || metric.throughput) return true;

  return false;
};

export const buildMetricTimeline = (metrics = []) => {
  const normalized = metrics
    .map((metric) => normalizeTrainingMetric(metric))
    .filter((metric) => hasCoreMetricValue(metric));

  // Process metrics in stream order first so validation rows without epoch can
  // inherit the latest known epoch from nearby epoch_end records.
  normalized.sort((a, b) => {
    const seqDiff = Number(a.seq || 0) - Number(b.seq || 0);
    if (seqDiff !== 0) return seqDiff;
    return Number(a.time || 0) - Number(b.time || 0);
  });

  // Some validation metrics may arrive without epoch metadata.
  // Attach them to the latest known epoch in the same ordered stream.
  let latestEpoch;
  let latestTotalEpochs;
  const enriched = normalized
    .map((metric) => {
      const epochNum = toNumber(metric.epoch);
      const totalEpochsNum = toNumber(metric.totalEpochs);

      if (epochNum !== undefined) {
        latestEpoch = epochNum;
        if (totalEpochsNum !== undefined) latestTotalEpochs = totalEpochsNum;
        return {
          ...metric,
          epoch: epochNum,
          ...(totalEpochsNum !== undefined ? { totalEpochs: totalEpochsNum } : {})
        };
      }

      const hasValidationScalar = VALIDATION_SCALAR_KEYS.some((key) => toNumber(metric[key]) !== undefined);
      if (hasValidationScalar && latestEpoch !== undefined) {
        return {
          ...metric,
          epoch: latestEpoch,
          ...(metric.totalEpochs === undefined && latestTotalEpochs !== undefined ? { totalEpochs: latestTotalEpochs } : {})
        };
      }

      return metric;
    })
    .filter((metric) => Number.isFinite(metric.epoch));

  const byEpoch = new Map();
  enriched.forEach((metric) => {
    const epochKey = Number(metric.epoch);
    const prev = byEpoch.get(epochKey) || { epoch: epochKey };
    byEpoch.set(epochKey, { ...prev, ...metric, epoch: epochKey });
  });

  return Array.from(byEpoch.values()).sort((a, b) => Number(a.epoch || 0) - Number(b.epoch || 0));
};

export const buildChartSeries = (metrics = [], key) => {
  const timeline = buildMetricTimeline(metrics);
  return timeline.filter((item) => toNumber(item[key]) !== undefined);
};

export const getLatestMetricByEvent = (metrics = [], targetEvent) => {
  const target = normalizeEventName(targetEvent);
  for (let i = metrics.length - 1; i >= 0; i -= 1) {
    const normalized = normalizeTrainingMetric(metrics[i]);
    if (normalizeEventName(normalized.event || normalized.eventKey) === target) {
      return normalized;
    }
  }
  return null;
};

const SNAPSHOT_KEYS = [
  'epoch',
  'totalEpochs',
  'box_loss',
  'pose_loss',
  'kobj_loss',
  'cls_loss',
  'dfl_loss',
  'mAP50',
  'mAP50_95',
  'pose_mAP50',
  'pose_mAP50_95',
  'box_precision',
  'box_recall',
  'pose_precision',
  'pose_recall',
  'learning_rate',
  'eta_seconds',
  'gpu_memory_used_gb',
  'gpu_memory_total_gb',
  'gpu_memory_percent',
  'gpu_utilization_percent',
  'gpu_temperature',
  'gpu_warnings',
  'event',
  'eventKey',
  'realtime_fps'
];

export const getLatestMetricSnapshot = (metrics = []) => {
  const normalized = metrics
    .map((metric) => normalizeTrainingMetric(metric))
    .filter((metric) => hasCoreMetricValue(metric));

  if (normalized.length === 0) return {};

  normalized.sort((a, b) => {
    const seqDiff = Number(a.seq || 0) - Number(b.seq || 0);
    if (seqDiff !== 0) return seqDiff;
    return Number(a.time || 0) - Number(b.time || 0);
  });

  const snapshot = {};
  const descending = [...normalized].reverse();
  const latestEpochRecord = [...descending].find((item) => Number.isFinite(item.epoch));
  if (latestEpochRecord) {
    snapshot.epoch = latestEpochRecord.epoch;
    snapshot.totalEpochs = latestEpochRecord.totalEpochs;
  }

  descending.forEach((metric) => {
    SNAPSHOT_KEYS.forEach((key) => {
      if (snapshot[key] === undefined && metric[key] !== undefined) {
        snapshot[key] = metric[key];
      }
    });
  });

  return snapshot;
};
