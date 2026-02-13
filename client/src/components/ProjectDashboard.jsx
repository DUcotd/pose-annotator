import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useProject } from '../context/ProjectContext';
import { Folder, Trash2, Plus, Image as ImageIcon, ChevronRight, Zap, Target, Upload, Download, X, AlertCircle, CheckCircle as CheckCircleIcon } from 'lucide-react';

export const ProjectDashboard = ({ projects = [], onCreateProject, onSelectProject, onDeleteProject }) => {
    const { importCollaboration, exportCollaboration } = useProject();
    const [newProjectName, setNewProjectName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [notification, setNotification] = useState(null);

    const handleImportProject = async () => {
        const result = await importCollaboration();
        if (result.success) {
            setNotification({ type: 'success', message: result.message });
        } else if (result.message !== '取消导入') {
            setNotification({ type: 'error', message: result.message });
        }
        if (result.success || result.message !== '取消导入') {
            setTimeout(() => setNotification(null), 5000);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newProjectName.trim()) {
            onCreateProject(newProjectName);
            setNewProjectName('');
            setIsCreating(false);
        }
    };
    const totalImages = projects.reduce((acc, p) => acc + (p.imageCount || 0), 0);

    return (
        <div style={{ padding: '0 3rem 0 3rem', maxWidth: '1600px', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Hero Section */}
            <div className="hero-section" style={{ padding: '64px 0 40px 0', flexShrink: 0 }}>
                <h1 className="hero-title" style={{ fontSize: '3rem', marginBottom: '16px', lineHeight: 1.2 }}>
                    <span className="text-gradient" style={{ letterSpacing: '-0.02em' }}>探索您的</span>
                    <br />
                    <span style={{ color: 'var(--text-primary)', fontSize: '2.6rem', fontWeight: 800, letterSpacing: '-1.5px', display: 'inline-flex', alignItems: 'center', gap: '16px' }}>
                        计算机视觉世界
                        <span className="badge-new" style={{ fontSize: '0.9rem', padding: '4px 12px', verticalAlign: 'middle', marginTop: '4px' }}>v1.2</span>
                    </span>
                </h1>
                <p className="hero-subtitle" style={{ fontSize: '1.15rem', marginTop: '1.2rem', maxWidth: '800px', color: 'var(--text-secondary)', fontWeight: 400, lineHeight: 1.7, letterSpacing: '0.01em' }}>
                    AI 驱动的高级标注平台。简化您的数据集管理流程，
                    <br />
                    从模型训练到结果导出，一切尽在掌握。
                </p>

                <div style={{ marginTop: '2rem', display: 'flex', gap: '1.2rem', flexWrap: 'wrap' }}>
                    <button className="btn-modern-primary" onClick={() => setIsCreating(true)}>
                        <Plus size={22} strokeWidth={2.5} />
                        立即开始
                    </button>
                    <button className="btn-modern-secondary" onClick={handleImportProject} style={{ gap: '8px' }}>
                        <Upload size={20} strokeWidth={2} />
                        导入项目 (ZIP)
                    </button>
                    <button className="btn-modern-secondary" onClick={() => setIsGuideOpen(true)}>
                        <Zap size={22} strokeWidth={2} />
                        快速指南
                    </button>
                </div>
            </div>

            {/* Creation Modal - rendered via Portal to ensure centering */}
            {isCreating && createPortal(
                <div className="modal-overlay" onClick={() => setIsCreating(false)}>
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
                        {/* Close Icon */}
                        <button
                            onClick={() => setIsCreating(false)}
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
                                <Plus size={32} strokeWidth={2.5} />
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
                            <div style={{ padding: '0 3rem 3rem 3rem' }}>
                                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label className="form-label" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>项目名称</label>
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
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        autoFocus
                                    />
                                </div>
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
                                    onClick={() => setIsCreating(false)}
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
                                    disabled={!newProjectName.trim()}
                                >
                                    创建项目
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Quick Guide Modal - rendered via Portal */}
            {isGuideOpen && createPortal(
                <div className="modal-overlay" onClick={() => setIsGuideOpen(false)}>
                    <div
                        onClick={e => e.stopPropagation()}
                        className="animate-scale-in glass-panel"
                        style={{ border: '1px solid var(--border-subtle)', maxWidth: '600px', width: '90%', padding: '2.5rem', background: 'var(--bg-secondary)', borderRadius: '24px' }}
                    >
                        <div className="modal-header-between">
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}><Zap size={24} className="text-gradient" /> 快速上手指南</h3>
                            <button
                                onClick={() => setIsGuideOpen(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    color: 'var(--text-tertiary)',
                                    transition: 'all 0.2s'
                                }}
                                className="hover-card"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body" style={{ gap: '1.5rem', marginTop: '1.5rem' }}>
                            {[
                                { icon: Plus, title: '创建项目', desc: '点击"新建项目"，输入名称创建您的数据集空间。', color: '#58a6ff', bg: 'rgba(88, 166, 255, 0.1)' },
                                { icon: Upload, title: '上传图片', desc: '进入项目后，在"图库"页面上传待标注的图片。', color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)' },
                                { icon: Target, title: '进行标注', desc: '点击图库中的图片进入编辑器，绘制边界框并分配标签。', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' },
                                { icon: Download, title: '导出数据集', desc: '标注完成后，点击侧边栏的"导出"按钮生成 YOLO 格式数据。', color: '#f472b6', bg: 'rgba(244, 114, 182, 0.1)' }
                            ].map((step, i) => (
                                <div key={i} className="guide-step" style={{ display: 'flex', gap: '1.2rem', alignItems: 'flex-start' }}>
                                    <div style={{ background: step.bg, padding: '12px', borderRadius: '12px', color: step.color }}>
                                        <step.icon size={24} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 600 }}>{i + 1}. {step.title}</h4>
                                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                                            {step.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="modal-footer" style={{ marginTop: '2.5rem' }}>
                            <button type="button" className="btn-modern-primary" onClick={() => setIsGuideOpen(false)} style={{ width: '100%', justifyContent: 'center' }}>
                                我明白了
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {notification && createPortal(
                <div style={{
                    position: 'fixed',
                    bottom: '40px',
                    right: '40px',
                    zIndex: 9999,
                    animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    <div style={{
                        padding: '16px 24px',
                        background: notification.type === 'success' ? '#065f46' : '#991b1b',
                        border: `1px solid ${notification.type === 'success' ? '#10b981' : '#ef4444'}`,
                        borderRadius: '16px',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
                    }}>
                        {notification.type === 'success' ? <CheckCircleIcon size={20} /> : <AlertCircle size={20} />}
                        <span style={{ fontWeight: 600 }}>{notification.message}</span>
                    </div>
                </div>,
                document.body
            )}

            {/* Projects Grid Container with independent scroll */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '3rem', paddingRight: '12px' }} className="custom-scrollbar">
                <div className="project-grid-modern" style={{ marginTop: '1rem' }}>
                    {projects.length === 0 ? (
                        <div className="empty-state-container" style={{ padding: '60px 40px', minHeight: '400px', justifyContent: 'center' }}>
                            <div className="empty-state-icon" style={{ width: '80px', height: '80px', marginBottom: '24px' }}>
                                <Folder size={40} />
                            </div>
                            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '1rem' }}>准备好开始了吗？</h2>
                            <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 2.5rem auto', fontSize: '1.1rem', lineHeight: 1.6 }}>
                                目前还没有任何项目。创建一个新项目来开始您的标注之旅。
                                <br />
                                您可以轻松地组织图片、标注目标并导出为标准的 YOLO 格式。
                            </p>
                            <button className="btn-modern-primary" onClick={() => setIsCreating(true)} style={{ padding: '14px 28px', fontSize: '1.1rem' }}>
                                <Plus size={22} />
                                创建第一个项目
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Inline Create Card */}
                            <div
                                className="glass-card glass-card-hover"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    borderStyle: 'dashed',
                                    borderWidth: '2px',
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    height: '260px',
                                    padding: '32px',
                                    background: 'rgba(255, 255, 255, 0.01)',
                                    animationDelay: '0.1s'
                                }}
                                onClick={() => setIsCreating(true)}
                            >
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '22px',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '20px',
                                    color: 'var(--text-tertiary)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    transition: 'all 0.3s ease'
                                }} className="create-card-icon">
                                    <Plus size={32} strokeWidth={1.5} />
                                </div>
                                <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)' }}>创建新项目</h3>
                                <p style={{ margin: '8px 0 0 0', color: 'var(--text-tertiary)', fontSize: '0.9rem', fontWeight: 500 }}>开始您的标注之旅</p>
                            </div>

                            {projects.map((project, index) => (
                                <div
                                    key={project.id}
                                    className={`glass-card glass-card-hover`}
                                    style={{
                                        height: '260px',
                                        padding: '32px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        position: 'relative',
                                        animationDelay: `${(index % 4) * 0.1 + 0.2}s`
                                    }}
                                    onClick={() => onSelectProject(project.id)}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '14px',
                                            background: 'rgba(77, 161, 255, 0.1)',
                                            color: '#4da1ff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '1px solid rgba(77, 161, 255, 0.1)'
                                        }}>
                                            <Folder size={24} />
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                                                className="icon-btn hover-card"
                                                title="删除项目"
                                                style={{
                                                    color: 'var(--text-tertiary)',
                                                    background: 'rgba(255,255,255,0.03)',
                                                    padding: '8px',
                                                    borderRadius: '10px'
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <h3 style={{
                                            margin: '0 0 1rem 0',
                                            fontSize: '1.4rem',
                                            fontWeight: 800,
                                            letterSpacing: '-0.5px',
                                            color: 'var(--text-primary)',
                                            lineHeight: 1.2
                                        }}>
                                            {project.name}
                                        </h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                background: 'rgba(255, 255, 255, 0.04)',
                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                padding: '4px 10px',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.85rem',
                                                fontWeight: 600
                                            }}>
                                                <ImageIcon size={14} />
                                                <span>{project.imageCount || 0}</span>
                                            </div>
                                            {project.imageCount > 0 && (
                                                <div style={{
                                                    background: 'rgba(52, 211, 153, 0.1)',
                                                    border: '1px solid rgba(52, 211, 153, 0.2)',
                                                    padding: '4px 10px',
                                                    borderRadius: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    color: '#34d399',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600
                                                }}>
                                                    <CheckCircleIcon size={14} />
                                                    <span>{project.annotatedCount || 0}</span>
                                                </div>
                                            )}
                                            <span className="card-tag">YOLO 格式</span>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: project.imageCount > 0 ? '#34d399' : '#fbbf24',
                                                boxShadow: `0 0 10px ${project.imageCount > 0 ? 'rgba(52, 211, 153, 0.4)' : 'rgba(251, 191, 36, 0.4)'}`
                                            }} />
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                {project.imageCount > 0 ? '已就绪' : '等待图片'}
                                            </span>
                                        </div>
                                        <div className="card-arrow-icon">
                                            <ChevronRight size={18} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {/* Subtle Footer Divider */}
            <div style={{
                height: '1px',
                background: 'linear-gradient(to right, transparent, var(--border-subtle), transparent)',
                width: '100%',
                opacity: 0.5,
                marginTop: 'auto'
            }} />
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};
