import React from 'react';
import { Folder, Trash2, Zap, ChevronRight, Image as ImageIcon, CheckCircle } from 'lucide-react';

export const ProjectCard = ({ project, onClick, onDelete, onRenumber, index }) => {
    const hasImages = (project.imageCount || 0) > 0;
    const hasAnnotated = (project.annotatedCount || 0) > 0;

    return (
        <div
            className="glass-card glass-card-hover project-card"
            style={{
                height: '260px',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                animationDelay: `${(index % 4) * 0.1 + 0.2}s`
            }}
            onClick={onClick}
        >
            {/* Header */}
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
                    margin: '0 0 1rem 0',
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    letterSpacing: '-0.5px',
                    color: 'var(--text-primary)',
                    lineHeight: 1.2
                }}>
                    {project.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                    {hasAnnotated && (
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
                            <CheckCircle size={14} />
                            <span>{project.annotatedCount || 0}</span>
                        </div>
                    )}
                    <span className="card-tag">YOLO 格式</span>
                </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: hasImages ? '#34d399' : '#fbbf24',
                        boxShadow: `0 0 10px ${hasImages ? 'rgba(52, 211, 153, 0.4)' : 'rgba(251, 191, 36, 0.4)'}`
                    }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {hasImages ? '已就绪' : '等待图片'}
                    </span>
                </div>
                <div className="card-arrow-icon">
                    <ChevronRight size={18} />
                </div>
            </div>
        </div>
    );
};

export const CreateProjectCard = ({ onClick }) => (
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
            animationDelay: '0.1s',
            touchAction: 'pan-x pan-y',
            userSelect: 'none',
            position: 'relative',
            zIndex: 1
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
            transition: 'all 0.3s ease'
        }} className="create-card-icon">
            <Folder size={32} strokeWidth={1.5} />
        </div>
        <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)' }}>创建新项目</h3>
        <p style={{ margin: '8px 0 0 0', color: 'var(--text-tertiary)', fontSize: '0.9rem', fontWeight: 500 }}>开始您的标注之旅</p>
    </div>
);

export const EmptyState = ({ onCreate }) => (
    <div 
        className="empty-state-container" 
        style={{ 
            padding: '60px 40px', 
            minHeight: '400px', 
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
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '1rem' }}>准备好开始了吗？</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 2.5rem auto', fontSize: '1.1rem', lineHeight: 1.6 }}>
            目前还没有任何项目。创建一个新项目来开始您的标注之旅。
            <br />
            您可以轻松地组织图片、标注目标并导出为标准的 YOLO 格式。
        </p>
        <button className="btn-modern-primary" onClick={onCreate} style={{ padding: '14px 28px', fontSize: '1.1rem' }}>
            <Folder size={22} />
            创建第一个项目
        </button>
    </div>
);
