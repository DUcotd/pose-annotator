import React, { useMemo, useState } from 'react';
import {
    Play, Square, RefreshCw, Database, CheckCircle, Layers, ArrowLeft,
    FolderOpen, AlertCircle, Download, ExternalLink
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useTraining } from '../hooks/useTraining';
import { StatBadge } from './training/CommonComponents';
import { LogWorkbench } from './training/LogWorkbench';
import { TrainingDashboard } from './training/TrainingDashboard';
import { TrainingForm, AugmentationForm, HardwareForm, StrategyForm, LossForm, RemoteForm } from './training/TrainingForms';
import './training/trainingWorkspace.css';
import { useErrorCenter } from '../error/ErrorCenter';

const getStatusMeta = (status) => {
    switch (status) {
        case 'running':
            return { label: '训练中', className: 'running', icon: <RefreshCw size={13} className="spin" /> };
        case 'completed':
            return { label: '已完成', className: 'completed', icon: <CheckCircle size={13} /> };
        case 'failed':
            return { label: '训练失败', className: 'failed', icon: <AlertCircle size={13} /> };
        case 'starting':
            return { label: '启动中', className: 'starting', icon: <RefreshCw size={13} className="spin" /> };
        default:
            return { label: '就绪', className: '', icon: null };
    }
};

const getConnectionMeta = (state) => {
    const normalized = String(state || '').toLowerCase();
    if (normalized === 'connected') return { label: '实时连接: SSE', tone: 'ok' };
    if (normalized === 'polling') return { label: '实时连接: 轮询兜底', tone: 'warn' };
    if (normalized === 'reconnecting' || normalized === 'connecting') return { label: '实时连接: 重连中', tone: 'warn' };
    if (normalized === 'disconnected') return { label: '实时连接: 已断开', tone: 'bad' };
    return { label: `实时连接: ${state || 'unknown'}`, tone: 'info' };
};

const getDiagnosisMeta = (diagnosis) => {
    if (!diagnosis) return { label: '诊断: 暂无错误', tone: 'ok' };
    if (diagnosis.status === 'failed') return { label: `诊断: ${diagnosis.code || 'FAILED'}`, tone: 'bad' };
    if (diagnosis.status === 'warning') return { label: `诊断: ${diagnosis.code || 'WARNING'}`, tone: 'warn' };
    return { label: `诊断: ${diagnosis.code || 'OK'}`, tone: 'info' };
};

