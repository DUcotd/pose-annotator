import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { ProgressRing } from './CommonComponents';
import {
    LineChart,
    GPUMemoryGauge,
    PerformanceMetrics,
    LearningRateChart,
    KeypointRadarChart,
    VisualValidationPreview
} from './VizComponents';
import {
    buildMetricTimeline,
    getLatestMetricSnapshot,
    getLatestMetricByEvent
} from '../../utils/trainingMetrics';

const panelStyle = {
    background: 'linear-gradient(165deg, rgba(9,18,34,0.82), rgba(14,27,48,0.66))',
    border: '1px solid rgba(148,163,184,0.24)',
    borderRadius: '16px',
    padding: '0.9rem'
};

const valueOrDash = (value, formatter) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '--';
    return formatter ? formatter(value) : value;
};

const formatDuration = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '--';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
};

const hasValue = (value) => Number.isFinite(Number(value));

const buildSeriesFromTimeline = (timeline, key) =>
    timeline.filter((entry) => hasValue(entry[key]));

const AdvancedGroup = ({
    title,
    summary,
    open,
    onToggle,
    children
}) => (
    <div style={{ ...panelStyle, padding: '0.75rem 0.8rem' }}>
        <button
            type="button"
            onClick={onToggle}
            style={{
                width: '100%',
                border: '1px solid rgba(148,163,184,0.26)',
                background: 'rgba(15,23,42,0.5)',
                borderRadius: '11px',
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                cursor: 'pointer',
                color: '#dbe4f2'
            }}
        >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800 }}>
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {title}
            </span>
            <span style={{
                fontSize: '11px',
                color: '#9aaccc',
                border: '1px solid rgba(148,163,184,0.24)',
                borderRadius: '999px',
                padding: '2px 8px'
            }}>
                {summary}
            </span>
        </button>

        {open && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {children}
            </div>
        )}
    </div>
);

const KPI = ({ label, value, tone = '#dbe4f2', meta = null }) => (
    <div style={{
        border: '1px solid rgba(148,163,184,0.2)',
        borderRadius: '12px',
        background: 'rgba(15,23,42,0.55)',
        padding: '0.7rem 0.75rem'
    }}>
        <div style={{ fontSize: '11px', color: '#9aaccc', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: '18px', color: tone, fontWeight: 800, marginTop: '3px' }}>{value}</div>
        {meta && <div style={{ fontSize: '10px', color: '#7f90af', marginTop: '2px' }}>{meta}</div>}
    </div>
);

const MetricSection = ({ title, metrics, type }) => {
    const isPose = type === 'pose';
    const color = isPose ? '#c4b5fd' : '#86efac';
    const precision = isPose ? metrics.pose_precision : (metrics.box_precision ?? metrics.precision);
    const recall = isPose ? metrics.pose_recall : (metrics.box_recall ?? metrics.recall);
    const map50 = isPose ? metrics.pose_mAP50 : metrics.mAP50;
    const map5095 = isPose ? (metrics.pose_mAP50_95 ?? metrics['pose_mAP50-95']) : (metrics.mAP50_95 ?? metrics['mAP50-95']);

    return (
        <div style={panelStyle}>
            <div style={{ fontSize: '12px', color, fontWeight: 800, marginBottom: '0.65rem' }}>{title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '8px' }}>
                <KPI label="Precision" value={valueOrDash(precision, (v) => `${(v * 100).toFixed(1)}%`)} />
                <KPI label="Recall" value={valueOrDash(recall, (v) => `${(v * 100).toFixed(1)}%`)} />
                <KPI label="mAP@50" value={valueOrDash(map50, (v) => `${(v * 100).toFixed(1)}%`)} tone={color} />
                <KPI label="mAP@50-95" value={valueOrDash(map5095, (v) => `${(v * 100).toFixed(1)}%`)} />
            </div>
        </div>
    );
};

