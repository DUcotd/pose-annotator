import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Folder, Trash2, Plus, Image as ImageIcon, ChevronRight, Zap, Target, Upload, Download, X } from 'lucide-react';

export const ProjectDashboard = ({ projects = [], onCreateProject, onSelectProject, onDeleteProject }) => {
    const [newProjectName, setNewProjectName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);

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
        <div style={{ padding: '0 3rem 4rem 3rem', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Hero Section */}
            <div className="hero-section animate-fade-in" style={{ padding: '80px 0 60px 0' }}>
                <h1 className="hero-title">
                    <span className="text-gradient">探索您的</span>
                    <br />
                    <span style={{ color: 'var(--text-primary)', fontSize: '3.2rem', fontWeight: 800, letterSpacing: '-1.5px' }}>计算机视觉世界</span>
                    <span className="badge-new">v1.2</span>
                </h1>
                <p className="hero-subtitle" style={{ fontSize: '1.25rem', marginTop: '1.5rem', maxWidth: '700px', color: 'var(--text-secondary)', fontWeight: 400 }}>
                    AI 驱动的高级标注平台。简化您的数据集管理流程，
                    <br />
                    从模型训练到结果导出，一切尽在掌握。
                </p>

                <div style={{ marginTop: '3rem', display: 'flex', gap: '1.2rem' }}>
                    <button className="btn-modern-primary" onClick={() => setIsCreating(true)}>
                        <Plus size={20} />
                        立即开始
                    </button>
                    <button className="btn-modern-secondary" onClick={() => setIsGuideOpen(true)}>
                        <Zap size={20} />
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
                            maxWidth: '440px',
                            background: '#1c2128',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.9)',
                            padding: 0,
                            position: 'relative'
                        }}
                    >
                        {/* Close Icon */}
                        <button
                            onClick={() => setIsCreating(false)}
                            style={{
                                position: 'absolute',
                                right: '16px',
                                top: '16px',
                                background: 'rgba(255,255,255,0.05)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px',
                                cursor: 'pointer',
                                color: 'var(--text-tertiary)',
                                transition: 'all 0.2s',
                                zIndex: 10
                            }}
                        >
                            <X size={18} />
                        </button>

                        <div style={{
                            height: '4px',
                            background: 'linear-gradient(to right, #58a6ff, #34d399, #fbbf24)',
                            width: '100%'
                        }} />

                        <div style={{ padding: '2.5rem 2.5rem 1.5rem 2.5rem' }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '16px',
                                background: 'linear-gradient(135deg, rgba(88, 166, 255, 0.15), rgba(88, 166, 255, 0.05))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1.5rem',
                                border: '1px solid rgba(88, 166, 255, 0.2)',
                                color: '#58a6ff'
                            }}>
                                <Plus size={28} />
                            </div>

                            <h3 style={{
                                margin: '0 0 0.8rem 0',
                                fontSize: '1.75rem',
                                fontWeight: 800,
                                letterSpacing: '-0.5px',
                                color: 'var(--text-primary)'
                            }}>
                                创建新项目
                            </h3>
                            <p style={{
                                margin: 0,
                                color: 'var(--text-secondary)',
                                fontSize: '1rem',
                                lineHeight: 1.6,
                                fontWeight: 400
                            }}>
                                为您的数据集创建一个新的工作空间。稍后您可以添加图片并开始标注。
                            </p>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={{ padding: '0 2.5rem 2.5rem 2.5rem' }}>
                                <div style={{ marginBottom: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label className="form-label" style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>项目名称</label>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>必填</span>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <div style={{
                                        position: 'absolute',
                                        left: '16px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--text-tertiary)',
                                        pointerEvents: 'none'
                                    }}>
                                        <Folder size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        className="input-modern"
                                        style={{
                                            paddingLeft: '48px',
                                            height: '56px',
                                            fontSize: '1.05rem',
                                            background: 'rgba(0,0,0,0.3)',
                                            border: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                        placeholder="例如：施工人员安全检测"
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div style={{
                                padding: '1.5rem 2.5rem',
                                background: 'rgba(0,0,0,0.2)',
                                borderTop: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '1rem'
                            }}>
                                <button
                                    type="button"
                                    className="btn-modern-secondary"
                                    onClick={() => setIsCreating(false)}
                                    style={{ height: '48px', padding: '0 1.5rem', background: 'transparent', border: 'none' }}
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="btn-modern-primary"
                                    style={{
                                        height: '48px',
                                        padding: '0 2rem',
                                        minWidth: '120px'
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

            {/* Projects Grid */}
            <div className="project-grid-modern">
                {projects.length === 0 ? (
                    <div className="empty-state-container animate-fade-in">
                        <div className="empty-state-icon">
                            <Folder size={40} />
                        </div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '1rem' }}>准备好开始了吗？</h2>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 2.5rem auto', fontSize: '1.1rem' }}>
                            目前还没有任何项目。创建一个新项目来开始您的标注之旅。
                        </p>
                        <button className="btn-modern-primary" onClick={() => setIsCreating(true)}>
                            <Plus size={20} />
                            创建第一个项目
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Inline Create Card */}
                        <div
                            className="glass-card animate-slide-up delay-1"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                borderStyle: 'dashed',
                                borderColor: 'rgba(255,255,255,0.1)',
                                height: '280px',
                                padding: '32px',
                                background: 'rgba(22, 27, 34, 0.3)'
                            }}
                            onClick={() => setIsCreating(true)}
                        >
                            <div style={{
                                background: 'var(--bg-tertiary)',
                                padding: '18px',
                                borderRadius: '50%',
                                marginBottom: '20px',
                                color: 'var(--accent-primary)',
                                border: '1px solid var(--border-subtle)'
                            }}>
                                <Plus size={32} />
                            </div>
                            <h3 style={{ margin: 0, fontWeight: 600, fontSize: '1.1rem' }}>创建新项目</h3>
                            <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>管理更多数据集</p>
                        </div>

                        {projects.map((project, index) => (
                            <div
                                key={project.id}
                                className={`glass-card glass-card-hover animate-slide-up`}
                                style={{
                                    height: '280px',
                                    padding: '32px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    position: 'relative',
                                    animationDelay: `${(index % 4) * 0.1 + 0.2}s`
                                }}
                                onClick={() => onSelectProject(project.id)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                    <div className="card-icon" style={{ background: 'rgba(88, 166, 255, 0.1)', color: 'var(--accent-primary)', padding: '12px', borderRadius: '12px' }}>
                                        <Folder size={24} />
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                                        className="icon-btn"
                                        title="删除项目"
                                        style={{ color: 'var(--text-tertiary)', padding: '6px' }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>

                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
                                        {project.name}
                                    </h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <ImageIcon size={14} />
                                            <span>{project.imageCount || 0}</span>
                                        </div>
                                        <span className="card-tag">YOLO 格式</span>
                                    </div>
                                </div>

                                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                                        {project.imageCount > 0 ? '已就绪' : '等待图片'}
                                    </span>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: 'rgba(255,255,255,0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s'
                                    }}>
                                        <ChevronRight size={18} color="var(--text-secondary)" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
};
