import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Cpu, Settings, FileText, Server, TrendingUp, Target } from 'lucide-react';
import { SectionCard, Toggle } from './CommonComponents';

const modelOptions = [
    { value: 'yolov8n-pose.pt', label: 'YOLOv8n-pose (Nano)', meta: '6.5MB · 最快' },
    { value: 'yolov8s-pose.pt', label: 'YOLOv8s-pose (Small)', meta: '23MB · 快速均衡' },
    { value: 'yolov8m-pose.pt', label: 'YOLOv8m-pose (Medium)', meta: '52MB · 精度优先' },
    { value: 'yolov8l-pose.pt', label: 'YOLOv8l-pose (Large)', meta: '88MB · 高精度' },
    { value: 'yolov8x-pose.pt', label: 'YOLOv8x-pose (XL)', meta: '131MB · 最高精度' }
];

const optimizerOptions = [
    { value: 'auto', label: 'Auto (自动)' },
    { value: 'SGD', label: 'SGD' },
    { value: 'Adam', label: 'Adam' },
    { value: 'AdamW', label: 'AdamW' }
];

const deviceOptions = [
    { value: '0', label: 'GPU 0 (默认显卡)' },
    { value: '1', label: 'GPU 1 (第二张显卡)' },
    { value: 'cpu', label: 'CPU (无显卡模式)' }
];

const STACK_STYLE = { display: 'flex', flexDirection: 'column', gap: '0.9rem' };
const FIELD_STYLE = { display: 'flex', flexDirection: 'column', gap: '6px' };
const FIELD_LABEL_STYLE = { fontSize: '12px', fontWeight: 700, color: '#b6c2d9', letterSpacing: '0.2px' };
const CONTROL_STYLE = { height: '42px', padding: '0 12px' };

const parseIntOr = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const parseFloatOr = (value, fallback) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const TextInput = ({ className = '', ...props }) => (
    <input
        {...props}
        className={`tw-control remote-input ${className}`.trim()}
        style={{ ...CONTROL_STYLE, ...(props.style || {}) }}
    />
);

