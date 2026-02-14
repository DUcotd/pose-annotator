import React, { useState, useEffect } from 'react';
import {
    Settings as SettingsIcon, CheckCircle, AlertTriangle, RefreshCw,
    FolderOpen, Info, ArrowLeft, Terminal, Cpu, Save
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
                                    padding: '2.5rem',
                                    borderRadius: '16px',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px dashed rgba(255,255,255,0.1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '12px',
                                    color: 'var(--text-tertiary)'
                                }}>
                                    <RefreshCw size={24} className="spin" style={{ color: 'var(--accent-primary)' }} />
                                    <div style={{ fontSize: '14px', fontWeight: 500 }}>正在深度扫描 Python 环境...</div>
                                    <div style={{ fontSize: '12px', opacity: 0.7 }}>正在查找 Conda, 系统路径和虚拟环境</div>
                                </div>
                            ) : detectedEnvs.length > 0 ? (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                                    gap: '12px',
                                    maxHeight: '400px',
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
                                                background: pythonPath === env.path ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${pythonPath === env.path ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                                borderRadius: '14px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '14px',
                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (pythonPath !== env.path) {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (pythonPath !== env.path) {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                                }
                                            }}
                                        >
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
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
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
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
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', opacity: 0.8 }}>
                                                    {env.path}
                                                </div>
                                            </div>
                                            {pythonPath === env.path ? (
                                                <CheckCircle size={20} style={{ color: '#6366f1', flexShrink: 0 }} />
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
                                    padding: '2.5rem',
                                    borderRadius: '16px',
                                    background: 'rgba(239,68,68,0.02)',
                                    border: '1px dashed rgba(239,68,68,0.2)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '12px',
                                    color: 'var(--text-tertiary)',
                                    textAlign: 'center'
                                }}>
                                    <AlertTriangle size={24} style={{ color: '#f87171' }} />
                                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#f87171' }}>未检测到 Python 环境</div>
                                    <div style={{ fontSize: '12px', maxWidth: '300px' }}>
                                        请尝试手动点击右上方「重新扫描环境」，或点击左侧文件夹图标手动浏览 python.exe 文件。
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