export const TrainingConfig = () => {
    const { currentProject, configLoading, goBack } = useProject();
    const { reportError } = useErrorCenter();
    const {
        config,
        status,
        envInfo,
        logs,
        metrics,
        eventsV2,
        diagnosisV2,
        connectionState,
        stats,
        datasetInfo,
        handleStart: startTraining,
        handleStop: stopTraining,
        handleBrowseData,
        updateConfig,
        exportLogsToFile,
        openLogFile,
        openLogsFolder
    } = useTraining(currentProject);

    const [exportResult, setExportResult] = useState(null);
    const [showExportSuccess, setShowExportSuccess] = useState(false);

    const hasExportableData = eventsV2.length > 0 || logs.length > 0 || metrics.length > 0;
    const isRunning = status === 'running' || status === 'starting';
    const statusMeta = useMemo(() => getStatusMeta(status), [status]);
    const connectionMeta = useMemo(() => getConnectionMeta(connectionState), [connectionState]);
    const diagnosisMeta = useMemo(() => getDiagnosisMeta(diagnosisV2), [diagnosisV2]);

    const onStart = async () => {
        try {
            await startTraining();
        } catch (err) {
            const errorMsg = err.message || 'Unknown error';
            if (errorMsg.includes('Dataset config not found')) {
                reportError(new Error(`数据集未导出，请先到“导出数据集”页面完成导出后再开始训练。详情：${errorMsg}`), {
                    source: 'training-config.start',
                    projectId: currentProject
                });
            } else {
                reportError(err, { source: 'training-config.start', projectId: currentProject });
            }
        }
    };

    if (configLoading) {
        return (
            <div className="tw-page" style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: '#b6c2d9' }}>
                    <RefreshCw size={20} className="spin" />
                    <span style={{ fontWeight: 700 }}>加载训练配置...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="tw-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="tw-header">
                <div className="tw-header-main">
                    <button className="tw-back-btn" onClick={goBack}>
                        <ArrowLeft size={17} />
                    </button>
                    <h2 className="tw-page-title">模型训练工作台</h2>
                    <span className="tw-badge">YOLOv8 Pose</span>
                    <span className={`tw-status-pill ${statusMeta.className}`}>
                        {statusMeta.icon}
                        {statusMeta.label}
                    </span>
                </div>
                <p className="tw-subtitle">
                    项目 <strong style={{ color: '#99f6e4', fontWeight: 700 }}>{currentProject}</strong> 的训练监控、配置和排障都在同一页面完成。
                </p>
                <div className="tw-header-meta">
                    <span className={`tw-meta-pill ${connectionMeta.tone}`}>{connectionMeta.label}</span>
                    <span className="tw-meta-pill info">事件总数: {eventsV2.length}</span>
                    <span className={`tw-meta-pill ${diagnosisMeta.tone}`}>{diagnosisMeta.label}</span>
                    <span className={`tw-meta-pill ${datasetInfo?.exists ? 'ok' : 'warn'}`}>
                        数据集: {datasetInfo?.exists ? '已就绪' : '未导出'}
                    </span>
                </div>
            </div>

            <div className="tw-main">
                <div className="tw-left tw-scroll custom-scrollbar">
                    <div className="tw-stat-grid">
                        <StatBadge
                            icon={Database}
                            label="总图片"
                            value={stats?.total || 0}
                            color="45,212,191"
                            gradient="linear-gradient(145deg, rgba(45,212,191,0.2), rgba(15,23,42,0.38))"
                        />
                        <StatBadge
                            icon={CheckCircle}
                            label="已标注"
                            value={stats?.annotated || 0}
                            color="74,222,128"
                            gradient="linear-gradient(145deg, rgba(74,222,128,0.2), rgba(15,23,42,0.38))"
                        />
                        <StatBadge
                            icon={Layers}
                            label="未标注"
                            value={stats?.unannotated || 0}
                            color="251,191,36"
                            gradient="linear-gradient(145deg, rgba(251,191,36,0.2), rgba(15,23,42,0.38))"
                        />
                    </div>

                    <div
                        className="tw-card tw-dataset-card"
                        style={{
                            borderColor: datasetInfo?.exists ? 'rgba(74,222,128,0.35)' : 'rgba(251,191,36,0.35)',
                            background: datasetInfo?.exists
                                ? 'linear-gradient(165deg, rgba(7,20,26,0.8), rgba(12,29,36,0.72))'
                                : 'linear-gradient(165deg, rgba(36,24,8,0.6), rgba(36,24,8,0.48))'
                        }}
                    >
                        <div className="tw-dataset-head">
                            {datasetInfo?.exists ? (
                                <CheckCircle size={18} style={{ color: '#4ade80' }} />
                            ) : (
                                <AlertCircle size={18} style={{ color: '#fbbf24' }} />
                            )}
                            <span style={{
                                fontSize: '13px',
                                fontWeight: 800,
                                color: datasetInfo?.exists ? '#4ade80' : '#fcd34d'
                            }}>
                                {datasetInfo?.exists ? '数据集已就绪，可直接训练' : '数据集未导出，训练将失败'}
                            </span>
                            {datasetInfo?.kptShape && (
                                <span className="tw-badge" style={{ marginLeft: 'auto', padding: '3px 9px', fontSize: '11px' }}>
                                    {datasetInfo.kptShape[0]} 关键点
                                </span>
                            )}
                        </div>

                        {datasetInfo?.exists ? (
                            <div className="tw-dataset-path">
                                {datasetInfo.yamlPath}
                            </div>
                        ) : (
                            <div style={{ fontSize: '12px', color: '#c9bfa2', lineHeight: 1.5 }}>
                                请先在左侧导航执行「导出数据集」，导出完成后再开始训练。
                            </div>
                        )}
                    </div>

                    <TrainingDashboard metrics={metrics} status={status} />

                    <LogWorkbench
                        events={eventsV2}
                        diagnosis={diagnosisV2}
                        connectionState={connectionState}
                    />
                </div>

                <div className="tw-right tw-scroll custom-scrollbar">
                    <div className="tw-card tw-sticky-panel" style={{ padding: '0.95rem' }}>
                        <div className="tw-actions">
                            {isRunning ? (
                                <button className="tw-action-btn danger" onClick={stopTraining}>
                                    <Square size={16} fill="currentColor" /> 停止训练
                                </button>
                            ) : (
                                <button className="tw-action-btn primary" onClick={onStart}>
                                    <Play size={16} fill="currentColor" /> 开始训练
                                </button>
                            )}

                            <button
                                className="tw-action-btn ghost"
                                onClick={async () => {
                                    try {
                                        const result = await exportLogsToFile();
                                        setExportResult(result);
                                        setShowExportSuccess(true);
                                    } catch (err) {
                                        reportError(err, { source: 'training-config.export-logs', projectId: currentProject });
                                    }
                                }}
                                disabled={!hasExportableData}
                            >
                                <Download size={16} /> 导出诊断包
                            </button>
                        </div>

                        <div style={{
                            marginTop: '0.75rem',
                            padding: '0.7rem 0.8rem',
                            borderRadius: '12px',
                            border: '1px solid rgba(148,163,184,0.24)',
                            background: 'rgba(15,23,42,0.5)',
                            fontSize: '12px',
                            color: '#a8b7d0',
                            lineHeight: 1.5
                        }}>
                            训练中建议只调整必要参数。若失败，优先查看「日志工作台」中的诊断卡与关键事件。
                        </div>
                    </div>

                    <TrainingForm
                        config={config}
                        updateConfig={updateConfig}
                        status={status}
                        onBrowseData={handleBrowseData}
                        envInfo={envInfo}
                    />

                    <HardwareForm
                        config={config}
                        updateConfig={updateConfig}
                        status={status}
                    />

                    <RemoteForm
                        config={config}
                        updateConfig={updateConfig}
                        status={status}
                    />

                    <StrategyForm
                        config={config}
                        updateConfig={updateConfig}
                        status={status}
                    />

                    <LossForm
                        config={config}
                        updateConfig={updateConfig}
                        status={status}
                    />

                    <AugmentationForm
                        config={config}
                        updateConfig={updateConfig}
                        status={status}
                    />
                </div>
            </div>

            {showExportSuccess && exportResult && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(2,6,23,0.72)',
                        backdropFilter: 'blur(8px)',
                        display: 'grid',
                        placeItems: 'center',
                        zIndex: 9999
                    }}
                    onClick={() => setShowExportSuccess(false)}
                >
                    <div
                        className="tw-card"
                        style={{
                            width: 'min(540px, calc(100% - 28px))',
                            padding: '1.25rem',
                            borderColor: 'rgba(59,130,246,0.4)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.9rem' }}>
                            <CheckCircle size={18} style={{ color: '#60a5fa' }} />
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#bfdbfe' }}>导出完成</h3>
                        </div>

                        <div style={{
                            borderRadius: '12px',
                            border: '1px solid rgba(148,163,184,0.28)',
                            background: 'rgba(2,6,23,0.46)',
                            padding: '0.75rem',
                            fontFamily: 'Consolas, Monaco, monospace',
                            color: '#93c5fd',
                            fontSize: '12px',
                            lineHeight: 1.5,
                            wordBreak: 'break-all'
                        }}>
                            {exportResult.filePath}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '0.95rem' }}>
                            <button
                                className="tw-action-btn primary"
                                onClick={async () => {
                                    try {
                                        await openLogFile(exportResult.filePath);
                                    } catch (err) {
                                        reportError(err, { source: 'training-config.open-log-file', projectId: currentProject });
                                    }
                                }}
                                style={{ height: '42px' }}
                            >
                                <ExternalLink size={15} /> 打开文件
                            </button>
                            <button
                                className="tw-action-btn ghost"
                                onClick={async () => {
                                    try {
                                        await openLogsFolder();
                                    } catch (err) {
                                        reportError(err, { source: 'training-config.open-log-folder', projectId: currentProject });
                                    }
                                }}
                                style={{ height: '42px' }}
                            >
                                <FolderOpen size={15} /> 打开目录
                            </button>
                        </div>

                        <button
                            className="tw-action-btn"
                            onClick={() => setShowExportSuccess(false)}
                            style={{ width: '100%', marginTop: '10px', height: '40px' }}
                        >
                            关闭
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
