import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Terminal, Settings, CheckCircle, AlertTriangle, RefreshCw, Database, Image as ImageIcon, FileText, FolderOpen } from 'lucide-react';
import { useProject } from '../context/ProjectContext';

export const TrainingConfig = () => {
    const { currentProject } = useProject();
    const [config, setConfig] = useState({
        model: 'yolov8n.pt',
        data: '',
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
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    const modelOptions = [
        { id: 'yolov8n.pt', label: 'YOLOv8n (Nano)' },
        { id: 'yolov8s.pt', label: 'YOLOv8s (Small)' },
        { id: 'yolov8m.pt', label: 'YOLOv8m (Medium)' },
        { id: 'yolov8l.pt', label: 'YOLOv8l (Large)' },
        { id: 'yolov8x.pt', label: 'YOLOv8x (XLarge)' }
    ];

    // Initial status check
    useEffect(() => {
        checkStatus();
        fetchStats();

        // Initialize default data path
        if (currentProject) {
            // We use a relative path that the server can resolve to the project directory
            // or we just default it to empty and let the server decide unless user overrides
            setConfig(prev => ({ ...prev, data: '' }));
        }

        // Close dropdown when clicking outside
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
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

                    <div className="config-card glass-panel-modern">
                        <h3><Settings size={20} className="icon-accent" /> 参数配置</h3>

                        <div className="form-group">
                            <label className="label-modern">Base Model</label>
                            <div className="select-wrapper-modern" ref={dropdownRef}>
                                <div
                                    className={`custom-select-trigger ${dropdownOpen ? 'open' : ''} ${status === 'running' ? 'disabled' : ''}`}
                                    onClick={() => status !== 'running' && setDropdownOpen(!dropdownOpen)}
                                >
                                    <Database size={16} className="input-icon-left" />
                                    <span className="selected-value">
                                        {modelOptions.find(m => m.id === config.model)?.label}
                                    </span>
                                    <div className="arrow-icon"></div>
                                </div>

                                {dropdownOpen && (
                                    <div className="custom-dropdown-menu">
                                        {modelOptions.map(option => (
                                            <div
                                                key={option.id}
                                                className={`dropdown-item-modern ${config.model === option.id ? 'active' : ''}`}
                                                onClick={() => {
                                                    setConfig({ ...config, model: option.id });
                                                    setDropdownOpen(false);
                                                }}
                                            >
                                                {option.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-group-modern">
                            <label className="label-modern">Custom Data YAML (Optional)</label>
                            <div className="input-wrapper-modern has-action">
                                <FileText size={16} className="input-icon-left" />
                                <input
                                    type="text"
                                    value={config.data}
                                    onChange={e => setConfig({ ...config, data: e.target.value })}
                                    placeholder="Default: dataset/data.yaml"
                                    disabled={status === 'running'}
                                    className="input-modern-field"
                                />
                                <button
                                    className="input-action-btn"
                                    onClick={handleBrowseData}
                                    disabled={status === 'running'}
                                    title="Browse YAML file"
                                >
                                    <FolderOpen size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="form-row-modern">
                            <div className="form-group-modern">
                                <label className="label-modern">Epochs</label>
                                <div className="input-wrapper-modern">
                                    <RefreshCw size={16} className="input-icon-left" />
                                    <input
                                        type="number"
                                        value={config.epochs}
                                        onChange={e => setConfig({ ...config, epochs: parseInt(e.target.value) })}
                                        disabled={status === 'running'}
                                        className="input-modern-field"
                                    />
                                </div>
                            </div>
                            <div className="form-group-modern">
                                <label className="label-modern">Batch Size</label>
                                <div className="input-wrapper-modern">
                                    <CheckCircle size={16} className="input-icon-left" />
                                    <input
                                        type="number"
                                        value={config.batch}
                                        onChange={e => setConfig({ ...config, batch: parseInt(e.target.value) })}
                                        disabled={status === 'running'}
                                        className="input-modern-field"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-row-modern">
                            <div className="form-group-modern">
                                <label className="label-modern">Img Size</label>
                                <div className="input-wrapper-modern">
                                    <ImageIcon size={16} className="input-icon-left" />
                                    <input
                                        type="number"
                                        value={config.imgsz}
                                        onChange={e => setConfig({ ...config, imgsz: parseInt(e.target.value) })}
                                        disabled={status === 'running'}
                                        className="input-modern-field"
                                    />
                                </div>
                            </div>
                            <div className="form-group-modern">
                                <label className="label-modern">Device</label>
                                <div className="input-wrapper-modern">
                                    <Terminal size={16} className="input-icon-left" />
                                    <input
                                        type="text"
                                        value={config.device}
                                        onChange={e => setConfig({ ...config, device: e.target.value })}
                                        placeholder="0, 1, cpu"
                                        disabled={status === 'running'}
                                        className="input-modern-field"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="train-actions-modern">
                            {status !== 'running' ? (
                                <button className="btn-modern-primary full-width" onClick={handleStart} disabled={!stats || stats.annotated === 0}>
                                    <Play size={18} fill="currentColor" /> 开始训练
                                </button>
                            ) : (
                                <button className="btn-modern-danger full-width" onClick={handleStop}>
                                    <Square size={18} fill="currentColor" /> 停止训练
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
                    background: rgba(22, 27, 34, 0.4); 
                    backdrop-filter: blur(12px);
                    padding: 24px; 
                    border-radius: 16px; 
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                }
                
                .config-card h3 { 
                    display: flex; 
                    align-items: center; 
                    gap: 12px; 
                    margin-top: 0; 
                    margin-bottom: 24px; 
                    font-size: 1.1rem; 
                    color: var(--text-primary);
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }

                .icon-accent { color: var(--accent-primary); }
                
                /* Form Elements */
                .form-group, .form-group-modern { margin-bottom: 20px; }
                .label-modern { 
                    display: block; 
                    margin-bottom: 8px; 
                    font-size: 0.7rem; 
                    font-weight: 800;
                    color: var(--text-tertiary); 
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    padding-left: 4px;
                }
                
                .input-wrapper-modern, .select-wrapper-modern {
                    position: relative;
                    display: flex;
                    align-items: center;
                    transition: all 0.3s ease;
                }

                .input-icon-left {
                    position: absolute;
                    left: 14px;
                    color: var(--text-tertiary);
                    pointer-events: none;
                    transition: all 0.3s ease;
                    z-index: 2;
                }

                .input-wrapper-modern:focus-within .input-icon-left {
                    color: var(--accent-primary);
                    transform: scale(1.1);
                }

                .input-wrapper-modern.has-action .input-modern-field {
                    padding-right: 48px;
                }

                .input-action-btn {
                    position: absolute;
                    right: 8px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: var(--text-secondary);
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    z-index: 2;
                }

                .input-action-btn:hover:not(:disabled) {
                    background: rgba(88, 166, 255, 0.1);
                    border-color: var(--accent-primary);
                    color: var(--accent-primary);
                    transform: translateY(-1px);
                }

                .input-action-btn:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                }

                .input-modern-field, .custom-select-trigger { 
                    width: 100%; 
                    padding: 12px 14px 12px 42px; 
                    background: rgba(0, 0, 0, 0.25); 
                    border: 1px solid rgba(255, 255, 255, 0.08); 
                    border-radius: 12px; 
                    color: var(--text-primary); 
                    font-size: 0.95rem;
                    font-weight: 600;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    box-sizing: border-box;
                }
                
                .input-modern-field:focus {
                    border-color: var(--accent-primary);
                    background: rgba(0, 0, 0, 0.4);
                    box-shadow: 0 0 0 4px rgba(88, 166, 255, 0.15);
                    outline: none;
                }

                .custom-select-trigger {
                    width: 100%; 
                    padding: 12px 14px 12px 42px; 
                    background: rgba(0, 0, 0, 0.2); 
                    border: 1px solid rgba(255, 255, 255, 0.1); 
                    border-radius: 12px; 
                    color: var(--text-primary); 
                    font-size: 0.95rem;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                }

                .custom-select-trigger.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .custom-select-trigger:hover:not(.disabled) {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: rgba(255, 255, 255, 0.2);
                }

                .custom-select-trigger.open {
                    border-color: var(--accent-primary);
                    background: rgba(0, 0, 0, 0.3);
                    box-shadow: 0 0 0 4px rgba(88, 166, 255, 0.1);
                }

                .arrow-icon {
                    position: absolute;
                    right: 16px;
                    width: 8px;
                    height: 8px;
                    border-right: 2px solid var(--text-tertiary);
                    border-bottom: 2px solid var(--text-tertiary);
                    transform: rotate(45deg);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .custom-select-trigger.open .arrow-icon {
                    transform: rotate(-135deg) translateY(-2px);
                    border-color: var(--accent-primary);
                }

                .custom-dropdown-menu {
                    position: absolute;
                    top: calc(100% + 8px);
                    left: 0;
                    right: 0;
                    background: rgba(22, 27, 34, 0.95);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 6px;
                    z-index: 100;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
                    animation: dropdownFadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }

                @keyframes dropdownFadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .dropdown-item-modern {
                    padding: 10px 14px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    transition: all 0.2s;
                }

                .dropdown-item-modern:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: var(--text-primary);
                    padding-left: 18px;
                }

                .dropdown-item-modern.active {
                    background: var(--accent-primary);
                    color: white;
                    font-weight: 600;
                }

                .input-modern-field { 
                    width: 100%; 
                    padding: 12px 14px 12px 42px; 
                    background: rgba(0, 0, 0, 0.2); 
                    border: 1px solid rgba(255, 255, 255, 0.1); 
                    border-radius: 12px; 
                    color: var(--text-primary); 
                    font-size: 0.95rem;
                    font-weight: 500;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    box-sizing: border-box;
                }

                .select-modern { display: none; } /* Hide old select */

                .form-row-modern { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                
                /* Buttons */
                .train-actions-modern { margin-top: 8px; }

                .btn-modern-primary { 
                    background: linear-gradient(135deg, #4da1ff 0%, #2f81f7 100%);
                    color: white; 
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 14px; 
                    border-radius: 12px; 
                    cursor: pointer; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    gap: 12px; 
                    font-weight: 700; 
                    font-size: 1.05rem;
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
                    box-shadow: 0 4px 15px rgba(47, 129, 247, 0.3);
                    width: 100%;
                }
                
                .btn-modern-primary:hover:not(:disabled) { 
                    transform: translateY(-3px) scale(1.02);
                    box-shadow: 0 12px 25px rgba(47, 129, 247, 0.4);
                    filter: brightness(1.1);
                }
                
                .btn-modern-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    filter: grayscale(1);
                    transform: none !important;
                    box-shadow: none;
                }

                .btn-modern-danger { 
                    background: linear-gradient(135deg, #f85149 0%, #b91c1c 100%);
                    color: white; 
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 14px; 
                    border-radius: 12px; 
                    cursor: pointer; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    gap: 10px; 
                    font-weight: 700; 
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(248, 81, 73, 0.3);
                    width: 100%;
                }

                .btn-modern-danger:hover {
                    transform: translateY(-2px);
                    filter: brightness(1.1);
                    box-shadow: 0 8px 20px rgba(248, 81, 73, 0.4);
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
