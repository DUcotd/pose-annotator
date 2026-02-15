import React from 'react';

const width = 280;
const height = 100;
const padding = 15;

export const LineChart = ({ data, dataKey, color, label, unit = "", multiplier = 1 }) => {
    if (!data || data.length === 0) {
        return (
            <div style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '16px',
                padding: '1.25rem',
                border: '1px solid rgba(255,255,255,0.04)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: '14px', color: `rgb(${color})`, fontWeight: 700 }}>--{unit}</span>
                </div>
                <div style={{
                    height: height - 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-tertiary)',
                    fontSize: '12px'
                }}>
                    等待数据...
                </div>
            </div>
        );
    }

    const latestValue = data[data.length - 1][dataKey];

    if (latestValue === undefined || data.length < 2) {
        return (
            <div style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '16px',
                padding: '1.25rem',
                border: '1px solid rgba(255,255,255,0.04)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: '14px', color: `rgb(${color})`, fontWeight: 700 }}>
                        {latestValue !== undefined ? (latestValue * multiplier).toFixed(multiplier === 1 ? 4 : 1) : '--'}{unit}
                    </span>
                </div>
                <div style={{
                    height: height - 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-tertiary)',
                    fontSize: '12px'
                }}>
                    正在收集...
                </div>
            </div>
        );
    }

    const values = data.map(d => (d[dataKey] || 0) * multiplier);
    const minVal = Math.min(...values) * 0.9;
    const maxVal = Math.max(...values) * 1.1;
    const range = maxVal - minVal || 1;

    const points = data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - (((d[dataKey] || 0) * multiplier - minVal) / range) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div style={{
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '16px',
            padding: '1.25rem',
            border: '1px solid rgba(255,255,255,0.04)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: '14px', color: `rgb(${color})`, fontWeight: 700 }}>
                    {(latestValue * multiplier).toFixed(multiplier === 1 ? 4 : 1)}{unit}
                </span>
            </div>
            <svg width="100%" height={height - 30} viewBox={`0 0 ${width} ${height - 30}`} preserveAspectRatio="none">
                <defs>
                    <linearGradient id={`grad-${dataKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={`rgb(${color})`} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={`rgb(${color})`} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <polygon
                    points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
                    fill={`url(#grad-${dataKey})`}
                />
                <polyline
                    fill="none"
                    stroke={`rgb(${color})`}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                    style={{ transition: 'all 0.5s ease' }}
                />
            </svg>
        </div>
    );
};

export const GPUMemoryGauge = ({ usedGB, totalGB, percent, temperature, utilization }) => {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;
    
    const getColor = (pct) => {
        if (pct < 60) return 'rgb(34,197,94)';
        if (pct < 80) return 'rgb(251,191,36)';
        return 'rgb(239,68,68)';
    };
    
    const color = getColor(percent);
    
    return (
        <div style={{
            background: 'rgba(0,0,0,0.2)',
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
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgb(251,191,36)' }}>GPU 资源监控</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                    <svg width="100" height="100" viewBox="0 0 100 100">
                        <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="8"
                        />
                        <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="none"
                            stroke={color}
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            style={{ 
                                transform: 'rotate(-90deg)', 
                                transformOrigin: '50% 50%',
                                transition: 'stroke-dashoffset 0.5s ease'
                            }}
                        />
                    </svg>
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color }}>{percent.toFixed(0)}%</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>显存</div>
                    </div>
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>已用 / 总量</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {usedGB?.toFixed(2) || '--'} / {totalGB?.toFixed(1) || '--'} GB
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>GPU 利用率</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {utilization?.toFixed(0) || '--'}%
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>温度</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: temperature > 80 ? 'rgb(239,68,68)' : 'var(--text-primary)' }}>
                            {temperature || '--'}°C
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const PerformanceMetrics = ({ latency, fps, meetsRealtime }) => {
    const latencyMs = latency?.mean_ms || 0;
    const p95Ms = latency?.p95_ms || 0;
    
    return (
        <div style={{
            background: 'rgba(0,0,0,0.2)',
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
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgb(59,130,246)' }}>性能基准</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>平均延迟</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {latencyMs > 0 ? `${latencyMs.toFixed(1)}ms` : '--'}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>
                        P95: {p95Ms > 0 ? `${p95Ms.toFixed(1)}ms` : '--'}
                    </div>
                </div>
                
                <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>实时 FPS</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: meetsRealtime ? 'rgb(34,197,94)' : 'rgb(251,191,36)' }}>
                        {fps || '--'}
                    </div>
                    <div style={{ fontSize: '9px', color: meetsRealtime ? 'rgb(34,197,94)' : 'rgb(251,191,36)' }}>
                        {meetsRealtime ? '✅ 满足实时' : '⚠️ 未达实时'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const LearningRateChart = ({ data }) => {
    const lrData = data.filter(d => d.learning_rate !== undefined);
    
    if (lrData.length < 2) {
        return (
            <div style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '16px',
                padding: '1.25rem',
                border: '1px solid rgba(255,255,255,0.04)'
            }}>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '0.5rem' }}>
                    学习率曲线
                </div>
                <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                    等待数据...
                </div>
            </div>
        );
    }
    
    const values = lrData.map(d => d.learning_rate);
    const maxVal = Math.max(...values) * 1.1;
    const minVal = 0;
    const range = maxVal - minVal || 1;
    
    const chartWidth = 250;
    const chartHeight = 60;
    
    const points = lrData.map((d, i) => {
        const x = 10 + (i / (lrData.length - 1)) * (chartWidth - 20);
        const y = chartHeight - 10 - ((d.learning_rate - minVal) / range) * (chartHeight - 20);
        return `${x},${y}`;
    }).join(' ');
    
    const latest = lrData[lrData.length - 1];
    
    return (
        <div style={{
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '16px',
            padding: '1rem',
            border: '1px solid rgba(255,255,255,0.04)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>学习率曲线</span>
                <span style={{ fontSize: '12px', color: 'rgb(168,85,247)', fontWeight: 700 }}>
                    {(latest.learning_rate * 1000).toFixed(4)}m
                </span>
            </div>
            <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                <defs>
                    <linearGradient id="lr-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgb(168,85,247)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="rgb(168,85,247)" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <polygon
                    points={`10,${chartHeight - 10} ${points} ${chartWidth - 10},${chartHeight - 10}`}
                    fill="url(#lr-grad)"
                />
                <polyline
                    fill="none"
                    stroke="rgb(168,85,247)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                />
            </svg>
            {latest.cos_lr && (
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.25rem', textAlign: 'center' }}>
                    余弦退火调度
                </div>
            )}
        </div>
    );
};

export const KeypointRadarChart = ({ keypoints }) => {
    if (!keypoints || keypoints.length === 0) {
        return (
            <div style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '16px',
                padding: '1rem',
                border: '1px solid rgba(255,255,255,0.04)'
            }}>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '0.5rem' }}>
                    关键点准确率分布
                </div>
                <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                    等待数据...
                </div>
            </div>
        );
    }
    
    const centerX = 100;
    const centerY = 70;
    const maxRadius = 50;
    const numPoints = keypoints.length;
    
    const angles = keypoints.map((_, i) => (2 * Math.PI * i) / numPoints - Math.PI / 2);
    
    const maxAP = Math.max(...keypoints.map(k => k.ap || 0), 1);
    
    const radarPoints = keypoints.map((kp, i) => {
        const r = ((kp.ap || 0) / maxAP) * maxRadius;
        const x = centerX + r * Math.cos(angles[i]);
        const y = centerY + r * Math.sin(angles[i]);
        return `${x},${y}`;
    }).join(' ');
    
    const gridLevels = [0.25, 0.5, 0.75, 1.0];
    
    return (
        <div style={{
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '16px',
            padding: '1rem',
            border: '1px solid rgba(255,255,255,0.04)'
        }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '0.5rem' }}>
                关键点准确率分布
            </div>
            <svg width="200" height="140" viewBox="0 0 200 140">
                {gridLevels.map((level, idx) => (
                    <circle
                        key={idx}
                        cx={centerX}
                        cy={centerY}
                        r={maxRadius * level}
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="1"
                    />
                ))}
                
                {angles.map((angle, i) => (
                    <line
                        key={i}
                        x1={centerX}
                        y1={centerY}
                        x2={centerX + maxRadius * Math.cos(angle)}
                        y2={centerY + maxRadius * Math.sin(angle)}
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="1"
                    />
                ))}
                
                <polygon
                    points={radarPoints}
                    fill="rgba(168,85,247,0.3)"
                    stroke="rgb(168,85,247)"
                    strokeWidth="2"
                />
                
                {keypoints.map((kp, i) => {
                    const labelRadius = maxRadius + 12;
                    const x = centerX + labelRadius * Math.cos(angles[i]);
                    const y = centerY + labelRadius * Math.sin(angles[i]);
                    return (
                        <text
                            key={i}
                            x={x}
                            y={y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{ fontSize: '8px', fill: 'var(--text-tertiary)' }}
                        >
                            {kp.keypoint_id !== undefined ? `K${kp.keypoint_id}` : `P${i}`}
                        </text>
                    );
                })}
            </svg>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '0.25rem' }}>
                {keypoints.length} 个关键点
            </div>
        </div>
    );
};

