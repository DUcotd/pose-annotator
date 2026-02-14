import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Cpu, Settings, FolderOpen, FileText } from 'lucide-react';
import { SectionCard, Toggle } from './CommonComponents';

const modelOptions = [
    { id: 'yolov8n.pt', label: 'YOLOv8n (Nano) - 轻量快速', size: '6.2MB', speed: '最快' },
    { id: 'yolov8s.pt', label: 'YOLOv8s (Small) - 均衡', size: '22.5MB', speed: '快速' },
    { id: 'yolov8m.pt', label: 'YOLOv8m (Medium) - 精度', size: '52MB', speed: '中等' },
    { id: 'yolov8l.pt', label: 'YOLOv8l (Large) - 高精度', size: '87.7MB', speed: '较慢' },
    { id: 'yolov8x.pt', label: 'YOLOv8x (XLarge) - 顶级', size: '130MB', speed: '最慢' }
];

export const TrainingForm = ({ config, updateConfig, status, onBrowseData, envInfo }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const dropdownRef = useRef(null);
    const dropdownTriggerRef = useRef(null);

    const isRunning = status === 'running' || status === 'starting';

    // ... useEffect remains same ...
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownOpen && dropdownTriggerRef.current && !dropdownTriggerRef.current.contains(event.target)) {
                const dropdownEl = document.getElementById('model-dropdown-portal');
                if (dropdownEl && !dropdownEl.contains(event.target)) {
                    setDropdownOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

    const handleModelClick = () => {
        if (!isRunning) {
            if (!dropdownOpen && dropdownTriggerRef.current) {
                const rect = dropdownTriggerRef.current.getBoundingClientRect();
                setDropdownPosition({
                    top: rect.bottom + 8,
                    left: rect.left,
                    width: rect.width
                });
            }
            setDropdownOpen(!dropdownOpen);
        }
    };

    return (
        <>
            <SectionCard icon={Cpu} title="基础配置" color="99,102,241" gradient="linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.05))">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Model Dropdown */}
                    <div style={{ position: 'relative' }} ref={dropdownRef}>
                        <label style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '8px', display: 'block', fontWeight: 600 }}>预训练模型</label>
                        <div
                            ref={dropdownTriggerRef}
                            onClick={handleModelClick}
                            style={{
                                background: 'rgba(0,0,0,0.25)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '14px',
                                padding: '1rem 1.25rem',
                                cursor: isRunning ? 'not-allowed' : 'pointer',
                                opacity: isRunning ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                        >
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {modelOptions.find(m => m.id === config.model)?.label}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                    {modelOptions.find(m => m.id === config.model)?.size} • {modelOptions.find(m => m.id === config.model)?.speed}
                                </div>
                            </div>
                            <div style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </div>
                        </div>

                        {dropdownOpen && createPortal(
                            <div
                                id="model-dropdown-portal"
                                style={{
                                    position: 'fixed',
                                    top: dropdownPosition.top,
                                    left: dropdownPosition.left,
                                    width: dropdownPosition.width,
                                    background: 'rgba(30,35,45,0.98)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '14px',
                                    overflow: 'hidden',
                                    zIndex: 9999,
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                                    maxHeight: '300px',
                                    overflowY: 'auto'
                                }}
                                className="custom-scrollbar"
                            >
                                {modelOptions.map(option => (
                                    <div
                                        key={option.id}
                                        onClick={() => {
                                            updateConfig({ model: option.id });
                                            setDropdownOpen(false);
                                        }}
                                        style={{
                                            padding: '1rem 1.25rem',
                                            cursor: 'pointer',
                                            background: config.model === option.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            transition: 'background 0.2s'
                                        }}
                                    >
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{option.label}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{option.size} • {option.speed}</div>
                                    </div>
                                ))}
                            </div>,
                            document.body
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '8px', display: 'block', fontWeight: 600 }}>训练轮次 (Epochs)</label>
                            <input
                                type="number"
                                value={config.epochs}
                                onChange={(e) => updateConfig({ epochs: parseInt(e.target.value) })}
                                disabled={isRunning}
                                style={{
                                    width: '100%',
                                    background: 'rgba(0,0,0,0.25)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    padding: '12px 16px',
                                    color: 'white',
                                    fontSize: '14px'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '8px', display: 'block', fontWeight: 600 }}>批次大小 (Batch)</label>
                            <input
                                type="number"
                                value={config.batch}
                                onChange={(e) => updateConfig({ batch: parseInt(e.target.value) })}
                                disabled={isRunning}
                                style={{
                                    width: '100%',
                                    background: 'rgba(0,0,0,0.25)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    padding: '12px 16px',
                                    color: 'white',
                                    fontSize: '14px'
                                }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '8px', display: 'block', fontWeight: 600 }}>数据集配置 (data.yaml)</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                value={config.data}
                                readOnly
                                placeholder="默认使用项目导出路径"
                                style={{
                                    flex: 1,
                                    background: 'rgba(0,0,0,0.25)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    padding: '12px 16px',
                                    color: 'white',
                                    fontSize: '13px',
                                    opacity: 0.8
                                }}
                            />
                            <button
                                onClick={onBrowseData}
                                disabled={isRunning}
                                style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    width: '44px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: isRunning ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <FileText size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Environment Info */}
                    {envInfo && (
                        <div style={{
                            marginTop: '0.5rem',
                            padding: '12px 14px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: envInfo.available ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: envInfo.available ? '#4ade80' : '#f87171'
                            }}>
                                <Settings size={16} className={isRunning ? 'spin' : ''} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    Python 环境
                                    {envInfo.available && (
                                        <span style={{
                                            fontSize: '10px',
                                            background: envInfo.cuda ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.1)',
                                            color: envInfo.cuda ? '#818cf8' : 'var(--text-tertiary)',
                                            padding: '1px 6px',
                                            borderRadius: '4px'
                                        }}>
                                            {envInfo.cuda ? 'GPU 加速' : 'CPU 模式'}
                                        </span>
                                    )}
                                </div>
                                <div style={{
                                    fontSize: '11px',
                                    color: 'var(--text-tertiary)',
                                    marginTop: '2px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {envInfo.available ? `${envInfo.version} • ${envInfo.message}` : '未配置 Python 环境'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </SectionCard>
        </>
    );
};

export const AugmentationForm = ({ config, updateConfig, status }) => {
    const isRunning = status === 'running' || status === 'starting';

    const SliderField = ({ label, value, min, max, step, onChange }) => (
        <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)' }}>{value}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                disabled={isRunning || !config.augmentationEnabled}
                style={{ width: '100%', height: '4px', borderRadius: '2px', cursor: 'pointer' }}
            />
        </div>
    );

    return (
        <SectionCard icon={Settings} title="数据增强" color="34,197,94" gradient="linear-gradient(135deg, rgba(34,197,94,0.15), rgba(74,222,128,0.05))">
            <Toggle
                checked={config.augmentationEnabled}
                onChange={(e) => updateConfig({ augmentationEnabled: e.target.checked })}
                label="启用数据增强"
                desc="通过几何变换和颜色抖动提升模型泛化能力"
            />

            <div style={{ marginTop: '1.5rem', opacity: config.augmentationEnabled ? 1 : 0.5 }}>
                <SliderField
                    label="旋转角度 (degrees)"
                    value={config.degrees} min={0} max={180} step={1}
                    onChange={(v) => updateConfig({ degrees: v })}
                />
                <SliderField
                    label="平移比例 (translate)"
                    value={config.translate} min={0} max={1} step={0.05}
                    onChange={(v) => updateConfig({ translate: v })}
                />
                <SliderField
                    label="缩放比例 (scale)"
                    value={config.scale} min={0} max={1} step={0.05}
                    onChange={(v) => updateConfig({ scale: v })}
                />
                <SliderField
                    label="Mosaic 概率"
                    value={config.mosaic} min={0} max={1} step={0.1}
                    onChange={(v) => updateConfig({ mosaic: v })}
                />
            </div>
        </SectionCard>
    );
};
