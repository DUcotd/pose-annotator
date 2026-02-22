import React, { useId } from 'react';

const CHART_WIDTH = 280;
const CHART_HEIGHT = 72;
const CHART_PADDING_X = 14;
const CHART_PADDING_Y = 8;
const DEFAULT_EMA_ALPHA = 0.35;

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
    height: CHART_HEIGHT,
    display: 'grid',
    placeItems: 'center',
    color: '#8391ad',
    fontSize: '12px'
};

const toFiniteNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
};

const buildEmaSeries = (values, alpha = DEFAULT_EMA_ALPHA) => {
    if (!Array.isArray(values) || values.length === 0) return [];
    const clampedAlpha = Math.max(0.01, Math.min(0.99, alpha));
    const result = [values[0]];
    for (let i = 1; i < values.length; i += 1) {
        result.push(clampedAlpha * values[i] + (1 - clampedAlpha) * result[i - 1]);
    }
    return result;
};

const computeDomain = (values, isPercent = false) => {
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (isPercent) {
        min = Math.max(0, Math.min(min, 100));
        max = Math.min(100, Math.max(max, 0));
    }

    let range = max - min;
    const minRange = isPercent ? 1 : Math.max(Math.abs(max) * 0.04, 0.01);
    if (range < minRange) {
        const center = (max + min) / 2;
        min = center - minRange / 2;
        max = center + minRange / 2;
        range = max - min;
    }

    const pad = Math.max(range * 0.12, isPercent ? 0.3 : 0);
    min -= pad;
    max += pad;

    if (isPercent) {
        min = Math.max(0, min);
        max = Math.min(100, max);
    }

    if (!Number.isFinite(max - min) || max === min) {
        max = min + 1;
    }

    return { min, max, range: max - min };
};

const buildPolylinePoints = (
    values,
    domain,
    width = CHART_WIDTH,
    height = CHART_HEIGHT,
    paddingX = CHART_PADDING_X,
    paddingY = CHART_PADDING_Y
) => {
    const spanX = width - 2 * paddingX;
    const spanY = height - 2 * paddingY;
    const count = values.length;
    return values.map((value, index) => {
        const x = count === 1
            ? width / 2
            : paddingX + (index / (count - 1)) * spanX;
        const normalized = (value - domain.min) / (domain.range || 1);
        const y = height - paddingY - normalized * spanY;
        return { x, y };
    });
};

const formatLatestValue = (value, multiplier, unit) => {
    if (!Number.isFinite(value)) return `--${unit}`;
    const scaled = value * multiplier;
    return `${scaled.toFixed(multiplier === 1 ? 4 : 1)}${unit}`;
};

