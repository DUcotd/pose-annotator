import React from 'react';
import { Folder, Upload, Zap } from 'lucide-react';

export const HeroSection = ({ onCreate, onImport, onGuide }) => {
    return (
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
                <button className="btn-modern-primary" onClick={onCreate}>
                    <Folder size={22} strokeWidth={2.5} />
                    立即开始
                </button>
                <button className="btn-modern-secondary" onClick={onImport} style={{ gap: '8px' }}>
                    <Upload size={20} strokeWidth={2} />
                    导入项目 (ZIP)
                </button>
                <button className="btn-modern-secondary" onClick={onGuide}>
                    <Zap size={22} strokeWidth={2} />
                    快速指南
                </button>
            </div>
        </div>
    );
};

export const DashboardStats = ({ projects }) => {
    const totalImages = projects.reduce((acc, p) => acc + (p.imageCount || 0), 0);
    const totalAnnotated = projects.reduce((acc, p) => acc + (p.annotatedCount || 0), 0);

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            marginTop: '1.5rem',
            marginBottom: '1rem'
        }}>
            <StatCard 
                label="项目总数" 
                value={projects.length} 
                color="99,102,241" 
                gradient="linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.05))"
            />
            <StatCard 
                label="图片总数" 
                value={totalImages} 
                color="77,161,255" 
                gradient="linear-gradient(135deg, rgba(77,161,255,0.15), rgba(96,165,250,0.05))"
            />
            <StatCard 
                label="已标注" 
                value={totalAnnotated} 
                color="34,197,94" 
                gradient="linear-gradient(135deg, rgba(34,197,94,0.15), rgba(74,222,128,0.05))"
            />
            <StatCard 
                label="标注率" 
                value={totalImages > 0 ? Math.round((totalAnnotated / totalImages) * 100) + '%' : '0%'} 
                color="251,191,36" 
                gradient="linear-gradient(135deg, rgba(251,191,36,0.15), rgba(252,211,77,0.05))"
            />
        </div>
    );
};

const StatCard = ({ label, value, color, gradient }) => (
    <div style={{
        background: gradient,
        borderRadius: '14px',
        padding: '1rem 1.25rem',
        border: `1px solid rgba(${color}, 0.2)`,
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
    }}>
        <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
        </div>
    </div>
);
