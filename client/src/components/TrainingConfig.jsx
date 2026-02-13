import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    Play, Square, Terminal, Settings, CheckCircle, AlertTriangle, RefreshCw, 
    Database, Image as ImageIcon, FileText, FolderOpen, Cpu, Gauge, 
    Layers, HardDrive, Activity, Zap, ArrowLeft
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';

export const TrainingConfig = () => {
    const { currentProject, goBack } = useProject();
    const [config, setConfig] = useState({
        model: 'yolov8n.pt',
        data: '',
        epochs: 10,
        batch: 8,
        imgsz: 640,
        device: '0',
        project: '',
        name: 'exp_auto',
        
        // 数据增强开关
        augmentationEnabled: true,
        
        // 几何变换
        degrees: 0,
        translate: 0.1,
        scale: 0.5,
        shear: 0,
        perspective: 0,
        
        // 翻转
        fliplr: 0.5,
        flipud: 0,
        
        // 颜色变换
        hsv_h: 0.015,
        hsv_s: 0.7,
        hsv_v: 0.4,
        
        // 混合增强
        mosaic: 1.0,
        mixup: 0,
        copy_paste: 0,
        
        // 模糊和噪声
        blur: 0,
        noise: 0,
        
        // 其他
        erasing: 0.4,
        crop_fraction: 1.0
    });
    const [status, setStatus] = useState('idle');
    const [logs, setLogs] = useState([]);
    const [metrics, setMetrics] = useState([]);
    const [stats, setStats] = useState(null);
    const logEndRef = useRef(null);
    const pollIntervalRef = useRef(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const dropdownRef = useRef(null);
    const dropdownTriggerRef = useRef(null);

    const modelOptions = [
        { id: 'yolov8n.pt', label: 'YOLOv8n (Nano) - 轻量快速', size: '6.2MB', speed: '最快' },
        { id: 'yolov8s.pt', label: 'YOLOv8s (Small) - 均衡', size: '22.5MB', speed: '快速' },
        { id: 'yolov8m.pt', label: 'YOLOv8m (Medium) - 精度', size: '52MB', speed: '中等' },
        { id: 'yolov8l.pt', label: 'YOLOv8l (Large) - 高精度', size: '87.7MB', speed: '较慢' },
        { id: 'yolov8x.pt', label: 'YOLOv8x (XLarge) - 顶级', size: '130MB', speed: '最慢' }
    ];

    useEffect(() => {
        checkStatus();
        fetchStats();

        if (currentProject) {
            setConfig(prev => ({ ...prev, data: '' }));
        }

        const handleClickOutside = (event) => {
            if (dropdownOpen && dropdownTriggerRef.current && !dropdownTriggerRef.current.contains(event.target)) {
                const dropdownEl = document.getElementById('model-dropdown-portal');
                if (dropdownEl && !dropdownEl.contains(event.target)) {
                    setDropdownOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            stopPolling();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [currentProject]);

    const fetchStats = async () => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${currentProject}/dataset/stats`);
            const data = await res.json();
            setStats(data);
        } catch (err) {
            console.error("Failed to fetch stats", err);
        }
    };

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const startPolling = () => {
        stopPolling();
        pollIntervalRef.current = setInterval(checkStatus, 2000);
    };

    const stopPolling = () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };

    const checkStatus = async () => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${currentProject}/train/status`);
            const data = await res.json();
            setStatus(data.status);
            setLogs(data.logs || []);
            setMetrics(data.metrics || []);

            if (data.status === 'running') {
                if (!pollIntervalRef.current) startPolling();
            } else {
                stopPolling();
            }
        } catch (err) {
            console.error("Failed to check status", err);
        }
    };

    const handleBrowseData = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/utils/select-file', { method: 'POST' });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to open file picker');
            }
            const data = await res.json();
            if (data.path) {
                setConfig({ ...config, data: data.path });
            }
        } catch (err) {
            console.error("Failed to browse file", err);
            alert(`无法打开文件选择器: ${err.message}\n请确保您正在使用桌面版应用程序。`);
        }
    };

    const handleBrowseProject = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/utils/select-folder', { method: 'POST' });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to open folder picker');
            }
            const data = await res.json();
            if (data.path) {
                setConfig({ ...config, project: data.path });
            }
        } catch (err) {
            console.error("Failed to browse folder", err);
            alert(`无法打开文件夹选择器: ${err.message}\n请确保您正在使用桌面版应用程序。`);
        }
    };

    const handleStart = async () => {
        try {
            setStatus('starting');
            const res = await fetch(`http://localhost:5000/api/projects/${currentProject}/train`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const data = await res.json();

            if (res.ok) {
                setStatus('running');
                setLogs([]);
                startPolling();
            } else {
                setStatus('failed');
                alert(`Start failed: ${data.error}`);
            }
        } catch (err) {
            setStatus('failed');
            alert(`Network error: ${err.message}`);
        }
    };

    const handleStop = async () => {
        try {
            await fetch(`http://localhost:5000/api/projects/${currentProject}/train/stop`, { method: 'POST' });
            checkStatus();
        } catch (err) {
            console.error("Failed to stop", err);
        }
    };

    const StatBadge = ({ icon: Icon, label, value, color, gradient }) => (
        <div style={{
            background: gradient || `rgba(${color}, 0.1)`,
            border: `1px solid rgba(${color}, 0.2)`,
            borderRadius: '14px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flex: 1
        }}>
            <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: `rgba(${color}, 0.15)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: `rgb(${color})`
            }}>
                <Icon size={20} />
            </div>
            <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{label}</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
            </div>
        </div>
    );

    const ProgressRing = ({ progress, size = 120, strokeWidth = 10 }) => {
        const radius = (size - strokeWidth) / 2;
        const circumference = radius * 2 * Math.PI;
        const offset = circumference - (progress / 100) * circumference;
        
        return (
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="url(#progressGradient)"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
                <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#4ade80" />
                    </linearGradient>
                </defs>
            </svg>
        );
    };

    const LineChart = ({ data, dataKey, color, label, unit = "" }) => {
        const width = 280;
        const height = 100;
        const padding = 15;

        if (!data || data.length === 0) {
            return (
                <div style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    borderRadius: '16px', 
                    padding: '1.25rem',
                    border: '1px solid rgba(255,255,255,0.04)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: '14px', color: `rgb(${color})`, fontWeight: 700 }}>--{unit}</span>
                    </div>
                    <div style={{ 
                        height: height - 30, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'var(--text-tertiary)',
                        fontSize: '12px'
                    }}>
                        等待数据...
                    </div>
                </div>
            );
        }

        const latestValue = data[data.length - 1][dataKey];
        
        if (latestValue === undefined || data.length < 2) {
            return (
                <div style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    borderRadius: '16px', 
                    padding: '1.25rem',
                    border: '1px solid rgba(255,255,255,0.04)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: '14px', color: `rgb(${color})`, fontWeight: 700 }}>
                            {latestValue !== undefined ? (dataKey === 'mAP50' ? (latestValue * 100).toFixed(1) : latestValue.toFixed(4)) : '--'}{unit}
                        </span>
                    </div>
                    <div style={{ 
                        height: height - 30, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'var(--text-tertiary)',
                        fontSize: '12px'
                    }}>
                        正在收集...
                    </div>
                </div>
            );
        }

        const values = data.map(d => d[dataKey] || 0);
        const minVal = Math.min(...values) * 0.9;
        const maxVal = Math.max(...values) * 1.1;
        const range = maxVal - minVal || 1;

        const points = data.map((d, i) => {
            const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
            const y = height - padding - (((d[dataKey] || 0) - minVal) / range) * (height - 2 * padding);
            return `${x},${y}`;
        }).join(' ');

        return (
            <div style={{ 
                background: 'rgba(0,0,0,0.2)', 
                borderRadius: '16px', 
                padding: '1.25rem',
                border: '1px solid rgba(255,255,255,0.04)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: '14px', color: `rgb(${color})`, fontWeight: 700 }}>
                        {dataKey === 'mAP50' ? (latestValue * 100).toFixed(1) : latestValue.toFixed(4)}{unit}
                    </span>
                </div>
                <svg width="100%" height={height - 30} viewBox={`0 0 ${width} ${height - 30}`} preserveAspectRatio="none">
                    <defs>
                        <linearGradient id={`grad-${dataKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={`rgb(${color})`} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={`rgb(${color})`} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <polygon
                        points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
                        fill={`url(#grad-${dataKey})`}
                    />
                    <polyline
                        fill="none"
                        stroke={`rgb(${color})`}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points}
                        style={{ transition: 'all 0.5s ease' }}
                    />
                </svg>
            </div>
        );
    };

    const TrainingDashboard = ({ metrics, status }) => {
        if (metrics.length === 0 && status !== 'running') return null;

        const latest = metrics[metrics.length - 1] || {};
        const progress = (latest.epoch && latest.totalEpochs) ? (latest.epoch / latest.totalEpochs) * 100 : 0;
        const mapVal = latest.mAP50 !== undefined ? (latest.mAP50 * 100).toFixed(1) : '--';

        return (
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                <div style={{
                    background: 'rgba(0,0,0,0.25)',
                    borderRadius: '20px',
                    padding: '1.5rem',
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5rem'
                }}>
                    <ProgressRing progress={progress} size={100} strokeWidth={8} />
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>训练进度</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                            {latest.epoch || 0} <span style={{ fontSize: '1rem', color: 'var(--text-tertiary)' }}>/ {latest.totalEpochs || '--'}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Epochs</div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '14px',
                        padding: '1rem 1.25rem',
                        border: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Zap size={16} style={{ color: 'rgb(251,191,36)' }} />
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>GPU 显存</span>
                        </div>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{latest.gpu_mem || '--'}</span>
                    </div>
                    <div style={{
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '14px',
                        padding: '1rem 1.25rem',
                        border: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Gauge size={16} style={{ color: 'rgb(34,197,94)' }} />
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>mAP@50</span>
                        </div>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'rgb(34,197,94)' }}>{mapVal}{mapVal !== '--' ? '%' : ''}</span>
                    </div>
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <LineChart data={metrics} dataKey="box_loss" color="255,123,114" label="Box Loss" />
                    <LineChart data={metrics} dataKey="mAP50" color="121,192,255" label="mAP@50" unit="%" />
                </div>
            </div>
        );
    };

    const Toggle = ({ checked, onChange, label, desc }) => (
        <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '1rem 1.25rem', 
            borderRadius: '14px', 
            background: 'rgba(255,255,255,0.025)', 
            border: '1px solid rgba(255,255,255,0.06)',
            cursor: 'pointer',
            transition: 'all 0.25s ease'
        }}>
            <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                {desc && <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{desc}</div>}
            </div>
            <div style={{
                width: '44px',
                height: '24px',
                borderRadius: '12px',
                background: checked ? 'linear-gradient(135deg, #22c55e, #4ade80)' : 'rgba(255,255,255,0.1)',
                position: 'relative',
                transition: 'all 0.3s ease'
            }}>
                <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '3px',
                    left: checked ? '23px' : '3px',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
                <input 
                    type="checkbox" 
                    checked={checked}
                    onChange={onChange}
                    style={{ opacity: 0, width: 0, height: 0 }}
                />
            </div>
        </label>
    );

    const SectionCard = ({ icon: Icon, title, color, gradient, children }) => (
        <div style={{ 
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '24px',
            padding: '1.75rem'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '1.5rem' }}>
                <div style={{ 
                    background: gradient || `rgba(${color}, 0.12)`, 
                    color: `rgb(${color})`, 
                    padding: '12px', 
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Icon size={22} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
            </div>
            {children}
        </div>
    );

    return (
        <div style={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            background: 'linear-gradient(135deg, rgba(13,17,23,0.95) 0%, rgba(22,27,34,0.98) 100%)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{ 
                padding: '1.5rem 2rem', 
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '0.75rem' }}>
                    <button 
                        onClick={goBack}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '12px',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer'
                        }}
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                        模型训练
                    </h2>
                    <span style={{
                        background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(74,222,128,0.1))',
                        color: '#4ade80',
                        padding: '6px 14px',
                        borderRadius: '10px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        border: '1px solid rgba(74,222,128,0.3)'
                    }}>
                        YOLOv8
                    </span>
                    <div style={{
                        marginLeft: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        background: status === 'running' ? 'rgba(34,197,94,0.15)' : 
                                   status === 'completed' ? 'rgba(59,130,246,0.15)' :
                                   status === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${status === 'running' ? 'rgba(34,197,94,0.3)' : 
                                     status === 'completed' ? 'rgba(59,130,246,0.3)' :
                                     status === 'failed' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`
                    }}>
                        {status === 'running' && <><RefreshCw size={14} className="spin" style={{ color: '#4ade80' }} /> <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '13px' }}>训练中</span></>}
                        {status === 'completed' && <><CheckCircle size={14} style={{ color: '#60a5fa' }} /> <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: '13px' }}>已完成</span></>}
                        {status === 'failed' && <><AlertTriangle size={14} style={{ color: '#f87171' }} /> <span style={{ color: '#f87171', fontWeight: 600, fontSize: '13px' }}>失败</span></>}
                        {status === 'idle' && <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '13px' }}>就绪</span>}
                        {status === 'starting' && <><RefreshCw size={14} className="spin" style={{ color: '#fbbf24' }} /> <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '13px' }}>启动中</span></>}
                    </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0, paddingLeft: '56px' }}>
                    为项目 <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{currentProject}</span> 训练自定义 YOLOv8-Pose 模型
                </p>
            </div>

            {/* Main Content */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 420px', 
                gap: '1.5rem',
                padding: '1.5rem 2rem',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden'
            }}>
                {/* Left: Logs & Charts */}
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1.5rem',
                    overflow: 'hidden'
                }}>
                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', flexShrink: 0 }}>
                        <StatBadge 
                            icon={Database} 
                            label="总图片" 
                            value={stats?.total || 0} 
                            color="99,102,241"
                            gradient="linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.05))"
                        />
                        <StatBadge 
                            icon={CheckCircle} 
                            label="已标注" 
                            value={stats?.annotated || 0} 
                            color="34,197,94"
                            gradient="linear-gradient(135deg, rgba(34,197,94,0.15), rgba(74,222,128,0.05))"
                        />
                        <StatBadge 
                            icon={Layers} 
                            label="标注目标" 
                            value={stats?.objects || 0} 
                            color="251,191,36"
                            gradient="linear-gradient(135deg, rgba(251,191,36,0.15), rgba(252,211,77,0.05))"
                        />
                    </div>

                    {/* Training Dashboard */}
                    <TrainingDashboard metrics={metrics} status={status} />

                    {/* Logs */}
                    <div style={{ 
                        flex: 1, 
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '20px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        minHeight: 0
                    }}>
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            padding: '1rem 1.25rem',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            flexShrink: 0
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Terminal size={16} style={{ color: 'var(--text-tertiary)' }} />
                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>训练日志</span>
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{logs.length} 行</span>
                        </div>
                        <div style={{ 
                            flex: 1, 
                            overflowY: 'auto', 
                            padding: '1rem',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                        }} className="custom-scrollbar">
                            {logs.length === 0 && (
                                <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '2rem' }}>
                                    等待日志输出...
                                </div>
                            )}
                            {logs.map((log, i) => (
                                <div key={i} style={{ 
                                    color: log.type === 'stdout' ? 'var(--text-secondary)' : '#f87171',
                                    marginBottom: '4px',
                                    wordBreak: 'break-all'
                                }}>
                                    <span style={{ color: 'var(--text-tertiary)', marginRight: '8px' }}>
                                        [{new Date(log.time).toLocaleTimeString()}]
                                    </span>
                                    {log.msg}
                                </div>
                            ))}
                            <div ref={logEndRef} />
                        </div>
                    </div>
                </div>

                {/* Right: Config */}
                <div style={{ 
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem'
                }} className="custom-scrollbar">
                    
                    {/* Model Selection */}
                    <SectionCard icon={Cpu} title="基础模型" color="99,102,241" gradient="linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.05))">
                        <div style={{ position: 'relative' }} ref={dropdownRef}>
                            <div
                                ref={dropdownTriggerRef}
                                onClick={() => {
                                    if (status !== 'running') {
                                        if (!dropdownOpen && dropdownTriggerRef.current) {
                                            const rect = dropdownTriggerRef.current.getBoundingClientRect();
                                            setDropdownPosition({
                                                top: rect.bottom + 8,
                                                left: rect.left,
                                                width: rect.width
                                            });
                                        }
                                        setDropdownOpen(!dropdownOpen);
                                    }
                                }}
                                style={{
                                    background: 'rgba(0,0,0,0.25)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '14px',
                                    padding: '1rem 1.25rem',
                                    cursor: status === 'running' ? 'not-allowed' : 'pointer',
                                    opacity: status === 'running' ? 0.6 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {modelOptions.find(m => m.id === config.model)?.label}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                        {modelOptions.find(m => m.id === config.model)?.size} • {modelOptions.find(m => m.id === config.model)?.speed}
                                    </div>
                                </div>
                                <div style={{ 
                                    width: '24px', 
                                    height: '24px', 
                                    borderRadius: '8px', 
                                    background: 'rgba(255,255,255,0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0)',
                                    transition: 'transform 0.2s'
                                }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M6 9l6 6 6-6" />
                                    </svg>
                                </div>
                            </div>
                            
                            {dropdownOpen && createPortal(
                                <div 
                                    id="model-dropdown-portal"
                                    style={{
                                        position: 'fixed',
                                        top: dropdownPosition.top,
                                        left: dropdownPosition.left,
                                        width: dropdownPosition.width,
                                        background: 'rgba(30,35,45,0.98)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '14px',
                                        overflow: 'hidden',
                                        zIndex: 9999,
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                                        maxHeight: '300px',
                                        overflowY: 'auto'
                                    }}
                                    className="custom-scrollbar"
                                >
                                    {modelOptions.map(option => (
                                        <div
                                            key={option.id}
                                            onClick={() => {
                                                setConfig({ ...config, model: option.id });
                                                setDropdownOpen(false);
                                            }}
                                            style={{
                                                padding: '1rem 1.25rem',
                                                cursor: 'pointer',
                                                background: config.model === option.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                transition: 'background 0.2s'
                                            }}
                                        >
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{option.label}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{option.size} • {option.speed}</div>
                                        </div>
                                    ))}
                                </div>,
                                document.body
                            )}
                        </div>
                    </SectionCard>

                    {/* Parameters */}
                    <SectionCard icon={Settings} title="训练参数" color="251,191,36" gradient="linear-gradient(135deg, rgba(251,191,36,0.15), rgba(252,211,77,0.05))">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>训练轮数</label>
                                <input
                                    type="number"
                                    value={config.epochs}
                                    onChange={e => setConfig({ ...config, epochs: parseInt(e.target.value) })}
                                    disabled={status === 'running'}
                                    style={{
                                        width: '100%',
                                        height: '48px',
                                        background: 'rgba(0,0,0,0.25)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        padding: '0 1rem',
                                        color: 'white',
                                        fontSize: '15px',
                                        fontWeight: 600,
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>批次大小</label>
                                <input
                                    type="number"
                                    value={config.batch}
                                    onChange={e => setConfig({ ...config, batch: parseInt(e.target.value) })}
                                    disabled={status === 'running'}
                                    style={{
                                        width: '100%',
                                        height: '48px',
                                        background: 'rgba(0,0,0,0.25)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        padding: '0 1rem',
                                        color: 'white',
                                        fontSize: '15px',
                                        fontWeight: 600,
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>图像尺寸</label>
                                <input
                                    type="number"
                                    value={config.imgsz}
                                    onChange={e => setConfig({ ...config, imgsz: parseInt(e.target.value) })}
                                    disabled={status === 'running'}
                                    style={{
                                        width: '100%',
                                        height: '48px',
                                        background: 'rgba(0,0,0,0.25)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        padding: '0 1rem',
                                        color: 'white',
                                        fontSize: '15px',
                                        fontWeight: 600,
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>计算设备</label>
                                <input
                                    type="text"
                                    value={config.device}
                                    onChange={e => setConfig({ ...config, device: e.target.value })}
                                    placeholder="0, 1, cpu"
                                    disabled={status === 'running'}
                                    style={{
                                        width: '100%',
                                        height: '48px',
                                        background: 'rgba(0,0,0,0.25)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        padding: '0 1rem',
                                        color: 'white',
                                        fontSize: '15px',
                                        fontWeight: 600,
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>
                    </SectionCard>

                    {/* Data Augmentation */}
                    <SectionCard icon={Activity} title="数据增强" color="236,72,153" gradient="linear-gradient(135deg, rgba(236,72,153,0.15), rgba(244,114,182,0.05))">
                        
                        {/* 全局开关 */}
                        <div style={{ 
                            marginBottom: '1.5rem',
                            padding: '1.25rem', 
                            borderRadius: '16px', 
                            background: config.augmentationEnabled ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                            border: `1px solid ${config.augmentationEnabled ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: config.augmentationEnabled ? '#4ade80' : '#f87171' }}>
                                    {config.augmentationEnabled ? '✓ 数据增强已启用' : '✗ 数据增强已禁用'}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                    {config.augmentationEnabled ? '训练时将应用图像变换和特征增强' : '使用原始数据，无任何增强处理'}
                                </div>
                            </div>
                            <div 
                                onClick={() => setConfig({...config, augmentationEnabled: !config.augmentationEnabled})}
                                style={{
                                    width: '56px',
                                    height: '30px',
                                    borderRadius: '15px',
                                    background: config.augmentationEnabled ? 'linear-gradient(135deg, #22c55e, #4ade80)' : 'rgba(255,255,255,0.1)',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    flexShrink: 0
                                }}
                            >
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: 'white',
                                    position: 'absolute',
                                    top: '3px',
                                    left: config.augmentationEnabled ? '29px' : '3px',
                                    transition: 'all 0.3s ease',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                                }} />
                            </div>
                        </div>

                        {/* 参数配置 */}
                        <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '1rem',
                            opacity: config.augmentationEnabled ? 1 : 0.4,
                            pointerEvents: config.augmentationEnabled ? 'auto' : 'none',
                            transition: 'all 0.3s ease'
                        }}>
                            
                            {/* 几何变换 */}
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ec4899' }} />
                                    几何变换
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>旋转角度 (±°)</label>
                                        <input type="number" value={config.degrees} onChange={e => setConfig({...config, degrees: parseFloat(e.target.value)})} disabled={status === 'running'} style={{ width: '100%', height: '40px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 10px', color: 'white', fontSize: '13px', outline: 'none' }} />
                                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>推荐: 0-15°，防止关键点错位</div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>平移比例</label>
                                        <input type="number" step="0.1" value={config.translate} onChange={e => setConfig({...config, translate: parseFloat(e.target.value)})} disabled={status === 'running'} style={{ width: '100%', height: '40px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 10px', color: 'white', fontSize: '13px', outline: 'none' }} />
                                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>推荐: 0.1，图像部分移出</div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>缩放范围</label>
                                        <input type="number" step="0.1" value={config.scale} onChange={e => setConfig({...config, scale: parseFloat(e.target.value)})} disabled={status === 'running'} style={{ width: '100%', height: '40px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 10px', color: 'white', fontSize: '13px', outline: 'none' }} />
                                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>推荐: 0.5，增加尺度多样性</div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>随机擦除</label>
                                        <input type="number" step="0.1" value={config.erasing} onChange={e => setConfig({...config, erasing: parseFloat(e.target.value)})} disabled={status === 'running'} style={{ width: '100%', height: '40px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 10px', color: 'white', fontSize: '13px', outline: 'none' }} />
                                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>推荐: 0.3-0.4，防止过拟合</div>
                                    </div>
                                </div>
                            </div>

                            {/* 翻转 */}
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#22d3ee' }} />
                                    翻转
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>水平翻转概率</label>
                                        <input type="number" step="0.1" max="1" value={config.fliplr} onChange={e => setConfig({...config, fliplr: parseFloat(e.target.value)})} disabled={status === 'running'} style={{ width: '100%', height: '40px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 10px', color: 'white', fontSize: '13px', outline: 'none' }} />
                                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>推荐: 0.5，标准水平翻转</div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>垂直翻转概率</label>
                                        <input type="number" step="0.1" max="1" value={config.flipud} onChange={e => setConfig({...config, flipud: parseFloat(e.target.value)})} disabled={status === 'running'} style={{ width: '100%', height: '40px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 10px', color: 'white', fontSize: '13px', outline: 'none' }} />
                                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>推荐: 0，适用于常规物体</div>
                                    </div>
                                </div>
                            </div>

                            {/* 颜色变换 */}
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#a855f7' }} />
                                    颜色变换 (HSV)
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>色相</label>
                                        <input type="number" step="0.01" max="1" value={config.hsv_h} onChange={e => setConfig({...config, hsv_h: parseFloat(e.target.value)})} disabled={status === 'running'} style={{ width: '100%', height: '40px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 10px', color: 'white', fontSize: '13px', outline: 'none' }} />
                                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>推荐: 0.015</div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>饱和度</label>
                                        <input type="number" step="0.1" max="1" value={config.hsv_s} onChange={e => setConfig({...config, hsv_s: parseFloat(e.target.value)})} disabled={status === 'running'} style={{ width: '100%', height: '40px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 10px', color: 'white', fontSize: '13px', outline: 'none' }} />
                                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>推荐: 0.7</div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>明度</label>
                                        <input type="number" step="0.1" max="1" value={config.hsv_v} onChange={e => setConfig({...config, hsv_v: parseFloat(e.target.value)})} disabled={status === 'running'} style={{ width: '100%', height: '40px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 10px', color: 'white', fontSize: '13px', outline: 'none' }} />
                                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>推荐: 0.4</div>
                                    </div>
                                </div>
                            </div>

                            {/* 高级增强 */}
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#f59e0b' }} />
                                    高级增强
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>马赛克 Mosaic</label>
                                        <input type="number" step="0.1" max="1" value={config.mosaic} onChange={e => setConfig({...config, mosaic: parseFloat(e.target.value)})} disabled={status === 'running'} style={{ width: '100%', height: '40px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 10px', color: 'white', fontSize: '13px', outline: 'none' }} />
                                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>推荐: 1.0，小样本数据最佳</div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>混合 MixUp</label>
                                        <input type="number" step="0.1" max="1" value={config.mixup} onChange={e => setConfig({...config, mixup: parseFloat(e.target.value)})} disabled={status === 'running'} style={{ width: '100%', height: '40px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 10px', color: 'white', fontSize: '13px', outline: 'none' }} />
                                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>推荐: 0-0.15，大数据集效果更好</div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </SectionCard>

                    {/* Output */}
                    <SectionCard icon={FolderOpen} title="输出设置" color="34,197,94" gradient="linear-gradient(135deg, rgba(34,197,94,0.15), rgba(74,222,128,0.05))">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>实验名称</label>
                                <input
                                    type="text"
                                    value={config.name}
                                    onChange={e => setConfig({ ...config, name: e.target.value })}
                                    placeholder="exp_auto"
                                    disabled={status === 'running'}
                                    style={{
                                        width: '100%',
                                        height: '48px',
                                        background: 'rgba(0,0,0,0.25)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        padding: '0 1rem',
                                        color: 'white',
                                        fontSize: '14px',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>输出目录</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={config.project}
                                        onChange={e => setConfig({ ...config, project: e.target.value })}
                                        placeholder="默认项目目录"
                                        disabled={status === 'running'}
                                        style={{
                                            flex: 1,
                                            height: '48px',
                                            background: 'rgba(0,0,0,0.25)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '12px',
                                            padding: '0 1rem',
                                            color: 'var(--text-secondary)',
                                            fontSize: '13px',
                                            outline: 'none'
                                        }}
                                    />
                                    <button
                                        onClick={handleBrowseProject}
                                        disabled={status === 'running'}
                                        style={{
                                            width: '48px',
                                            height: '48px',
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'var(--text-secondary)',
                                            cursor: status === 'running' ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        <FolderOpen size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Warning */}
                    {stats?.annotated === 0 && (
                        <div style={{
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: '14px',
                            padding: '1rem 1.25rem',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px'
                        }}>
                            <AlertTriangle size={18} style={{ color: '#f87171', flexShrink: 0, marginTop: '2px' }} />
                            <div style={{ fontSize: '13px', color: '#f87171', lineHeight: 1.5 }}>
                                没有已标注的图片，无法开始训练。请先去编辑器进行标注。
                            </div>
                        </div>
                    )}

                    {/* Action Button */}
                    <button
                        onClick={status === 'running' ? handleStop : handleStart}
                        disabled={status === 'starting' || (!stats || stats.annotated === 0)}
                        style={{
                            width: '100%',
                            height: '56px',
                            borderRadius: '16px',
                            fontSize: '1rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            background: status === 'running' 
                                ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                                : 'linear-gradient(135deg, #22c55e, #4ade80)',
                            border: 'none',
                            color: 'white',
                            cursor: status === 'starting' || (!stats || stats.annotated === 0) ? 'not-allowed' : 'pointer',
                            opacity: status === 'starting' || (!stats || stats.annotated === 0) ? 0.6 : 1,
                            boxShadow: status !== 'running' ? '0 8px 24px rgba(34,197,94,0.25)' : '0 8px 24px rgba(239,68,68,0.25)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {status === 'running' ? (
                            <><Square size={18} fill="currentColor" /> 停止训练</>
                        ) : status === 'starting' ? (
                            <><RefreshCw size={18} className="spin" /> 启动中...</>
                        ) : (
                            <><Play size={18} fill="currentColor" /> 开始训练</>
                        )}
                    </button>
                </div>
            </div>

            <style>{`
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
