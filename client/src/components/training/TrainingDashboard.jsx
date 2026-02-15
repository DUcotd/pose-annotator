import React, { useState, useEffect } from 'react';
import { Zap, Gauge, Target, Activity, TrendingUp, Box, Move, Cpu, Thermometer, AlertTriangle } from 'lucide-react';
import { ProgressRing } from './CommonComponents';
import { LineChart, GPUMemoryGauge, PerformanceMetrics, LearningRateChart, KeypointRadarChart, VisualValidationPreview } from './VizComponents';

const MetricCard = ({ icon: Icon, label, value, unit, color, subValue, subLabel, warning }) => (
    <div style={{
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '14px',
        padding: '1rem 1.25rem',
        border: warning ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Icon size={16} style={{ color: warning ? 'rgb(239,68,68)' : color }} />
            <div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block' }}>{label}</span>
                {subLabel && <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{subLabel}</span>}
            </div>
        </div>
        <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: warning ? 'rgb(239,68,68)' : 'var(--text-primary)' }}>{value}{unit}</span>
            {subValue !== undefined && (
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block' }}>{subValue}</span>
            )}
            {warning && (
                <span style={{ fontSize: '10px', color: 'rgb(239,68,68)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <AlertTriangle size={10} /> {warning}
                </span>
            )}
        </div>
    </div>
);

const MetricSection = ({ title, metrics, type }) => {
    const isPose = type === 'pose';
    const color = isPose ? 'rgb(168,85,247)' : 'rgb(34,197,94)';
    const Icon = isPose ? Move : Target;
    
    let precision, recall, map50, map50_95;
    
    if (isPose) {
        precision = metrics['pose_precision'];
        recall = metrics['pose_recall'];
        map50 = metrics['pose_mAP50'];
        map50_95 = metrics['pose_mAP50_95'] || metrics['pose_mAP50-95'];
    } else {
        precision = metrics['box_precision'] || metrics['precision'];
        recall = metrics['box_recall'] || metrics['recall'];
        map50 = metrics['mAP50'];
        map50_95 = metrics['mAP50_95'] || metrics['mAP50-95'];
    }
    
    return (
        <div style={{
            background: 'rgba(0,0,0,0.15)',
            borderRadius: '16px',
            padding: '1rem',
            border: `1px solid ${color}20`
        }}>
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '0.75rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid rgba(255,255,255,0.06)'
            }}>
                <Icon size={14} style={{ color }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color }}>{title}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Precision</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {precision !== undefined ? (precision * 100).toFixed(1) + '%' : '--'}
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Recall</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {recall !== undefined ? (recall * 100).toFixed(1) + '%' : '--'}
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>mAP@50</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color }}>
                        {map50 !== undefined ? (map50 * 100).toFixed(1) + '%' : '--'}
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>mAP@50-95</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {map50_95 !== undefined ? (map50_95 * 100).toFixed(1) + '%' : '--'}
                    </div>
                </div>
            </div>
        </div>
    );
};

