import React from 'react';
import { Folder, Upload, Zap, Layers, Image as ImageIcon, CheckCircle, TrendingUp } from 'lucide-react';

export const HeroSection = ({ onCreate, onImport, onGuide, summary }) => {
    const metrics = [
        { label: '项目', value: summary?.projects ?? 0 },
        { label: '图片', value: summary?.images ?? 0 },
        { label: '标注率', value: `${summary?.rate ?? 0}%` }
    ];

    return (
        <div className="hero-section">
            <h1 className="hero-title">
                <span className="hero-title-kicker text-gradient">探索您的</span>
                <span className="hero-title-main">
                    计算机视觉世界
                    <span className="badge-new">v2.1</span>
                </span>
            </h1>
            <p className="hero-subtitle">
                AI 驱动的高级标注平台，简化数据集管理流程，
                从模型训练到结果导出，一切尽在掌握。
            </p>

            <div className="hero-metrics" aria-label="项目概览">
                {metrics.map((metric) => (
                    <div key={metric.label} className="hero-metric-pill">
                        <span className="hero-metric-label">{metric.label}</span>
                        <span className="hero-metric-value">{metric.value}</span>
                    </div>
                ))}
            </div>

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
    const annotationRate = totalImages > 0 ? Math.round((totalAnnotated / totalImages) * 100) : 0;

    return (
        <div className="dashboard-stats">
            <StatCard
                label="项目总数"
                value={projects.length}
                gradient="linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.02))"
                icon={<Layers size={20} strokeWidth={2} />}
                iconBg="rgba(99,102,241,0.15)"
                iconColor="#818cf8"
            />
            <StatCard
                label="图片总数"
                value={totalImages}
                gradient="linear-gradient(135deg, rgba(77,161,255,0.08), rgba(96,165,250,0.02))"
                icon={<ImageIcon size={20} strokeWidth={2} />}
                iconBg="rgba(77,161,255,0.15)"
                iconColor="#4da1ff"
            />
            <StatCard
                label="已标注"
                value={totalAnnotated}
                gradient="linear-gradient(135deg, rgba(34,197,94,0.08), rgba(74,222,128,0.02))"
                icon={<CheckCircle size={20} strokeWidth={2} />}
                iconBg="rgba(34,197,94,0.15)"
                iconColor="#34d399"
            />
            <StatCard
                label="标注率"
                value={annotationRate + '%'}
                gradient="linear-gradient(135deg, rgba(251,191,36,0.08), rgba(252,211,77,0.02))"
                icon={<TrendingUp size={20} strokeWidth={2} />}
                iconBg="rgba(251,191,36,0.15)"
                iconColor="#fbbf24"
                showProgress={true}
                progressValue={annotationRate}
                progressColor={annotationRate >= 80 ? 'green' : ''}
            />
        </div>
    );
};

const StatCard = ({ label, value, gradient, icon, iconBg, iconColor, showProgress, progressValue, progressColor }) => (
    <div className="dashboard-stat-card" style={{ background: gradient }}>
        <div className="stat-card-icon" style={{ background: iconBg, color: iconColor }}>
            {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</div>
            <div className="stat-value-animated">{value}</div>
            {showProgress && (
                <div className="progress-bar-track" style={{ marginTop: '8px' }}>
                    <div
                        className={`progress-bar-fill ${progressColor || ''}`}
                        style={{ width: `${progressValue}%` }}
                    />
                </div>
            )}
        </div>
    </div>
);
