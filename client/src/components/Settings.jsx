import React, { useState, useEffect } from 'react';
import {
    Settings as SettingsIcon, CheckCircle, AlertTriangle, RefreshCw,
    FolderOpen, Info, ArrowLeft, Terminal, Cpu, Save, Database,
    Box, Plus, X, Zap, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { createPortal } from 'react-dom';

const API_BASE = 'http://localhost:5000/api';

export const Settings = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState('projects');
    const [pythonPath, setPythonPath] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState(null);
    const [detectedEnvs, setDetectedEnvs] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [projectsDir, setProjectsDir] = useState('');
    const [isSavingDir, setIsSavingDir] = useState(false);
    const [dirSaveMessage, setDirSaveMessage] = useState(null);

    const [envs, setEnvs] = useState([]);
    const [isLoadingEnvs, setIsLoadingEnvs] = useState(false);
    const [compatibilityMatrix, setCompatibilityMatrix] = useState(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [createProgress, setCreateProgress] = useState(null);
    const [newEnv, setNewEnv] = useState({
        name: '',
        pythonVersion: '3.10',
        cudaVersion: 'auto'
    });
    const [detectedCuda, setDetectedCuda] = useState(null);
    const [expandedEnv, setExpandedEnv] = useState(null);
    const [envListOpen, setEnvListOpen] = useState(true);
    const [compatOpen, setCompatOpen] = useState(false);

    useEffect(() => {
        fetchSettings();
        handleScan();
    }, []);

    useEffect(() => {
        if (activeTab === 'environments') {
            fetchEnvs();
            fetchCompatibility();
            detectCuda();
        }
    }, [activeTab]);

    const fetchSettings = async () => {
        try {
            const res = await fetch(`${API_BASE}/settings`);
            const data = await res.json();
            if (data.pythonPath) {
                setPythonPath(data.pythonPath);
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
        try {
            const res = await fetch(`${API_BASE}/settings/projects-dir`);
            const data = await res.json();
            setProjectsDir(data.projectsDir || '');
        } catch (err) {
            console.error('Failed to load projects dir:', err);
        }
    };

    const fetchEnvs = async () => {
        setIsLoadingEnvs(true);
        try {
            const res = await fetch(`${API_BASE}/settings/envs`);
            const data = await res.json();
            setEnvs(data.envs || []);
        } catch (err) {
            console.error('Failed to fetch environments:', err);
        } finally {
            setIsLoadingEnvs(false);
        }
    };

    const fetchCompatibility = async () => {
        try {
            const res = await fetch(`${API_BASE}/settings/envs/compatibility`);
            const data = await res.json();
            setCompatibilityMatrix(data);
        } catch (err) {
            console.error('Failed to fetch compatibility:', err);
        }
    };

    const detectCuda = async () => {
        try {
            const res = await fetch(`${API_BASE}/settings/envs/detect-cuda`);
            const data = await res.json();
            setDetectedCuda(data);
        } catch (err) {
            console.error('Failed to detect CUDA:', err);
        }
    };

    const handleCreateEnv = async () => {
        if (!newEnv.name.trim()) {
            return;
        }

        setCreateProgress({ status: 'creating', message: '正在创建环境...' });

        try {
            const res = await fetch(`${API_BASE}/settings/envs/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newEnv)
            });
            const data = await res.json();

            if (data.success) {
                setCreateProgress({ status: 'success', message: data.result?.message || '环境创建成功' });
                setTimeout(() => {
                    setShowCreateDialog(false);
                    setCreateProgress(null);
                    setNewEnv({ name: '', pythonVersion: '3.10', cudaVersion: 'auto' });
                    fetchEnvs();
                }, 2000);
            } else {
                setCreateProgress({ status: 'error', message: data.result?.error || data.error || '创建失败，请重试' });
            }
        } catch (err) {
            setCreateProgress({ status: 'error', message: '创建失败: ' + err.message });
        }
    };

    const handleSelectFile = async () => {
        try {
            const res = await fetch(`${API_BASE}/utils/select-python`, { method: 'POST' });
            const data = await res.json();
            if (data.path) {
                setPythonPath(data.path);
                setValidationResult(null);
            }
        } catch (err) {
            console.error('Failed to select file:', err);
        }
    };

    const handleScan = async () => {
        setIsScanning(true);
        try {
            const res = await fetch(`${API_BASE}/settings/scan-envs`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setDetectedEnvs(data);
            }
        } catch (err) {
            console.error('Failed to scan environments:', err);
        } finally {
            setIsScanning(false);
        }
    };

    const handleValidate = async (customPath) => {
        const path = customPath || pythonPath;
        if (!path.trim()) {
            setValidationResult({ valid: false, error: '请先输入或选择 Python 路径' });
            return;
        }

        setIsValidating(true);
        setValidationResult(null);

        try {
            const res = await fetch(`${API_BASE}/settings/validate-python`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pythonPath: path })
            });
            const data = await res.json();
            setValidationResult(data);
        } catch (err) {
            setValidationResult({ valid: false, error: '验证失败: ' + err.message });
        } finally {
            setIsValidating(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveMessage(null);

        try {
            const res = await fetch(`${API_BASE}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pythonPath })
            });
            const data = await res.json();

            if (data.success) {
                setSaveMessage({ type: 'success', text: '✓ 设置已保存，训练时将使用此 Python 路径' });
                setTimeout(() => setSaveMessage(null), 5000);
            } else {
                setSaveMessage({ type: 'error', text: '保存失败: ' + data.error });
            }
        } catch (err) {
            setSaveMessage({ type: 'error', text: '保存失败: ' + err.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSelectProjectsDir = async () => {
        try {
            const res = await fetch(`${API_BASE}/utils/select-folder`, { method: 'POST' });
            const data = await res.json();
            if (data.path) {
                setProjectsDir(data.path);
                setDirSaveMessage(null);
            }
        } catch (err) {
            console.error('Failed to select folder:', err);
        }
    };

    const handleSaveProjectsDir = async () => {
        setIsSavingDir(true);
        setDirSaveMessage(null);

        try {
            const res = await fetch(`${API_BASE}/settings/projects-dir`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectsDir })
            });
            const data = await res.json();

            if (data.success) {
                setDirSaveMessage({ type: 'success', text: data.message });
                setTimeout(() => setDirSaveMessage(null), 5000);
            } else {
                setDirSaveMessage({ type: 'error', text: data.error });
            }
        } catch (err) {
            setDirSaveMessage({ type: 'error', text: '保存失败: ' + err.message });
        } finally {
            setIsSavingDir(false);
        }
    };

    const handleResetProjectsDir = async () => {
        setProjectsDir('');
        setIsSavingDir(true);
        setDirSaveMessage(null);

        try {
            const res = await fetch(`${API_BASE}/settings/projects-dir`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectsDir: null })
            });
            const data = await res.json();

            if (data.success) {
                setDirSaveMessage({ type: 'success', text: data.message });
                setTimeout(() => setDirSaveMessage(null), 5000);
            } else {
                setDirSaveMessage({ type: 'error', text: data.error });
            }
        } catch (err) {
            setDirSaveMessage({ type: 'error', text: '保存失败: ' + err.message });
        } finally {
            setIsSavingDir(false);
        }
    };

    const getCompatibilityColor = (status) => {
        switch (status) {
            case 'compatible': return { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', text: '#4ade80' };
            case 'warning': return { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.3)', text: '#fbbf24' };
            case 'incompatible': return { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', text: '#f87171' };
            default: return { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', text: 'var(--text-tertiary)' };
        }
    };

    const getCompatibilityLabel = (status) => {
        switch (status) {
            case 'compatible': return '推荐';
            case 'warning': return '警告';
            case 'incompatible': return '不兼容';
            default: return '未知';
        }
    };

    const InfoCard = ({ icon: Icon, title, children, color = '99,102,241' }) => (
        <div style={{
            background: 'rgba(0,0,0,0.25)',
            borderRadius: '16px',
            padding: '1.25rem',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            gap: '1rem',
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.25)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        }}
        >
            <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, rgba(${color}, 0.2), rgba(${color}, 0.1))`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: `rgb(${color})`,
                flexShrink: 0,
                boxShadow: `0 4px 12px rgba(${color}, 0.15)`
            }}>
                <Icon size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                    fontSize: '14px', 
                    fontWeight: 600, 
                    color: 'var(--text-primary)', 
                    marginBottom: '8px',
                    lineHeight: 1.3
                }}>
                    {title}
                </div>
                <div style={{ 
                    fontSize: '13px', 
                    color: 'var(--text-tertiary)', 
                    lineHeight: 1.6 
                }}>
                    {children}
                </div>
            </div>
        </div>
    );

    const CollapsibleSection = ({ title, isOpen, onToggle, children }) => (
        <div style={{
            background: 'rgba(0,0,0,0.18)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '18px',
            overflow: 'hidden'
        }}>
            <button
                type="button"
                onClick={onToggle}
                style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    cursor: 'pointer',
                    color: 'var(--text-primary)'
                }}
            >
                <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-secondary)' }}>{title}</span>
                {isOpen ? <ChevronUp size={18} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-tertiary)' }} />}
            </button>
            {isOpen ? (
                <div style={{ padding: '16px' }}>
                    {children}
                </div>
            ) : null}
        </div>
    );

    const renderPythonConfig = () => (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '20px',
            padding: '2rem',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                <Terminal size={20} style={{ color: 'rgb(251,191,36)' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Python 解释器配置
                </h3>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                选择用于模型训练的 Python 解释器。该解释器需要已安装 <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>ultralytics</code> 库。
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Python 解释器路径
                    </label>
                    <button
                        onClick={handleScan}
                        disabled={isScanning}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <RefreshCw size={12} className={isScanning ? 'spin' : ''} />
                        {isScanning ? '扫描中...' : '重新扫描环境'}
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                    <input
                        type="text"
                        value={pythonPath}
                        onChange={(e) => {
                            setPythonPath(e.target.value);
                            setValidationResult(null);
                        }}
                        placeholder="例如: C:\Python39\python.exe 或 D:\miniconda3\envs\yolo\python.exe"
                        style={{
                            flex: 1,
                            height: '52px',
                            padding: '0 18px',
                            fontSize: '14px',
                            background: 'rgba(0,0,0,0.4)',
                            border: `1px solid ${validationResult?.valid === true ? 'rgba(34,197,94,0.5)' : validationResult?.valid === false ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
                            borderRadius: '14px',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            transition: 'all 0.2s ease',
                            backdropFilter: 'blur(10px)'
                        }}
                        onFocus={(e) => {
                            if (!validationResult) {
                                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)';
                                e.currentTarget.style.background = 'rgba(0,0,0,0.5)';
                            }
                        }}
                        onBlur={(e) => {
                            if (!validationResult) {
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                                e.currentTarget.style.background = 'rgba(0,0,0,0.4)';
                            }
                        }}
                    />
                    <button
                        onClick={handleSelectFile}
                        style={{
                            width: '52px',
                            height: '52px',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            backdropFilter: 'blur(10px)'
                        }}
                        title="浏览文件"
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                            e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        <FolderOpen size={20} />
                    </button>
                    <button
                        onClick={() => handleValidate()}
                        disabled={isValidating || !pythonPath.trim()}
                        style={{
                            width: '52px',
                            height: '52px',
                            background: isValidating ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.25)',
                            border: `1px solid ${isValidating ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.4)'}`,
                            borderRadius: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isValidating ? 'var(--text-tertiary)' : 'rgb(99,102,241)',
                            cursor: isValidating || !pythonPath.trim() ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            backdropFilter: 'blur(10px)',
                            boxShadow: isValidating ? 'none' : '0 4px 12px rgba(99,102,241,0.2)'
                        }}
                        title="验证路径"
                        onMouseEnter={(e) => {
                            if (!isValidating && pythonPath.trim()) {
                                e.currentTarget.style.background = 'rgba(99,102,241,0.35)';
                                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)';
                                e.currentTarget.style.transform = 'scale(1.05)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isValidating && pythonPath.trim()) {
                                e.currentTarget.style.background = 'rgba(99,102,241,0.25)';
                                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
                                e.currentTarget.style.transform = 'scale(1)';
                            }
                        }}
                    >
                        {isValidating ? <RefreshCw size={20} className="spin" /> : <CheckCircle size={20} />}
                    </button>
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <Terminal size={16} style={{ color: 'var(--text-tertiary)' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            自动检测到的环境
                        </span>
                    </div>

                    {isScanning ? (
                        <div style={{
                            padding: '3rem 2rem',
                            borderRadius: '20px',
                            background: 'rgba(255,255,255,0.01)',
                            border: '1px dashed rgba(255,255,255,0.1)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '16px',
                            color: 'var(--text-tertiary)',
                            textAlign: 'center'
                        }}>
                            <div style={{ position: 'relative', width: '48px', height: '48px' }}>
                                <RefreshCw size={48} className="spin" style={{ color: 'var(--accent-primary)', opacity: 0.8 }} />
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>正在智能扫描 Python 环境</div>
                            <div style={{ fontSize: '13px', opacity: 0.6, maxWidth: '280px', lineHeight: 1.5 }}>
                                正在搜索 Conda 环境、系统变量、常见安装目录以及项目虚拟环境...
                            </div>
                        </div>
                    ) : detectedEnvs.length > 0 ? (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                            gap: '12px',
                            maxHeight: '420px',
                            overflowY: 'auto',
                            padding: '4px'
                        }} className="custom-scrollbar">
                            {detectedEnvs.map((env, i) => (
                                <div
                                    key={i}
                                    onClick={() => {
                                        setPythonPath(env.path);
                                        setValidationResult(env);
                                    }}
                                    style={{
                                        padding: '16px',
                                        cursor: 'pointer',
                                        background: pythonPath === env.path ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${pythonPath === env.path ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                        borderRadius: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '14px',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (pythonPath !== env.path) {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (pythonPath !== env.path) {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                        }
                                    }}
                                >
                                    <div style={{
                                        width: '42px',
                                        height: '42px',
                                        borderRadius: '12px',
                                        background: env.source === 'conda' ? 'rgba(74,222,128,0.1)' : 'rgba(99,102,241,0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: env.source === 'conda' ? '#4ade80' : '#818cf8',
                                        flexShrink: 0
                                    }}>
                                        {env.source === 'conda' ? <RefreshCw size={20} /> : <Terminal size={20} />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{env.name}</span>
                                            {env.hasUltralytics && (
                                                <div style={{
                                                    fontSize: '10px',
                                                    background: 'rgba(34,197,94,0.15)',
                                                    color: '#4ade80',
                                                    padding: '2px 6px',
                                                    borderRadius: '6px',
                                                    fontWeight: 600,
                                                    border: '1px solid rgba(34,197,94,0.2)'
                                                }}>
                                                    YOLO 已就绪
                                                </div>
                                            )}
                                            {env.hasTorch && (
                                                <div style={{
                                                    fontSize: '10px',
                                                    background: 'rgba(99,102,241,0.15)',
                                                    color: '#818cf8',
                                                    padding: '2px 6px',
                                                    borderRadius: '6px',
                                                    fontWeight: 600,
                                                    border: '1px solid rgba(99,102,241,0.2)'
                                                }}>
                                                    Torch {env.torchVersion?.split('+')[0]} {env.cudaAvailable ? '(CUDA)' : '(CPU)'}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', opacity: 0.7 }}>
                                            {env.path}
                                        </div>
                                    </div>
                                    {pythonPath === env.path ? (
                                        <div style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: 'var(--accent-primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            flexShrink: 0,
                                            boxShadow: '0 0 12px rgba(99,102,241,0.4)'
                                        }}>
                                            <CheckCircle size={16} />
                                        </div>
                                    ) : (
                                        <div style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            border: '2px solid rgba(255,255,255,0.1)',
                                            flexShrink: 0
                                        }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{
                            padding: '3rem 2rem',
                            borderRadius: '20px',
                            background: 'rgba(239,68,68,0.02)',
                            border: '1px dashed rgba(239,68,68,0.15)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '16px',
                            color: 'var(--text-tertiary)',
                            textAlign: 'center'
                        }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '50%',
                                background: 'rgba(239,68,68,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#f87171'
                            }}>
                                <AlertTriangle size={32} />
                            </div>
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: '#f87171', marginBottom: '8px' }}>未检测到 Python 环境</div>
                                <div style={{ fontSize: '13px', maxWidth: '340px', lineHeight: 1.6, opacity: 0.8 }}>
                                    自动检测未能找到可用的 Python 解释器。这可能是因为 Python 未安装在标准路径，或者尚未配置环境变量。
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button onClick={handleScan} style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'var(--text-secondary)',
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}>重新扫描</button>
                                <button onClick={handleSelectFile} style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    background: 'rgba(99,102,241,0.1)',
                                    border: '1px solid rgba(99,102,241,0.2)',
                                    color: '#818cf8',
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}>手动浏览</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {validationResult && (
                <div style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '14px',
                    background: validationResult.valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${validationResult.valid ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    {validationResult.valid ? (
                        <CheckCircle size={18} style={{ color: '#4ade80', flexShrink: 0 }} />
                    ) : (
                        <AlertTriangle size={18} style={{ color: '#f87171', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1 }}>
                        <div style={{
                            fontSize: '14px',
                            color: validationResult.valid ? '#4ade80' : '#f87171',
                            fontWeight: 500
                        }}>
                            {validationResult.message || validationResult.error}
                        </div>
                        {validationResult.valid && !validationResult.hasUltralytics && (
                            <div style={{ fontSize: '12px', color: '#fbbf24', marginTop: '4px' }}>
                                提示：此环境缺少 ultralytics 库，训练可能无法启动。
                            </div>
                        )}
                    </div>
                    {validationResult.valid && validationResult.version && (
                        <span style={{
                            fontSize: '12px',
                            color: 'var(--text-tertiary)',
                            marginLeft: 'auto'
                        }}>
                            {validationResult.version}
                        </span>
                    )}
                </div>
            )}

            <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                    width: '100%',
                    height: '52px',
                    background: isSaving ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none',
                    borderRadius: '14px',
                    color: 'white',
                    fontSize: '15px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    boxShadow: isSaving ? 'none' : '0 8px 24px rgba(99,102,241,0.3)',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                    if (!isSaving) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 12px 32px rgba(99,102,241,0.35)';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isSaving) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.3)';
                    }
                }}
            >
                {isSaving ? (
                    <RefreshCw size={18} className="spin" />
                ) : (
                    <>
                        <Save size={18} /> 保存设置
                    </>
                )}
            </button>

            {saveMessage && (
                <div style={{
                    marginTop: '1rem',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: saveMessage.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: saveMessage.type === 'success' ? '#4ade80' : '#f87171',
                    fontSize: '14px',
                    fontWeight: 500,
                    textAlign: 'center'
                }}>
                    {saveMessage.text}
                </div>
            )}
        </div>
    );

    const renderProjectsDir = () => (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '20px',
            padding: '2rem',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                <Database size={20} style={{ color: 'rgb(77,161,255)' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    项目存储位置
                </h3>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                设置项目的默认存储位置。如果不设置，项目将保存在应用数据目录中。
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        项目存储目录
                    </label>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                    <input
                        type="text"
                        value={projectsDir}
                        onChange={(e) => setProjectsDir(e.target.value)}
                        placeholder="默认使用应用数据目录"
                        style={{
                            flex: 1,
                            height: '52px',
                            padding: '0 18px',
                            fontSize: '14px',
                            background: 'rgba(0,0,0,0.4)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '14px',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            transition: 'all 0.2s ease',
                            backdropFilter: 'blur(10px)'
                        }}
                        onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(77,161,255,0.5)';
                            e.currentTarget.style.background = 'rgba(0,0,0,0.5)';
                        }}
                        onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                            e.currentTarget.style.background = 'rgba(0,0,0,0.4)';
                        }}
                    />
                    <button
                        onClick={handleSelectProjectsDir}
                        style={{
                            width: '52px',
                            height: '52px',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            backdropFilter: 'blur(10px)'
                        }}
                        title="浏览文件夹"
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                            e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        <FolderOpen size={20} />
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handleSaveProjectsDir}
                        disabled={isSavingDir}
                        style={{
                            flex: 1,
                            height: '48px',
                            background: isSavingDir ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #4da1ff, #34d399)',
                            border: 'none',
                            borderRadius: '12px',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            cursor: isSavingDir ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            backdropFilter: 'blur(10px)',
                            boxShadow: isSavingDir ? 'none' : '0 4px 16px rgba(77,161,255,0.25)'
                        }}
                        onMouseEnter={(e) => {
                            if (!isSavingDir) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 8px 24px rgba(77,161,255,0.3)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isSavingDir) {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 16px rgba(77,161,255,0.25)';
                            }
                        }}
                    >
                        {isSavingDir ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
                        保存设置
                    </button>
                    {projectsDir && (
                        <button
                            onClick={handleResetProjectsDir}
                            disabled={isSavingDir}
                            style={{
                                height: '48px',
                                padding: '0 1.5rem',
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: '12px',
                                color: '#f87171',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: isSavingDir ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease',
                                backdropFilter: 'blur(10px)'
                            }}
                            onMouseEnter={(e) => {
                                if (!isSavingDir) {
                                    e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
                                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isSavingDir) {
                                    e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }
                            }}
                        >
                            恢复默认
                        </button>
                    )}
                </div>
            </div>

            {dirSaveMessage && (
                <div style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: dirSaveMessage.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: dirSaveMessage.type === 'success' ? '#4ade80' : '#f87171',
                    fontSize: '14px',
                    fontWeight: 500,
                    textAlign: 'center'
                }}>
                    {dirSaveMessage.text}
                </div>
            )}
        </div>
    );

    const renderEnvironments = () => (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '20px',
            padding: '2rem',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Box size={20} style={{ color: 'rgb(99,102,241)' }} />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        Python 环境管理
                    </h3>
                </div>
                <button
                    onClick={() => setShowCreateDialog(true)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        border: 'none',
                        borderRadius: '12px',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
                    }}
                >
                    <Plus size={16} />
                    创建新环境
                </button>
            </div>

            {detectedCuda && detectedCuda.available && (
                <div style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.2)',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <Zap size={18} style={{ color: '#4ade80' }} />
                    <span style={{ fontSize: '14px', color: '#4ade80' }}>
                        检测到 CUDA {detectedCuda.version} - 推荐创建 CUDA 环境以加速训练
                    </span>
                </div>
            )}

            {isLoadingEnvs ? (
                <div style={{
                    padding: '3rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px'
                }}>
                    <RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>加载环境中...</span>
                </div>
            ) : envs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {envs.map((env, index) => {
                        const colors = getCompatibilityColor(env.compatibility);
                        const isExpanded = expandedEnv === index;
                        
                        return (
                            <div
                                key={index}
                                style={{
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: '16px',
                                    border: `1px solid ${colors.border}`,
                                    overflow: 'hidden'
                                }}
                            >
                                <div
                                    onClick={() => setExpandedEnv(isExpanded ? null : index)}
                                    style={{
                                        padding: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '14px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '12px',
                                        background: env.source === 'conda' ? 'rgba(74,222,128,0.1)' : 'rgba(99,102,241,0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: env.source === 'conda' ? '#4ade80' : '#818cf8',
                                        flexShrink: 0
                                    }}>
                                        {env.source === 'conda' ? <RefreshCw size={20} /> : <Terminal size={20} />}
                                    </div>
                                    
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {env.name}
                                            </span>
                                            <span style={{
                                                fontSize: '11px',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                background: colors.bg,
                                                color: colors.text,
                                                fontWeight: 600
                                            }}>
                                                {getCompatibilityLabel(env.compatibility)}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', opacity: 0.8 }}>
                                            Python {env.pythonVersion || '未知'} 
                                            {env.torchVersion && ` • PyTorch ${env.torchVersion.split('+')[0]}`}
                                            {env.cudaAvailable !== undefined && ` • ${env.cudaAvailable ? 'CUDA' : 'CPU'}`}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {env.cudaAvailable && (
                                            <div style={{
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                background: 'rgba(34,197,94,0.15)',
                                                color: '#4ade80',
                                                fontSize: '11px',
                                                fontWeight: 600
                                            }}>
                                                CUDA
                                            </div>
                                        )}
                                        {isExpanded ? <ChevronUp size={18} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-tertiary)' }} />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div style={{
                                        padding: '0 16px 16px 16px',
                                        borderTop: '1px solid rgba(255,255,255,0.06)',
                                        marginTop: 0
                                    }}>
                                        <div style={{ paddingTop: '16px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
                                                <div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>路径</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{env.path}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>来源</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{env.source}</div>
                                                </div>
                                            </div>
                                            
                                            {env.compatibilityDetails && (env.compatibilityDetails.warnings.length > 0 || env.compatibilityDetails.errors.length > 0) && (
                                                <div style={{ marginTop: '12px' }}>
                                                    {env.compatibilityDetails.errors.map((err, i) => (
                                                        <div key={i} style={{
                                                            display: 'flex',
                                                            alignItems: 'flex-start',
                                                            gap: '8px',
                                                            padding: '8px 12px',
                                                            borderRadius: '8px',
                                                            background: 'rgba(239,68,68,0.1)',
                                                            marginBottom: '8px'
                                                        }}>
                                                            <AlertCircle size={14} style={{ color: '#f87171', flexShrink: 0, marginTop: '2px' }} />
                                                            <span style={{ fontSize: '12px', color: '#f87171' }}>{err}</span>
                                                        </div>
                                                    ))}
                                                    {env.compatibilityDetails.warnings.map((warn, i) => (
                                                        <div key={i} style={{
                                                            display: 'flex',
                                                            alignItems: 'flex-start',
                                                            gap: '8px',
                                                            padding: '8px 12px',
                                                            borderRadius: '8px',
                                                            background: 'rgba(251,191,36,0.1)',
                                                            marginBottom: '8px'
                                                        }}>
                                                            <AlertTriangle size={14} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
                                                            <span style={{ fontSize: '12px', color: '#fbbf24' }}>{warn}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                                <button
                                                    onClick={() => {
                                                        setPythonPath(env.path);
                                                        setActiveTab('python');
                                                    }}
                                                    style={{
                                                        padding: '8px 16px',
                                                        borderRadius: '8px',
                                                        background: 'rgba(99,102,241,0.15)',
                                                        border: '1px solid rgba(99,102,241,0.3)',
                                                        color: '#818cf8',
                                                        fontSize: '13px',
                                                        fontWeight: 500,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    选择此环境
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div style={{
                    padding: '3rem',
                    borderRadius: '16px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px dashed rgba(255,255,255,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                    textAlign: 'center'
                }}>
                    <Box size={40} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            暂无可用环境
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                            点击上方按钮创建新的 Python 环境
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderCompatibilityMatrix = () => {
        if (!compatibilityMatrix) return null;

        return (
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '20px',
                padding: '2rem',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                    <Cpu size={20} style={{ color: 'rgb(139,92,246)' }} />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        版本兼容性矩阵
                    </h3>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '13px'
                    }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-tertiary)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>配置</th>
                                <th style={{ padding: '12px', textAlign: 'center', color: 'var(--text-tertiary)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>CUDA 版本</th>
                                <th style={{ padding: '12px', textAlign: 'center', color: 'var(--text-tertiary)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>PyTorch</th>
                                <th style={{ padding: '12px', textAlign: 'center', color: 'var(--text-tertiary)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Ultralytics</th>
                                <th style={{ padding: '12px', textAlign: 'center', color: 'var(--text-tertiary)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Python</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(compatibilityMatrix).map(([key, config]) => (
                                <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                                        {config.description || key.toUpperCase()}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        {config.cudaVersion || 'CPU'}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        {config.pytorch}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        {config.ultralytics}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        {config.python?.join(', ')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{
                    marginTop: '1.5rem',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(251,191,36,0.1)',
                    border: '1px solid rgba(251,191,36,0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <AlertTriangle size={16} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ fontSize: '13px', color: '#fbbf24', lineHeight: 1.5 }}>
                            <strong>已知不兼容版本：</strong>
                            <br />
                            • PyTorch 2.0.0/2.0.1 存在已知问题，建议使用 2.1.0 或更高版本
                            <br />
                            • Python 3.7 及更低版本不支持 Ultralytics 8.0+
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderCreateDialog = () => {
        if (!showCreateDialog) return null;

        return createPortal(
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(4px)'
            }} onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                    setShowCreateDialog(false);
                    setCreateProgress(null);
                }
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, rgba(30,35,45,0.98) 0%, rgba(20,25,35,0.98) 100%)',
                    borderRadius: '24px',
                    padding: '2rem',
                    width: '480px',
                    maxWidth: '90vw',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.4)'
                }} onMouseDown={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                            创建新 Python 环境
                        </h3>
                        <button
                            onClick={() => {
                                setShowCreateDialog(false);
                                setCreateProgress(null);
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-tertiary)',
                                cursor: 'pointer',
                                padding: '4px'
                            }}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                环境名称
                            </label>
                            <input
                                type="text"
                                value={newEnv.name}
                                onChange={(e) => setNewEnv({ ...newEnv, name: e.target.value })}
                                placeholder="例如: yolo-train"
                                style={{
                                    width: '100%',
                                    height: '48px',
                                    padding: '0 16px',
                                    fontSize: '14px',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                Python 版本
                            </label>
                            <select
                                value={newEnv.pythonVersion}
                                onChange={(e) => setNewEnv({ ...newEnv, pythonVersion: e.target.value })}
                                style={{
                                    width: '100%',
                                    height: '48px',
                                    padding: '0 16px',
                                    fontSize: '14px',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <option value="3.8">Python 3.8</option>
                                <option value="3.9">Python 3.9</option>
                                <option value="3.10">Python 3.10 (推荐)</option>
                                <option value="3.11">Python 3.11</option>
                                <option value="3.12">Python 3.12</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                CUDA 版本
                            </label>
                            <select
                                value={newEnv.cudaVersion}
                                onChange={(e) => setNewEnv({ ...newEnv, cudaVersion: e.target.value })}
                                style={{
                                    width: '100%',
                                    height: '48px',
                                    padding: '0 16px',
                                    fontSize: '14px',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <option value="auto">自动检测</option>
                                <option value="cpu">CPU Only (无 GPU 加速)</option>
                                <option value="11.8">CUDA 11.8</option>
                                <option value="12.1">CUDA 12.1</option>
                                <option value="12.4">CUDA 12.4</option>
                            </select>
                            {detectedCuda && detectedCuda.available && newEnv.cudaVersion === 'auto' && (
                                <div style={{ marginTop: '8px', fontSize: '12px', color: '#4ade80' }}>
                                    将使用检测到的 CUDA {detectedCuda.version}
                                </div>
                            )}
                        </div>
                    </div>

                    {createProgress && (
                        <div style={{
                            marginTop: '1.5rem',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            background: createProgress.status === 'error' ? 'rgba(239,68,68,0.1)' : 
                                       createProgress.status === 'success' ? 'rgba(34,197,94,0.1)' : 
                                       'rgba(99,102,241,0.1)',
                            border: `1px solid ${createProgress.status === 'error' ? 'rgba(239,68,68,0.2)' : 
                                     createProgress.status === 'success' ? 'rgba(34,197,94,0.2)' : 
                                     'rgba(99,102,241,0.2)'}`
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                color: createProgress.status === 'error' ? '#f87171' : 
                                       createProgress.status === 'success' ? '#4ade80' : 
                                       '#818cf8'
                            }}>
                                {createProgress.status === 'creating' && <RefreshCw size={16} className="spin" />}
                                {createProgress.status === 'success' && <CheckCircle size={16} />}
                                {createProgress.status === 'error' && <AlertCircle size={16} />}
                                <span style={{ fontSize: '14px' }}>{createProgress.message}</span>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
                        <button
                            onClick={() => {
                                setShowCreateDialog(false);
                                setCreateProgress(null);
                            }}
                            style={{
                                flex: 1,
                                height: '48px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                color: 'var(--text-secondary)',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            取消
                        </button>
                        <button
                            onClick={handleCreateEnv}
                            disabled={!newEnv.name.trim() || createProgress?.status === 'creating'}
                            style={{
                                flex: 1,
                                height: '48px',
                                background: !newEnv.name.trim() || createProgress?.status === 'creating' 
                                    ? 'rgba(99,102,241,0.3)' 
                                    : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                border: 'none',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: !newEnv.name.trim() || createProgress?.status === 'creating' ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {createProgress?.status === 'creating' ? '创建中...' : '创建环境'}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    };

    return createPortal(
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'linear-gradient(135deg, rgba(13,17,23,0.98) 0%, rgba(22,27,34,0.98) 100%)',
            overflow: 'auto'
        }}>
            <div style={{ 
                maxWidth: '900px', 
                margin: '0 auto', 
                padding: 'clamp(1.5rem, 4vw, 2.5rem) clamp(1rem, 3vw, 2rem)',
                minHeight: '100vh'
            }}>
                {/* Header Section */}
                <div style={{ marginBottom: '2rem' }}>
                    <button
                        onClick={onBack}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '12px',
                            width: '44px',
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            marginBottom: '1.25rem',
                            transition: 'all 0.2s ease',
                            backdropFilter: 'blur(10px)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                        }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '16px',
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#818cf8',
                            boxShadow: '0 8px 24px rgba(99,102,241,0.15)',
                            flexShrink: 0
                        }}>
                            <SettingsIcon size={28} />
                        </div>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <h2 style={{ 
                                fontSize: 'clamp(1.5rem, 4vw, 1.875rem)', 
                                fontWeight: 800, 
                                margin: 0, 
                                color: 'var(--text-primary)',
                                lineHeight: 1.2
                            }}>
                                全局设置
                            </h2>
                            <p style={{ 
                                fontSize: '14px', 
                                color: 'var(--text-tertiary)', 
                                margin: '8px 0 0 0',
                                lineHeight: 1.5
                            }}>
                                配置 Python 环境和其他系统选项
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div style={{
                    display: 'flex',
                    gap: '10px',
                    marginBottom: '2rem',
                    background: 'rgba(0,0,0,0.25)',
                    padding: '8px',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(10px)'
                }}>
                    <button
                        onClick={() => setActiveTab('projects')}
                        style={{
                            flex: 1,
                            padding: '14px 24px',
                            background: activeTab === 'projects'
                                ? 'linear-gradient(135deg, rgba(77,161,255,0.18), rgba(52,211,153,0.12))'
                                : 'transparent',
                            border: activeTab === 'projects'
                                ? '1px solid rgba(77,161,255,0.35)'
                                : '1px solid transparent',
                            borderRadius: '12px',
                            color: activeTab === 'projects' ? '#4da1ff' : 'var(--text-secondary)',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== 'projects') {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== 'projects') {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }
                        }}
                    >
                        <Database size={18} />
                        <span>项目目录</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('python')}
                        style={{
                            flex: 1,
                            padding: '14px 24px',
                            background: activeTab === 'python' 
                                ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))' 
                                : 'transparent',
                            border: activeTab === 'python' 
                                ? '1px solid rgba(99,102,241,0.4)' 
                                : '1px solid transparent',
                            borderRadius: '12px',
                            color: activeTab === 'python' ? '#818cf8' : 'var(--text-secondary)',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== 'python') {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== 'python') {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }
                        }}
                    >
                        <Terminal size={18} />
                        <span>Python 配置</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('environments')}
                        style={{
                            flex: 1,
                            padding: '14px 24px',
                            background: activeTab === 'environments' 
                                ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))' 
                                : 'transparent',
                            border: activeTab === 'environments' 
                                ? '1px solid rgba(99,102,241,0.4)' 
                                : '1px solid transparent',
                            borderRadius: '12px',
                            color: activeTab === 'environments' ? '#818cf8' : 'var(--text-secondary)',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== 'environments') {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== 'environments') {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }
                        }}
                    >
                        <Box size={18} />
                        <span>Python 环境</span>
                    </button>
                </div>

                {/* Content Area */}
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1.5rem',
                    marginBottom: '2rem'
                }}>
                    {activeTab === 'projects' && (
                        <>
                            {renderProjectsDir()}
                        </>
                    )}

                    {activeTab === 'python' && (
                        <>
                            {renderPythonConfig()}
                        </>
                    )}

                    {activeTab === 'environments' && (
                        <>
                            <CollapsibleSection title="环境列表" isOpen={envListOpen} onToggle={() => setEnvListOpen(v => !v)}>
                                {renderEnvironments()}
                            </CollapsibleSection>
                            <CollapsibleSection title="版本兼容性矩阵" isOpen={compatOpen} onToggle={() => setCompatOpen(v => !v)}>
                                {renderCompatibilityMatrix()}
                            </CollapsibleSection>
                        </>
                    )}
                </div>

                {/* Info Cards Section */}
                {activeTab === 'python' && (
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '1rem',
                        marginTop: '1rem'
                    }}>
                        <InfoCard icon={Info} title="配置优先级" color="99,102,241">
                            系统使用以下优先级选择 Python 路径：<br />
                            1. 用户配置路径 (最高优先级)<br />
                            2. 硬编码备选路径<br />
                            3. Conda 回退机制 (最低优先级)
                        </InfoCard>

                        <InfoCard icon={Cpu} title="路径示例 (Windows)" color="34,197,94">
                            常见 Python 路径：<br />
                            • Anaconda: <code style={{ color: '#4ade80' }}>D:\Anaconda3\python.exe</code><br />
                            • Miniconda: <code style={{ color: '#4ade80' }}>D:\miniconda3\python.exe</code><br />
                            • Conda 环境: <code style={{ color: '#4ade80' }}>D:\miniconda3\envs\yolo\python.exe</code>
                        </InfoCard>

                        <InfoCard icon={AlertTriangle} title="故障排除" color="251,191,36">
                            如果训练失败，请确保：<br />
                            • Python 路径指向正确的 python.exe<br />
                            • 已安装 ultralytics: <code style={{ color: '#fbbf24' }}>pip install ultralytics</code><br />
                            • 已安装 torch: <code style={{ color: '#fbbf24' }}>pip install torch</code>
                        </InfoCard>
                    </div>
                )}

            </div>

            {renderCreateDialog()}

            <style>{`
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>,
        document.body
    );
};