export const LineChart = ({ data, dataKey, color, label, unit = '', multiplier = 1 }) => {
    const id = useId();
    const gradientId = `line-grad-${id}`;
    const series = Array.isArray(data)
        ? data
            .map((entry) => ({
                entry,
                value: toFiniteNumber(entry?.[dataKey])
            }))
            .filter((item) => item.value !== undefined)
        : [];
    const latestValue = series.length > 0 ? series[series.length - 1].value : undefined;

    if (series.length === 0 || latestValue === undefined) {
        return (
            <div style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <span style={titleStyle}>{label}</span>
                    <span style={{ fontSize: '13px', color: `rgb(${color})`, fontWeight: 800 }}>
                        {formatLatestValue(latestValue, multiplier, unit)}
                    </span>
                </div>
                <div style={emptyBodyStyle}>等待训练数据...</div>
            </div>
        );
    }

    const isPercent = unit === '%' || multiplier === 100;
    const rawValues = series.map((item) => item.value * multiplier);
    const domain = computeDomain(rawValues, isPercent);
    const rawPoints = buildPolylinePoints(rawValues, domain);
    const smoothValues = series.length >= 3 ? buildEmaSeries(rawValues) : rawValues;
    const smoothPoints = buildPolylinePoints(smoothValues, domain);
    const rawPolyline = rawPoints.map((point) => `${point.x},${point.y}`).join(' ');
    const smoothPolyline = smoothPoints.map((point) => `${point.x},${point.y}`).join(' ');
    const latestText = formatLatestValue(latestValue, multiplier, unit);
    const chartBaselineY = CHART_HEIGHT - CHART_PADDING_Y;

    return (
        <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <span style={titleStyle}>{label}</span>
                <span style={{ fontSize: '13px', color: `rgb(${color})`, fontWeight: 800 }}>{latestText}</span>
            </div>
            <svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={`rgb(${color})`} stopOpacity="0.30" />
                        <stop offset="100%" stopColor={`rgb(${color})`} stopOpacity="0.03" />
                    </linearGradient>
                </defs>

                {series.length > 1 && (
                    <polygon
                        points={`${CHART_PADDING_X},${chartBaselineY} ${smoothPolyline} ${CHART_WIDTH - CHART_PADDING_X},${chartBaselineY}`}
                        fill={`url(#${gradientId})`}
                    />
                )}

                {series.length > 1 && (
                    <polyline
                        fill="none"
                        stroke={`rgba(${color},0.38)`}
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={rawPolyline}
                    />
                )}

                {series.length > 1 && (
                    <polyline
                        fill="none"
                        stroke={`rgb(${color})`}
                        strokeWidth="2.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={smoothPolyline}
                    />
                )}

                {series.length === 1 && (
                    <>
                        <line
                            x1={CHART_PADDING_X}
                            y1={smoothPoints[0].y}
                            x2={CHART_WIDTH - CHART_PADDING_X}
                            y2={smoothPoints[0].y}
                            stroke={`rgba(${color},0.35)`}
                            strokeWidth="1.4"
                        />
                        <circle cx={smoothPoints[0].x} cy={smoothPoints[0].y} r="3.4" fill={`rgb(${color})`} />
                    </>
                )}
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
    const id = useId();
    const gradientId = `lr-grad-${id}`;
    const lrData = Array.isArray(data)
        ? data
            .map((entry) => ({
                ...entry,
                learning_rate: toFiniteNumber(entry?.learning_rate)
            }))
            .filter((entry) => entry.learning_rate !== undefined)
        : [];

    if (lrData.length === 0) {
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
    const chartWidth = 250;
    const chartHeight = 66;
    const chartPadding = 10;
    const domain = computeDomain(values, false);
    const rawPoints = buildPolylinePoints(values, domain, chartWidth, chartHeight, chartPadding, chartPadding);
    const smoothValues = lrData.length >= 3 ? buildEmaSeries(values) : values;
    const smoothPoints = buildPolylinePoints(smoothValues, domain, chartWidth, chartHeight, chartPadding, chartPadding);
    const rawPolyline = rawPoints.map((point) => `${point.x},${point.y}`).join(' ');
    const smoothPolyline = smoothPoints.map((point) => `${point.x},${point.y}`).join(' ');
    const chartBaselineY = chartHeight - chartPadding;

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
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgba(168,85,247,0.35)" />
                        <stop offset="100%" stopColor="rgba(168,85,247,0.03)" />
                    </linearGradient>
                </defs>

                {lrData.length > 1 && (
                    <polygon
                        points={`${chartPadding},${chartBaselineY} ${smoothPolyline} ${chartWidth - chartPadding},${chartBaselineY}`}
                        fill={`url(#${gradientId})`}
                    />
                )}

                {lrData.length > 1 && (
                    <polyline
                        fill="none"
                        stroke="rgba(167,139,250,0.4)"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={rawPolyline}
                    />
                )}

                {lrData.length > 1 && (
                    <polyline
                        fill="none"
                        stroke="#a78bfa"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={smoothPolyline}
                    />
                )}

                {lrData.length === 1 && (
                    <>
                        <line
                            x1={chartPadding}
                            y1={smoothPoints[0].y}
                            x2={chartWidth - chartPadding}
                            y2={smoothPoints[0].y}
                            stroke="rgba(167,139,250,0.42)"
                            strokeWidth="1.4"
                        />
                        <circle cx={smoothPoints[0].x} cy={smoothPoints[0].y} r="3.2" fill="#a78bfa" />
                    </>
                )}
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
