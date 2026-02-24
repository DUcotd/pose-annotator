import { useState, useEffect, useRef, useCallback } from 'react';
import { useProject } from '../context/ProjectContext';
import { normalizeTrainingMetric, hasCoreMetricValue } from '../utils/trainingMetrics';
import { apiClient } from '../lib/apiClient';
import { apiUrl } from '../api';
import { useErrorCenter } from '../error/ErrorCenter';

const DEFAULT_TRAINING_CONFIG = {
    model: 'yolov8n-pose.pt',
    data: '',
    epochs: 200,
    batch: 16,
    imgsz: 640,
    device: '0',
    project: '',
    name: 'exp_auto',

    hardwareEnabled: false,
    workers: 0,
    cache_images: false,

    strategyEnabled: false,
    patience: 60,
    cos_lr: true,
    optimizer: 'auto',
    rect: true,

    augmentationEnabled: false,
    degrees: 180,
    translate: 0.2,
    scale: 0.6,
    shear: 0,
    perspective: 0.001,
    fliplr: 0.5,
    flipud: 0.5,
    hsv_h: 0.015,
    hsv_s: 0.7,
    hsv_v: 0.4,
    mosaic: 0.0,
    close_mosaic: 0,
    mixup: 0,
    copy_paste: 0,
    erasing: 0.4,
    crop_fraction: 1.0,

    lossEnabled: false,
    loss_pose: 25.0,
    loss_box: 7.5,
    loss_cls: 0.5,
    resume: false,
    export_formats: '',

    remoteEnabled: false,
    remoteHost: '',
    remotePort: 22,
    remoteUser: '',
    remotePassword: '',
    remotePath: '/tmp/training',
    remotePython: 'python3'
};

const EVENT_RING_LIMIT = 2000;
const POLL_INTERVAL_MS = 2000;
const SSE_RECONNECT_BASE_MS = 1200;
const SSE_RECONNECT_MAX_MS = 15000;
const SSE_STALE_TIMEOUT_MS = 45000;
const METRIC_LIKE_EVENT_KEYS = new Set([
    'epoch_end',
    'validation_complete',
    'performance_benchmark',
    'per_keypoint_metrics',
    'gpu_summary',
    'visual_validation',
    'gpu_warning',
    'validation_row',
    'validation_metrics'
]);

const normalizeEventKey = (value) => String(value || '').trim().toLowerCase();

const parseContentDispositionFilename = (contentDisposition, fallbackName) => {
    if (!contentDisposition) return fallbackName;
    const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^'";\s]+)/i);
    if (!filenameMatch) return fallbackName;
    try {
        return decodeURIComponent(filenameMatch[1]);
    } catch {
        return fallbackName;
    }
};

const mapLegacyLogTypeToLevel = (type) => {
    const t = String(type || '').toLowerCase();
    if (t === 'error') return 'error';
    if (t === 'stderr') return 'warn';
    if (t === 'suggestion') return 'warn';
    if (t === 'system') return 'info';
    if (t === 'metric') return 'info';
    return 'info';
};

const mapLegacyLogTypeToKind = (type) => {
    const t = String(type || '').toLowerCase();
    if (t === 'metric') return 'metric';
    if (t === 'error' || t === 'stderr' || t === 'suggestion') return 'diagnostic';
    if (t === 'system') return 'status';
    return 'raw';
};

const normalizeLegacyLogToEvent = (log, idx) => {
    const ts = Number(log?.time || Date.now());
    const iso = Number.isFinite(ts) ? new Date(ts).toISOString() : new Date().toISOString();
    const type = String(log?.type || 'log').toLowerCase();

    return {
        schemaVersion: 1,
        runId: 'legacy',
        seq: idx + 1,
        ts: iso,
        source: type === 'stderr' ? 'py_stderr' : 'server',
        level: mapLegacyLogTypeToLevel(type),
        stage: 'train',
        kind: mapLegacyLogTypeToKind(type),
        code: `LEGACY_${String(log?.type || 'log').toUpperCase()}`,
        message: String(log?.msg || ''),
        details: log || {},
        raw: String(log?.msg || '')
    };
};