const SliderField = ({ label, value, min, max, step, onChange, disabled }) => (
    <div style={FIELD_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#b6c2d9', fontWeight: 700 }}>{label}</span>
            <span style={{ fontSize: '12px', color: '#5eead4', fontWeight: 700 }}>{value}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(parseFloatOr(e.target.value, value))}
            style={{ width: '100%', accentColor: '#14b8a6', cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
    </div>
);

const PortalSelect = ({
    value,
    options,
    onChange,
    disabled = false,
    placeholder = '请选择',
    renderValue = null,
    renderOption = null,
    portalId
}) => {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef(null);

    const selectedOption = useMemo(
        () => options.find((option) => option.value === value),
        [options, value]
    );

    useEffect(() => {
        const onDocumentClick = (event) => {
            if (!open) return;
            const dropdownEl = document.getElementById(portalId);
            const triggerEl = triggerRef.current;
            const target = event.target;

            if (triggerEl && triggerEl.contains(target)) return;
            if (dropdownEl && dropdownEl.contains(target)) return;
            setOpen(false);
        };

        document.addEventListener('mousedown', onDocumentClick);
        return () => document.removeEventListener('mousedown', onDocumentClick);
    }, [open, portalId]);

    const toggleDropdown = () => {
        if (disabled) return;
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;

        setPosition({
            top: rect.bottom + 8,
            left: rect.left,
            width: rect.width
        });
        setOpen((prev) => !prev);
    };

    return (
        <div style={{ position: 'relative' }}>
            <button
                ref={triggerRef}
                type="button"
                onClick={toggleDropdown}
                disabled={disabled}
                className="tw-control"
                style={{
                    ...CONTROL_STYLE,
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'left',
                    cursor: disabled ? 'not-allowed' : 'pointer'
                }}
            >
                <span style={{ display: 'block', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    {renderValue ? renderValue(selectedOption) : (
                        <span style={{ fontSize: '13px', color: selectedOption ? '#e7edf8' : '#7f90af' }}>
                            {selectedOption?.label || placeholder}
                        </span>
                    )}
                </span>
                <span style={{ marginLeft: '10px', color: '#9aaccc', fontSize: '11px' }}>
                    {open ? '▲' : '▼'}
                </span>
            </button>

            {open && createPortal(
                <div
                    id={portalId}
                    className="custom-scrollbar"
                    style={{
                        position: 'fixed',
                        top: position.top,
                        left: position.left,
                        width: position.width,
                        maxHeight: '300px',
                        overflowY: 'auto',
                        background: 'linear-gradient(165deg, rgba(8,16,30,0.96), rgba(13,25,46,0.95))',
                        border: '1px solid rgba(148,163,184,0.32)',
                        borderRadius: '12px',
                        boxShadow: '0 18px 36px rgba(2,6,23,0.52)',
                        zIndex: 9999
                    }}
                >
                    {options.map((option) => {
                        const isSelected = option.value === value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setOpen(false);
                                }}
                                style={{
                                    width: '100%',
                                    border: 'none',
                                    borderBottom: '1px solid rgba(148,163,184,0.16)',
                                    background: isSelected ? 'rgba(20,184,166,0.16)' : 'transparent',
                                    color: isSelected ? '#99f6e4' : '#d7e0f0',
                                    padding: '10px 12px',
                                    textAlign: 'left',
                                    cursor: 'pointer'
                                }}
                            >
                                {renderOption ? renderOption(option, isSelected) : option.label}
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
};

export const TrainingForm = ({ config, updateConfig, status, onBrowseData, envInfo }) => {
    const isRunning = status === 'running' || status === 'starting';

    return (
        <SectionCard
            icon={Cpu}
            title="基础配置"
            color="45,212,191"
            gradient="linear-gradient(145deg, rgba(45,212,191,0.18), rgba(6,182,212,0.08))"
        >
            <div style={STACK_STYLE}>
                <div style={FIELD_STYLE}>
                    <label style={FIELD_LABEL_STYLE}>预训练模型</label>
                    <PortalSelect
                        value={config.model}
                        options={modelOptions}
                        disabled={isRunning}
                        onChange={(value) => updateConfig({ model: value })}
                        portalId="model-select-portal"
                        renderValue={(selected) => (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '13px', color: '#e7edf8', fontWeight: 700 }}>
                                    {selected?.label || '请选择模型'}
                                </span>
                                <span style={{ fontSize: '11px', color: '#8da0bf' }}>
                                    {selected?.meta || ''}
                                </span>
                            </div>
                        )}
                        renderOption={(option, selected) => (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: selected ? '#99f6e4' : '#dbe4f2' }}>
                                    {option.label}
                                </span>
                                <span style={{ fontSize: '11px', color: '#8da0bf' }}>{option.meta}</span>
                            </div>
                        )}
                    />
                </div>

                <div className="tw-grid-2">
                    <div style={FIELD_STYLE}>
                        <label style={FIELD_LABEL_STYLE}>训练轮次 (Epochs)</label>
                        <TextInput
                            type="number"
                            value={config.epochs}
                            disabled={isRunning}
                            onChange={(e) => updateConfig({ epochs: parseIntOr(e.target.value, config.epochs) })}
                        />
                    </div>
                    <div style={FIELD_STYLE}>
                        <label style={FIELD_LABEL_STYLE}>批次大小 (Batch)</label>
                        <TextInput
                            type="number"
                            value={config.batch}
                            disabled={isRunning}
                            onChange={(e) => updateConfig({ batch: parseIntOr(e.target.value, config.batch) })}
                        />
                    </div>
                </div>

                <div className="tw-grid-2">
                    <div style={FIELD_STYLE}>
                        <label style={FIELD_LABEL_STYLE}>图片尺寸 (Imgsz)</label>
                        <TextInput
                            type="number"
                            value={config.imgsz}
                            disabled={isRunning}
                            onChange={(e) => updateConfig({ imgsz: parseIntOr(e.target.value, config.imgsz) })}
                        />
                    </div>
                    <div style={FIELD_STYLE}>
                        <label style={FIELD_LABEL_STYLE}>实验名称</label>
                        <TextInput
                            type="text"
                            value={config.name}
                            disabled={isRunning}
                            onChange={(e) => updateConfig({ name: e.target.value })}
                        />
                        <div style={{ fontSize: '11px', color: '#7f90af', lineHeight: 1.4 }}>
                            默认建议 <code style={{ color: '#99f6e4', fontFamily: 'Consolas, Monaco, monospace' }}>exp_auto</code>；
                            历史同名会自动递增为 <code style={{ color: '#99f6e4', fontFamily: 'Consolas, Monaco, monospace' }}>exp_auto_1 / exp_auto_2</code>。
                        </div>
                    </div>
                </div>

                <div style={FIELD_STYLE}>
                    <label style={FIELD_LABEL_STYLE}>数据集配置 (data.yaml)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                        <TextInput
                            type="text"
                            readOnly
                            value={config.data}
                            placeholder="默认使用项目导出路径"
                            style={{ opacity: 0.78 }}
                        />
                        <button
                            type="button"
                            className="tw-inline-icon-btn"
                            onClick={onBrowseData}
                            disabled={isRunning}
                        >
                            <FileText size={16} />
                        </button>
                    </div>
                </div>

                {envInfo && (
                    <div style={{
                        borderRadius: '12px',
                        border: `1px solid ${envInfo.available ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
                        background: envInfo.available
                            ? 'linear-gradient(145deg, rgba(12,36,31,0.56), rgba(15,23,42,0.54))'
                            : 'linear-gradient(145deg, rgba(48,20,20,0.42), rgba(15,23,42,0.54))',
                        padding: '0.75rem',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center'
                    }}>
                        <div style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            display: 'grid',
                            placeItems: 'center',
                            color: envInfo.available ? '#4ade80' : '#fca5a5',
                            background: envInfo.available ? 'rgba(74,222,128,0.14)' : 'rgba(248,113,113,0.14)'
                        }}>
                            <Settings size={15} className={isRunning ? 'spin' : ''} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', color: '#d9e3f5', fontWeight: 700 }}>
                                Python 环境 {envInfo.cuda ? '· GPU' : '· CPU'}
                            </div>
                            <div style={{
                                fontSize: '11px',
                                color: '#8da0bf',
                                marginTop: '2px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {envInfo.available ? `${envInfo.version} · ${envInfo.message}` : '未配置 Python 环境'}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </SectionCard>
    );
};

export const HardwareForm = ({ config, updateConfig, status }) => {
    const isRunning = status === 'running' || status === 'starting';
    const isEnabled = config.hardwareEnabled !== false;

    return (
        <SectionCard
            icon={Server}
            title="硬件与性能"
            color="59,130,246"
            gradient="linear-gradient(145deg, rgba(59,130,246,0.18), rgba(14,116,144,0.08))"
            collapsible
            defaultCollapsed
            statusSummary={isEnabled ? `设备: ${config.device === 'cpu' ? 'CPU' : `GPU ${config.device}`}` : '已禁用'}
        >
            <Toggle
                checked={isEnabled}
                onChange={(e) => updateConfig({ hardwareEnabled: e.target.checked })}
                label="启用硬件配置"
                desc="设置训练设备、数据线程和缓存策略"
                disabled={isRunning}
            />

            <div style={{ ...STACK_STYLE, marginTop: '0.9rem', opacity: isEnabled ? 1 : 0.56 }}>
                <div className="tw-grid-2">
                    <div style={FIELD_STYLE}>
                        <label style={FIELD_LABEL_STYLE}>设备 (Device)</label>
                        <PortalSelect
                            value={config.device}
                            options={deviceOptions}
                            onChange={(value) => updateConfig({ device: value })}
                            disabled={isRunning || !isEnabled}
                            portalId="device-select-portal"
                        />
                    </div>
                    <div style={FIELD_STYLE}>
                        <label style={FIELD_LABEL_STYLE}>数据加载线程 (Workers)</label>
                        <TextInput
                            type="number"
                            value={config.workers}
                            disabled={isRunning || !isEnabled}
                            onChange={(e) => updateConfig({ workers: parseIntOr(e.target.value, config.workers) })}
                        />
                    </div>
                </div>

                <Toggle
                    checked={config.cache_images}
                    onChange={(e) => updateConfig({ cache_images: e.target.checked })}
                    label="缓存图片到内存"
                    desc="内存足够时建议开启，训练速度更稳定"
                    disabled={isRunning || !isEnabled}
                />
            </div>
        </SectionCard>
    );
};

export const StrategyForm = ({ config, updateConfig, status }) => {
    const isRunning = status === 'running' || status === 'starting';
    const isEnabled = config.strategyEnabled !== false;

    return (
        <SectionCard
            icon={TrendingUp}
            title="训练策略"
            color="251,146,60"
            gradient="linear-gradient(145deg, rgba(251,146,60,0.18), rgba(180,83,9,0.08))"
            collapsible
            defaultCollapsed
            statusSummary={isEnabled ? `优化器: ${config.optimizer?.toUpperCase?.() || config.optimizer}` : '已禁用'}
        >
            <Toggle
                checked={isEnabled}
                onChange={(e) => updateConfig({ strategyEnabled: e.target.checked })}
                label="启用训练策略"
                desc="控制优化器、早停、学习率策略与续训模式"
                disabled={isRunning}
            />

            <div style={{ ...STACK_STYLE, marginTop: '0.9rem', opacity: isEnabled ? 1 : 0.56 }}>
                <div className="tw-grid-2">
                    <div style={FIELD_STYLE}>
                        <label style={FIELD_LABEL_STYLE}>早停轮次 (Patience)</label>
                        <TextInput
                            type="number"
                            value={config.patience}
                            disabled={isRunning || !isEnabled}
                            onChange={(e) => updateConfig({ patience: parseIntOr(e.target.value, config.patience) })}
                        />
                    </div>
                    <div style={FIELD_STYLE}>
                        <label style={FIELD_LABEL_STYLE}>优化器</label>
                        <PortalSelect
                            value={config.optimizer}
                            options={optimizerOptions}
                            onChange={(value) => updateConfig({ optimizer: value })}
                            disabled={isRunning || !isEnabled}
                            portalId="optimizer-select-portal"
                        />
                    </div>
                </div>

                <div className="tw-grid-2">
                    <div style={FIELD_STYLE}>
                        <label style={FIELD_LABEL_STYLE}>关闭马赛克轮次</label>
                        <TextInput
                            type="number"
                            value={config.close_mosaic}
                            disabled={isRunning || !isEnabled}
                            onChange={(e) => updateConfig({ close_mosaic: parseIntOr(e.target.value, config.close_mosaic) })}
                        />
                    </div>
                </div>

                <Toggle
                    checked={config.cos_lr}
                    onChange={(e) => updateConfig({ cos_lr: e.target.checked })}
                    label="余弦退火学习率"
                    desc="后期收敛更平滑，通常提升最终指标"
                    disabled={isRunning || !isEnabled}
                />
                <Toggle
                    checked={config.rect}
                    onChange={(e) => updateConfig({ rect: e.target.checked })}
                    label="矩形训练"
                    desc="按比例加载图片，减少不必要填充"
                    disabled={isRunning || !isEnabled}
                />
                <Toggle
                    checked={config.resume}
                    onChange={(e) => updateConfig({ resume: e.target.checked })}
                    label="断点续训 (Resume)"
                    desc="从最近一次中断位置继续训练"
                    disabled={isRunning || !isEnabled}
                />
            </div>
        </SectionCard>
    );
};

export const LossForm = ({ config, updateConfig, status }) => {
    const isRunning = status === 'running' || status === 'starting';
    const isEnabled = config.lossEnabled !== false;

    return (
        <SectionCard
            icon={Target}
            title="损失函数权重"
            color="236,72,153"
            gradient="linear-gradient(145deg, rgba(236,72,153,0.18), rgba(190,24,93,0.08))"
            collapsible
            defaultCollapsed
            statusSummary={isEnabled ? `Pose: ${config.loss_pose}, Box: ${config.loss_box}` : '已禁用'}
        >
            <Toggle
                checked={isEnabled}
                onChange={(e) => updateConfig({ lossEnabled: e.target.checked })}
                label="启用损失权重配置"
                desc="用于平衡关键点、边框与类别学习强度"
                disabled={isRunning}
            />

            <div style={{ ...STACK_STYLE, marginTop: '0.9rem', opacity: isEnabled ? 1 : 0.56 }}>
                <div style={FIELD_STYLE}>
                    <label style={FIELD_LABEL_STYLE}>关键点损失权重 (Pose)</label>
                    <TextInput
                        type="number"
                        step="0.1"
                        value={config.loss_pose}
                        disabled={isRunning || !isEnabled}
                        onChange={(e) => updateConfig({ loss_pose: parseFloatOr(e.target.value, config.loss_pose) })}
                    />
                </div>

                <div className="tw-grid-2">
                    <div style={FIELD_STYLE}>
                        <label style={FIELD_LABEL_STYLE}>边框损失权重 (Box)</label>
                        <TextInput
                            type="number"
                            step="0.1"
                            value={config.loss_box}
                            disabled={isRunning || !isEnabled}
                            onChange={(e) => updateConfig({ loss_box: parseFloatOr(e.target.value, config.loss_box) })}
                        />
                    </div>
                    <div style={FIELD_STYLE}>
                        <label style={FIELD_LABEL_STYLE}>类别损失权重 (Cls)</label>
                        <TextInput
                            type="number"
                            step="0.1"
                            value={config.loss_cls}
                            disabled={isRunning || !isEnabled}
                            onChange={(e) => updateConfig({ loss_cls: parseFloatOr(e.target.value, config.loss_cls) })}
                        />
                    </div>
                </div>
            </div>
        </SectionCard>
    );
};

export const AugmentationForm = ({ config, updateConfig, status }) => {
    const isRunning = status === 'running' || status === 'starting';
    const augmentationDisabled = isRunning || !config.augmentationEnabled;

    return (
        <SectionCard
            icon={Settings}
            title="数据增强"
            color="74,222,128"
            gradient="linear-gradient(145deg, rgba(74,222,128,0.18), rgba(22,163,74,0.08))"
            collapsible
            defaultCollapsed
            statusSummary={config.augmentationEnabled ? '已启用' : '已禁用'}
        >
            <Toggle
                checked={config.augmentationEnabled}
                onChange={(e) => updateConfig({ augmentationEnabled: e.target.checked })}
                label="启用数据增强"
                desc="通过几何和颜色扰动提升泛化能力"
                disabled={isRunning}
            />

            <div style={{ ...STACK_STYLE, marginTop: '1rem', opacity: config.augmentationEnabled ? 1 : 0.56 }}>
                <SliderField
                    label="旋转角度 (degrees)"
                    value={config.degrees}
                    min={0}
                    max={180}
                    step={1}
                    disabled={augmentationDisabled}
                    onChange={(value) => updateConfig({ degrees: value })}
                />
                <SliderField
                    label="平移比例 (translate)"
                    value={config.translate}
                    min={0}
                    max={1}
                    step={0.05}
                    disabled={augmentationDisabled}
                    onChange={(value) => updateConfig({ translate: value })}
                />
                <SliderField
                    label="缩放比例 (scale)"
                    value={config.scale}
                    min={0}
                    max={1}
                    step={0.05}
                    disabled={augmentationDisabled}
                    onChange={(value) => updateConfig({ scale: value })}
                />
                <SliderField
                    label="左右翻转 (fliplr)"
                    value={config.fliplr}
                    min={0}
                    max={1}
                    step={0.05}
                    disabled={augmentationDisabled}
                    onChange={(value) => updateConfig({ fliplr: value })}
                />
                <SliderField
                    label="上下翻转 (flipud)"
                    value={config.flipud}
                    min={0}
                    max={1}
                    step={0.05}
                    disabled={augmentationDisabled}
                    onChange={(value) => updateConfig({ flipud: value })}
                />
                <SliderField
                    label="透视变换 (perspective)"
                    value={config.perspective}
                    min={0}
                    max={0.01}
                    step={0.0005}
                    disabled={augmentationDisabled}
                    onChange={(value) => updateConfig({ perspective: value })}
                />
                <SliderField
                    label="Mosaic 概率"
                    value={config.mosaic}
                    min={0}
                    max={1}
                    step={0.1}
                    disabled={augmentationDisabled}
                    onChange={(value) => updateConfig({ mosaic: value })}
                />
            </div>
        </SectionCard>
    );
};

export const RemoteForm = ({ config, updateConfig, status }) => {
    const isRunning = status === 'running' || status === 'starting';
    const isEnabled = config.remoteEnabled === true;

    return (
        <SectionCard
            icon={Server}
            title="远程训练配置"
            color="59,130,246"
            gradient="linear-gradient(145deg, rgba(59,130,246,0.18), rgba(37,99,235,0.08))"
            collapsible
            defaultCollapsed={!isEnabled}
            statusSummary={isEnabled ? `主机: ${config.remoteHost || '未配置'}` : '本地训练'}
        >
            <Toggle
                checked={isEnabled}
                onChange={(e) => updateConfig({ remoteEnabled: e.target.checked })}
                label="启用远程服务器训练"
                desc="将数据同步到远程主机后执行训练"
                disabled={isRunning}
            />

            <div style={{ ...STACK_STYLE, marginTop: '0.9rem', opacity: isEnabled ? 1 : 0.56 }}>
                <div className="tw-grid-host-port">
                    <div style={FIELD_STYLE}>
                        <label style={FIELD_LABEL_STYLE}>主机 (Host)</label>
                        <TextInput
                            type="text"
                            value={config.remoteHost}
                            placeholder="192.168.1.100"
                            disabled={isRunning || !isEnabled}
                            onChange={(e) => updateConfig({ remoteHost: e.target.value })}
                        />
                    </div>
                    <div style={FIELD_STYLE}>
                        <label style={FIELD_LABEL_STYLE}>端口</label>
                        <TextInput
                            type="number"
                            value={config.remotePort}
                            disabled={isRunning || !isEnabled}
                            onChange={(e) => updateConfig({ remotePort: parseIntOr(e.target.value, config.remotePort) })}
                        />
                    </div>
                </div>

                <div className="tw-grid-2">
                    <div style={FIELD_STYLE}>
                        <label style={FIELD_LABEL_STYLE}>用户名</label>
                        <TextInput
                            type="text"
                            value={config.remoteUser}
                            disabled={isRunning || !isEnabled}
                            onChange={(e) => updateConfig({ remoteUser: e.target.value })}
                        />
                    </div>
                    <div style={FIELD_STYLE}>
                        <label style={FIELD_LABEL_STYLE}>密码</label>
                        <TextInput
                            type="password"
                            value={config.remotePassword}
                            disabled={isRunning || !isEnabled}
                            onChange={(e) => updateConfig({ remotePassword: e.target.value })}
                        />
                    </div>
                </div>

                <div style={FIELD_STYLE}>
                    <label style={FIELD_LABEL_STYLE}>远程工作路径 (Remote Path)</label>
                    <TextInput
                        type="text"
                        value={config.remotePath}
                        placeholder="/home/user/training"
                        disabled={isRunning || !isEnabled}
                        onChange={(e) => updateConfig({ remotePath: e.target.value })}
                    />
                </div>

                <div style={FIELD_STYLE}>
                    <label style={FIELD_LABEL_STYLE}>Python 解释器路径</label>
                    <TextInput
                        type="text"
                        value={config.remotePython}
                        placeholder="python3"
                        disabled={isRunning || !isEnabled}
                        onChange={(e) => updateConfig({ remotePython: e.target.value })}
                    />
                </div>
            </div>
        </SectionCard>
    );
};
