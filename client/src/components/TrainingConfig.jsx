import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Terminal, Settings, CheckCircle, AlertTriangle, RefreshCw, Database } from 'lucide-react';
import { useProject } from '../context/ProjectContext';

export const TrainingConfig = () => {
    const { currentProject } = useProject();
    const [config, setConfig] = useState({
        model: 'yolov8n.pt',
        epochs: 100,
        batch: 16,
        imgsz: 640,
        device: '0'
    });
    const [status, setStatus] = useState('idle'); // idle, running, completed, failed
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState(null);
    const logEndRef = useRef(null);
    const pollIntervalRef = useRef(null);

    // Initial status check
    useEffect(() => {
        checkStatus();
        fetchStats();
        return () => stopPolling();
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

    // Auto-scroll logs
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

            if (data.status === 'running') {
                if (!pollIntervalRef.current) startPolling();
            } else {
                stopPolling();
            }
        } catch (err) {
            console.error("Failed to check status", err);
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

    return (
        <div className="train-panel fade-in">
            <div className="train-header">
                <h2>
                    <Terminal size={24} />
                    模型训练 (YOLOv8)
                </h2>
                <div className={`status-badge ${status}`}>
                    {status === 'idle' && <span className="text-gray">Ready</span>}
                    {status === 'running' && <span className="text-blue"><RefreshCw className="spin" size={14} /> Training</span>}
                    {status === 'completed' && <span className="text-green"><CheckCircle size={14} /> Completed</span>}
                    {status === 'failed' && <span className="text-red"><AlertTriangle size={14} /> Failed</span>}
                </div>
            </div>

            <div className="train-layout">
                {/* Configuration Panel */}
                <div className="left-panel">
                    {/* Dataset Info Card */}
                    <div className="info-card">
                        <h3><Database size={18} /> 数据集概览</h3>
                        {stats ? (
                            <div className="stats-content">
                                <div className="stat-row">
                                    <div className="stat-item">
                                        <span className="stat-label">总图片</span>
                                        <span className="stat-value">{stats.total}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label highlight">已标注</span>
                                        <span className="stat-value highlight">{stats.annotated}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label text-muted">未标注</span>
                                        <span className="stat-value text-muted">{stats.unannotated}</span>
                                    </div>
                                </div>

                                {stats.annotated === 0 && (
                                    <div className="warning-box">
                                        <AlertTriangle size={16} />
                                        <span>没有已标注的图片，无法开始训练。请先去编辑器进行标注。</span>
                                    </div>
                                )}

                                {stats.samples && stats.samples.length > 0 && (
                                    <div className="samples-preview">
                                        <label>标注样本 Preview:</label>
                                        <div className="sample-grid">
                                            {stats.samples.map((sample, i) => (
                                                <div key={i} className="sample-img">
                                                    <img src={`http://localhost:5000/api/projects/${currentProject}/uploads/${sample}`} alt="sample" />
                                                </div>
                                            ))}
                                            {stats.annotated > 5 && <div className="sample-more">+{stats.annotated - 5}</div>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="loading-stats">加载中...</div>
                        )}
                    </div>

                    <div className="config-card">
                        <h3><Settings size={18} /> 参数配置</h3>

                        <div className="form-group">
                            <label>Base Model</label>
                            <select
                                value={config.model}
                                onChange={e => setConfig({ ...config, model: e.target.value })}
                                disabled={status === 'running'}
                            >
                                <option value="yolov8n.pt">YOLOv8n (Nano)</option>
                                <option value="yolov8s.pt">YOLOv8s (Small)</option>
                                <option value="yolov8m.pt">YOLOv8m (Medium)</option>
                                <option value="yolov8l.pt">YOLOv8l (Large)</option>
                                <option value="yolov8x.pt">YOLOv8x (XLarge)</option>
                            </select>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Epochs</label>
                                <input
                                    type="number"
                                    value={config.epochs}
                                    onChange={e => setConfig({ ...config, epochs: parseInt(e.target.value) })}
                                    disabled={status === 'running'}
                                />
                            </div>
                            <div className="form-group">
                                <label>Batch Size</label>
                                <input
                                    type="number"
                                    value={config.batch}
                                    onChange={e => setConfig({ ...config, batch: parseInt(e.target.value) })}
                                    disabled={status === 'running'}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Img Size</label>
                                <input
                                    type="number"
                                    value={config.imgsz}
                                    onChange={e => setConfig({ ...config, imgsz: parseInt(e.target.value) })}
                                    disabled={status === 'running'}
                                />
                            </div>
                            <div className="form-group">
                                <label>Device</label>
                                <input
                                    type="text"
                                    value={config.device}
                                    onChange={e => setConfig({ ...config, device: e.target.value })}
                                    placeholder="0, 1, cpu"
                                    disabled={status === 'running'}
                                />
                            </div>
                        </div>

                        <div className="train-actions">
                            {status !== 'running' ? (
                                <button className="btn-primary full-width" onClick={handleStart} disabled={!stats || stats.annotated === 0}>
                                    <Play size={18} /> 开始训练
                                </button>
                            ) : (
                                <button className="btn-danger full-width" onClick={handleStop}>
                                    <Square size={18} /> 停止训练
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Log Output */}
                <div className="log-card">
                    <div className="log-header">
                        <h3>Run Logs</h3>
                        <span className="log-count">{logs.length} lines</span>
                    </div>
                    <div className="log-window">
                        {logs.length === 0 && <div className="no-logs">Waiting for logs...</div>}
                        {logs.map((log, i) => (
                            <div key={i} className={`log-line ${log.type}`}>
                                <span className="log-time">[{new Date(log.time).toLocaleTimeString()}]</span>
                                <span className="log-msg">{log.msg}</span>
                            </div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </div>
            </div>

            <style>{`
                /* Global Reset for this component */
                * { box-sizing: border-box; }

                /* Enhanced Styles */
                .train-panel { 
                    padding: 24px; 
                    height: 100%; 
                    display: flex; 
                    flex-direction: column; 
                    background: var(--bg-primary); 
                    color: var(--text-primary);
                    overflow: hidden; /* Prevent outer scroll */
                }

                .train-header { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    margin-bottom: 16px; 
                    padding-bottom: 16px;
                    border-bottom: 1px solid var(--border-color);
                    flex-shrink: 0; /* Prevent header from shrinking */
                }
                
                .train-header h2 { 
                    display: flex; 
                    align-items: center; 
                    gap: 12px; 
                    margin: 0; 
                    font-size: 1.5rem;
                    font-weight: 600;
                    background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                
                .train-layout { 
                    display: grid; 
                    grid-template-columns: 340px 1fr; 
                    gap: 24px; 
                    flex: 1; 
                    min-height: 0; /* Important for nested scrolling */
                    overflow: hidden;
                }
                
                .left-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    overflow-y: auto;
                    max-height: 100%;
                }

                /* Info Card */
                .info-card {
                    background: var(--bg-secondary);
                    padding: 20px;
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                }

                .info-card h3 {
                    display: flex; 
                    align-items: center; 
                    gap: 10px; 
                    margin-top: 0; 
                    margin-bottom: 16px; 
                    font-size: 1.0rem; 
                    color: var(--text-primary);
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .stat-row { display: flex; justify-content: space-between; margin-bottom: 20px; text-align: center; }
                .stat-item { display: flex; flex-direction: column; flex: 1; }
                .stat-label { font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px; }
                .stat-value { font-size: 1.2rem; font-weight: 700; color: var(--text-primary); }
                .stat-value.highlight { color: var(--accent-primary); }
                .stat-label.highlight { color: var(--accent-primary); font-weight: 600; }
                .text-muted { opacity: 0.5; }

                .warning-box {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    color: var(--danger);
                    padding: 10px;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    display: flex;
                    gap: 8px;
                    align-items: flex-start;
                    margin-bottom: 15px;
                }

                .samples-preview label { display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; }
                .sample-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
                .sample-img { aspect-ratio: 1; background: #000; border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color); }
                .sample-img img { width: 100%; height: 100%; object-fit: cover; opacity: 0.8; }
                .sample-more { font-size: 0.7rem; display: flex; align-items: center; justify-content: center; background: var(--bg-tertiary); color: var(--text-secondary); border-radius: 4px; }

                /* Config Card Polish */
                .config-card { 
                    background: var(--bg-secondary); 
                    padding: 24px; 
                    border-radius: 12px; 
                    height: fit-content; 
                    border: 1px solid var(--border-color);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    /* overflow-y: auto; handled by left-panel now */
                }
                
                .config-card h3 { 
                    display: flex; 
                    align-items: center; 
                    gap: 10px; 
                    margin-top: 0; 
                    margin-bottom: 20px; 
                    font-size: 1.1rem; 
                    color: var(--text-primary);
                    font-weight: 600;
                }
                
                /* Form Elements */
                .form-group { margin-bottom: 16px; }
                .form-group label { 
                    display: block; 
                    margin-bottom: 8px; 
                    font-size: 0.85rem; 
                    font-weight: 500;
                    color: var(--text-secondary); 
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .form-group input, .form-group select { 
                    width: 100%; 
                    padding: 10px 14px; 
                    background: var(--bg-tertiary); 
                    border: 1px solid var(--border-color); 
                    border-radius: 8px; 
                    color: var(--text-primary); 
                    font-size: 0.95rem;
                    transition: all 0.2s;
                    box-sizing: border-box; /* Explicitly set */
                }
                
                .form-group input:focus, .form-group select:focus {
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 0 2px var(--accent-primary-alpha, rgba(59, 130, 246, 0.2));
                    outline: none;
                }
                
                /* Specific fix for select options in dark mode */
                .form-group select option {
                    background-color: var(--bg-secondary);
                    color: var(--text-primary);
                }

                .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                
                /* Buttons */
                .btn-primary { 
                    background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-hover) 100%);
                    color: white; 
                    border: none; 
                    padding: 12px; 
                    border-radius: 8px; 
                    cursor: pointer; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    gap: 10px; 
                    font-weight: 600; 
                    font-size: 1rem;
                    transition: transform 0.1s, box-shadow 0.2s; 
                    box-shadow: 0 4px 12px var(--accent-shadow, rgba(59, 130, 246, 0.3));
                    width: 100%;
                }
                
                .btn-primary:hover:not(:disabled) { 
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px var(--accent-shadow, rgba(59, 130, 246, 0.4));
                }
                
                .btn-primary:active:not(:disabled) { transform: translateY(0); }
                
                .btn-danger { 
                    background: linear-gradient(135deg, var(--danger) 0%, #b91c1c 100%); /* Adjust manually if variable missing */
                    color: white; 
                    border: none; 
                    padding: 12px; 
                    border-radius: 8px; 
                    cursor: pointer; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    gap: 8px; 
                    font-weight: 600; 
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
                    width: 100%;
                }
                
                /* Log Card */
                .log-card { 
                    background: #121212; /* Darker purely for terminal feel */
                    border-radius: 12px; 
                    display: flex; 
                    flex-direction: column; 
                    overflow: hidden; 
                    border: 1px solid #333; 
                    box-shadow: 0 44px 20px rgba(0,0,0,0.2);
                    height: 100%; /* Fill available space */
                }
                
                .log-header { 
                    padding: 12px 20px; 
                    background: #1a1a1a; 
                    border-bottom: 1px solid #333; 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    flex-shrink: 0;
                }
                
                .log-header h3 { margin: 0; font-size: 0.95rem; color: #a0a0a0; font-family: 'Consolas', monospace; }
                .log-count { font-size: 0.8rem; color: #666; background: #252526; padding: 2px 8px; border-radius: 4px; }
                
                .log-window { 
                    flex: 1; 
                    overflow-y: auto; 
                    padding: 20px; 
                    font-family: 'JetBrains Mono', 'Consolas', monospace; 
                    font-size: 0.9rem; 
                    color: #d4d4d4; 
                    line-height: 1.5;
                }
                
                /* Custom Scrollbar for logs */
                .log-window::-webkit-scrollbar { width: 10px; }
                .log-window::-webkit-scrollbar-track { background: #121212; }
                .log-window::-webkit-scrollbar-thumb { background: #333; border-radius: 5px; border: 2px solid #121212; }
                .log-window::-webkit-scrollbar-thumb:hover { background: #555; }

                .log-line { margin-bottom: 4px; white-space: pre-wrap; word-break: break-all; animation: fadeIn 0.1s ease; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                .log-line.stderr { color: #ff7b72; }
                .log-line.system { color: #dcdcaa; font-style: italic; border-left: 2px solid #dcdcaa; padding-left: 10px; margin: 8px 0; }
                .log-time { color: #569cd6; margin-right: 12px; font-size: 0.8rem; opacity: 0.5; user-select: none; }
                
                /* Status Badge */
                .status-badge { 
                    padding: 6px 16px; 
                    border-radius: 30px; 
                    font-size: 0.9rem; 
                    font-weight: 600; 
                    display: flex; 
                    align-items: center; 
                    gap: 8px;
                    border: 1px solid transparent;
                }
                
                .status-badge.idle { background: var(--bg-tertiary); color: var(--text-secondary); border-color: var(--border-color); }
                .status-badge.running { background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-color: rgba(59, 130, 246, 0.2); }
                .status-badge.completed { background: rgba(16, 185, 129, 0.1); color: #10b981; border-color: rgba(16, 185, 129, 0.2); }
                .status-badge.failed { background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.2); }

                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                
                .full-width { width: 100%; }
                
                .no-logs { 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: center; 
                    height: 100%; 
                    color: #444; 
                    font-style: italic; 
                }
                .no-logs::before {
                    content: '>';
                    font-size: 3rem;
                    margin-bottom: 10px;
                    opacity: 0.2;
                }
            `}</style>
        </div>
    );
};
