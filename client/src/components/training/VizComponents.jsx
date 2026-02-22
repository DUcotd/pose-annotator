import React from 'react';

const WIDTH = 280;
const HEIGHT = 102;
const PADDING = 14;

const panelStyle = {
    background: 'linear-gradient(165deg, rgba(9,18,34,0.82), rgba(14,27,48,0.66))',
    border: '1px solid rgba(148,163,184,0.24)',
    borderRadius: '16px',
    padding: '0.85rem'
};

const titleStyle = {
    fontSize: '12px',
    fontWeight: 800,
    color: '#b9c7e0'
};

const emptyBodyStyle = {
    height: HEIGHT - 30,
    display: 'grid',
    placeItems: 'center',
    color: '#8391ad',
    fontSize: '12px'
};

export const LineChart = ({ data, dataKey, color, label, unit = '', multiplier = 1 }) => {
    const series = Array.isArray(data)
        ? data.filter((entry) => entry && entry[dataKey] !== undefined && entry[dataKey] !== null)
        : [];
    const latestValue = series.length > 0 ? series[series.length - 1][dataKey] : undefined;

    if (!series || series.length < 2 || latestValue === undefined) {
        return (
            <div style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <span style={titleStyle}>{label}</span>
                    <span style={{ fontSize: '13px', color: `rgb(${color})`, fontWeight: 800 }}>
                        {latestValue !== undefined ? `${(latestValue * multiplier).toFixed(multiplier === 1 ? 4 : 1)}${unit}` : `--${unit}`}
                    </span>
                </div>
                <div style={emptyBodyStyle}>等待训练数据...</div>
            </div>
        );
    }

    const values = series.map((entry) => Number(entry[dataKey] || 0) * multiplier);
    const minValue = Math.min(...values) * 0.9;
    const maxValue = Math.max(...values) * 1.1;
    const range = maxValue - minValue || 1;

    const points = series.map((entry, index) => {
        const x = PADDING + (index / (series.length - 1)) * (WIDTH - 2 * PADDING);
        const y = HEIGHT - PADDING - (((Number(entry[dataKey] || 0) * multiplier) - minValue) / range) * (HEIGHT - 2 * PADDING);
        return `${x},${y}`;
    }).join(' ');

    const latestText = `${(latestValue * multiplier).toFixed(multiplier === 1 ? 4 : 1)}${unit}`;
    const gradientId = `grad-${dataKey}`;

    return (
        <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <span style={titleStyle}>{label}</span>
                <span style={{ fontSize: '13px', color: `rgb(${color})`, fontWeight: 800 }}>{latestText}</span>
            </div>
            <svg width="100%" height={HEIGHT - 30} viewBox={`0 0 ${WIDTH} ${HEIGHT - 30}`} preserveAspectRatio="none">
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={`rgb(${color})`} stopOpacity="0.32" />
                        <stop offset="100%" stopColor={`rgb(${color})`} stopOpacity="0.04" />
                    </linearGradient>
                </defs>
                <polygon
                    points={`${PADDING},${HEIGHT - PADDING} ${points} ${WIDTH - PADDING},${HEIGHT - PADDING}`}
                    fill={`url(#${gradientId})`}
                />
                <polyline
                    fill="none"
                    stroke={`rgb(${color})`}
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                />
            </svg>
        </div>
    );
};

