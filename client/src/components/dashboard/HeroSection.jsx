import React from 'react';
import { Folder, Upload, Zap } from 'lucide-react';

export const HeroSection = ({ onCreate, onImport, onGuide }) => {
    return (
        <div className="hero-section">
            <h1 className="hero-title">
                <span className="hero-title-kicker text-gradient">探索您的</span>
                <span className="hero-title-main">
                    计算机视觉世界
                    <span className="badge-new">v1.2</span>
                </span>
            </h1>
            <p className="hero-subtitle">
                AI 驱动的高级标注平台。简化您的数据集管理流程，
                <br />
                从模型训练到结果导出，一切尽在掌握。
            </p>

            <div className="hero-actions">
                <button className="btn-modern-primary" onClick={onCreate}>
                    <Folder size={22} strokeWidth={2.5} />
                    立即开始
                </button>
                <button className="btn-modern-secondary" onClick={onImport}>
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
        <div className="dashboard-stats">
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
    <div className="dashboard-stat-card" style={{ background: gradient, borderColor: `rgba(${color}, 0.2)` }}>
        <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
        </div>
    </div>
);
