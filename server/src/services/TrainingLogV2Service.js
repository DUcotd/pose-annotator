const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const logger = require('../utils/logger');

const SCHEMA_VERSION = 2;
const EVENT_RING_LIMIT = 2000;
const METRIC_RING_LIMIT = 2000;
const RAW_TAIL_LIMIT = 500;
const DEFAULT_LIMIT = 200;
const MAX_QUERY_LIMIT = 2000;
const DEFAULT_LOG_ROOT = path.join(__dirname, '..', '..', 'data', 'training_logs_v2');

const TERMINAL_STATUS = new Set(['completed', 'failed', 'stopped']);

class TrainingLogV2Service extends EventEmitter {
  constructor() {
    super();
    this.activeRuns = new Map();
  }

  sanitizeId(raw) {
    return String(raw || 'unknown').replace(/[^\w.-]/g, '_');
  }

  ensureDir(dirPath) {
    if (!dirPath) return;
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  generateRunId(projectId) {
    const safeProject = this.sanitizeId(projectId);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suffix = crypto.randomBytes(3).toString('hex');
    return `${safeProject}_${stamp}_${suffix}`;
  }

  getBaseDir(projectRoot, projectId) {
    if (projectRoot) {
      return path.join(projectRoot, 'runs', 'logs', 'v2');
    }
    return path.join(DEFAULT_LOG_ROOT, this.sanitizeId(projectId));
  }

  getRunDir(projectRoot, projectId, runId) {
    return path.join(this.getBaseDir(projectRoot, projectId), runId);
  }

  getRunFiles(runDir) {
    return {
      events: path.join(runDir, 'events.ndjson'),
      metrics: path.join(runDir, 'metrics.ndjson'),
      diagnosis: path.join(runDir, 'diagnosis.json'),
      manifest: path.join(runDir, 'manifest.json')
    };
  }

  trimToLimit(arr, limit) {
    if (arr.length <= limit) return arr;
    return arr.slice(arr.length - limit);
  }

  appendNdjson(filePath, obj) {
    fs.appendFileSync(filePath, `${JSON.stringify(obj)}\n`, 'utf8');
  }

  safeWriteJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  buildManifest(state) {
    return {
      schemaVersion: SCHEMA_VERSION,
      projectId: state.projectId,
      runId: state.runId,
      status: state.status,
      connectionState: state.connectionState,
      startTime: state.startTime,
      endTime: state.endTime,
      cursor: state.seq,
      counts: {
        events: state.totalEvents,
        metrics: state.totalMetrics
      },
      configSummary: state.configSummary || {}
    };
  }

  persistManifest(state) {
    try {
      this.safeWriteJson(state.files.manifest, this.buildManifest(state));
    } catch (err) {
      logger.warn(`[TrainingLogV2] Failed to persist manifest for ${state.projectId}: ${err.message}`);
    }
  }

  persistDiagnosis(state) {
    try {
      const payload = {
        schemaVersion: SCHEMA_VERSION,
        projectId: state.projectId,
        runId: state.runId,
        current: state.diagnosis,
        history: state.diagnosisHistory
      };
      this.safeWriteJson(state.files.diagnosis, payload);
    } catch (err) {
      logger.warn(`[TrainingLogV2] Failed to persist diagnosis for ${state.projectId}: ${err.message}`);
    }
  }

  createRun(projectId, projectRoot = null, configSummary = {}) {
    const runId = this.generateRunId(projectId);
    const runDir = this.getRunDir(projectRoot, projectId, runId);
    this.ensureDir(runDir);
    const files = this.getRunFiles(runDir);
    const nowIso = new Date().toISOString();

    const state = {
      schemaVersion: SCHEMA_VERSION,
      projectId,
      projectRoot,
      runId,
      runDir,
      files,
      seq: 0,
      status: 'starting',
      connectionState: 'initializing',
      startTime: nowIso,
      endTime: null,
      events: [],
      metrics: [],
      rawTail: [],
      totalEvents: 0,
      totalMetrics: 0,
      diagnosis: null,
      diagnosisHistory: [],
      configSummary
    };

    this.activeRuns.set(projectId, state);
    this.persistManifest(state);
    this.persistDiagnosis(state);
    return state;
  }

  getActiveRun(projectId) {
    return this.activeRuns.get(projectId) || null;
  }

  ensureActiveRun(projectId, projectRoot = null, configSummary = {}) {
    const active = this.getActiveRun(projectId);
    if (active) return active;
    return this.createRun(projectId, projectRoot, configSummary);
  }

  setConnectionState(projectId, connectionState) {
    const state = this.getActiveRun(projectId);
    if (!state) return null;
    state.connectionState = connectionState;
    this.persistManifest(state);
    return state;
  }

  setStatus(projectId, status) {
    const state = this.getActiveRun(projectId);
    if (!state) return null;

    state.status = status;
    if (TERMINAL_STATUS.has(status)) {
      state.endTime = new Date().toISOString();
    }
    this.persistManifest(state);

    const payload = {
      projectId,
      runId: state.runId,
      status: state.status,
      ts: new Date().toISOString(),
      seq: state.seq
    };
    this.emit('status', payload);
    return payload;
  }

  toEventEnvelope(state, eventInput = {}) {
    const seq = ++state.seq;
    const ts = new Date().toISOString();

    return {
      schemaVersion: SCHEMA_VERSION,
      runId: state.runId,
      seq,
      ts,
      source: eventInput.source || 'server',
      level: eventInput.level || 'info',
      stage: eventInput.stage || 'unknown',
      kind: eventInput.kind || 'raw',
      code: eventInput.code || 'LOG_LINE',
      message: eventInput.message || '',
      details: eventInput.details || undefined,
      raw: eventInput.raw || undefined
    };
  }

  appendEvent(projectId, eventInput = {}) {
    const state = this.ensureActiveRun(projectId);
    const event = this.toEventEnvelope(state, eventInput);

    state.events.push(event);
    state.events = this.trimToLimit(state.events, EVENT_RING_LIMIT);
    state.totalEvents += 1;

    if (event.raw || event.source === 'py_stderr') {
      state.rawTail.push(event.raw || event.message);
      state.rawTail = this.trimToLimit(state.rawTail, RAW_TAIL_LIMIT);
    }

    try {
      this.appendNdjson(state.files.events, event);
    } catch (err) {
      logger.warn(`[TrainingLogV2] Failed to append event for ${projectId}: ${err.message}`);
    }

    this.persistManifest(state);
    this.emit('event', { projectId, event });
    return event;
  }

  appendMetric(projectId, metricPayload = {}, meta = {}) {
    const event = this.appendEvent(projectId, {
      source: meta.source || 'py_stdout',
      level: meta.level || 'info',
      stage: meta.stage || 'train',
      kind: 'metric',
      code: meta.code || 'TRAIN_METRIC',
      message: meta.message || metricPayload.event || 'metric',
      details: metricPayload,
      raw: meta.raw
    });

    const state = this.getActiveRun(projectId);
    if (!state) return event;

    const metricRecord = {
      ...metricPayload,
      runId: state.runId,
      seq: event.seq,
      ts: event.ts
    };

    state.metrics.push(metricRecord);
    state.metrics = this.trimToLimit(state.metrics, METRIC_RING_LIMIT);
    state.totalMetrics += 1;

    try {
      this.appendNdjson(state.files.metrics, metricRecord);
    } catch (err) {
      logger.warn(`[TrainingLogV2] Failed to append metric for ${projectId}: ${err.message}`);
    }

    this.persistManifest(state);
    this.emit('metric', { projectId, metric: metricRecord, event });
    return metricRecord;
  }

  getRawTail(projectId) {
    const state = this.getActiveRun(projectId);
    return state ? [...state.rawTail] : [];
  }

  updateDiagnosis(projectId, patch = {}) {
    const state = this.ensureActiveRun(projectId);
    const now = new Date().toISOString();
    const prev = state.diagnosis;

    const next = {
      runId: state.runId,
      status: patch.status || 'failed',
      stage: patch.stage || 'unknown',
      code: patch.code || 'UNKNOWN_ERROR',
      rootCause: patch.rootCause || '训练失败',
      evidence: Array.isArray(patch.evidence) ? patch.evidence.slice(-50) : [],
      suggestions: Array.isArray(patch.suggestions) ? patch.suggestions : [],
      rawTail: Array.isArray(patch.rawTail) ? patch.rawTail.slice(-RAW_TAIL_LIMIT) : this.getRawTail(projectId),
      firstSeenAt: prev && prev.code === patch.code ? prev.firstSeenAt : now,
      lastSeenAt: now
    };

    if (prev && prev.code !== next.code) {
      state.diagnosisHistory.push(prev);
      state.diagnosisHistory = this.trimToLimit(state.diagnosisHistory, 50);
    }

    state.diagnosis = next;
    this.persistDiagnosis(state);
    this.persistManifest(state);

    this.emit('diagnosis', { projectId, diagnosis: next });
    return next;
  }

  getStatus(projectId) {
    const state = this.getActiveRun(projectId);
    if (!state) {
      return {
        schemaVersion: SCHEMA_VERSION,
        status: 'idle',
        runId: null,
        cursor: 0,
        connectionState: 'disconnected',
        diagnosis: null,
        metrics: [],
        previewEvents: []
      };
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      status: state.status,
      runId: state.runId,
      cursor: state.seq,
      connectionState: state.connectionState,
      diagnosis: state.diagnosis,
      metrics: [...state.metrics],
      previewEvents: state.events.slice(-100),
      startTime: state.startTime,
      endTime: state.endTime,
      counts: {
        events: state.totalEvents,
        metrics: state.totalMetrics
      }
    };
  }

  normalizeFilterParam(value) {
    if (!value) return null;
    if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
    return String(value)
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
  }

  getEvents(projectId, options = {}) {
    const {
      runId,
      cursor = 0,
      limit = DEFAULT_LIMIT,
      levels,
      stages,
      kinds,
      codes,
      search,
      order = 'asc'
    } = options;

    const active = this.getActiveRun(projectId);
    const targetRunId = runId || (active ? active.runId : null);
    if (!targetRunId) {
      return { runId: null, cursor: Number(cursor || 0), events: [], hasMore: false };
    }

    const cursorNum = Number(cursor || 0);
    let sourceEvents = [];
    let resolvedRunId = targetRunId;

    if (active && active.runId === targetRunId) {
      const earliestSeq = active.events.length > 0
        ? Number(active.events[0].seq || 0)
        : Number(active.seq || 0) + 1;
      const needsDiskBackfill = cursorNum < Math.max(0, earliestSeq - 1);

      if (needsDiskBackfill) {
        const runDir = this.findRunDir(projectId, targetRunId, options.projectRoot);
        if (runDir) {
          const files = this.getRunFiles(runDir);
          sourceEvents = this.readNdjsonSafe(files.events);
        } else {
          sourceEvents = [...active.events];
        }
      } else {
        sourceEvents = [...active.events];
      }
      resolvedRunId = active.runId;
    } else {
      const runDir = this.findRunDir(projectId, targetRunId, options.projectRoot);
      if (!runDir) {
        return { runId: null, cursor: cursorNum, events: [], hasMore: false };
      }
      const files = this.getRunFiles(runDir);
      sourceEvents = this.readNdjsonSafe(files.events);

      const manifest = this.readJsonSafe(files.manifest, {});
      resolvedRunId = manifest.runId || targetRunId;
    }

    const levelSet = this.normalizeFilterParam(levels);
    const stageSet = this.normalizeFilterParam(stages);
    const kindSet = this.normalizeFilterParam(kinds);
    const codeSet = this.normalizeFilterParam(codes);
    const query = search ? String(search).toLowerCase() : '';

    let events = sourceEvents.filter(evt => Number(evt.seq || 0) > cursorNum);

    if (levelSet && levelSet.length > 0) {
      events = events.filter(evt => levelSet.includes(evt.level));
    }
    if (stageSet && stageSet.length > 0) {
      events = events.filter(evt => stageSet.includes(evt.stage));
    }
    if (kindSet && kindSet.length > 0) {
      events = events.filter(evt => kindSet.includes(evt.kind));
    }
    if (codeSet && codeSet.length > 0) {
      events = events.filter(evt => codeSet.includes(evt.code));
    }
    if (query) {
      events = events.filter(evt => {
        const hit = [
          evt.message,
          evt.code,
          evt.raw,
          evt.stage,
          evt.level,
          evt.kind,
          evt.details ? JSON.stringify(evt.details) : ''
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hit.includes(query);
      });
    }

    const numericLimit = Math.min(
      MAX_QUERY_LIMIT,
      Math.max(1, Number(limit || DEFAULT_LIMIT))
    );
    const hasMore = events.length > numericLimit;

    if (order === 'desc') {
      events = events.slice(-numericLimit).reverse();
    } else {
      events = events.slice(0, numericLimit);
    }

    const nextCursor = events.length > 0
      ? Math.max(...events.map(e => Number(e.seq || 0)))
      : cursorNum;

    return {
      runId: resolvedRunId,
      cursor: nextCursor,
      events,
      hasMore
    };
  }

  readJsonSafe(filePath, fallback) {
    try {
      if (!fs.existsSync(filePath)) return fallback;
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return fallback;
    }
  }

  readNdjsonSafe(filePath) {
    try {
      if (!fs.existsSync(filePath)) return [];
      const lines = fs.readFileSync(filePath, 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      return lines.map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }

  listRuns(projectId, projectRoot = null) {
    const active = this.getActiveRun(projectId);
    const root = projectRoot || (active ? active.projectRoot : null);
    const runsBaseDir = this.getBaseDir(root, projectId);
    const runs = [];

    if (fs.existsSync(runsBaseDir)) {
      const dirs = fs.readdirSync(runsBaseDir, { withFileTypes: true }).filter(d => d.isDirectory());
      dirs.forEach((dir) => {
        const runDir = path.join(runsBaseDir, dir.name);
        const files = this.getRunFiles(runDir);
        const manifest = this.readJsonSafe(files.manifest, null);
        if (manifest) {
          runs.push({
            runId: manifest.runId,
            status: manifest.status,
            startTime: manifest.startTime,
            endTime: manifest.endTime,
            cursor: manifest.cursor || 0,
            counts: manifest.counts || { events: 0, metrics: 0 }
          });
        }
      });
    }

    if (active && !runs.some(r => r.runId === active.runId)) {
      runs.push({
        runId: active.runId,
        status: active.status,
        startTime: active.startTime,
        endTime: active.endTime,
        cursor: active.seq,
        counts: { events: active.totalEvents, metrics: active.totalMetrics }
      });
    }

    runs.sort((a, b) => String(b.startTime || '').localeCompare(String(a.startTime || '')));
    return runs;
  }

  findRunDir(projectId, runId, projectRoot = null) {
    const active = this.getActiveRun(projectId);
    if (active && active.runId === runId) {
      return active.runDir;
    }

    const root = projectRoot || (active ? active.projectRoot : null);
    const candidate = this.getRunDir(root, projectId, runId);
    if (fs.existsSync(candidate)) return candidate;
    return null;
  }

  exportRun(projectId, options = {}) {
    const state = this.getActiveRun(projectId);
    const runId = options.runId || (state ? state.runId : null);
    if (!runId) {
      throw new Error('No runId available for export');
    }

    const runDir = this.findRunDir(projectId, runId, options.projectRoot);
    if (!runDir) {
      throw new Error(`Run not found: ${runId}`);
    }

    const files = this.getRunFiles(runDir);
    const manifest = this.readJsonSafe(files.manifest, {});
    const diagnosis = this.readJsonSafe(files.diagnosis, {});
    const events = this.readNdjsonSafe(files.events);
    const metrics = this.readNdjsonSafe(files.metrics);
    const payload = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      manifest,
      diagnosis,
      metrics,
      events
    };

    const format = String(options.format || 'json').toLowerCase();
    if (format === 'zip') {
      const zip = new AdmZip();
      zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
      zip.addFile('diagnosis.json', Buffer.from(JSON.stringify(diagnosis, null, 2), 'utf8'));
      zip.addFile('metrics.json', Buffer.from(JSON.stringify(metrics, null, 2), 'utf8'));
      zip.addFile('events.json', Buffer.from(JSON.stringify(events, null, 2), 'utf8'));
      zip.addFile('package.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
      return {
        format: 'zip',
        filename: `training_diagnosis_${runId}.zip`,
        contentType: 'application/zip',
        content: zip.toBuffer()
      };
    }

    return {
      format: 'json',
      filename: `training_diagnosis_${runId}.json`,
      contentType: 'application/json; charset=utf-8',
      content: JSON.stringify(payload, null, 2)
    };
  }

  saveExportToFile(projectId, outputPath, options = {}) {
    const result = this.exportRun(projectId, options);
    this.ensureDir(path.dirname(outputPath));

    if (Buffer.isBuffer(result.content)) {
      fs.writeFileSync(outputPath, result.content);
    } else {
      fs.writeFileSync(outputPath, result.content, 'utf8');
    }

    return {
      success: true,
      outputPath,
      runId: options.runId || (this.getActiveRun(projectId) ? this.getActiveRun(projectId).runId : null),
      format: result.format,
      filename: path.basename(outputPath),
      size: Buffer.isBuffer(result.content)
        ? result.content.length
        : Buffer.byteLength(result.content, 'utf8')
    };
  }
}

module.exports = new TrainingLogV2Service();