export const GPUMemoryGauge = ({ usedGB, totalGB, percent = 0, temperature, utilization, unavailable = false }) => {
    const telemetryAvailable = !unavailable && (
        (Number(totalGB ?? 0) > 0) ||
        (Number(usedGB ?? 0) > 0) ||
        (Number(percent ?? 0) > 0) ||
        (Number(utilization ?? 0) > 0) ||
        (Number(temperature ?? 0) > 0)
    );
    const safePercent = telemetryAvailable ? Number(percent || 0) : 0;
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (safePercent / 100) * circumference;

    const gaugeColor = !telemetryAvailable
        ? '#64748b'
        : safePercent < 60 ? '#4ade80' : safePercent < 80 ? '#facc15' : '#f87171';

    return (
        <div style={panelStyle}>
            <div style={{ ...titleStyle, marginBottom: '0.65rem', color: '#fcd34d' }}>GPU 资源监控</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ position: 'relative', width: '92px', height: '92px' }}>
                    <svg width="92" height="92" viewBox="0 0 92 92">
                        <circle cx="46" cy="46" r={radius} fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth="8" />
                        <circle
                            cx="46"
                            cy="46"
                            r={radius}
                            fill="none"
                            stroke={gaugeColor}
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.35s ease' }}
                        />
                    </svg>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeItems: 'center',
                        textAlign: 'center'
                    }}>
                        <div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: gaugeColor }}>
                                {telemetryAvailable ? `${safePercent.toFixed(0)}%` : '--'}
                            </div>
                            <div style={{ fontSize: '9px', color: '#8da0bf' }}>
                                {telemetryAvailable ? '显存占用' : '等待遥测'}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span style={{ color: '#8da0bf' }}>已用 / 总量</span>
                        <span style={{ color: '#e7edf8', fontWeight: 700 }}>
                            {telemetryAvailable ? `${Number(usedGB ?? 0).toFixed(2)} / ${Number(totalGB ?? 0).toFixed(1)} GB` : '-- / -- GB'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span style={{ color: '#8da0bf' }}>GPU 利用率</span>
                        <span style={{ color: '#e7edf8', fontWeight: 700 }}>
                            {telemetryAvailable && utilization !== undefined ? `${utilization.toFixed(0)}%` : '--'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span style={{ color: '#8da0bf' }}>温度</span>
                        <span style={{ color: telemetryAvailable && temperature > 80 ? '#fca5a5' : '#e7edf8', fontWeight: 700 }}>
                            {telemetryAvailable && temperature !== undefined ? `${temperature}°C` : '--'}
                        </span>
                    </div>
                    {!telemetryAvailable && (
                        <div style={{ fontSize: '10px', color: '#93c5fd' }}>
                            等待 GPU 遥测数据...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const PerformanceMetrics = ({ latency, fps, meetsRealtime }) => {
    const latencyMs = latency?.mean_ms || 0;
    const p95Ms = latency?.p95_ms || 0;

    return (
        <div style={panelStyle}>
            <div style={{ ...titleStyle, marginBottom: '0.65rem', color: '#93c5fd' }}>性能基准</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '8px' }}>
                <div style={{
                    border: '1px solid rgba(148,163,184,0.22)',
                    borderRadius: '11px',
                    padding: '0.6rem',
                    background: 'rgba(15,23,42,0.5)',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '10px', color: '#8da0bf' }}>平均延迟</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#e7edf8', marginTop: '2px' }}>
                        {latencyMs > 0 ? `${latencyMs.toFixed(1)}ms` : '--'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#7f90af', marginTop: '2px' }}>
                        P95: {p95Ms > 0 ? `${p95Ms.toFixed(1)}ms` : '--'}
                    </div>
                </div>

                <div style={{
                    border: '1px solid rgba(148,163,184,0.22)',
                    borderRadius: '11px',
                    padding: '0.6rem',
                    background: 'rgba(15,23,42,0.5)',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '10px', color: '#8da0bf' }}>实时 FPS</div>
                    <div style={{
                        fontSize: '16px',
                        fontWeight: 800,
                        color: meetsRealtime ? '#4ade80' : '#facc15',
                        marginTop: '2px'
                    }}>
                        {fps || '--'}
                    </div>
                    <div style={{ fontSize: '10px', color: meetsRealtime ? '#86efac' : '#fde68a', marginTop: '2px' }}>
                        {meetsRealtime ? '满足实时要求' : '未达到实时要求'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const LearningRateChart = ({ data }) => {
    const lrData = data.filter((entry) => entry.learning_rate !== undefined);

    if (lrData.length < 2) {
        return (
            <div style={panelStyle}>
                <div style={{ ...titleStyle, marginBottom: '0.5rem', color: '#c4b5fd' }}>学习率曲线</div>
                <div style={{ height: 66, display: 'grid', placeItems: 'center', color: '#8391ad', fontSize: '12px' }}>
                    等待学习率数据...
                </div>
            </div>
        );
    }

    const values = lrData.map((entry) => entry.learning_rate);
    const maxValue = Math.max(...values) * 1.1;
    const minValue = 0;
    const range = maxValue - minValue || 1;
    const chartWidth = 250;
    const chartHeight = 66;
    const points = lrData.map((entry, index) => {
        const x = 10 + (index / (lrData.length - 1)) * (chartWidth - 20);
        const y = chartHeight - 10 - ((entry.learning_rate - minValue) / range) * (chartHeight - 20);
        return `${x},${y}`;
    }).join(' ');

    const latest = lrData[lrData.length - 1];

    return (
        <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ ...titleStyle, color: '#c4b5fd' }}>学习率曲线</span>
                <span style={{ fontSize: '12px', color: '#c4b5fd', fontWeight: 800 }}>
                    {(latest.learning_rate * 1000).toFixed(4)}m
                </span>
            </div>
            <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                <defs>
                    <linearGradient id="lr-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgba(168,85,247,0.35)" />
                        <stop offset="100%" stopColor="rgba(168,85,247,0.03)" />
                    </linearGradient>
                </defs>
                <polygon points={`10,${chartHeight - 10} ${points} ${chartWidth - 10},${chartHeight - 10}`} fill="url(#lr-grad)" />
                <polyline fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
            </svg>
            {latest.cos_lr && (
                <div style={{ fontSize: '10px', color: '#8da0bf', marginTop: '2px', textAlign: 'center' }}>
                    余弦退火调度
                </div>
            )}
        </div>
    );
};

export const KeypointRadarChart = ({ keypoints }) => {
    if (!keypoints || keypoints.length === 0) {
        return (
            <div style={panelStyle}>
                <div style={{ ...titleStyle, marginBottom: '0.5rem' }}>关键点准确率分布</div>
                <div style={{ height: 126, display: 'grid', placeItems: 'center', color: '#8391ad', fontSize: '12px' }}>
                    等待关键点统计...
                </div>
            </div>
        );
    }

    const centerX = 100;
    const centerY = 70;
    const maxRadius = 50;
    const count = keypoints.length;
    const angles = keypoints.map((_, index) => (2 * Math.PI * index) / count - Math.PI / 2);
    const maxAP = Math.max(...keypoints.map((item) => item.ap || 0), 1);

    const radarPoints = keypoints.map((keypoint, index) => {
        const radius = ((keypoint.ap || 0) / maxAP) * maxRadius;
        const x = centerX + radius * Math.cos(angles[index]);
        const y = centerY + radius * Math.sin(angles[index]);
        return `${x},${y}`;
    }).join(' ');

    const gridLevels = [0.25, 0.5, 0.75, 1];

    return (
        <div style={panelStyle}>
            <div style={{ ...titleStyle, marginBottom: '0.5rem' }}>关键点准确率分布</div>
            <svg width="200" height="140" viewBox="0 0 200 140">
                {gridLevels.map((level) => (
                    <circle
                        key={level}
                        cx={centerX}
                        cy={centerY}
                        r={maxRadius * level}
                        fill="none"
                        stroke="rgba(148,163,184,0.2)"
                        strokeWidth="1"
                    />
                ))}

                {angles.map((angle, index) => (
                    <line
                        key={angle}
                        x1={centerX}
                        y1={centerY}
                        x2={centerX + maxRadius * Math.cos(angle)}
                        y2={centerY + maxRadius * Math.sin(angle)}
                        stroke="rgba(148,163,184,0.2)"
                        strokeWidth="1"
                    />
                ))}

                <polygon points={radarPoints} fill="rgba(167,139,250,0.25)" stroke="#a78bfa" strokeWidth="2" />

                {keypoints.map((keypoint, index) => {
                    const labelRadius = maxRadius + 12;
                    const x = centerX + labelRadius * Math.cos(angles[index]);
                    const y = centerY + labelRadius * Math.sin(angles[index]);
                    return (
                        <text
                            key={`${keypoint.keypoint_id ?? index}`}
                            x={x}
                            y={y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{ fontSize: '8px', fill: '#8da0bf' }}
                        >
                            {keypoint.keypoint_id !== undefined ? `K${keypoint.keypoint_id}` : `P${index}`}
                        </text>
                    );
                })}
            </svg>
            <div style={{ fontSize: '10px', color: '#8da0bf', textAlign: 'center' }}>{keypoints.length} 个关键点</div>
        </div>
    );
};

export const VisualValidationPreview = ({ samples, outputDir }) => {
    if (!samples || samples.length === 0) {
        return (
            <div style={panelStyle}>
                <div style={{ ...titleStyle, marginBottom: '0.5rem', color: '#86efac' }}>可视化验证</div>
                <div style={{ height: 126, display: 'grid', placeItems: 'center', color: '#8391ad', fontSize: '12px' }}>
                    暂无可视化样本
                </div>
            </div>
        );
    }

    return (
        <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <span style={{ ...titleStyle, color: '#86efac' }}>可视化验证</span>
                {outputDir && (
                    <span style={{ fontSize: '10px', color: '#8da0bf', maxWidth: '52%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {outputDir}
                    </span>
                )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                {samples.map((sample, index) => (
                    <div
                        key={`${sample.category || 'sample'}-${index}`}
                        style={{
                            border: '1px solid rgba(148,163,184,0.24)',
                            borderRadius: '10px',
                            background: 'rgba(15,23,42,0.5)',
                            padding: '0.55rem'
                        }}
                    >
                        <div style={{ fontSize: '10px', color: '#8da0bf', marginBottom: '3px' }}>
                            {sample.category || `样本 ${index + 1}`}
                        </div>
                        <div style={{ fontSize: '12px', color: '#e7edf8', fontWeight: 800 }}>
                            {sample.num_detections || 0} 检测
                        </div>
                        {sample.avg_confidence !== undefined && (
                            <div style={{ fontSize: '10px', color: '#86efac', marginTop: '2px' }}>
                                置信度 {(sample.avg_confidence * 100).toFixed(1)}%
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const LogViewer = ({ logs }) => {
    const filteredLogs = logs.filter((log) => {
        if (!log.msg) return false;
        const message = log.msg.trim();
        if (message.includes('━━━━') || message.includes('────') || message.includes('╸')) return false;
        if (/^\d+%\s*[━─╸]+/.test(message)) return false;
        if (message.startsWith('Class') && message.includes('Images') && message.includes('Box(P')) return false;
        if (message.startsWith('Epoch') && message.includes('GPU_mem')) return false;
        return true;
    });

    return (
        <div style={{
            ...panelStyle,
            display: 'flex',
            flexDirection: 'column',
            minHeight: '220px',
            padding: 0,
            overflow: 'hidden'
        }}>
            <div style={{
                padding: '0.8rem 0.9rem',
                borderBottom: '1px solid rgba(148,163,184,0.24)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span style={{ ...titleStyle, color: '#b9c7e0' }}>训练日志</span>
                <span style={{ fontSize: '11px', color: '#8da0bf' }}>{filteredLogs.length} 条</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', fontFamily: 'Consolas, Monaco, monospace', fontSize: '12px' }} className="custom-scrollbar">
                {filteredLogs.length === 0 && (
                    <div style={{ color: '#8391ad', textAlign: 'center', padding: '1.8rem 0.75rem' }}>
                        等待日志输出...
                    </div>
                )}

                {filteredLogs.map((log, index) => (
                    <div
                        key={`${log.time || 't'}-${index}`}
                        style={{
                            marginBottom: '6px',
                            border: '1px solid rgba(148,163,184,0.2)',
                            borderRadius: '8px',
                            background: 'rgba(15,23,42,0.5)',
                            padding: '6px 8px'
                        }}
                    >
                        <div style={{ fontSize: '10px', color: '#8da0bf', marginBottom: '3px' }}>
                            [{new Date(log.time).toLocaleTimeString()}] {log.type || 'log'}
                        </div>
                        <div style={{ color: '#dbe4f2', wordBreak: 'break-all', lineHeight: 1.45 }}>
                            {log.msg}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