export const VisualValidationPreview = ({ samples, outputDir }) => {
    if (!samples || samples.length === 0) {
        return null;
    }
    
    return (
        <div style={{
            background: 'rgba(0,0,0,0.2)',
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
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgb(34,197,94)' }}>可视化验证</span>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
                {samples.map((sample, i) => (
                    <div key={i} style={{
                        flexShrink: 0,
                        padding: '0.5rem',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '8px',
                        minWidth: '120px'
                    }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                            {sample.category || `样本 ${i + 1}`}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {sample.num_detections || 0} 检测
                        </div>
                        {sample.avg_confidence !== undefined && (
                            <div style={{ fontSize: '10px', color: 'rgb(34,197,94)' }}>
                                置信度: {(sample.avg_confidence * 100).toFixed(1)}%
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const LogViewer = ({ logs }) => {
    const getLogStyle = (type) => {
        switch (type) {
            case 'stderr':
                return { color: '#f87171', background: 'rgba(248,113,113,0.1)' };
            case 'system':
                return { color: '#60a5fa', background: 'rgba(96,165,250,0.1)' };
            case 'metric':
                return { color: '#4ade80', background: 'rgba(74,222,128,0.1)' };
            case 'suggestion':
                return { color: '#fbbf24', background: 'rgba(251,191,36,0.1)' };
            case 'error':
                return { color: '#f87171', background: 'rgba(248,113,113,0.15)' };
            default:
                return { color: 'var(--text-secondary)', background: 'transparent' };
        }
    };

    const getLogIcon = (type) => {
        switch (type) {
            case 'stderr':
            case 'error':
                return '❌';
            case 'system':
                return 'ℹ️';
            case 'metric':
                return '📊';
            case 'suggestion':
                return '💡';
            default:
                return '›';
        }
    };

    const filteredLogs = logs.filter(log => {
        if (!log.msg) return false;
        const msg = log.msg.trim();
        if (msg.includes('━━━━') || msg.includes('────') || msg.includes('╸')) return false;
        if (/^\d+%\s*[━─╸]+/.test(msg)) return false;
        if (msg.startsWith('Class') && msg.includes('Images') && msg.includes('Box(P')) return false;
        if (msg.startsWith('Epoch') && msg.includes('GPU_mem')) return false;
        return true;
    });

    return (
        <div style={{
            flex: 1,
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: '200px'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>训练日志</span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{filteredLogs.length} 条</span>
            </div>
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.75rem',
                fontFamily: 'monospace',
                fontSize: '12px'
            }} className="custom-scrollbar">
                {filteredLogs.length === 0 && (
                    <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '2rem' }}>
                        等待日志输出...
                    </div>
                )}
                {filteredLogs.map((log, i) => {
                    const style = getLogStyle(log.type);
                    const icon = getLogIcon(log.type);
                    const isImportant = ['metric', 'error', 'suggestion', 'system'].includes(log.type);
                    
                    return (
                        <div key={i} style={{
                            ...style,
                            marginBottom: '4px',
                            padding: isImportant ? '8px 12px' : '4px 8px',
                            borderRadius: isImportant ? '8px' : '4px',
                            wordBreak: 'break-all',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px'
                        }}>
                            <span style={{ 
                                color: 'var(--text-tertiary)', 
                                flexShrink: 0,
                                fontSize: '11px',
                                minWidth: '70px'
                            }}>
                                [{new Date(log.time).toLocaleTimeString()}]
                            </span>
                            <span style={{ flexShrink: 0 }}>{icon}</span>
                            <span style={{ flex: 1 }}>{log.msg}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
