import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useProject } from '../context/ProjectContext';
import {
    Download,
    Shuffle,
    FolderOpen,
    ArrowLeft,
    CheckCircle,
    Info,
    Database,
    Target,
    Layout,
    Share2,
    FileImage,
    Box,
    PieChart,
    Loader2,
    Sparkles,
    Layers,
    AlertTriangle
} from 'lucide-react';
import './export/datasetWorkspace.css';
import { apiClient } from '../lib/apiClient';
import { useErrorCenter } from '../error/ErrorCenter';

const StatCard = ({ icon: Icon, label, value, subValue, tone = 'mint' }) => (
    <div className={`de-stat-card de-stat-${tone}`}>
        <div className="de-stat-icon">
            <Icon size={18} />
        </div>
        <div className="de-stat-body">
            <div className="de-stat-label">{label}</div>
            <div className="de-stat-value">{value}</div>
            {subValue ? <div className="de-stat-meta">{subValue}</div> : null}
        </div>
    </div>
);

const SectionCard = ({ icon: Icon, title, subtitle, iconTone = 'mint', children }) => (
    <div className="de-card de-section">
        <div className="de-section-head">
            <div className={`de-section-icon ${iconTone}`}>
                <Icon size={18} />
            </div>
            <div>
                <h3 className="de-section-title">{title}</h3>
                {subtitle ? <p className="de-section-sub">{subtitle}</p> : null}
            </div>
        </div>
        {children}
    </div>
);

const ToggleRow = ({ checked, onChange, title, desc }) => (
    <label className="de-toggle">
        <div className="de-toggle-body">
            <div className="de-toggle-title">{title}</div>
            {desc ? <div className="de-toggle-desc">{desc}</div> : null}
        </div>
        <div className={`de-switch ${checked ? 'checked' : ''}`}>
            <div className={`de-switch-dot ${checked ? 'checked' : ''}`} />
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                style={{ opacity: 0, width: 0, height: 0 }}
            />
        </div>
    </label>
);

