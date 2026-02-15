import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, X, Upload } from 'lucide-react';

export const ImportCollaborationModal = ({ isOpen, onClose, onImport }) => {
    const [zipPath, setZipPath] = useState('');
    const [customPath, setCustomPath] = useState('');
    const [defaultPath, setDefaultPath] = useState('');
    const [useCustomPath, setUseCustomPath] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetch('http://localhost:5000/api/settings/projects-dir')
                .then(res => res.json())
                .then(data => {
                    setDefaultPath(data.projectsDir || '使用默认位置');
                })
                .catch(() => {
                    setDefaultPath('使用默认位置');
                });
            setZipPath('');
            setCustomPath('');
            setUseCustomPath(false);
        }
    }, [isOpen]);

    const handleSelectZip = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/utils/select-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filters: [{ name: '项目协作包 (ZIP)', extensions: ['zip'] }]
                })
            });
            const data = await res.json();
            if (data.path) {
                setZipPath(data.path);
            }
        } catch (err) {
            console.error('Failed to select file:', err);
        }
    };

    const handleSelectFolder = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/utils/select-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.path) {
                setCustomPath(data.path);
                setUseCustomPath(true);
            }
        } catch (err) {
            console.error('Failed to select folder:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!zipPath) return;

        setIsImporting(true);
        try {
            await onImport(zipPath, useCustomPath ? customPath : null);
            onClose();
        } finally {
            setIsImporting(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                className="animate-scale-in modal-panel"
                style={{
                    maxWidth: '520px',
                    background: '#0d1117',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                    padding: 0,
                    position: 'relative',
                    borderRadius: '24px',
                    overflow: 'hidden'
                }}
            >
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        right: '20px',
                        top: '20px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '10px',
                        cursor: 'pointer',
                        color: 'var(--text-tertiary)',
                        transition: 'all 0.2s',
                        zIndex: 10
                    }}
                    className="hover-card"
                >
                    <X size={20} />
                </button>

                <div style={{
                    height: '6px',
                    background: 'linear-gradient(to right, #4da1ff, #34d399, #fbbf24)',
                    width: '100%',
                    opacity: 0.8
                }} />

                <div style={{ padding: '3.5rem 3rem 2rem 3rem' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'rgba(77, 161, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1.8rem',
                        border: '1px solid rgba(77, 161, 255, 0.2)',
                        color: '#4da1ff',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                    }}>
                        <Upload size={32} strokeWidth={2.5} />
                    </div>

                    <h3 style={{
                        margin: '0 0 1rem 0',
                        fontSize: '2rem',
                        fontWeight: 800,
                        letterSpacing: '-0.8px',
                        color: 'var(--text-primary)',
                        lineHeight: 1.1
                    }}>
                        导入协作包
                    </h3>
                    <p style={{
                        margin: 0,
                        color: 'var(--text-secondary)',
                        fontSize: '1.05rem',
                        lineHeight: 1.6,
                        fontWeight: 400,
                        opacity: 0.9
                    }}>
                        从 ZIP 协作包导入项目，包含图片和标注数据。
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ padding: '0 3rem 1.5rem 3rem' }}>
                        <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>协作包文件</label>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>必填</span>
                        </div>
                        <div style={{ 
                            display: 'flex', 
                            gap: '0.75rem', 
                            alignItems: 'center',
                            padding: '0.75rem',
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                background: 'rgba(0,0,0,0.3)',
                                borderRadius: '8px',
                                minHeight: '44px',
                                overflow: 'hidden'
                            }}>
                                <FolderOpen size={16} style={{ flexShrink: 0, color: 'rgba(255,255,255,0.4)' }} />
                                <span style={{ 
                                    fontSize: '0.9rem', 
                                    color: zipPath ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {zipPath || '点击选择 ZIP 文件...'}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleSelectZip}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: 'rgba(77, 161, 255, 0.1)',
                                    border: '1px solid rgba(77, 161, 255, 0.3)',
                                    borderRadius: '8px',
                                    color: '#4da1ff',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s'
                                }}
                                className="hover-card"
                            >
                                选择文件
                            </button>
                        </div>
                    </div>

                    <div style={{ padding: '0 3rem 3rem 3rem' }}>
                        <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>导入位置</label>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>可选</span>
                        </div>
                        <div style={{ 
                            display: 'flex', 
                            gap: '0.75rem', 
                            alignItems: 'center',
                            padding: '0.75rem',
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                background: 'rgba(0,0,0,0.3)',
                                borderRadius: '8px',
                                minHeight: '44px',
                                overflow: 'hidden'
                            }}>
                                <FolderOpen size={16} style={{ flexShrink: 0, color: 'rgba(255,255,255,0.4)' }} />
                                <span style={{ 
                                    fontSize: '0.9rem', 
                                    color: useCustomPath ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {useCustomPath ? customPath : defaultPath}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleSelectFolder}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: 'rgba(77, 161, 255, 0.1)',
                                    border: '1px solid rgba(77, 161, 255, 0.3)',
                                    borderRadius: '8px',
                                    color: '#4da1ff',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s'
                                }}
                                className="hover-card"
                            >
                                浏览...
                            </button>
                            {useCustomPath && (
                                <button
                                    type="button"
                                    onClick={() => { setUseCustomPath(false); setCustomPath(''); }}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        color: 'var(--text-tertiary)',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.2s'
                                    }}
                                    className="hover-card"
                                >
                                    重置
                                </button>
                            )}
                        </div>
                        <p style={{ 
                            margin: '0.5rem 0 0 0', 
                            fontSize: '0.8rem', 
                            color: 'var(--text-tertiary)' 
                        }}>
                            {useCustomPath ? '项目将导入到所选目录下' : '默认导入到应用数据目录，点击"浏览"选择其他位置'}
                        </p>
                    </div>

                    <div style={{
                        padding: '2rem 3rem',
                        background: 'rgba(0,0,0,0.25)',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '1.2rem'
                    }}>
                        <button
                            type="button"
                            className="btn-modern-secondary"
                            onClick={onClose}
                            style={{ height: '52px', padding: '0 2rem' }}
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="btn-modern-primary"
                            style={{
                                height: '52px',
                                padding: '0 2.5rem',
                                minWidth: '140px'
                            }}
                            disabled={!zipPath || isImporting}
                        >
                            {isImporting ? '导入中...' : '导入项目'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
