import React from 'react';

const width = 280;
const height = 100;
const padding = 15;

export const LineChart = ({ data, dataKey, color, label, unit = "" }) => {
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
                        {latestValue !== undefined ? (dataKey === 'mAP50' ? (latestValue * 100).toFixed(1) : latestValue.toFixed(4)) : '--'}{unit}
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

    const values = data.map(d => d[dataKey] || 0);
    const minVal = Math.min(...values) * 0.9;
    const maxVal = Math.max(...values) * 1.1;
    const range = maxVal - minVal || 1;

    const points = data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - (((d[dataKey] || 0) - minVal) / range) * (height - 2 * padding);
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
                    {dataKey === 'mAP50' ? (latestValue * 100).toFixed(1) : latestValue.toFixed(4)}{unit}
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

export const LogViewer = ({ logs, logEndRef }) => {
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
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{logs.length} 行</span>
            </div>
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1rem',
                fontFamily: 'monospace',
                fontSize: '12px'
            }} className="custom-scrollbar">
                {logs.length === 0 && (
                    <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '2rem' }}>
                        等待日志输出...
                    </div>
                )}
                {logs.map((log, i) => (
                    <div key={i} style={{
                        color: log.type === 'stdout' ? 'var(--text-secondary)' :
                            log.type === 'stderr' ? '#f87171' :
                                log.type === 'system' ? '#60a5fa' : 'var(--text-secondary)',
                        marginBottom: '4px',
                        wordBreak: 'break-all'
                    }}>
                        <span style={{ color: 'var(--text-tertiary)', marginRight: '8px' }}>
                            [{new Date(log.time).toLocaleTimeString()}]
                        </span>
                        {log.msg}
                    </div>
                ))}
                <div ref={logEndRef} />
            </div>
        </div>
    );
};