export const DatasetExport = () => {
    const {
        currentProject,
        projectConfig,
        configLoading,
        updateProjectConfig,
        exportProject,
        exportDatasetZip,
        exportCollaboration,
        goBack
    } = useProject();
    const { reportError } = useErrorCenter();

    const [includeVisibility, setIncludeVisibility] = useState(true);
    const [customPath, setCustomPath] = useState('');
    const [numKeypoints, setNumKeypoints] = useState(17);
    const [isExporting, setIsExporting] = useState(false);
    const [isZipExporting, setIsZipExporting] = useState(false);
    const [isCollaborationExporting, setIsCollaborationExporting] = useState(false);
    const [notification, setNotification] = useState(null);
    const [exportStats, setExportStats] = useState(null);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [exportResult, setExportResult] = useState(null);
    const [showExportModal, setShowExportModal] = useState(false);

    const [trainRatio, setTrainRatio] = useState(80);
    const [valRatio, setValRatio] = useState(20);
    const [testRatio, setTestRatio] = useState(0);
    const [shuffleData, setShuffleData] = useState(true);
    const [includeUnannotated, setIncludeUnannotated] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await apiClient.get(`/api/projects/${encodeURIComponent(currentProject)}/dataset/stats`);
                setExportStats({
                    totalImages: data.total || 0,
                    images: data.annotated || 0,
                    bboxes: data.bboxes || 0,
                    keypoints: data.keypoints || 0
                });
            } catch (err) {
                console.error('Failed to fetch stats:', err);
                reportError(err, { source: 'dataset-export.fetch-stats', projectId: currentProject });
            } finally {
                setIsLoadingStats(false);
            }
        };

        fetchStats();

        if (projectConfig.exportSettings) {
            const s = projectConfig.exportSettings;
            if (s.includeVisibility !== undefined) setIncludeVisibility(s.includeVisibility);
            if (s.customPath !== undefined) setCustomPath(s.customPath);
            if (s.numKeypoints !== undefined) setNumKeypoints(s.numKeypoints);
            if (s.trainRatio !== undefined) setTrainRatio(Math.round(s.trainRatio * 100));
            if (s.valRatio !== undefined) setValRatio(Math.round(s.valRatio * 100));
            if (s.testRatio !== undefined) setTestRatio(Math.round(s.testRatio * 100));
            if (s.shuffle !== undefined) setShuffleData(s.shuffle);
            if (s.includeUnannotated !== undefined) setIncludeUnannotated(s.includeUnannotated);
        }
    }, [currentProject, projectConfig, reportError]);

    useEffect(() => {
        if (!notification) return undefined;
        const timer = setTimeout(() => setNotification(null), 5000);
        return () => clearTimeout(timer);
    }, [notification]);

    const saveSettings = async (updates) => {
        const currentSettings = {
            includeVisibility,
            customPath,
            numKeypoints,
            trainRatio: (typeof trainRatio === 'number' ? trainRatio : 0) / 100,
            valRatio: (typeof valRatio === 'number' ? valRatio : 0) / 100,
            testRatio: (typeof testRatio === 'number' ? testRatio : 0) / 100,
            shuffle: shuffleData,
            includeUnannotated,
            ...updates
        };
        await updateProjectConfig(currentProject, { exportSettings: currentSettings });
    };

    const isRatioValid = trainRatio + valRatio + testRatio === 100;
    const totalImages = exportStats?.totalImages || 0;
    const annotatedImages = exportStats?.images || 0;
    const completionPercent = totalImages > 0 ? Math.round((annotatedImages / totalImages) * 100) : 0;

    const ratioRows = useMemo(() => ([
        { id: 'train', label: '训练集', icon: Sparkles, color: '#34d399', value: trainRatio },
        { id: 'val', label: '验证集', icon: Layout, color: '#fbbf24', value: valRatio },
        { id: 'test', label: '测试集', icon: FileImage, color: '#60a5fa', value: testRatio }
    ]), [trainRatio, valRatio, testRatio]);

    const handleSelectFolder = async () => {
        try {
            const data = await apiClient.post('/api/utils/select-folder', {});
            if (data.path) {
                setCustomPath(data.path);
                saveSettings({ customPath: data.path });
            }
        } catch (err) {
            reportError(err, { source: 'dataset-export.select-folder' });
            setNotification({ type: 'error', message: '选择目录失败，请重试。' });
        }
    };

    const handleExport = async () => {
        if (!isRatioValid) return;
        setIsExporting(true);
        const result = await exportProject(currentProject, {
            includeVisibility,
            customPath,
            numKeypoints,
            trainRatio: trainRatio / 100,
            valRatio: valRatio / 100,
            testRatio: testRatio / 100,
            shuffle: shuffleData,
            includeUnannotated
        });
        setIsExporting(false);
        if (result.success) {
            setExportResult(result);
            setShowExportModal(true);
            if (result.stats) setExportStats(result.stats);
        } else {
            setNotification({ type: 'error', message: result.message || '导出失败' });
        }
    };

    const handleZipExport = async () => {
        if (!isRatioValid) return;
        setIsZipExporting(true);
        const result = await exportDatasetZip(currentProject, {
            includeVisibility,
            customPath,
            numKeypoints,
            trainRatio: trainRatio / 100,
            valRatio: valRatio / 100,
            testRatio: testRatio / 100,
            shuffle: shuffleData,
            includeUnannotated
        });
        setIsZipExporting(false);
        if (result.success) {
            setExportResult({ ...result, isZip: true });
            setShowExportModal(true);
            if (result.stats) setExportStats(result.stats);
        } else {
            setNotification({ type: 'error', message: result.message || '导出失败' });
        }
    };

    const handleCollaborationExport = async () => {
        setIsCollaborationExporting(true);
        const result = await exportCollaboration(currentProject);
        setIsCollaborationExporting(false);
        if (result.success) {
            setNotification({ type: 'success', message: '协作包导出成功。' });
        } else {
            setNotification({ type: 'error', message: result.message || '协作包导出失败。' });
        }
    };

    const handleRatioChange = (type, rawValue) => {
        const normalized = String(rawValue ?? '').replace(/[^0-9]/g, '');
        const v = Math.max(0, Math.min(100, Number.parseInt(normalized, 10) || 0));
        let nextTrain = trainRatio;
        let nextVal = valRatio;
        let nextTest = testRatio;

        if (type === 'train') {
            nextTrain = v;
            const remaining = 100 - v;
            nextVal = Math.round((valRatio / (valRatio + testRatio || 1)) * remaining);
            nextTest = remaining - nextVal;
        } else if (type === 'val') {
            nextVal = v;
            if (trainRatio + v > 100) {
                nextTrain = 100 - v;
                nextTest = 0;
            } else {
                nextTest = 100 - trainRatio - v;
            }
        } else {
            nextTest = v;
            if (trainRatio + v > 100) {
                nextTrain = 100 - v;
                nextVal = 0;
            } else {
                nextVal = 100 - trainRatio - v;
            }
        }

        setTrainRatio(nextTrain);
        setValRatio(nextVal);
        setTestRatio(nextTest);
        saveSettings({
            trainRatio: nextTrain / 100,
            valRatio: nextVal / 100,
            testRatio: nextTest / 100
        });
    };

    const exportPath = exportResult?.path || exportResult?.filePath || exportResult?.targetPath || '--';

    if (configLoading) {
        return (
            <div className="de-page">
                <div className="de-container">
                    <div className="de-card" style={{ minHeight: '220px', display: 'grid', placeItems: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: '#b6c2d9' }}>
                            <Loader2 size={20} className="spin" />
                            <span style={{ fontWeight: 700 }}>加载导出配置...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="de-page custom-scrollbar">
            <div className="de-container">
                <div className="de-card de-header">
                    <div className="de-header-main">
                        <button className="de-back-btn" onClick={goBack} type="button" aria-label="返回">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="de-title-wrap">
                            <div className="de-title-row">
                                <h1 className="de-title">数据导出中心</h1>
                                <span className="de-badge">YOLO POSE</span>
                            </div>
                            <p className="de-subtitle">
                                项目 <strong style={{ color: '#99f6e4' }}>{currentProject}</strong> 的导出配置、划分比例与结果输出统一在此管理。
                            </p>
                        </div>
                    </div>
                    <div className="de-meta">
                        <span>状态: 就绪</span>
                        <span>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                    </div>
                </div>

                <div className="de-stat-grid">
                    <StatCard
                        icon={FileImage}
                        label="资源总量"
                        value={isLoadingStats ? '...' : totalImages}
                        subValue="图片素材"
                        tone="blue"
                    />
                    <StatCard
                        icon={Box}
                        label="标注实体"
                        value={isLoadingStats ? '...' : (exportStats?.bboxes || 0)}
                        subValue="边界框总数"
                        tone="mint"
                    />
                    <StatCard
                        icon={Target}
                        label="关键点总量"
                        value={isLoadingStats ? '...' : (exportStats?.keypoints || 0)}
                        subValue="关键点总数"
                        tone="gold"
                    />
                    <StatCard
                        icon={PieChart}
                        label="标注进度"
                        value={isLoadingStats ? '...' : `${completionPercent}%`}
                        subValue={`${annotatedImages} / ${totalImages || 0} 已标注`}
                        tone="green"
                    />
                </div>

                <div className="de-main">
                    <div className="de-col">
                        <SectionCard
                            icon={Database}
                            iconTone="blue"
                            title="数据标签设置"
                            subtitle="统一导出标注粒度与负样本策略"
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                                <ToggleRow
                                    checked={includeVisibility}
                                    onChange={(e) => {
                                        setIncludeVisibility(e.target.checked);
                                        saveSettings({ includeVisibility: e.target.checked });
                                    }}
                                    title="包含关键点可见性 (v)"
                                    desc="导出时保留关键点遮挡状态字段。"
                                />
                                <ToggleRow
                                    checked={includeUnannotated}
                                    onChange={(e) => {
                                        setIncludeUnannotated(e.target.checked);
                                        saveSettings({ includeUnannotated: e.target.checked });
                                    }}
                                    title="导出未标注负样本"
                                    desc="自动为未标注图片生成空标签文件。"
                                />
                                <div className="de-field">
                                    <label className="de-field-label" htmlFor="num-keypoints">
                                        关键点数量
                                    </label>
                                    <input
                                        id="num-keypoints"
                                        type="number"
                                        className="de-input"
                                        min={1}
                                        value={numKeypoints}
                                        onChange={(e) => {
                                            const value = Number.parseInt(e.target.value, 10) || 17;
                                            setNumKeypoints(value);
                                            saveSettings({ numKeypoints: value });
                                        }}
                                    />
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard
                            icon={Layers}
                            iconTone="gold"
                            title="数据集划分比例"
                            subtitle="训练 / 验证 / 测试比例必须合计为 100%"
                        >
                            <div className="de-ratio-grid">
                                {ratioRows.map((row) => (
                                    <div key={row.id} className="de-ratio-card">
                                        <div className="de-ratio-head" style={{ color: row.color }}>
                                            <row.icon size={14} />
                                            {row.label}
                                        </div>
                                        <div className="de-ratio-input">
                                            <input
                                                type="text"
                                                className="de-input"
                                                value={row.value}
                                                onChange={(e) => handleRatioChange(row.id, e.target.value)}
                                            />
                                            <span className="de-ratio-unit">%</span>
                                        </div>
                                        <div className="de-ratio-count">
                                            预计 {Math.round((row.value / 100) * totalImages)} 张
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="de-ratio-bar">
                                <div className="de-seg-train" style={{ width: `${trainRatio}%` }} />
                                <div className="de-seg-val" style={{ width: `${valRatio}%` }} />
                                <div className="de-seg-test" style={{ width: `${testRatio}%` }} />
                            </div>
                            {!isRatioValid ? (
                                <div className="de-warning">
                                    当前比例总和为 {trainRatio + valRatio + testRatio}%，请调整为 100% 后导出。
                                </div>
                            ) : null}
                        </SectionCard>
                    </div>

                    <div className="de-col">
                        <SectionCard
                            icon={Download}
                            iconTone="mint"
                            title="导出执行"
                            subtitle="设置导出路径并选择导出类型"
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                                <ToggleRow
                                    checked={shuffleData}
                                    onChange={(e) => {
                                        setShuffleData(e.target.checked);
                                        saveSettings({ shuffle: e.target.checked });
                                    }}
                                    title="导出前随机打乱样本"
                                    desc="建议保持开启，提升训练采样均匀性。"
                                />

                                <div className="de-field">
                                    <label className="de-field-label">导出目录</label>
                                    <div className="de-path-row">
                                        <div className="de-readonly" title={customPath || '默认路径 (项目目录 /dataset)'}>
                                            {customPath || '默认路径 (项目目录 /dataset)'}
                                        </div>
                                        <button className="de-btn" onClick={handleSelectFolder} type="button">
                                            <FolderOpen size={16} />
                                            选择目录
                                        </button>
                                    </div>
                                </div>

                                <div className="de-action-stack">
                                    <button
                                        className="de-btn de-btn-primary"
                                        type="button"
                                        onClick={handleExport}
                                        disabled={isExporting || !isRatioValid}
                                    >
                                        {isExporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                                        {isExporting ? '正在导出...' : '导出 YOLO 数据集'}
                                    </button>
                                    <button
                                        className="de-btn de-btn-secondary"
                                        type="button"
                                        onClick={handleZipExport}
                                        disabled={isZipExporting || !isRatioValid}
                                    >
                                        {isZipExporting ? <Loader2 size={16} className="spin" /> : <Box size={16} />}
                                        {isZipExporting ? '正在打包...' : '导出 ZIP 压缩包'}
                                    </button>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard
                            icon={Share2}
                            iconTone="blue"
                            title="协作包导出"
                            subtitle="快速打包项目配置与标注资产用于跨设备协作"
                        >
                            <div className="de-collab-box">
                                <div>
                                    <div className="de-collab-title">生成协作迁移包</div>
                                    <div className="de-collab-sub">包含类定义、配置与标注状态。</div>
                                </div>
                                <button
                                    className="de-btn de-btn-collab"
                                    type="button"
                                    onClick={handleCollaborationExport}
                                    disabled={isCollaborationExporting}
                                >
                                    {isCollaborationExporting ? <Loader2 size={16} className="spin" /> : <Share2 size={16} />}
                                    {isCollaborationExporting ? '打包中...' : '立即打包'}
                                </button>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>

            {notification && createPortal(
                <div className={`de-toast ${notification.type || 'success'}`}>
                    {notification.type === 'error' ? <AlertTriangle size={15} /> : <Info size={15} />}
                    <span>{notification.message}</span>
                </div>,
                document.body
            )}

            {showExportModal && exportResult && createPortal(
                <div className="de-modal-overlay" onClick={() => setShowExportModal(false)}>
                    <div className="de-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="de-modal-icon">
                            <CheckCircle size={28} />
                        </div>
                        <h3 className="de-modal-title">导出完成</h3>
                        <div className="de-modal-path">{exportPath}</div>
                        <div className="de-modal-actions">
                            <button type="button" className="de-btn" onClick={() => setShowExportModal(false)}>
                                关闭
                            </button>
                            <button
                                type="button"
                                className="de-btn de-btn-primary"
                                onClick={() => setShowExportModal(false)}
                            >
                                确认
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
