import React, { useState, useEffect } from 'react';
import {
    Settings as SettingsIcon, CheckCircle, AlertTriangle, RefreshCw,
    FolderOpen, Info, ArrowLeft, Terminal, Cpu, Save, Database
} from 'lucide-react';
import { createPortal } from 'react-dom';

export const Settings = ({ onBack }) => {
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

    useEffect(() => {
        fetchSettings();
        handleScan();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/settings');
            const data = await res.json();
            if (data.pythonPath) {
                setPythonPath(data.pythonPath);
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
        try {
            const res = await fetch('http://localhost:5000/api/settings/projects-dir');
            const data = await res.json();
            setProjectsDir(data.projectsDir || '');
        } catch (err) {
            console.error('Failed to load projects dir:', err);
        }
    };

    const handleSelectFile = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/utils/select-python', { method: 'POST' });
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
            const res = await fetch('http://localhost:5000/api/settings/scan-envs');
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
            const res = await fetch('http://localhost:5000/api/settings/validate-python', {
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
            const res = await fetch('http://localhost:5000/api/settings', {
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
            const res = await fetch('http://localhost:5000/api/utils/select-folder', { method: 'POST' });
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
            const res = await fetch('http://localhost:5000/api/settings/projects-dir', {
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
            const res = await fetch('http://localhost:5000/api/settings/projects-dir', {
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

    const InfoCard = ({ icon: Icon, title, children, color = '99,102,241' }) => (
        <div style={{
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '16px',
            padding: '1.25rem',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            gap: '1rem'
        }}>
            <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: `rgba(${color}, 0.15)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: `rgb(${color})`,
                flexShrink: 0
            }}>
                <Icon size={20} />
            </div>
            <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>{title}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{children}</div>
            </div>
        </div>
    );

    return createPortal(
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'linear-gradient(135deg, rgba(13,17,23,0.98) 0%, rgba(22,27,34,0.98) 100%)',
            overflow: 'auto'
        }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
                {/* Header */}
                <div style={{ marginBottom: '2.5rem' }}>
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
                            marginBottom: '1rem'
                        }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '14px',
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#818cf8'
                        }}>
                            <SettingsIcon size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                                全局设置
                            </h2>
                            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>
                                配置 Python 环境和其他系统选项
                            </p>
                        </div>
                    </div>
                </div>

                {/* Python Configuration */}
                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '24px',
                    padding: '2rem',
                    border: '1px solid rgba(255,255,255,0.06)',
                    marginBottom: '1.5rem'
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

                    {/* Path Input */}
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
                                    padding: '0 16px',
                                    fontSize: '14px',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: `1px solid ${validationResult?.valid === true ? 'rgba(34,197,94,0.4)' : validationResult?.valid === false ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
                                    borderRadius: '14px',
                                    color: 'var(--text-primary)',
                                    outline: 'none'
                                }}
                            />
                            <button
                                onClick={handleSelectFile}
                                style={{
                                    width: '52px',
                                    height: '52px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer'
                                }}
                                title="浏览文件"
                            >
                                <FolderOpen size={20} />
                            </button>
                            <button
                                onClick={() => handleValidate()}
                                disabled={isValidating || !pythonPath.trim()}
                                style={{
                                    width: '52px',
                                    height: '52px',
                                    background: isValidating ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.2)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: isValidating ? 'var(--text-tertiary)' : 'rgb(99,102,241)',
                                    cursor: isValidating || !pythonPath.trim() ? 'not-allowed' : 'pointer'
                                }}
                                title="验证路径"
                            >
                                {isValidating ? <RefreshCw size={20} className="spin" /> : <CheckCircle size={20} />}
                            </button>
                        </div>

                        {/* Detected Environments List */}
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

                    {/* Validation Result */}
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

                    {/* Save Button */}
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
                            boxShadow: isSaving ? 'none' : '0 8px 24px rgba(99,102,241,0.25)'
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

                    {/* Save Message */}
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

                {/* Projects Directory Configuration */}
                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '24px',
                    padding: '2rem',
                    border: '1px solid rgba(255,255,255,0.06)',
                    marginBottom: '1.5rem'
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
                                    padding: '0 16px',
                                    fontSize: '14px',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '14px',
                                    color: 'var(--text-primary)',
                                    outline: 'none'
                                }}
                            />
                            <button
                                onClick={handleSelectProjectsDir}
                                style={{
                                    width: '52px',
                                    height: '52px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer'
                                }}
                                title="浏览文件夹"
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
                                    cursor: isSavingDir ? 'not-allowed' : 'pointer'
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
                                        cursor: isSavingDir ? 'not-allowed' : 'pointer'
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

                {/* Info Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
        </div>,
        document.body
    );
};
