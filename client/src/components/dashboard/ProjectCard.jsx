import React from 'react';
import { Folder, Trash2, Zap, ChevronRight, Image as ImageIcon, CheckCircle, MapPin, Loader2, Plus } from 'lucide-react';

export const ProjectCard = ({ project, onClick, onDelete, onRenumber, index, isDeleting }) => {
    const hasImages = (project.imageCount || 0) > 0;
    const hasAnnotated = (project.annotatedCount || 0) > 0;
    const annotationRate = hasImages ? Math.round(((project.annotatedCount || 0) / project.imageCount) * 100) : 0;

    return (
        <div
            className="glass-card glass-card-hover project-card"
            style={{
                height: '300px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                animationDelay: `${(index % 4) * 0.1 + 0.2}s`,
                opacity: isDeleting ? 0.6 : 1,
                pointerEvents: isDeleting ? 'none' : 'auto'
            }}
            onClick={onClick}
        >
            {isDeleting && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: 'inherit',
                    zIndex: 10
                }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <Loader2 size={32} className="spin-animation" style={{ color: '#4da1ff' }} />
                        <span style={{ color: '#fff', fontWeight: 600 }}>删除中...</span>
                    </div>
                </div>
            )}

            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, rgba(77, 161, 255, 0.2), rgba(99, 102, 241, 0.1))',
                    color: '#4da1ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(77, 161, 255, 0.15)',
                    boxShadow: '0 4px 12px rgba(77, 161, 255, 0.1)',
                    flexShrink: 0
                }}>
                    <Folder size={22} strokeWidth={2} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); onRenumber(project.id); }}
                        className="icon-btn hover-card"
                        title="对现有图片重新编号 (解决乱序问题)"
                        style={{
                            color: '#fbbf24',
                            background: 'rgba(251, 191, 36, 0.05)',
                            padding: '8px',
                            borderRadius: '10px',
                            border: '1px solid rgba(251, 191, 36, 0.1)'
                        }}
                    >
                        <Zap size={16} fill="currentColor" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
                        className="icon-btn trash-btn"
                        title="删除项目"
                        style={{
                            color: 'var(--text-tertiary)',
                            background: 'rgba(255,255,255,0.03)',
                            padding: '8px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1 }}>
                <h3 style={{
                    margin: '0 0 0.5rem 0',
                    fontSize: '1.3rem',
                    fontWeight: 800,
                    letterSpacing: '-0.5px',
                    color: 'var(--text-primary)',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {project.name}
                </h3>

                {project.path && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '0.75rem',
                        color: 'var(--text-tertiary)',
                        fontSize: '0.75rem',
                        overflow: 'hidden'
                    }}>
                        <MapPin size={12} style={{ flexShrink: 0 }} />
                        <span style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }} title={project.path}>
                            {project.path}
                        </span>
                    </div>
                )}

                {/* Stats badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        fontWeight: 600
                    }}>
                        <ImageIcon size={13} />
                        <span>{project.imageCount || 0} 张</span>
                    </div>
                    {hasAnnotated && (
                        <div style={{
                            background: 'rgba(52, 211, 153, 0.08)',
                            border: '1px solid rgba(52, 211, 153, 0.18)',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: '#34d399',
                            fontSize: '0.82rem',
                            fontWeight: 600
                        }}>
                            <CheckCircle size={13} />
                            <span>{project.annotatedCount || 0} 已标</span>
                        </div>
                    )}
                    <span className="card-tag">YOLO</span>
                </div>

                {/* Annotation progress bar */}
                {hasImages && (
                    <div className="project-card-progress">
                        <div className="project-card-progress-label">
                            <span>标注进度</span>
                            <span style={{ color: annotationRate >= 80 ? '#34d399' : 'var(--text-tertiary)' }}>{annotationRate}%</span>
                        </div>
                        <div className="progress-bar-track">
                            <div
                                className={`progress-bar-fill ${annotationRate >= 80 ? 'green' : ''}`}
                                style={{ width: `${annotationRate}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: hasImages ? '#34d399' : '#fbbf24',
                        boxShadow: `0 0 8px ${hasImages ? 'rgba(52, 211, 153, 0.5)' : 'rgba(251, 191, 36, 0.5)'}`
                    }} />
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {hasImages ? '已就绪' : '等待图片'}
                    </span>
                </div>
                <div className="card-arrow-icon">
                    <ChevronRight size={16} />
                </div>
            </div>
        </div>
    );
};

export const CreateProjectCard = ({ onClick }) => (
    <div
        className="glass-card glass-card-hover create-project-card"
        style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderStyle: 'dashed',
            borderWidth: '2px',
            borderColor: 'rgba(255,255,255,0.08)',
            height: '300px',
            padding: '32px',
            background: 'rgba(255, 255, 255, 0.01)',
            animationDelay: '0.1s',
            touchAction: 'pan-x pan-y',
            userSelect: 'none',
            position: 'relative',
            zIndex: 1,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onClick={onClick}
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
        }} className="create-card-icon">
            <Plus size={32} strokeWidth={1.5} />
        </div>
        <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-primary)' }}>创建新项目</h3>
        <p style={{ margin: '8px 0 0 0', color: 'var(--text-tertiary)', fontSize: '0.88rem', fontWeight: 500 }}>开始您的标注之旅</p>
    </div>
);

export const EmptyState = ({ onCreate }) => (
    <div
        className="empty-state-container"
        style={{
            padding: '40px 40px',
            minHeight: '320px',
            justifyContent: 'center',
            touchAction: 'pan-x pan-y',
            userSelect: 'none',
            position: 'relative',
            zIndex: 1
        }}
    >
        <div className="empty-state-icon" style={{ width: '80px', height: '80px', marginBottom: '24px' }}>
            <Folder size={40} />
        </div>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.75rem' }}>准备好开始了吗？</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 2rem auto', fontSize: '1rem', lineHeight: 1.6 }}>
            目前还没有任何项目。创建一个新项目来开始您的标注之旅。
            <br />
            您可以轻松地组织图片、标注目标并导出为标准的 YOLO 格式。
        </p>
        <button className="btn-modern-primary" onClick={onCreate} style={{ padding: '14px 28px', fontSize: '1rem' }}>
            <Folder size={20} />
            创建第一个项目
        </button>
    </div>
);
