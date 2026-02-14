import React, { useRef, useEffect } from 'react';
import {
    Play, Square, RefreshCw, Database, CheckCircle, Layers, ArrowLeft, ChevronDown, ChevronRight,
    FolderOpen, FileText, AlertCircle
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useTraining } from '../hooks/useTraining';
import { StatBadge } from './training/CommonComponents';
import { LogViewer } from './training/VizComponents';
import { TrainingDashboard } from './training/TrainingDashboard';
import { TrainingForm, AugmentationForm, HardwareForm, StrategyForm, LossForm } from './training/TrainingForms';

export const TrainingConfig = () => {
    const { currentProject, configLoading, goBack } = useProject();
    const {
        config,
        status,
        envInfo,
        logs,
        metrics,
        stats,
        datasetInfo,
        showAdvanced,
        setShowAdvanced,
        handleStart: startTraining,
        handleStop: stopTraining,
        handleBrowseData,
        updateConfig
    } = useTraining(currentProject);

    const logEndRef = useRef(null);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

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
                    overflow: 'hidden'
                }}>
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
                    <LogViewer logs={logs} logEndRef={logEndRef} />
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

                    {/* Forms */}
                    <TrainingForm
                        config={config}
                        updateConfig={updateConfig}
                        status={status}
                        onBrowseData={handleBrowseData}
                        envInfo={envInfo}
                    />

                    {/* 高级设置折叠区域 */}
                    <div
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '1rem 1.25rem',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '14px',
                            border: '1px solid rgba(255,255,255,0.06)',
                            cursor: 'pointer',
                            marginBottom: '0.5rem'
                        }}
                    >
                        {showAdvanced ? (
                            <ChevronDown size={18} style={{ color: 'var(--accent-primary)' }} />
                        ) : (
                            <ChevronRight size={18} style={{ color: 'var(--text-tertiary)' }} />
                        )}
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            高级配置
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                            {showAdvanced ? '点击收起' : '点击展开'}
                        </span>
                    </div>

                    {showAdvanced && (
                        <>
                            <HardwareForm
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
                        </>
                    )}

                    <AugmentationForm
                        config={config}
                        updateConfig={updateConfig}
                        status={status}
                    />
                </div>
            </div>
        </div>
    );
};
