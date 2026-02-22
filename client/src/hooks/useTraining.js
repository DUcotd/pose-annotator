import { useState, useEffect, useRef, useCallback } from 'react';
import { useProject } from '../context/ProjectContext';

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

const normalizeMetricFromEvent = (event) => {
    const details = event?.details && typeof event.details === 'object' ? event.details : {};
    return {
        ...details,
        runId: event.runId,
        seq: event.seq,
        time: details.time || Date.parse(event.ts) || Date.now(),
        event: details.event || event.code
    };
};

export const useTraining = (projectId) => {
    const { projectConfig, updateProjectConfig } = useProject();

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

    const pollIntervalRef = useRef(null);
    const eventSourceRef = useRef(null);
    const fallbackPollRef = useRef(null);
    const cursorRef = useRef(0);
    const runIdRef = useRef(null);

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
        setMetrics((prev) => {
            const byKey = new Map();
            prev.forEach((m, idx) => {
                const key = `${m.runId || 'legacy'}:${m.seq || m.epoch || idx}`;
                byKey.set(key, m);
            });
            incomingMetrics.forEach((m, idx) => {
                const key = `${m.runId || 'legacy'}:${m.seq || m.epoch || `new-${idx}`}`;
                byKey.set(key, m);
            });
            const merged = Array.from(byKey.values()).sort((a, b) => {
                const ta = Number(a.time || 0);
                const tb = Number(b.time || 0);
                if (ta !== tb) return ta - tb;
                return Number(a.seq || 0) - Number(b.seq || 0);
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
            .filter((event) => event.kind === 'metric')
            .map(normalizeMetricFromEvent);
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

    const fetchEnvInfo = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:5000/api/settings/check-env');
            const data = await res.json();
            setEnvInfo(data);
        } catch (err) {
            console.error('Failed to fetch environment info', err);
        }
    }, []);

    const fetchDatasetInfo = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${projectId}/dataset/info`);
            const data = await res.json();
            setDatasetInfo(data);
        } catch (err) {
            console.error('Failed to fetch dataset info', err);
        }
    }, [projectId]);

    const fetchStats = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${projectId}/dataset/stats`);
            const data = await res.json();
            setStats(data);
        } catch (err) {
            console.error('Failed to fetch stats', err);
        }
    }, [projectId]);

    const fetchV2Runs = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${projectId}/train/v2/runs`);
            if (!res.ok) return;
            const data = await res.json();
            setRunsV2(data.runs || []);
        } catch (err) {
            console.error('Failed to fetch v2 runs', err);
        }
    }, [projectId]);

    const fetchV2Status = useCallback(async () => {
        if (!projectId) return null;
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${projectId}/train/v2/status`);
            if (!res.ok) return null;
            const data = await res.json();

            if (data.status) setStatus(data.status);
            if (data.diagnosis) setDiagnosisV2(data.diagnosis);
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
            console.error('Failed to fetch v2 status', err);
            return null;
        }
    }, [projectId, mergeEvents, mergeMetrics, updateRunId]);

    const fetchV2Events = useCallback(async (inputCursor = null, options = {}) => {
        if (!projectId) return null;
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
            const res = await fetch(`http://localhost:5000/api/projects/${projectId}/train/v2/events?${params.toString()}`);
            if (!res.ok) return null;
            const data = await res.json();
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
            console.error('Failed to fetch v2 events', err);
            return null;
        }
    }, [projectId, mergeEvents, updateRunId]);

    const startFallbackPolling = useCallback(() => {
        if (!projectId || fallbackPollRef.current) return;
        setStreamMode('polling');
        setConnectionState('polling');

        fallbackPollRef.current = setInterval(async () => {
            await fetchV2Status();
            await fetchV2Events();
            await fetchV2Runs();
        }, POLL_INTERVAL_MS);
    }, [projectId, fetchV2Status, fetchV2Events, fetchV2Runs]);

    const connectV2Stream = useCallback(() => {
        if (!projectId || typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
            startFallbackPolling();
            return;
        }

        stopFallbackPolling();
        closeEventSource();

        setStreamMode('sse');
        setConnectionState('connecting');

        const streamUrl = `http://localhost:5000/api/projects/${projectId}/train/v2/stream?lastSeq=${cursorRef.current || 0}`;
        const source = new window.EventSource(streamUrl);
        eventSourceRef.current = source;

        const safeParse = (raw) => {
            try {
                return JSON.parse(raw);
            } catch {
                return null;
            }
        };

        source.addEventListener('connected', (evt) => {
            const data = safeParse(evt.data);
            setConnectionState('connected');
            if (data?.status) setStatus(data.status);
            if (data?.diagnosis) setDiagnosisV2(data.diagnosis);
            if (data?.runId) updateRunId(data.runId);
            if (Number.isFinite(data?.cursor) && data.cursor > cursorRef.current) {
                cursorRef.current = data.cursor;
                setCursor(data.cursor);
            }
        });

        source.addEventListener('replay', (evt) => {
            const data = safeParse(evt.data);
            if (data?.events) mergeEvents(data.events);
            if (Number.isFinite(data?.cursor) && data.cursor > cursorRef.current) {
                cursorRef.current = data.cursor;
                setCursor(data.cursor);
            }
        });

        source.addEventListener('event', (evt) => {
            const event = safeParse(evt.data);
            if (!event) return;
            mergeEvents([event]);
        });

        source.addEventListener('metric', (evt) => {
            const payload = safeParse(evt.data);
            if (!payload) return;

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
            const diagnosis = safeParse(evt.data);
            if (!diagnosis) return;
            setDiagnosisV2(diagnosis);
        });

        source.addEventListener('replay_gap', async (evt) => {
            const payload = safeParse(evt.data);
            setConnectionState('polling');
            startFallbackPolling();
            await fetchV2Events(payload?.cursor ?? cursorRef.current, { runId: payload?.runId || runIdRef.current });
        });

        source.addEventListener('status', (evt) => {
            const payload = safeParse(evt.data);
            if (!payload) return;
            if (payload.status) setStatus(payload.status);
            if (Number.isFinite(payload.seq) && payload.seq > cursorRef.current) {
                cursorRef.current = payload.seq;
                setCursor(payload.seq);
            }
        });

        source.onerror = () => {
            setConnectionState('reconnecting');
            closeEventSource();
            startFallbackPolling();
        };
    }, [projectId, mergeEvents, mergeMetrics, closeEventSource, startFallbackPolling, stopFallbackPolling, fetchV2Events, updateRunId]);

    const checkStatus = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${projectId}/train/status`);
            const data = await res.json();

            setStatus(data.status);
            setLogs(data.logs || []);
            if (metrics.length === 0 && Array.isArray(data.metrics)) {
                setMetrics(data.metrics);
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
        }
    }, [projectId, stopPolling, metrics.length]);

    useEffect(() => {
        if (!projectId) return undefined;

        cursorRef.current = 0;
        setCursor(0);
        setEventsV2([]);
        setDiagnosisV2(null);
        setRunsV2([]);
        setRunId(null);
        runIdRef.current = null;
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
        stopPolling,
        stopFallbackPolling,
        closeEventSource
    ]);

    const handleStart = async () => {
        try {
            setStatus('starting');
            setDiagnosisV2(null);
            setEventsV2([]);
            setMetrics([]);
            setCursor(0);
            cursorRef.current = 0;

            const res = await fetch(`http://localhost:5000/api/projects/${projectId}/train`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const data = await res.json();

            if (!res.ok) {
                setStatus('failed');
                throw new Error(data.error || 'Unknown error');
            }

            setStatus('running');
            setLogs([]);
            if (data.runId) updateRunId(data.runId);
            connectV2Stream();
            checkStatus();
            await fetchV2Status();
            await fetchV2Runs();
        } catch (err) {
            setStatus('failed');
            throw err;
        }
    };

    const handleStop = async () => {
        try {
            await fetch(`http://localhost:5000/api/projects/${projectId}/train/stop`, { method: 'POST' });
            await checkStatus();
            await fetchV2Status();
        } catch (err) {
            console.error('Failed to stop', err);
        }
    };

    const handleBrowseData = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/utils/select-file', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to open file picker');
            const data = await res.json();
            if (data.path) setConfig((prev) => ({ ...prev, data: data.path }));
        } catch (err) {
            console.error('Failed to browse file', err);
            throw err;
        }
    };

    const handleBrowseProject = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/utils/select-folder', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to open folder picker');
            const data = await res.json();
            if (data.path) setConfig((prev) => ({ ...prev, project: data.path }));
        } catch (err) {
            console.error('Failed to browse folder', err);
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
            const response = await fetch(`http://localhost:5000/api/projects/${projectId}/train/v2/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: '导出失败' }));
                throw new Error(errorData.error || '导出结构化诊断包失败');
            }

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
            const response = await fetch(`http://localhost:5000/api/projects/${projectId}/train/v2/export-to-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '导出失败');
            }

            return data;
        } catch (err) {
            console.error('Failed to export logs to file:', err);
            throw err;
        }
    };

    const openLogFile = async (filePath = null) => {
        if (!projectId) {
            throw new Error('项目ID不存在');
        }

        try {
            const response = await fetch(`http://localhost:5000/api/projects/${projectId}/train/logs/open`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '打开文件失败');
            }

            return data;
        } catch (err) {
            console.error('Failed to open log file:', err);
            throw err;
        }
    };

    const openLogsFolder = async () => {
        if (!projectId) {
            throw new Error('项目ID不存在');
        }

        try {
            const response = await fetch(`http://localhost:5000/api/projects/${projectId}/train/logs/open-folder`, {
                method: 'POST'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '打开文件夹失败');
            }

            return data;
        } catch (err) {
            console.error('Failed to open logs folder:', err);
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