const LossSection = ({ metrics }) => {
    const losses = [
        { key: 'box_loss', label: 'Box', color: '#fca5a5' },
        { key: 'pose_loss', label: 'Pose', color: '#c4b5fd' },
        { key: 'kobj_loss', label: 'KObj', color: '#fde68a' },
        { key: 'cls_loss', label: 'Cls', color: '#93c5fd' },
        { key: 'dfl_loss', label: 'DFL', color: '#86efac' }
    ];

    return (
        <div style={panelStyle}>
            <div style={{ fontSize: '12px', color: '#fcd34d', fontWeight: 800, marginBottom: '0.65rem' }}>Loss 指标</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '8px' }}>
                {losses.map((item) => (
                    <KPI
                        key={item.key}
                        label={item.label}
                        value={valueOrDash(metrics[item.key], (v) => v.toFixed(4))}
                        tone={item.color}
                    />
                ))}
            </div>
        </div>
    );
};

export const TrainingDashboard = ({ metrics = [], status }) => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [advancedGroups, setAdvancedGroups] = useState({
        runtime: true,
        quality: false,
        loss: false,
        validation: false,
        matrix: false
    });

    const timeline = useMemo(() => buildMetricTimeline(metrics), [metrics]);
    const latest = useMemo(() => getLatestMetricSnapshot(metrics), [metrics]);
    const progress = (Number.isFinite(latest.epoch) && Number.isFinite(latest.totalEpochs) && latest.totalEpochs > 0)
        ? (latest.epoch / latest.totalEpochs) * 100
        : 0;
    const hasMetrics = timeline.length > 0 || metrics.length > 0;
    const performanceData = useMemo(() => getLatestMetricByEvent(metrics, 'performance_benchmark'), [metrics]);
    const keypointData = useMemo(() => getLatestMetricByEvent(metrics, 'per_keypoint_metrics'), [metrics]);
    const visualValidationData = useMemo(() => getLatestMetricByEvent(metrics, 'visual_validation'), [metrics]);

    const boxLossSeries = useMemo(() => buildSeriesFromTimeline(timeline, 'box_loss'), [timeline]);
    const poseLossSeries = useMemo(() => buildSeriesFromTimeline(timeline, 'pose_loss'), [timeline]);
    const map50Series = useMemo(() => buildSeriesFromTimeline(timeline, 'mAP50'), [timeline]);
    const poseMap50Series = useMemo(() => buildSeriesFromTimeline(timeline, 'pose_mAP50'), [timeline]);
    const map5095Series = useMemo(() => buildSeriesFromTimeline(timeline, 'mAP50_95'), [timeline]);
    const poseMap5095Series = useMemo(() => buildSeriesFromTimeline(timeline, 'pose_mAP50_95'), [timeline]);
    const boxPrecisionSeries = useMemo(() => buildSeriesFromTimeline(timeline, 'box_precision'), [timeline]);
    const boxRecallSeries = useMemo(() => buildSeriesFromTimeline(timeline, 'box_recall'), [timeline]);
    const posePrecisionSeries = useMemo(() => buildSeriesFromTimeline(timeline, 'pose_precision'), [timeline]);
    const poseRecallSeries = useMemo(() => buildSeriesFromTimeline(timeline, 'pose_recall'), [timeline]);
    const lrSeries = useMemo(() => buildSeriesFromTimeline(timeline, 'learning_rate'), [timeline]);
    const clsLossSeries = useMemo(() => buildSeriesFromTimeline(timeline, 'cls_loss'), [timeline]);
    const dflLossSeries = useMemo(() => buildSeriesFromTimeline(timeline, 'dfl_loss'), [timeline]);
    const kobjLossSeries = useMemo(() => buildSeriesFromTimeline(timeline, 'kobj_loss'), [timeline]);
    const valBoxLossSeries = useMemo(() => buildSeriesFromTimeline(timeline, 'val_box_loss'), [timeline]);
    const valPoseLossSeries = useMemo(() => buildSeriesFromTimeline(timeline, 'val_pose_loss'), [timeline]);
    const valKobjLossSeries = useMemo(() => buildSeriesFromTimeline(timeline, 'val_kobj_loss'), [timeline]);
    const valClsLossSeries = useMemo(() => buildSeriesFromTimeline(timeline, 'val_cls_loss'), [timeline]);
    const valDflLossSeries = useMemo(() => buildSeriesFromTimeline(timeline, 'val_dfl_loss'), [timeline]);

    const gpuTelemetryAvailable =
        (Number(latest.gpu_memory_total_gb ?? 0) > 0) ||
        (Number(latest.gpu_memory_used_gb ?? 0) > 0) ||
        (Number(latest.gpu_memory_percent ?? 0) > 0) ||
        (Number(latest.gpu_utilization_percent ?? 0) > 0) ||
        (Number(latest.gpu_temperature ?? 0) > 0);
    const gpuMemText = gpuTelemetryAvailable
        ? `${Number(latest.gpu_memory_used_gb ?? 0).toFixed(2)} / ${Number(latest.gpu_memory_total_gb ?? 0).toFixed(1)} GB`
        : '-- / -- GB';
    const gpuMemMetaText = gpuTelemetryAvailable
        ? valueOrDash(latest.gpu_memory_percent, (v) => `${v.toFixed(1)}%`)
        : '等待 GPU 遥测';
    const gpuUtilText = gpuTelemetryAvailable
        ? valueOrDash(latest.gpu_utilization_percent, (v) => `${v.toFixed(0)}%`)
        : '--';
    const gpuTempMetaText = gpuTelemetryAvailable
        ? valueOrDash(latest.gpu_temperature, (v) => `${v}°C`)
        : '--';

    const hasPerformanceData = Boolean(
        performanceData?.latency ||
        performanceData?.realtime_fps ||
        performanceData?.meets_realtime_requirement !== undefined
    );
    const hasKeypointData = Array.isArray(keypointData?.keypoints) && keypointData.keypoints.length > 0;
    const hasVisualData = Array.isArray(visualValidationData?.samples) && visualValidationData.samples.length > 0;
    const runtimeSignalCount = [
        hasPerformanceData,
        gpuTelemetryAvailable,
        lrSeries.length > 0
    ].filter(Boolean).length;
    const qualitySignalCount = [
        boxPrecisionSeries.length > 0 || boxRecallSeries.length > 0,
        posePrecisionSeries.length > 0 || poseRecallSeries.length > 0,
        hasKeypointData
    ].filter(Boolean).length;
    const lossSignalCount = [
        boxLossSeries.length > 0 || poseLossSeries.length > 0,
        clsLossSeries.length > 0 || dflLossSeries.length > 0 || kobjLossSeries.length > 0
    ].filter(Boolean).length;
    const validationSignalCount = [
        hasVisualData,
        hasKeypointData
    ].filter(Boolean).length;
    const matrixSignalCount = [
        boxLossSeries.length > 0 || poseLossSeries.length > 0 || kobjLossSeries.length > 0 || clsLossSeries.length > 0 || dflLossSeries.length > 0,
        valBoxLossSeries.length > 0 || valPoseLossSeries.length > 0 || valKobjLossSeries.length > 0 || valClsLossSeries.length > 0 || valDflLossSeries.length > 0,
        boxPrecisionSeries.length > 0 || boxRecallSeries.length > 0 || map50Series.length > 0 || map5095Series.length > 0,
        posePrecisionSeries.length > 0 || poseRecallSeries.length > 0 || poseMap50Series.length > 0 || poseMap5095Series.length > 0,
        lrSeries.length > 0
    ].filter(Boolean).length;
    const availableAdvancedCount = [
        runtimeSignalCount > 0,
        qualitySignalCount > 0,
        lossSignalCount > 0,
        validationSignalCount > 0,
        matrixSignalCount > 0
    ].filter(Boolean).length;

    const statusText = status === 'running'
        ? '训练实时更新中'
        : status === 'starting'
            ? '训练准备中'
            : status === 'failed'
                ? '训练失败，请查看日志诊断'
                : status === 'completed'
                    ? '训练已完成'
                    : '等待训练开始';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
            <div style={{
                ...panelStyle,
                padding: '1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '0.85rem',
                alignItems: 'stretch'
            }}>
                <div style={{
                    borderRadius: '14px',
                    border: '1px solid rgba(148,163,184,0.26)',
                    background: 'linear-gradient(145deg, rgba(6,16,30,0.8), rgba(10,23,43,0.68))',
                    padding: '0.9rem',
                    display: 'flex',
                    gap: '0.9rem',
                    alignItems: 'center'
                }}>
                    <ProgressRing progress={progress} size={88} strokeWidth={8} />
                    <div>
                        <div style={{ fontSize: '11px', color: '#8da0bf', fontWeight: 700, letterSpacing: '0.4px' }}>训练进度</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#e7edf8', lineHeight: 1.1 }}>
                            {latest.epoch || 0}
                            <span style={{ color: '#8da0bf', fontSize: '0.95rem' }}> / {latest.totalEpochs || '--'}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#9aaccc', marginTop: '4px' }}>{statusText}</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                    <KPI label="GPU 显存" value={gpuMemText} tone="#fde68a" meta={gpuMemMetaText} />
                    <KPI label="GPU 利用率" value={gpuUtilText} tone="#93c5fd" meta={gpuTempMetaText} />
                    <KPI label="Box mAP@50" value={valueOrDash(latest.mAP50, (v) => `${(v * 100).toFixed(1)}%`)} tone="#86efac" />
                    <KPI label="Pose mAP@50" value={valueOrDash(latest.pose_mAP50, (v) => `${(v * 100).toFixed(1)}%`)} tone="#c4b5fd" />
                    <KPI label="学习率" value={valueOrDash(latest.learning_rate, (v) => v.toExponential(2))} tone="#a5b4fc" />
                    <KPI label="剩余时间 ETA" value={valueOrDash(latest.eta_seconds, (v) => formatDuration(v))} tone="#67e8f9" />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                <MetricSection title="Box 检测指标" metrics={latest} type="box" />
                <MetricSection title="Pose 关键点指标" metrics={latest} type="pose" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                <LineChart data={boxLossSeries} dataKey="box_loss" color="255,123,114" label="Box Loss" />
                <LineChart data={poseLossSeries} dataKey="pose_loss" color="168,85,247" label="Pose Loss" />
                <LineChart data={map50Series} dataKey="mAP50" color="34,197,94" label="Box mAP@50" unit="%" multiplier={100} />
                <LineChart data={poseMap50Series} dataKey="pose_mAP50" color="168,85,247" label="Pose mAP@50" unit="%" multiplier={100} />
                <LineChart data={map5095Series} dataKey="mAP50_95" color="59,130,246" label="Box mAP@50-95" unit="%" multiplier={100} />
                <LineChart data={poseMap5095Series} dataKey="pose_mAP50_95" color="45,212,191" label="Pose mAP@50-95" unit="%" multiplier={100} />
            </div>

            <div style={{
                ...panelStyle,
                padding: '0.75rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.8rem',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    <div style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '9px',
                        border: '1px solid rgba(148,163,184,0.32)',
                        background: 'linear-gradient(145deg, rgba(59,130,246,0.2), rgba(2,6,23,0.4))',
                        color: '#93c5fd',
                        display: 'grid',
                        placeItems: 'center'
                    }}>
                        <SlidersHorizontal size={15} />
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#dbe4f2' }}>高级指标</div>
                        <div style={{ fontSize: '11px', color: '#8da0bf' }}>
                            {availableAdvancedCount > 0
                                ? `已识别 ${availableAdvancedCount} 组高级指标（可按需展开）`
                                : '训练过程中将自动补齐高级指标'}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => setShowAdvanced((prev) => !prev)}
                        style={{
                            border: '1px solid rgba(148,163,184,0.3)',
                            background: showAdvanced
                                ? 'linear-gradient(135deg, rgba(20,184,166,0.26), rgba(6,182,212,0.18))'
                                : 'rgba(15,23,42,0.58)',
                            color: showAdvanced ? '#99f6e4' : '#dbe4f2',
                            borderRadius: '999px',
                            padding: '8px 12px',
                            fontSize: '12px',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            cursor: 'pointer'
                        }}
                    >
                        {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {showAdvanced ? '收起高级指标' : '展开高级指标'}
                    </button>
                    {showAdvanced && (
                        <>
                            <button
                                type="button"
                                onClick={() => setAdvancedGroups({
                                    runtime: true,
                                    quality: true,
                                    loss: true,
                                    validation: true,
                                    matrix: true
                                })}
                                style={{
                                    border: '1px solid rgba(148,163,184,0.26)',
                                    background: 'rgba(15,23,42,0.5)',
                                    color: '#b6c2d9',
                                    borderRadius: '999px',
                                    padding: '8px 10px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                展开全部分组
                            </button>
                            <button
                                type="button"
                                onClick={() => setAdvancedGroups({
                                    runtime: false,
                                    quality: false,
                                    loss: false,
                                    validation: false,
                                    matrix: false
                                })}
                                style={{
                                    border: '1px solid rgba(148,163,184,0.26)',
                                    background: 'rgba(15,23,42,0.5)',
                                    color: '#9aaccc',
                                    borderRadius: '999px',
                                    padding: '8px 10px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                收起全部分组
                            </button>
                        </>
                    )}
                </div>
            </div>

            {showAdvanced && (
                <>
                    <AdvancedGroup
                        title="资源与性能"
                        summary={runtimeSignalCount > 0 ? `${runtimeSignalCount} 项有数据` : '等待数据'}
                        open={advancedGroups.runtime}
                        onToggle={() => setAdvancedGroups((prev) => ({ ...prev, runtime: !prev.runtime }))}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                            <GPUMemoryGauge
                                usedGB={latest.gpu_memory_used_gb}
                                totalGB={latest.gpu_memory_total_gb}
                                percent={latest.gpu_memory_percent || 0}
                                temperature={latest.gpu_temperature}
                                utilization={latest.gpu_utilization_percent}
                                unavailable={!gpuTelemetryAvailable}
                            />
                            <PerformanceMetrics
                                latency={performanceData?.latency}
                                fps={performanceData?.realtime_fps}
                                meetsRealtime={performanceData?.meets_realtime_requirement}
                            />
                            <LearningRateChart data={lrSeries} />
                        </div>
                    </AdvancedGroup>

                    <AdvancedGroup
                        title="精度与召回"
                        summary={qualitySignalCount > 0 ? `${qualitySignalCount} 项有数据` : '等待数据'}
                        open={advancedGroups.quality}
                        onToggle={() => setAdvancedGroups((prev) => ({ ...prev, quality: !prev.quality }))}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                            <LineChart data={boxPrecisionSeries} dataKey="box_precision" color="56,189,248" label="Box Precision" unit="%" multiplier={100} />
                            <LineChart data={boxRecallSeries} dataKey="box_recall" color="74,222,128" label="Box Recall" unit="%" multiplier={100} />
                            <LineChart data={posePrecisionSeries} dataKey="pose_precision" color="167,139,250" label="Pose Precision" unit="%" multiplier={100} />
                            <LineChart data={poseRecallSeries} dataKey="pose_recall" color="192,132,252" label="Pose Recall" unit="%" multiplier={100} />
                        </div>
                        <KeypointRadarChart keypoints={keypointData?.keypoints} />
                    </AdvancedGroup>

                    <AdvancedGroup
                        title="损失与优化"
                        summary={lossSignalCount > 0 ? `${lossSignalCount} 项有数据` : '等待数据'}
                        open={advancedGroups.loss}
                        onToggle={() => setAdvancedGroups((prev) => ({ ...prev, loss: !prev.loss }))}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                            <LineChart data={kobjLossSeries} dataKey="kobj_loss" color="250,204,21" label="KObj Loss" />
                            <LineChart data={clsLossSeries} dataKey="cls_loss" color="96,165,250" label="Cls Loss" />
                            <LineChart data={dflLossSeries} dataKey="dfl_loss" color="74,222,128" label="DFL Loss" />
                            <LineChart data={lrSeries} dataKey="learning_rate" color="129,140,248" label="Learning Rate" />
                        </div>
                        <LossSection metrics={latest} />
                    </AdvancedGroup>

                    <AdvancedGroup
                        title="完整结果矩阵"
                        summary={matrixSignalCount > 0 ? `${matrixSignalCount} 组有数据` : '等待数据'}
                        open={advancedGroups.matrix}
                        onToggle={() => setAdvancedGroups((prev) => ({ ...prev, matrix: !prev.matrix }))}
                    >
                        <div style={{ fontSize: '12px', color: '#9aaccc', fontWeight: 700 }}>Train Loss</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                            <LineChart data={boxLossSeries} dataKey="box_loss" color="255,123,114" label="Train Box Loss" />
                            <LineChart data={poseLossSeries} dataKey="pose_loss" color="168,85,247" label="Train Pose Loss" />
                            <LineChart data={kobjLossSeries} dataKey="kobj_loss" color="250,204,21" label="Train KObj Loss" />
                            <LineChart data={clsLossSeries} dataKey="cls_loss" color="96,165,250" label="Train Cls Loss" />
                            <LineChart data={dflLossSeries} dataKey="dfl_loss" color="74,222,128" label="Train DFL Loss" />
                        </div>

                        <div style={{ fontSize: '12px', color: '#9aaccc', fontWeight: 700 }}>Val Loss</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                            <LineChart data={valBoxLossSeries} dataKey="val_box_loss" color="253,164,175" label="Val Box Loss" />
                            <LineChart data={valPoseLossSeries} dataKey="val_pose_loss" color="196,181,253" label="Val Pose Loss" />
                            <LineChart data={valKobjLossSeries} dataKey="val_kobj_loss" color="254,240,138" label="Val KObj Loss" />
                            <LineChart data={valClsLossSeries} dataKey="val_cls_loss" color="147,197,253" label="Val Cls Loss" />
                            <LineChart data={valDflLossSeries} dataKey="val_dfl_loss" color="134,239,172" label="Val DFL Loss" />
                        </div>

                        <div style={{ fontSize: '12px', color: '#9aaccc', fontWeight: 700 }}>Box Metrics</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                            <LineChart data={boxPrecisionSeries} dataKey="box_precision" color="56,189,248" label="Box Precision" unit="%" multiplier={100} />
                            <LineChart data={boxRecallSeries} dataKey="box_recall" color="74,222,128" label="Box Recall" unit="%" multiplier={100} />
                            <LineChart data={map50Series} dataKey="mAP50" color="34,197,94" label="Box mAP@50" unit="%" multiplier={100} />
                            <LineChart data={map5095Series} dataKey="mAP50_95" color="59,130,246" label="Box mAP@50-95" unit="%" multiplier={100} />
                        </div>

                        <div style={{ fontSize: '12px', color: '#9aaccc', fontWeight: 700 }}>Pose Metrics</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                            <LineChart data={posePrecisionSeries} dataKey="pose_precision" color="167,139,250" label="Pose Precision" unit="%" multiplier={100} />
                            <LineChart data={poseRecallSeries} dataKey="pose_recall" color="192,132,252" label="Pose Recall" unit="%" multiplier={100} />
                            <LineChart data={poseMap50Series} dataKey="pose_mAP50" color="168,85,247" label="Pose mAP@50" unit="%" multiplier={100} />
                            <LineChart data={poseMap5095Series} dataKey="pose_mAP50_95" color="45,212,191" label="Pose mAP@50-95" unit="%" multiplier={100} />
                        </div>

                        <div style={{ fontSize: '12px', color: '#9aaccc', fontWeight: 700 }}>Learning Rate</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                            <LineChart data={lrSeries} dataKey="learning_rate" color="129,140,248" label="Learning Rate" />
                        </div>
                    </AdvancedGroup>

                    <AdvancedGroup
                        title="验证与可视化"
                        summary={validationSignalCount > 0 ? `${validationSignalCount} 项有数据` : '等待数据'}
                        open={advancedGroups.validation}
                        onToggle={() => setAdvancedGroups((prev) => ({ ...prev, validation: !prev.validation }))}
                    >
                        <VisualValidationPreview
                            samples={visualValidationData?.samples}
                            outputDir={visualValidationData?.output_dir}
                        />
                    </AdvancedGroup>
                </>
            )}

            {!hasMetrics && (
                <div style={{
                    ...panelStyle,
                    textAlign: 'center',
                    color: '#8da0bf',
                    fontSize: '13px',
                    padding: '1.1rem'
                }}>
                    尚未收到训练指标，启动训练后此区域将实时刷新。
                </div>
            )}

            {Array.isArray(latest.gpu_warnings) && latest.gpu_warnings.length > 0 && (
                <div style={{
                    borderRadius: '12px',
                    border: '1px solid rgba(248,113,113,0.28)',
                    background: 'linear-gradient(145deg, rgba(64,18,18,0.44), rgba(15,23,42,0.56))',
                    padding: '0.75rem 0.9rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px'
                }}>
                    <AlertTriangle size={15} style={{ color: '#fca5a5', marginTop: '2px' }} />
                    <div style={{ fontSize: '12px', color: '#fecaca', lineHeight: 1.5 }}>
                        <strong style={{ color: '#fca5a5' }}>GPU 警告：</strong>{latest.gpu_warnings.join('；')}
                    </div>
                </div>
            )}
        </div>
    );
};
