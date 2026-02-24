import React from 'react';
import { Folder, Upload, Zap, Layers, Image as ImageIcon, CheckCircle, TrendingUp } from 'lucide-react';

export const HeroSection = ({ onCreate, onImport, onGuide, summary }) => {
    const metrics = [
        { label: '项目', value: summary?.projects ?? 0, icon: Layers, tone: 'indigo' },
        { label: '图片', value: summary?.images ?? 0, icon: ImageIcon, tone: 'blue' },
        { label: '标注率', value: `${summary?.rate ?? 0}%`, icon: TrendingUp, tone: 'green' }
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
                {metrics.map((metric) => {
                    const Icon = metric.icon;
                    return (
                        <div key={metric.label} className="hero-metric-pill" data-tone={metric.tone}>
                            <span className={`hero-metric-icon hero-metric-icon-${metric.tone}`} aria-hidden="true">
                                <Icon size={13} strokeWidth={2.3} />
                            </span>
                            <span className="hero-metric-label">{metric.label}</span>
                            <span className="hero-metric-value">{metric.value}</span>
                        </div>
                    );
                })}
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
    const pendingImages = Math.max(totalImages - totalAnnotated, 0);
    const completedProjects = projects.filter((project) => {
        const imageCount = project.imageCount || 0;
        return imageCount > 0 && (project.annotatedCount || 0) >= imageCount;
    }).length;
    const avgImagesPerProject = projects.length > 0 ? Math.round(totalImages / projects.length) : 0;
    const progressTone = annotationRate >= 85 ? 'excellent' : annotationRate >= 50 ? 'steady' : 'attention';
    const progressText = progressTone === 'excellent' ? '进度优秀' : progressTone === 'steady' ? '进度稳定' : '待推进';

    return (
        <div className="dashboard-stats-wrap">
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

            <div className="dashboard-stats-brief" aria-label="统计补充信息">
                <div className="stats-brief-header">
                    <span className="stats-brief-title">数据态势</span>
                    <span className={`stats-brief-badge ${progressTone}`}>
                        {progressText}
                    </span>
                </div>
                <div className="stats-brief-grid">
                    <div className="stats-brief-item">
                        <span className="stats-brief-label">待标注</span>
                        <strong className="stats-brief-value">{pendingImages}</strong>
                    </div>
                    <div className="stats-brief-item">
                        <span className="stats-brief-label">已完成项目</span>
                        <strong className="stats-brief-value">{completedProjects}</strong>
                    </div>
                    <div className="stats-brief-item">
                        <span className="stats-brief-label">单项目均图</span>
                        <strong className="stats-brief-value">{avgImagesPerProject}</strong>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, gradient, icon, iconBg, iconColor, showProgress, progressValue, progressColor }) => (
    <div className="dashboard-stat-card" style={{ background: gradient }}>
        <div className="stat-card-icon" style={{ background: iconBg, color: iconColor }}>
            {icon}
        </div>
        <div className="stat-card-content">
            <div className="stat-card-label">{label}</div>
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
