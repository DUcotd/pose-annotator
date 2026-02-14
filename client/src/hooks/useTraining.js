import { useState, useEffect, useRef, useCallback } from 'react';

export const useTraining = (projectId) => {
    const [config, setConfig] = useState({
        model: 'yolov8n.pt',
        data: '',
        epochs: 10,
        batch: 8,
        imgsz: 640,
        device: '0',
        project: '',
        name: 'exp_auto',

        augmentationEnabled: true,
        degrees: 0,
        translate: 0.1,
        scale: 0.5,
        shear: 0,
        perspective: 0,
        fliplr: 0.5,
        flipud: 0,
        hsv_h: 0.015,
        hsv_s: 0.7,
        hsv_v: 0.4,
        mosaic: 1.0,
        mixup: 0,
        copy_paste: 0,
        erasing: 0.4,
        crop_fraction: 1.0
    });

    const [status, setStatus] = useState('idle');
    const [logs, setLogs] = useState([]);
    const [metrics, setMetrics] = useState([]);
    const [stats, setStats] = useState(null);
    const pollIntervalRef = useRef(null);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);

    const checkStatus = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${projectId}/train/status`);
            const data = await res.json();

            setStatus(data.status);
            setLogs(data.logs || []);
            setMetrics(data.metrics || []);

            if (data.status === 'running') {
                if (!pollIntervalRef.current) {
                    pollIntervalRef.current = setInterval(checkStatus, 2000);
                }
            } else {
                stopPolling();
            }
        } catch (err) {
            console.error("Failed to check status", err);
        }
    }, [projectId, stopPolling]);

    const fetchStats = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${projectId}/dataset/stats`);
            const data = await res.json();
            setStats(data);
        } catch (err) {
            console.error("Failed to fetch stats", err);
        }
    }, [projectId]);

    useEffect(() => {
        if (projectId) {
            checkStatus();
            fetchStats();
        }
        return () => stopPolling();
    }, [projectId, checkStatus, fetchStats, stopPolling]);

    const handleStart = async () => {
        try {
            setStatus('starting');
            const res = await fetch(`http://localhost:5000/api/projects/${projectId}/train`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const data = await res.json();

            if (res.ok) {
                setStatus('running');
                setLogs([]);
                checkStatus(); // Start polling
            } else {
                setStatus('failed');
                throw new Error(data.error || 'Unknown error');
            }
        } catch (err) {
            setStatus('failed');
            throw err;
        }
    };

    const handleStop = async () => {
        try {
            await fetch(`http://localhost:5000/api/projects/${projectId}/train/stop`, { method: 'POST' });
            checkStatus();
        } catch (err) {
            console.error("Failed to stop", err);
        }
    };

    const handleBrowseData = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/utils/select-file', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to open file picker');
            const data = await res.json();
            if (data.path) setConfig(prev => ({ ...prev, data: data.path }));
        } catch (err) {
            console.error("Failed to browse file", err);
            throw err;
        }
    };

    const handleBrowseProject = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/utils/select-folder', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to open folder picker');
            const data = await res.json();
            if (data.path) setConfig(prev => ({ ...prev, project: data.path }));
        } catch (err) {
            console.error("Failed to browse folder", err);
            throw err;
        }
    };

    const updateConfig = (updates) => {
        setConfig(prev => ({ ...prev, ...updates }));
    };

    return {
        config,
        status,
        logs,
        metrics,
        stats,
        handleStart,
        handleStop,
        handleBrowseData,
        handleBrowseProject,
        updateConfig,
        refreshStats: fetchStats
    };
};