const LossSection = ({ metrics }) => {
    const losses = [
        { key: 'box_loss', label: 'Box', color: 'rgb(255,123,114)' },
        { key: 'pose_loss', label: 'Pose', color: 'rgb(168,85,247)' },
        { key: 'kobj_loss', label: 'KObj', color: 'rgb(251,191,36)' },
        { key: 'cls_loss', label: 'Cls', color: 'rgb(59,130,246)' },
        { key: 'dfl_loss', label: 'DFL', color: 'rgb(34,197,94)' },
    ];
    
    return (
        <div style={{
            background: 'rgba(0,0,0,0.15)',
            borderRadius: '16px',
            padding: '1rem',
            border: '1px solid rgba(255,255,255,0.04)'
        }}>
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '0.75rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid rgba(255,255,255,0.06)'
            }}>
                <Activity size={14} style={{ color: 'rgb(251,191,36)' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgb(251,191,36)' }}>Loss 指标</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {losses.map(({ key, label, color }) => {
                    const value = metrics[key];
                    return (
                        <div key={key} style={{
                            flex: '1 1 calc(33% - 0.5rem)',
                            minWidth: '60px',
                            textAlign: 'center',
                            padding: '0.5rem',
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '8px'
                        }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{label}</div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color }}>
                                {value !== undefined ? value.toFixed(4) : '--'}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const TrainingDashboard = ({ metrics, status }) => {
    const latest = metrics[metrics.length - 1] || {};
    const progress = (latest.epoch && latest.totalEpochs) ? (latest.epoch / latest.totalEpochs) * 100 : 0;
    const hasMetrics = metrics.length > 0;
    
    const [performanceData, setPerformanceData] = useState(null);
    const [keypointData, setKeypointData] = useState(null);
    const [visualValidationData, setVisualValidationData] = useState(null);
    
    useEffect(() => {
        metrics.forEach(m => {
            if (m.event === 'performance_benchmark') {
                setPerformanceData(m);
            }
            if (m.event === 'per_keypoint_metrics') {
                setKeypointData(m);
            }
            if (m.event === 'visual_validation') {
                setVisualValidationData(m);
            }
        });
    }, [metrics]);
    
    const formatETA = (seconds) => {
        if (!seconds || seconds <= 0) return '--';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };
    
    const gpuMemoryWarning = latest.gpu_memory_percent > 85 ? '显存紧张' : null;
    const gpuUtilWarning = latest.gpu_utilization_percent < 30 && latest.gpu_utilization_percent > 0 ? '可能IO瓶颈' : null;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            marginBottom: '1.5rem'
        }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: '1rem',
                alignItems: 'start'
            }}>
                <div style={{
                    background: 'rgba(0,0,0,0.25)',
                    borderRadius: '20px',
                    padding: '1.5rem',
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5rem'
                }}>
                    <ProgressRing progress={progress} size={100} strokeWidth={8} />
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>训练进度</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                            {latest.epoch || 0} <span style={{ fontSize: '1rem', color: 'var(--text-tertiary)' }}>/ {latest.totalEpochs || '--'}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Epochs</div>
                        {latest.eta_seconds > 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                预计剩余: {formatETA(latest.eta_seconds)}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <MetricCard 
                            icon={Cpu} 
                            label="GPU 显存" 
                            value={latest.gpu_memory_used_gb !== undefined ? latest.gpu_memory_used_gb.toFixed(2) : (latest.gpu_mem || '--')} 
                            unit={latest.gpu_memory_total_gb ? ` / ${latest.gpu_memory_total_gb.toFixed(1)} GB` : ''} 
                            color="rgb(251,191,36)"
                            warning={gpuMemoryWarning}
                            subValue={latest.gpu_memory_percent !== undefined ? `${latest.gpu_memory_percent.toFixed(1)}%` : undefined}
                        />
                        <MetricCard 
                            icon={Gauge} 
                            label="GPU 利用率" 
                            value={latest.gpu_utilization_percent !== undefined ? latest.gpu_utilization_percent.toFixed(0) : '--'} 
                            unit="%" 
                            color="rgb(59,130,246)"
                            warning={gpuUtilWarning}
                            subValue={latest.gpu_temperature ? `${latest.gpu_temperature}°C` : undefined}
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <MetricCard 
                            icon={TrendingUp} 
                            label="Box mAP@50" 
                            value={latest.mAP50 !== undefined ? (latest.mAP50 * 100).toFixed(1) : '--'} 
                            unit="%" 
                            color="rgb(34,197,94)"
                            subValue={latest.mAP50_95 !== undefined ? `mAP@50-95: ${(latest.mAP50_95 * 100).toFixed(1)}%` : undefined}
                        />
                        <MetricCard 
                            icon={Move} 
                            label="Pose mAP@50" 
                            value={latest.pose_mAP50 !== undefined ? (latest.pose_mAP50 * 100).toFixed(1) : '--'} 
                            unit="%" 
                            color="rgb(168,85,247)"
                            subValue={latest.pose_mAP50_95 !== undefined ? `mAP@50-95: ${(latest.pose_mAP50_95 * 100).toFixed(1)}%` : undefined}
                        />
                    </div>
                </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <GPUMemoryGauge 
                    usedGB={latest.gpu_memory_used_gb}
                    totalGB={latest.gpu_memory_total_gb}
                    percent={latest.gpu_memory_percent || 0}
                    temperature={latest.gpu_temperature}
                    utilization={latest.gpu_utilization_percent}
                />
                <PerformanceMetrics 
                    latency={performanceData?.latency}
                    fps={performanceData?.realtime_fps}
                    meetsRealtime={performanceData?.meets_realtime_requirement}
                />
                <LearningRateChart data={metrics} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <MetricSection title="Box 检测指标" metrics={latest} type="box" />
                <MetricSection title="Pose 关键点指标" metrics={latest} type="pose" />
                <LossSection metrics={latest} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <LineChart data={metrics} dataKey="box_loss" color="255,123,114" label="Box Loss" />
                <LineChart data={metrics} dataKey="pose_loss" color="168,85,247" label="Pose Loss" />
                <LineChart data={metrics} dataKey="mAP50" color="34,197,94" label="mAP@50" unit="%" multiplier={100} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <LineChart data={metrics} dataKey="pose_mAP50" color="168,85,247" label="Pose mAP@50" unit="%" multiplier={100} />
                <LineChart data={metrics} dataKey="mAP50_95" color="59,130,246" label="mAP@50-95" unit="%" multiplier={100} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <KeypointRadarChart keypoints={keypointData?.keypoints} />
                <VisualValidationPreview 
                    samples={visualValidationData?.samples} 
                    outputDir={visualValidationData?.output_dir}
                />
            </div>
            
            {latest.gpu_warnings && latest.gpu_warnings.length > 0 && (
                <div style={{
                    background: 'rgba(239,68,68,0.1)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    border: '1px solid rgba(239,68,68,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                }}>
                    <AlertTriangle size={16} style={{ color: 'rgb(239,68,68)' }} />
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgb(239,68,68)' }}>GPU 警告</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {latest.gpu_warnings.join('; ')}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