const isMetricLikeEvent = (event) => {
    if (!event || typeof event !== 'object') return false;

    if (String(event.kind || '').toLowerCase() === 'metric') return true;

    const detailEvent = normalizeEventKey(event?.details?.event);
    const code = normalizeEventKey(event?.code);

    return METRIC_LIKE_EVENT_KEYS.has(detailEvent) || METRIC_LIKE_EVENT_KEYS.has(code);
};

const trimString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeTrainingConfigForSubmit = (config = {}) => {
    const normalized = {
        ...config,
        name: trimString(config.name) || 'exp_auto'
    };

    if (normalized.remoteEnabled === true) {
        const remotePortNum = Number.parseInt(config.remotePort, 10);
        normalized.remoteHost = trimString(config.remoteHost);
        normalized.remoteUser = trimString(config.remoteUser);
        normalized.remotePassword = typeof config.remotePassword === 'string' ? config.remotePassword : '';
        normalized.remotePath = trimString(config.remotePath) || '/tmp/training';
        normalized.remotePython = trimString(config.remotePython) || 'python3';
        normalized.remotePort = Number.isInteger(remotePortNum) ? remotePortNum : 22;
    }

    return normalized;
};

const validateRemoteConfigBeforeStart = (config = {}) => {
    if (config.remoteEnabled !== true) return null;

    const missingFields = [];
    if (!trimString(config.remoteHost)) missingFields.push('主机');
    if (!Number.isInteger(Number(config.remotePort)) || Number(config.remotePort) < 1 || Number(config.remotePort) > 65535) {
        missingFields.push('端口(1-65535)');
    }
    if (!trimString(config.remoteUser)) missingFields.push('用户名');
    if (!trimString(config.remotePassword)) missingFields.push('密码');
    if (!trimString(config.remotePath)) missingFields.push('远程工作路径');
    if (!trimString(config.remotePython)) missingFields.push('Python 解释器路径');

    if (missingFields.length > 0) {
        return `远程训练配置不完整: ${missingFields.join('、')}`;
    }

    if (!trimString(config.remotePath).startsWith('/')) {
        return '远程工作路径必须是 Linux 绝对路径（以 / 开头）';
    }

    return null;
};

