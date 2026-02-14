import React from 'react';
import { Zap, Gauge } from 'lucide-react';
import { ProgressRing } from './CommonComponents';
import { LineChart } from './VizComponents';

export const TrainingDashboard = ({ metrics, status }) => {
    if (metrics.length === 0 && status !== 'running') return null;

    const latest = metrics[metrics.length - 1] || {};
    const progress = (latest.epoch && latest.totalEpochs) ? (latest.epoch / latest.totalEpochs) * 100 : 0;
    const mapVal = latest.mAP50 !== undefined ? (latest.mAP50 * 100).toFixed(1) : '--';

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            marginBottom: '1.5rem'
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
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '14px',
                    padding: '1rem 1.25rem',
                    border: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Zap size={16} style={{ color: 'rgb(251,191,36)' }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>GPU 显存</span>
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{latest.gpu_mem || '--'}</span>
                </div>
                <div style={{
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '14px',
                    padding: '1rem 1.25rem',
                    border: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Gauge size={16} style={{ color: 'rgb(34,197,94)' }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>mAP@50</span>
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'rgb(34,197,94)' }}>{mapVal}{mapVal !== '--' ? '%' : ''}</span>
                </div>
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <LineChart data={metrics} dataKey="box_loss" color="255,123,114" label="Box Loss" />
                <LineChart data={metrics} dataKey="mAP50" color="121,192,255" label="mAP@50" unit="%" />
            </div>
        </div>
    );
};
