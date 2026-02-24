import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Folder, X, FolderOpen } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useErrorCenter } from '../../error/ErrorCenter';

export const CreateProjectModal = ({ isOpen, onClose, onSubmit }) => {
    const { reportError } = useErrorCenter();
    const [name, setName] = useState('');
    const [customPath, setCustomPath] = useState('');
    const [defaultPath, setDefaultPath] = useState('');
    const [useCustomPath, setUseCustomPath] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSubmitError('');
            apiClient.get('/api/settings/projects-dir')
                .then((data) => {
                    setDefaultPath(data.projectsDir || '使用默认位置');
                })
                .catch((err) => {
                    reportError(err, { source: 'create-project-modal.load-default-path' });
                    setDefaultPath('使用默认位置');
                });
        }
    }, [isOpen, reportError]);

    const handleSelectFolder = async () => {
        try {
            const data = await apiClient.post('/api/utils/select-folder', {});
            if (data.path) {
                setCustomPath(data.path);
                setUseCustomPath(true);
            }
        } catch (err) {
            console.error('Failed to select folder:', err);
            reportError(err, { source: 'create-project-modal.select-folder' });
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || isSubmitting) return;

        setSubmitError('');
        setIsSubmitting(true);

        const targetPath = useCustomPath
            ? customPath
            : (defaultPath && defaultPath !== '使用默认位置' ? defaultPath : null);

        try {
            const result = await onSubmit(name, targetPath);
            const success = typeof result === 'string' || !!result?.success;

            if (success) {
                setName('');
                setCustomPath('');
                setUseCustomPath(false);
                onClose();
            } else {
                setSubmitError(result?.message || '创建失败，请检查项目名是否重复或路径是否可写');
            }
        } catch (err) {
            setSubmitError(err?.message ? String(err.message) : '创建失败，请稍后重试');
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                className="animate-scale-in modal-panel"
                style={{
                    maxWidth: '480px',
                    background: '#0d1117',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                    padding: 0,
                    position: 'relative',
                    borderRadius: '24px',
                    overflow: 'hidden'
                }}
            >
                {/* Close Button */}
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

                {/* Progress Bar */}
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
                        <Folder size={32} strokeWidth={2.5} />
                    </div>

                    <h3 style={{
                        margin: '0 0 1rem 0',
                        fontSize: '2rem',
                        fontWeight: 800,
                        letterSpacing: '-0.8px',
                        color: 'var(--text-primary)',
                        lineHeight: 1.1
                    }}>
                        创建新项目
                    </h3>
                    <p style={{
                        margin: 0,
                        color: 'var(--text-secondary)',
                        fontSize: '1.05rem',
                        lineHeight: 1.6,
                        fontWeight: 400,
                        opacity: 0.9
                    }}>
                        为您的数据集创建一个新的工作空间。稍后您可以添加图片并开始标注。
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ padding: '0 3rem 1.5rem 3rem' }}>
                        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>项目名称</label>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>必填</span>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                left: '18px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'rgba(255,255,255,0.3)',
                                pointerEvents: 'none',
                                zIndex: 1
                            }}>
                                <Folder size={20} />
                            </div>
                            <input
                                type="text"
                                className="input-modern"
                                style={{
                                    paddingLeft: '54px',
                                    height: '60px',
                                    fontSize: '1.1rem',
                                    background: 'rgba(0,0,0,0.4)',
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                                }}
                                placeholder="例如：施工人员安全检测"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div style={{ padding: '0 3rem 3rem 3rem' }}>
                        <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>保存位置</label>
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
                            {useCustomPath ? '项目将创建在所选目录下' : '默认保存到应用数据目录，点击"浏览"选择其他位置'}
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
                        {submitError ? (
                            <div style={{
                                marginRight: 'auto',
                                maxWidth: '52%',
                                color: '#fca5a5',
                                fontSize: '0.85rem',
                                lineHeight: 1.4
                            }}>
                                {submitError}
                            </div>
                        ) : null}
                        <button
                            type="button"
                            className="btn-modern-secondary"
                            onClick={onClose}
                            disabled={isSubmitting}
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
                            disabled={!name.trim() || isSubmitting}
                        >
                            {isSubmitting ? '创建中...' : '创建项目'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