export const useTraining = (projectId) => {
    const { projectConfig, updateProjectConfig } = useProject();
    const { reportError } = useErrorCenter();
    const encodedProjectId = encodeURIComponent(projectId || '');

    const [config, setConfig] = useState(() => ({
        ...DEFAULT_TRAINING_CONFIG,
        ...(projectConfig.trainingSettings || {})
    }));

    useEffect(() => {
        setConfig({
            ...DEFAULT_TRAINING_CONFIG,
            ...(projectConfig.trainingSettings || {})
        });
    }, [projectConfig.trainingSettings]);

    const [status, setStatus] = useState('idle');
    const [envInfo, setEnvInfo] = useState(null);
    const [logs, setLogs] = useState([]);
    const [metrics, setMetrics] = useState([]);
    const [stats, setStats] = useState(null);
    const [datasetInfo, setDatasetInfo] = useState(null);

    const [eventsV2, setEventsV2] = useState([]);
    const [diagnosisV2, setDiagnosisV2] = useState(null);
    const [runsV2, setRunsV2] = useState([]);
    const [cursor, setCursor] = useState(0);
    const [connectionState, setConnectionState] = useState('disconnected');
    const [streamMode, setStreamMode] = useState('idle');
    const [runId, setRunId] = useState(null);
    const [v2Supported, setV2Supported] = useState(true);

    const pollIntervalRef = useRef(null);
    const eventSourceRef = useRef(null);
    const fallbackPollRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const streamWatchdogRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const cursorRef = useRef(0);
    const runIdRef = useRef(null);
    const v2SupportedRef = useRef(true);
    const connectV2StreamRef = useRef(null);

    const updateRunId = useCallback((nextRunId) => {
        if (!nextRunId) return;

        if (runIdRef.current && runIdRef.current !== nextRunId) {
            cursorRef.current = 0;
            setCursor(0);
            setEventsV2([]);
            setMetrics([]);
            setDiagnosisV2(null);
        }

        runIdRef.current = nextRunId;
        setRunId(nextRunId);
    }, []);

    const mergeMetrics = useCallback((incomingMetrics) => {
        if (!incomingMetrics || incomingMetrics.length === 0) return;

        const normalizedIncoming = incomingMetrics
            .map((metric) => normalizeTrainingMetric(metric))
            .filter((metric) => hasCoreMetricValue(metric));

        if (normalizedIncoming.length === 0) return;

        setMetrics((prev) => {
            const byKey = new Map();
            prev.forEach((m, idx) => {
                const key = `${m.runId || 'legacy'}:${m.seq || m.epoch || idx}`;
                byKey.set(key, m);
            });
            normalizedIncoming.forEach((m, idx) => {
                const key = `${m.runId || 'legacy'}:${m.seq || `${m.event || 'metric'}:${m.epoch || 'na'}:${m.time || idx}`}`;
                byKey.set(key, m);
            });
            const merged = Array.from(byKey.values()).sort((a, b) => {
                const sa = Number(a.seq || 0);
                const sb = Number(b.seq || 0);
                if (sa !== sb) return sa - sb;
                return Number(a.time || 0) - Number(b.time || 0);
            });
            return merged.slice(-EVENT_RING_LIMIT);
        });
    }, []);

    const mergeEvents = useCallback((incomingEvents) => {
        if (!incomingEvents || incomingEvents.length === 0) return;

        setEventsV2((prev) => {
            const byKey = new Map();
            prev.forEach((event, idx) => {
                const key = `${event.runId || 'legacy'}:${event.seq || idx}`;
                byKey.set(key, event);
            });
            incomingEvents.forEach((event, idx) => {
                const key = `${event.runId || 'legacy'}:${event.seq || `new-${idx}`}`;
                byKey.set(key, event);
            });

            const merged = Array.from(byKey.values()).sort((a, b) => {
                const sa = Number(a.seq || 0);
                const sb = Number(b.seq || 0);
                if (sa !== sb) return sa - sb;
                return String(a.ts || '').localeCompare(String(b.ts || ''));
            });

            return merged.slice(-EVENT_RING_LIMIT);
        });

        const maxSeq = Math.max(...incomingEvents.map((e) => Number(e.seq || 0)));
        if (maxSeq > cursorRef.current) {
            cursorRef.current = maxSeq;
            setCursor(maxSeq);
        }

        const metricEvents = incomingEvents
            .filter((event) => isMetricLikeEvent(event))
            .map((event) => normalizeTrainingMetric({
                ...(event.details || {}),
                raw: event.raw
            }, {
                runId: event.runId,
                seq: event.seq,
                ts: event.ts,
                event: event?.details?.event || event.code,
                code: event.code,
                stage: event.stage,
                raw: event.raw
            }))
            .filter((metric) => hasCoreMetricValue(metric));
        mergeMetrics(metricEvents);
    }, [mergeMetrics]);

    const stopFallbackPolling = useCallback(() => {
        if (fallbackPollRef.current) {
            clearInterval(fallbackPollRef.current);
            fallbackPollRef.current = null;
        }
    }, []);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);

    const closeEventSource = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    }, []);

    const clearReconnectTimer = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
    }, []);

    const clearStreamWatchdog = useCallback(() => {
        if (streamWatchdogRef.current) {
            clearTimeout(streamWatchdogRef.current);
            streamWatchdogRef.current = null;
        }
    }, []);

    const handleV2Unsupported = useCallback(() => {
        if (!v2SupportedRef.current) return;
        v2SupportedRef.current = false;
        setV2Supported(false);
        setStreamMode('legacy');
        setConnectionState('legacy');
        clearReconnectTimer();
        clearStreamWatchdog();
        stopFallbackPolling();
        closeEventSource();
    }, [stopFallbackPolling, closeEventSource, clearReconnectTimer, clearStreamWatchdog]);

    const fetchEnvInfo = useCallback(async () => {
        try {
            const data = await apiClient.get('/api/settings/check-env');
            setEnvInfo(data);
        } catch (err) {
            console.error('Failed to fetch environment info', err);
            reportError(err, { source: 'training.fetch-env', projectId });
        }
    }, [projectId, reportError]);

    const fetchDatasetInfo = useCallback(async () => {
        if (!projectId) return;
        try {
            const data = await apiClient.get(`/api/projects/${encodedProjectId}/dataset/info`);
            setDatasetInfo(data);
        } catch (err) {
            console.error('Failed to fetch dataset info', err);
            reportError(err, { source: 'training.fetch-dataset-info', projectId });
        }
    }, [projectId, reportError]);

    const fetchStats = useCallback(async () => {
        if (!projectId) return;
        try {
            const data = await apiClient.get(`/api/projects/${encodedProjectId}/dataset/stats`);
            setStats(data);
        } catch (err) {
            console.error('Failed to fetch stats', err);
            reportError(err, { source: 'training.fetch-stats', projectId });
        }
    }, [projectId, reportError]);

    const fetchV2Runs = useCallback(async () => {
        if (!projectId || !v2SupportedRef.current) return;
        try {
            const data = await apiClient.get(`/api/projects/${encodedProjectId}/train/v2/runs`);
            setRunsV2(data.runs || []);
        } catch (err) {
            if (err?.status === 404) {
                handleV2Unsupported();
                return;
            }
            console.error('Failed to fetch v2 runs', err);
            reportError(err, { source: 'training.fetch-v2-runs', projectId });
        }
    }, [projectId, handleV2Unsupported, reportError]);

    const fetchV2Status = useCallback(async () => {
        if (!projectId || !v2SupportedRef.current) return null;
        try {
            const data = await apiClient.get(`/api/projects/${encodedProjectId}/train/v2/status`);

            if (data.status) setStatus(data.status);
            if (Object.prototype.hasOwnProperty.call(data, 'diagnosis')) {
                setDiagnosisV2(data.diagnosis ?? null);
            }
            if (data.connectionState) setConnectionState(data.connectionState);
            if (data.runId) updateRunId(data.runId);
            if (Array.isArray(data.metrics) && data.metrics.length > 0) {
                mergeMetrics(data.metrics);
            }
            if (Array.isArray(data.previewEvents) && data.previewEvents.length > 0) {
                mergeEvents(data.previewEvents);
            }
            if (Number.isFinite(data.cursor) && data.cursor > cursorRef.current) {
                cursorRef.current = data.cursor;
                setCursor(data.cursor);
            }
            return data;
        } catch (err) {
            if (err?.status === 404) {
                handleV2Unsupported();
                return null;
            }
            console.error('Failed to fetch v2 status', err);
            reportError(err, { source: 'training.fetch-v2-status', projectId });
            return null;
        }
    }, [projectId, mergeEvents, mergeMetrics, updateRunId, handleV2Unsupported, reportError]);

    const fetchV2Events = useCallback(async (inputCursor = null, options = {}) => {
        if (!projectId || !v2SupportedRef.current) return null;
        const nextCursor = inputCursor == null ? cursorRef.current : inputCursor;
        const selectedRunId = options.runId || runIdRef.current;
        try {
            const params = new URLSearchParams({
                cursor: String(nextCursor || 0),
                limit: '200'
            });
            if (selectedRunId) {
                params.set('runId', selectedRunId);
            }
            const data = await apiClient.get(`/api/projects/${encodedProjectId}/train/v2/events?${params.toString()}`);
            if (Array.isArray(data.events) && data.events.length > 0) {
                mergeEvents(data.events);
            }
            if (Number.isFinite(data.cursor) && data.cursor > cursorRef.current) {
                cursorRef.current = data.cursor;
                setCursor(data.cursor);
            }
            if (data.runId) updateRunId(data.runId);
            return data;
        } catch (err) {
            if (err?.status === 404) {
                handleV2Unsupported();
                return null;
            }
            console.error('Failed to fetch v2 events', err);
            reportError(err, { source: 'training.fetch-v2-events', projectId });
            return null;
        }
    }, [projectId, mergeEvents, updateRunId, handleV2Unsupported, reportError]);

    const startFallbackPolling = useCallback(() => {
        if (!projectId || fallbackPollRef.current || !v2SupportedRef.current) return;
        setStreamMode('polling');
        setConnectionState('polling');

        fallbackPollRef.current = setInterval(async () => {
            await fetchV2Status();
            await fetchV2Events();
            await fetchV2Runs();
        }, POLL_INTERVAL_MS);
    }, [projectId, fetchV2Status, fetchV2Events, fetchV2Runs]);

    const scheduleSseReconnect = useCallback((reason = 'error') => {
        if (!projectId || !v2SupportedRef.current) return;
        if (reconnectTimerRef.current) return;

        const nextAttempt = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = nextAttempt;
        const backoff = Math.min(
            SSE_RECONNECT_MAX_MS,
            SSE_RECONNECT_BASE_MS * (2 ** Math.min(nextAttempt - 1, 4))
        );

        reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            if (!v2SupportedRef.current || !projectId) return;
            const connect = connectV2StreamRef.current;
            if (typeof connect === 'function') {
                connect(reason);
            }
        }, backoff);
    }, [projectId]);

    const markStreamAlive = useCallback(() => {
        clearStreamWatchdog();
        streamWatchdogRef.current = setTimeout(() => {
            if (!v2SupportedRef.current) return;
            setConnectionState('reconnecting');
            closeEventSource();
            startFallbackPolling();
            scheduleSseReconnect('stale_timeout');
        }, SSE_STALE_TIMEOUT_MS);
    }, [clearStreamWatchdog, closeEventSource, scheduleSseReconnect, startFallbackPolling]);

    const connectV2Stream = useCallback((trigger = 'manual') => {
        if (!v2SupportedRef.current) {
            setStreamMode('legacy');
            setConnectionState('legacy');
            return;
        }
        if (!projectId || typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
            startFallbackPolling();
            return;
        }

        clearReconnectTimer();
        clearStreamWatchdog();
        stopFallbackPolling();
        closeEventSource();

        setStreamMode('sse');
        setConnectionState(trigger === 'manual' ? 'connecting' : 'reconnecting');

        const streamUrl = apiUrl(`/api/projects/${encodedProjectId}/train/v2/stream?lastSeq=${cursorRef.current || 0}`);
        const source = new window.EventSource(streamUrl);
        eventSourceRef.current = source;

        const safeParse = (raw) => {
            try {
                return JSON.parse(raw);
            } catch {
                return null;
            }
        };

        const handleAlive = () => {
            reconnectAttemptsRef.current = 0;
            setConnectionState('connected');
            markStreamAlive();
        };

        source.onopen = () => {
            handleAlive();
        };

        source.addEventListener('connected', (evt) => {
            const data = safeParse(evt.data);
            handleAlive();
            if (data?.status) setStatus(data.status);
            if (data && Object.prototype.hasOwnProperty.call(data, 'diagnosis')) {
                setDiagnosisV2(data.diagnosis ?? null);
            }
            if (data?.runId) updateRunId(data.runId);
            if (Number.isFinite(data?.cursor) && data.cursor > cursorRef.current) {
                cursorRef.current = data.cursor;
                setCursor(data.cursor);
            }
        });

        source.addEventListener('replay', (evt) => {
            const data = safeParse(evt.data);
            handleAlive();
            if (data?.events) mergeEvents(data.events);
            if (Number.isFinite(data?.cursor) && data.cursor > cursorRef.current) {
                cursorRef.current = data.cursor;
                setCursor(data.cursor);
            }
        });

        source.addEventListener('event', (evt) => {
            const event = safeParse(evt.data);
            if (!event) return;
            handleAlive();
            mergeEvents([event]);
        });

        source.addEventListener('metric', (evt) => {
            const payload = safeParse(evt.data);
            if (!payload) return;
            handleAlive();

            if (payload.kind === 'metric') {
                mergeEvents([payload]);
                return;
            }

            const metric = {
                ...payload,
                time: payload.time || Date.now()
            };
            mergeMetrics([metric]);
        });

        source.addEventListener('diagnosis', (evt) => {
            let diagnosis;
            try {
                diagnosis = JSON.parse(evt.data);
            } catch {
                return;
            }
            handleAlive();
            setDiagnosisV2(diagnosis ?? null);
        });

        source.addEventListener('replay_gap', async (evt) => {
            const payload = safeParse(evt.data);
            handleAlive();
            setConnectionState('polling');
            startFallbackPolling();
            await fetchV2Events(payload?.cursor ?? cursorRef.current, { runId: payload?.runId || runIdRef.current });
            scheduleSseReconnect('replay_gap');
        });

        source.addEventListener('status', (evt) => {
            const payload = safeParse(evt.data);
            if (!payload) return;
            handleAlive();
            if (payload.status) setStatus(payload.status);
            if (Number.isFinite(payload.seq) && payload.seq > cursorRef.current) {
                cursorRef.current = payload.seq;
                setCursor(payload.seq);
            }
        });

        source.addEventListener('heartbeat', () => {
            handleAlive();
        });

        source.onerror = () => {
            if (!v2SupportedRef.current) return;
            setConnectionState('reconnecting');
            clearStreamWatchdog();
            closeEventSource();
            startFallbackPolling();
            scheduleSseReconnect('sse_error');
        };
    }, [
        projectId,
        mergeEvents,
        mergeMetrics,
        closeEventSource,
        startFallbackPolling,
        stopFallbackPolling,
        fetchV2Events,
        updateRunId,
        scheduleSseReconnect,
        clearReconnectTimer,
        markStreamAlive,
        clearStreamWatchdog
    ]);

    useEffect(() => {
        connectV2StreamRef.current = connectV2Stream;
    }, [connectV2Stream]);

    const checkStatus = useCallback(async () => {
        if (!projectId) return;
        try {
            const data = await apiClient.get(`/api/projects/${encodedProjectId}/train/status`);

            setStatus(data.status);
            setLogs(data.logs || []);
            if (!v2SupportedRef.current) {
                const legacyEvents = (data.logs || []).map((log, idx) => normalizeLegacyLogToEvent(log, idx));
                setEventsV2(legacyEvents.slice(-EVENT_RING_LIMIT));

                if (data.status === 'failed') {
                    const latestErr = [...(data.logs || [])].reverse().find((item) =>
                        item.type === 'error' || item.type === 'stderr'
                    );
                    if (latestErr) {
                        setDiagnosisV2({
                            runId: 'legacy',
                            status: 'failed',
                            stage: 'train',
                            code: `LEGACY_${String(latestErr.type || 'ERROR').toUpperCase()}`,
                            rootCause: String(latestErr.msg || '训练失败'),
                            evidence: [String(latestErr.msg || '')],
                            suggestions: ['请升级到最新后端以启用结构化诊断卡与完整证据。'],
                            firstSeenAt: new Date(Number(latestErr.time || Date.now())).toISOString(),
                            lastSeenAt: new Date(Number(latestErr.time || Date.now())).toISOString()
                        });
                    }
                } else {
                    setDiagnosisV2(null);
                }
            }
            if (Array.isArray(data.metrics)) {
                setMetrics((prev) => (prev.length === 0 ? data.metrics : prev));
            }

            if (data.status === 'running') {
                if (!pollIntervalRef.current) {
                    pollIntervalRef.current = setInterval(checkStatus, POLL_INTERVAL_MS);
                }
            } else {
                stopPolling();
            }
        } catch (err) {
            console.error('Failed to check status', err);
            reportError(err, { source: 'training.check-status', projectId });
        }
    }, [projectId, stopPolling, reportError]);

    useEffect(() => {
        if (!projectId) return undefined;

        cursorRef.current = 0;
        setCursor(0);
        setEventsV2([]);
        setDiagnosisV2(null);
        setRunsV2([]);
        setRunId(null);
        runIdRef.current = null;
        setV2Supported(true);
        v2SupportedRef.current = true;
        setConnectionState('connecting');
        setStreamMode('idle');

        checkStatus();
        fetchV2Status();
        fetchV2Runs();
        fetchStats();
        fetchEnvInfo();
        fetchDatasetInfo();
        connectV2Stream();

        return () => {
            clearReconnectTimer();
            clearStreamWatchdog();
            stopPolling();
            stopFallbackPolling();
            closeEventSource();
        };
    }, [
        projectId,
        checkStatus,
        fetchV2Status,
        fetchV2Runs,
        fetchStats,
        fetchEnvInfo,
        fetchDatasetInfo,
        connectV2Stream,
        clearReconnectTimer,
        clearStreamWatchdog,
        stopPolling,
        stopFallbackPolling,
        closeEventSource
    ]);

    const handleStart = async () => {
        try {
            const submitConfig = normalizeTrainingConfigForSubmit(config);
            const remoteConfigError = validateRemoteConfigBeforeStart(submitConfig);
            if (remoteConfigError) {
                setStatus('idle');
                throw new Error(remoteConfigError);
            }

            setStatus('starting');
            setDiagnosisV2(null);
            setEventsV2([]);
            setMetrics([]);
            setCursor(0);
            cursorRef.current = 0;

            const data = await apiClient.post(`/api/projects/${encodedProjectId}/train`, submitConfig);

            setStatus('running');
            setLogs([]);
            if (data.runId) updateRunId(data.runId);
            connectV2Stream();
            checkStatus();
            await fetchV2Status();
            await fetchV2Runs();
        } catch (err) {
            setStatus('failed');
            reportError(err, { source: 'training.start', projectId });
            throw err;
        }
    };

    const handleStop = async () => {
        try {
            await apiClient.post(`/api/projects/${encodedProjectId}/train/stop`, {});
            await checkStatus();
            await fetchV2Status();
        } catch (err) {
            console.error('Failed to stop', err);
            reportError(err, { source: 'training.stop', projectId });
        }
    };

    const handleBrowseData = async () => {
        try {
            const data = await apiClient.post('/api/utils/select-file', {});
            if (data.path) setConfig((prev) => ({ ...prev, data: data.path }));
        } catch (err) {
            console.error('Failed to browse file', err);
            reportError(err, { source: 'training.browse-data', projectId });
            throw err;
        }
    };

    const handleBrowseProject = async () => {
        try {
            const data = await apiClient.post('/api/utils/select-folder', {});
            if (data.path) setConfig((prev) => ({ ...prev, project: data.path }));
        } catch (err) {
            console.error('Failed to browse folder', err);
            reportError(err, { source: 'training.browse-project', projectId });
            throw err;
        }
    };

    const updateConfig = (updates) => {
        const newConfig = { ...config, ...updates };
        setConfig(newConfig);
        updateProjectConfig(projectId, { trainingSettings: newConfig });
    };

    const exportLogs = async (options = {}) => {
        if (!projectId) {
            throw new Error('项目ID不存在');
        }

        const payload = {
            runId: options.runId || runId,
            format: options.format || 'json'
        };

        try {
            const response = await apiClient.requestRaw(`/api/projects/${encodedProjectId}/train/v2/export`, {
                method: 'POST',
                body: payload
            });

            const contentDisposition = response.headers.get('Content-Disposition');
            const defaultFilename = `training_diagnosis_${projectId}_${new Date().toISOString().slice(0, 10)}.${payload.format === 'zip' ? 'zip' : 'json'}`;
            const filename = parseContentDispositionFilename(contentDisposition, defaultFilename);

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            return { success: true, filename };
        } catch (err) {
            console.error('Failed to export logs:', err);
            reportError(err, { source: 'training.export-logs', projectId });
            throw err;
        }
    };

    const exportLogsToFile = async (options = {}) => {
        if (!projectId) {
            throw new Error('项目ID不存在');
        }

        const payload = {
            runId: options.runId || runId,
            format: options.format || 'json'
        };

        try {
            const data = await apiClient.post(`/api/projects/${encodedProjectId}/train/v2/export-to-file`, payload);
            return data;
        } catch (err) {
            console.error('Failed to export logs to file:', err);
            reportError(err, { source: 'training.export-logs-to-file', projectId });
            throw err;
        }
    };

    const openLogFile = async (filePath = null) => {
        if (!projectId) {
            throw new Error('项目ID不存在');
        }

        try {
            const data = await apiClient.post(`/api/projects/${encodedProjectId}/train/logs/open`, { filePath });
            return data;
        } catch (err) {
            console.error('Failed to open log file:', err);
            reportError(err, { source: 'training.open-log-file', projectId });
            throw err;
        }
    };

    const openLogsFolder = async () => {
        if (!projectId) {
            throw new Error('项目ID不存在');
        }

        try {
            const data = await apiClient.post(`/api/projects/${encodedProjectId}/train/logs/open-folder`, {});
            return data;
        } catch (err) {
            console.error('Failed to open logs folder:', err);
            reportError(err, { source: 'training.open-logs-folder', projectId });
            throw err;
        }
    };

    return {
        config,
        status,
        envInfo,
        logs,
        metrics,
        stats,
        datasetInfo,
        eventsV2,
        diagnosisV2,
        runsV2,
        cursor,
        connectionState,
        streamMode,
        v2Supported,
        runId,
        handleStart,
        handleStop,
        handleBrowseData,
        handleBrowseProject,
        updateConfig,
        refreshStats: fetchStats,
        refreshEnv: fetchEnvInfo,
        refreshDatasetInfo: fetchDatasetInfo,
        refreshV2Status: fetchV2Status,
        refreshV2Events: fetchV2Events,
        refreshV2Runs: fetchV2Runs,
        exportLogs,
        exportLogsToFile,
        openLogFile,
        openLogsFolder
    };
};
