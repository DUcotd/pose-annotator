import React from 'react';
import { Folder, Trash2, Zap, ChevronRight, Image as ImageIcon, CheckCircle, MapPin, Loader2, Plus } from 'lucide-react';

const handleCardKeyDown = (event, callback) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        callback();
    }
};

export const ProjectCard = ({ project, onClick, onDelete, onRenumber, index, isDeleting }) => {
    const hasImages = (project.imageCount || 0) > 0;
    const hasAnnotated = (project.annotatedCount || 0) > 0;
    const annotationRate = hasImages ? Math.round(((project.annotatedCount || 0) / project.imageCount) * 100) : 0;

    return (
        <div
            className={`glass-card glass-card-hover project-card dash-project-card ${isDeleting ? 'is-deleting' : ''}`}
            style={{
                animationDelay: `${(index % 4) * 0.1 + 0.2}s`,
            }}
            onClick={onClick}
            onKeyDown={(event) => {
                if (isDeleting) return;
                handleCardKeyDown(event, onClick);
            }}
            role="button"
            tabIndex={isDeleting ? -1 : 0}
            aria-label={`打开项目 ${project.name}`}
        >
            {isDeleting && (
                <div className="dash-project-overlay">
                    <div className="dash-project-overlay-body">
                        <Loader2 size={32} className="spin-animation dash-project-overlay-icon" />
                        <span className="dash-project-overlay-text">删除中...</span>
                    </div>
                </div>
            )}

            <div className="dash-project-header">
                <div className="dash-project-icon-wrap">
                    <Folder size={22} strokeWidth={2} />
                </div>
                <div className="dash-project-actions">
                    <button
                        onClick={(e) => { e.stopPropagation(); onRenumber(project.id); }}
                        className="icon-btn hover-card dash-project-action dash-project-action-renumber"
                        title="对现有图片重新编号 (解决乱序问题)"
                    >
                        <Zap size={16} fill="currentColor" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
                        className="icon-btn trash-btn dash-project-action dash-project-action-delete"
                        title="删除项目"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            <div className="dash-project-body">
                <h3 className="dash-project-name">
                    {project.name}
                </h3>

                {project.path && (
                    <div className="dash-project-path">
                        <MapPin size={12} className="dash-project-path-icon" />
                        <span className="dash-project-path-text" title={project.path}>
                            {project.path}
                        </span>
                    </div>
                )}

                <div className="dash-project-badges">
                    <div className="dash-project-badge">
                        <ImageIcon size={13} />
                        <span>{project.imageCount || 0} 张</span>
                    </div>
                    {hasAnnotated && (
                        <div className="dash-project-badge dash-project-badge-annotated">
                            <CheckCircle size={13} />
                            <span>{project.annotatedCount || 0} 已标</span>
                        </div>
                    )}
                    <span className="card-tag">YOLO</span>
                </div>

                {hasImages && (
                    <div className="project-card-progress">
                        <div className="project-card-progress-label">
                            <span>标注进度</span>
                            <span className={`dash-project-progress-value ${annotationRate >= 80 ? 'success' : ''}`}>
                                {annotationRate}%
                            </span>
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

            <div className="dash-project-footer">
                <div className="dash-project-status">
                    <div className={`dash-project-status-dot ${hasImages ? 'ready' : 'waiting'}`} />
                    <span className="dash-project-status-text">
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
        className="glass-card glass-card-hover create-project-card dash-create-card"
        style={{
            animationDelay: '0.1s',
        }}
        onClick={onClick}
        onKeyDown={(event) => handleCardKeyDown(event, onClick)}
        role="button"
        tabIndex={0}
        aria-label="创建新项目"
    >
        <div className="create-card-icon dash-create-icon">
            <Plus size={32} strokeWidth={1.5} />
        </div>
        <h3 className="dash-create-title">创建新项目</h3>
        <p className="dash-create-subtitle">开始您的标注之旅</p>
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
