import React, { useRef, useEffect, useState } from 'react';
import {
    Play, Square, RefreshCw, Database, CheckCircle, Layers, ArrowLeft,
    FolderOpen, FileText, AlertCircle, Download, ExternalLink
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useTraining } from '../hooks/useTraining';
import { StatBadge } from './training/CommonComponents';
import { LogWorkbench } from './training/LogWorkbench';
import { TrainingDashboard } from './training/TrainingDashboard';
import { TrainingForm, AugmentationForm, HardwareForm, StrategyForm, LossForm, RemoteForm } from './training/TrainingForms';

export const TrainingConfig = () => {
    const { currentProject, configLoading, goBack } = useProject();
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

    const logEndRef = useRef(null);
    const [exportResult, setExportResult] = useState(null);
    const [showExportSuccess, setShowExportSuccess] = useState(false);
    const hasExportableData = eventsV2.length > 0 || logs.length > 0 || metrics.length > 0;

    const onStart = async () => {
        try {
            await startTraining();
        } catch (err) {
            const errorMsg = err.message || 'Unknown error';
            if (errorMsg.includes('Dataset config not found')) {
                alert(`⚠️ 数据集未导出\n\n请先导出数据集再开始训练：\n1. 点击左侧导航栏的「导出数据集」\n2. 配置导出选项并点击导出\n3. 导出成功后返回此页面开始训练\n\n详细错误：${errorMsg}`);
            } else {
                alert(`启动失败: ${errorMsg}`);
            }
        }
    };

    if (configLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)', gap: '12px' }}>
                <RefreshCw size={24} className="spin" />
                <span style={{ fontWeight: 600 }}>加载训练配置...</span>
            </div>
        );
    }

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, rgba(13,17,23,0.95) 0%, rgba(22,27,34,0.98) 100%)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '1.5rem 2rem',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '0.75rem' }}>
                    <button
                        onClick={goBack}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '12px',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer'
                        }}
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                        模型训练
                    </h2>
                    <span style={{
                        background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(74,222,128,0.1))',
                        color: '#4ade80',
                        padding: '6px 14px',
                        borderRadius: '10px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        border: '1px solid rgba(74,222,128,0.3)'
                    }}>
                        YOLOv8
                    </span>
                    <div style={{
                        marginLeft: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        background: status === 'running' ? 'rgba(34,197,94,0.15)' :
                            status === 'completed' ? 'rgba(59,130,246,0.15)' :
                                status === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${status === 'running' ? 'rgba(34,197,94,0.3)' :
                            status === 'completed' ? 'rgba(59,130,246,0.3)' :
                                status === 'failed' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`
                    }}>
                        {status === 'running' && <><RefreshCw size={14} className="spin" style={{ color: '#4ade80' }} /> <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '13px' }}>训练中</span></>}
                        {status === 'completed' && <><CheckCircle size={14} style={{ color: '#60a5fa' }} /> <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: '13px' }}>已完成</span></>}
                        {status === 'failed' && <><RefreshCw size={14} style={{ color: '#f87171' }} /> <span style={{ color: '#f87171', fontWeight: 600, fontSize: '13px' }}>尝试中</span></>}
                        {status === 'idle' && <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '13px' }}>就绪</span>}
                        {status === 'starting' && <><RefreshCw size={14} className="spin" style={{ color: '#fbbf24' }} /> <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '13px' }}>启动中</span></>}
                    </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0, paddingLeft: '56px' }}>
                    为项目 <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{currentProject}</span> 训练自定义 YOLOv8 模型
                </p>
            </div>

            {/* Main Content */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 420px',
                gap: '1.5rem',
                padding: '1.5rem 2rem',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden'
            }}>
                {/* Left: Logs & Charts */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
                    overflowY: 'auto',
                    minHeight: 0,
                    paddingRight: '4px'
                }} className="custom-scrollbar">
                    {/* Stats Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', flexShrink: 0 }}>
                        <StatBadge
                            icon={Database}
                            label="总图片"
                            value={stats?.total || 0}
                            color="99,102,241"
                            gradient="linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.05))"
                        />
                        <StatBadge
                            icon={CheckCircle}
                            label="已标注"
                            value={stats?.annotated || 0}
                            color="34,197,94"
                            gradient="linear-gradient(135deg, rgba(34,197,94,0.15), rgba(74,222,128,0.05))"
                        />
                        <StatBadge
                            icon={Layers}
                            label="未标注"
                            value={stats?.unannotated || 0}
                            color="251,191,36"
                            gradient="linear-gradient(135deg, rgba(251,191,36,0.15), rgba(252,211,77,0.05))"
                        />
                    </div>

                    {/* Dataset Path Info */}
                    <div style={{
                        background: datasetInfo?.exists
                            ? 'rgba(34, 197, 94, 0.08)'
                            : 'rgba(251, 191, 36, 0.08)',
                        borderRadius: '16px',
                        padding: '1rem 1.25rem',
                        border: `1px solid ${datasetInfo?.exists
                            ? 'rgba(34, 197, 94, 0.2)'
                            : 'rgba(251, 191, 36, 0.2)'}`,
                        flexShrink: 0
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            {datasetInfo?.exists ? (
                                <CheckCircle size={20} style={{ color: '#4ade80' }} />
                            ) : (
                                <AlertCircle size={20} style={{ color: '#fbbf24' }} />
                            )}
                            <span style={{
                                fontSize: '14px',
                                fontWeight: 700,
                                color: datasetInfo?.exists ? '#4ade80' : '#fbbf24'
                            }}>
                                {datasetInfo?.exists ? '数据集已就绪' : '数据集未导出'}
                            </span>
                            {datasetInfo?.kptShape && (
                                <span style={{
                                    fontSize: '11px',
                                    background: 'rgba(99,102,241,0.15)',
                                    color: '#818cf8',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    marginLeft: 'auto'
                                }}>
                                    {datasetInfo.kptShape[0]} 关键点
                                </span>
                            )}
                        </div>

                        {datasetInfo?.exists ? (
                            <div style={{
                                background: 'rgba(0, 0, 0, 0.2)',
                                borderRadius: '10px',
                                padding: '10px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}>
                                <FileText size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                <div style={{
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    color: '#60a5fa',
                                    wordBreak: 'break-all',
                                    flex: 1
                                }}>
                                    {datasetInfo.yamlPath}
                                </div>
                            </div>
                        ) : (
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                请先导出数据集：点击左侧导航栏的「导出数据集」
                            </div>
                        )}
                    </div>

                    {/* Dashboard */}
                    <TrainingDashboard metrics={metrics} status={status} />

                    {/* Log Viewer */}
                    <LogWorkbench
                        events={eventsV2}
                        diagnosis={diagnosisV2}
                        connectionState={connectionState}
                    />
                </div>

                {/* Right: Controls & Config */}
                <div style={{
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    paddingRight: '4px'
                }} className="custom-scrollbar">

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '1rem', flexShrink: 0 }}>
                        {status === 'running' || status === 'starting' ? (
                            <button
                                onClick={stopTraining}
                                style={{
                                    flex: 1,
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    borderRadius: '16px',
                                    padding: '1rem',
                                    color: '#ef4444',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Square size={20} fill="currentColor" /> 停止训练
                            </button>
                        ) : (
                            <button
                                onClick={onStart}
                                style={{
                                    flex: 1,
                                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                    border: 'none',
                                    borderRadius: '16px',
                                    padding: '1rem',
                                    color: 'white',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Play size={20} fill="currentColor" /> 开始训练
                            </button>
                        )}
                    </div>

                    {/* Export Logs Button */}
                    <button
                        onClick={async () => {
                            try {
                                const result = await exportLogsToFile();
                                setExportResult(result);
                                setShowExportSuccess(true);
                            } catch (err) {
                                alert(`导出失败: ${err.message}`);
                            }
                        }}
                        disabled={!hasExportableData}
                        style={{
                            width: '100%',
                            background: !hasExportableData
                                ? 'rgba(255,255,255,0.03)'
                                : 'rgba(99, 102, 241, 0.1)',
                            border: !hasExportableData
                                ? '1px solid rgba(255,255,255,0.06)'
                                : '1px solid rgba(99, 102, 241, 0.2)',
                            borderRadius: '16px',
                            padding: '0.875rem',
                            color: !hasExportableData
                                ? 'var(--text-tertiary)'
                                : '#818cf8',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            cursor: !hasExportableData ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            flexShrink: 0
                        }}
                    >
                        <Download size={18} /> 导出训练日志
                    </button>

                    {/* Export Success Modal */}
                    {showExportSuccess && exportResult && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.75)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10000,
                            animation: 'fadeIn 0.3s ease'
                        }}
                            onClick={() => setShowExportSuccess(false)}
                        >
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(22, 27, 34, 0.98), rgba(13, 17, 23, 0.98))',
                                borderRadius: '24px',
                                padding: '2rem',
                                maxWidth: '500px',
                                width: '90%',
                                border: '2px solid rgba(99, 102, 241, 0.4)',
                                boxShadow: '0 0 40px rgba(99, 102, 241, 0.2), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                animation: 'scaleInBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                            }}
                                onClick={e => e.stopPropagation()}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <div style={{
                                        width: '64px',
                                        height: '64px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(129, 140, 248, 0.2))',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#818cf8',
                                        marginBottom: '1rem',
                                        animation: 'pulseSuccess 2s ease-in-out infinite',
                                        border: '2px solid rgba(99, 102, 241, 0.5)'
                                    }}>
                                        <CheckCircle size={32} strokeWidth={2.5} />
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#818cf8', textAlign: 'center' }}>
                                        日志导出成功
                                    </h3>
                                </div>

                                <div style={{
                                    background: 'rgba(0, 0, 0, 0.25)',
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    marginBottom: '1.5rem'
                                }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                                        保存位置
                                    </div>
                                    <div style={{
                                        fontFamily: 'monospace',
                                        fontSize: '13px',
                                        color: '#60a5fa',
                                        wordBreak: 'break-all',
                                        lineHeight: 1.5
                                    }}>
                                        {exportResult.filePath}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await openLogFile(exportResult.filePath);
                                            } catch (err) {
                                                alert(`打开文件失败: ${err.message}`);
                                            }
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '14px',
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                                            border: 'none',
                                            color: 'white',
                                            fontSize: '15px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <ExternalLink size={18} /> 打开日志
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await openLogsFolder();
                                            } catch (err) {
                                                alert(`打开文件夹失败: ${err.message}`);
                                            }
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '14px',
                                            borderRadius: '12px',
                                            background: 'rgba(99, 102, 241, 0.15)',
                                            border: '1px solid rgba(99, 102, 241, 0.3)',
                                            color: '#818cf8',
                                            fontSize: '15px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <FolderOpen size={18} /> 打开文件夹
                                    </button>
                                </div>

                                <button
                                    onClick={() => setShowExportSuccess(false)}
                                    style={{
                                        width: '100%',
                                        marginTop: '12px',
                                        padding: '12px',
                                        borderRadius: '10px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        color: 'var(--text-secondary)',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    关闭
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Forms */}
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
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleInBounce {
                    0% { transform: scale(0.8); opacity: 0; }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes pulseSuccess {
                    0%, 100% { 
                        transform: scale(1); 
                        box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
                    }
                    50% { 
                        transform: scale(1.05); 
                        box-shadow: 0 0 20px 5px rgba(99, 102, 241, 0.2);
                    }
                }
                .remote-input:focus {
                    outline: none !important;
                    border-color: rgba(99, 102, 241, 0.5) !important;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1) !important;
                    background: rgba(0,0,0,0.35) !important;
                }
                .remote-input {
                    transition: all 0.2s ease-in-out;
                }
            `}</style>
        </div>
    );
};
