import { useState, useEffect, useRef, useCallback } from 'react';
import { useProject } from '../context/ProjectContext';

export const useTraining = (projectId) => {
    const { projectConfig, updateProjectConfig } = useProject();

    const [config, setConfig] = useState({
        model: 'yolov8n-pose.pt',
        data: '',
        epochs: 150,
        batch: 2,
        imgsz: 1280,
        device: '0',
        project: '',
        name: 'exp_3',

        workers: 0,
        cache_images: false,
        patience: 60,
        cos_lr: true,
        optimizer: 'auto',
        rect: true,

        augmentationEnabled: true,
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

        loss_pose: 25.0,
        loss_box: 7.5,
        loss_cls: 0.5,
        resume: false,
        export_formats: '',
        ...(projectConfig.trainingSettings || {})
    });

    // Handle project change or initial load
    useEffect(() => {
        if (projectConfig.trainingSettings) {
            setConfig(prev => ({ ...prev, ...projectConfig.trainingSettings }));
        }
    }, [projectConfig.trainingSettings]);

    const [status, setStatus] = useState('idle');
    const [envInfo, setEnvInfo] = useState(null);
    const [logs, setLogs] = useState([]);
    const [metrics, setMetrics] = useState([]);
    const [stats, setStats] = useState(null);
    const [datasetInfo, setDatasetInfo] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const pollIntervalRef = useRef(null);

    const fetchEnvInfo = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:5000/api/settings/check-env');
            const data = await res.json();
            setEnvInfo(data);
        } catch (err) {
            console.error("Failed to fetch environment info", err);
        }
    }, []);

    const fetchDatasetInfo = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${projectId}/dataset/info`);
            const data = await res.json();
            setDatasetInfo(data);
        } catch (err) {
            console.error("Failed to fetch dataset info", err);
        }
    }, [projectId]);

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
            fetchEnvInfo();
            fetchDatasetInfo();
        }
        return () => stopPolling();
    }, [projectId, checkStatus, fetchStats, fetchEnvInfo, fetchDatasetInfo, stopPolling]);

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
        const newConfig = { ...config, ...updates };
        setConfig(newConfig);
        // Persist to project config
        updateProjectConfig(projectId, { trainingSettings: newConfig });
    };

    return {
        config,
        status,
        envInfo,
        logs,
        metrics,
        stats,
        datasetInfo,
        showAdvanced,
        setShowAdvanced,
        handleStart,
        handleStop,
        handleBrowseData,
        handleBrowseProject,
        updateConfig,
        refreshStats: fetchStats,
        refreshEnv: fetchEnvInfo,
        refreshDatasetInfo: fetchDatasetInfo
    };
};
