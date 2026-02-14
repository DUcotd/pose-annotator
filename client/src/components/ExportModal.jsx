import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, Shuffle, FolderOpen, Loader2 } from 'lucide-react';
import { useProject } from '../context/ProjectContext';

export const ExportModal = ({ isOpen, onClose, onExport }) => {
    const { currentProject, projectConfig, configLoading, updateProjectConfig } = useProject();

    const [includeVisibility, setIncludeVisibility] = useState(true);
    const [customPath, setCustomPath] = useState('');
    const [numKeypoints, setNumKeypoints] = useState(17);
    const [isExporting, setIsExporting] = useState(false);

    // Dataset split options
    const [trainRatio, setTrainRatio] = useState(80);
    const [valRatio, setValRatio] = useState(20);
    const [testRatio, setTestRatio] = useState(0);
    const [shuffleData, setShuffleData] = useState(true);
    const [includeUnannotated, setIncludeUnannotated] = useState(true);

    // Sync state with projectConfig when modal opens
    useEffect(() => {
        if (isOpen && projectConfig.exportSettings) {
            const s = projectConfig.exportSettings;
            if (s.includeVisibility !== undefined) setIncludeVisibility(s.includeVisibility);
            if (s.customPath !== undefined) setCustomPath(s.customPath);
            if (s.numKeypoints !== undefined) setNumKeypoints(s.numKeypoints);
            if (s.trainRatio !== undefined) setTrainRatio(Math.round(s.trainRatio * 100));
            if (s.valRatio !== undefined) setValRatio(Math.round(s.valRatio * 100));
            if (s.testRatio !== undefined) setTestRatio(Math.round(s.testRatio * 100));
            if (s.shuffle !== undefined) setShuffleData(s.shuffle);
            if (s.includeUnannotated !== undefined) setIncludeUnannotated(s.includeUnannotated);
        }
    }, [isOpen, projectConfig]);

    // Save settings helper
    const saveSettings = async (updates) => {
        const currentSettings = {
            includeVisibility,
            customPath,
            numKeypoints,
            trainRatio: trainRatio / 100,
            valRatio: valRatio / 100,
            testRatio: testRatio / 100,
            shuffle: shuffleData,
            includeUnannotated,
            ...updates
        };
        await updateProjectConfig(currentProject, { exportSettings: currentSettings });
    };

    if (!isOpen) return null;

    if (configLoading) {
        return createPortal(
            <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="modal-content-modern" style={{ width: 'auto', padding: '2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Loader2 size={24} className="spin" />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>加载配置...</span>
                </div>
            </div>,
            document.body
        );
    }

    const totalRatio = trainRatio + valRatio + testRatio;
    const isRatioValid = totalRatio === 100;

    const handleSelectFolder = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/utils/select-folder', { method: 'POST' });
            const data = await res.json();
            if (data.path) {
                setCustomPath(data.path);
                saveSettings({ customPath: data.path });
            }
        } catch (err) {
            console.error('Failed to select folder:', err);
        }
    };

    const handleExport = async () => {
        if (!isRatioValid) return;
        setIsExporting(true);
        await onExport({
            includeVisibility,
            customPath,
            numKeypoints,
            trainRatio: trainRatio / 100,
            valRatio: valRatio / 100,
            testRatio: testRatio / 100,
            shuffle: shuffleData,
            includeUnannotated
        });
        setIsExporting(false);
        onClose();
    };

    // Auto-adjust: when train or val changes, auto-compute the remaining for test
    const handleTrainChange = (v) => {
        const t = Math.max(0, Math.min(100, parseInt(v) || 0));
        setTrainRatio(t);
        // Auto-adjust val to fit, test gets remainder
        let newVal = valRatio;
        if (t + newVal > 100) newVal = 100 - t;
        const newTest = Math.max(0, 100 - t - Math.min(newVal, 100 - t));
        setValRatio(newVal);
        setTestRatio(newTest);
        saveSettings({ trainRatio: t / 100, valRatio: newVal / 100, testRatio: newTest / 100 });
    };

    const handleValChange = (v) => {
        const val = Math.max(0, Math.min(100, parseInt(v) || 0));
        setValRatio(val);
        const newTest = Math.max(0, 100 - trainRatio - val);
        setTestRatio(newTest);
        saveSettings({ valRatio: val / 100, testRatio: newTest / 100 });
    };

    const handleTestChange = (v) => {
        const t = Math.max(0, Math.min(100, parseInt(v) || 0));
        setTestRatio(t);
        const newVal = Math.max(0, 100 - trainRatio - t);
        setValRatio(newVal);
        saveSettings({ testRatio: t / 100, valRatio: newVal / 100 });
    };

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', borderRadius: '24px', padding: '10px' }}>
                <div className="modal-header-between" style={{ padding: '20px 24px 10px 24px', marginBottom: '0.5rem' }}>
                    <h3 className="flex-center" style={{ gap: '12px' }}>
                        <div className="modal-icon modal-icon-accent">
                            <Download size={22} className="animate-float" />
                        </div>
                        <span style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px' }}>导出数据集</span>
                    </h3>
                    <button onClick={onClose} className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)' }}><X size={20} /></button>
                </div>

                <div className="modal-body" style={{ gap: '1.25rem', padding: '0 24px 24px 24px' }}>
                    {/* Section 1: Data Scope */}
                    <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        padding: '20px',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                    }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                            导出选项
                        </div>
                        <label className="checkbox-label" style={{ background: 'transparent', border: 'none', padding: 0 }}>
                            <input
                                type="checkbox"
                                checked={includeVisibility}
                                onChange={(e) => {
                                    setIncludeVisibility(e.target.checked);
                                    saveSettings({ includeVisibility: e.target.checked });
                                }}
                            />
                            <span style={{ fontSize: '14px', fontWeight: 500 }}>包含可见性 (v=2)</span>
                        </label>

                        <label className="checkbox-label" style={{ background: 'transparent', border: 'none', padding: 0 }}>
                            <input
                                type="checkbox"
                                checked={includeUnannotated}
                                onChange={(e) => {
                                    setIncludeUnannotated(e.target.checked);
                                    saveSettings({ includeUnannotated: e.target.checked });
                                }}
                            />
                            <span style={{ fontSize: '14px', fontWeight: 500 }}>包含未标注数据 (生成空标签文件)</span>
                        </label>
                    </div>

                    {/* Section 2: Keypoints */}
                    <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        padding: '20px',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                关键点配置
                            </span>
                            <span style={{ fontSize: '10px', background: 'var(--accent-dim)', color: 'var(--accent-primary)', padding: '2px 10px', borderRadius: '6px', fontWeight: 800 }}>
                                YOLO POSE
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={numKeypoints}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 17;
                                    setNumKeypoints(val);
                                    saveSettings({ numKeypoints: val });
                                }}
                                className="input-sm"
                                style={{ width: '90px', height: '50px', textAlign: 'center', background: 'rgba(0,0,0,0.4)', fontWeight: 800, fontSize: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '2px' }}>点位数量</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>默认为 17 (COCO标准)</div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Split Ratio */}
                    <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        padding: '20px',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '18px' }}>
                            数据集划分比例
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                            {[
                                { label: 'Train', value: trainRatio, setter: handleTrainChange, color: '#4ade80' },
                                { label: 'Val', value: valRatio, setter: handleValChange, color: '#fbbf24' },
                                { label: 'Test', value: testRatio, setter: handleTestChange, color: '#3b82f6' }
                            ].map(item => (
                                <div key={item.label} style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 8px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ fontSize: '11px', color: item.color, fontWeight: 900, marginBottom: '6px', textTransform: 'uppercase' }}>{item.label}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                        <input
                                            type="number" min="0" max="100"
                                            value={item.value}
                                            onChange={(e) => item.setter(e.target.value)}
                                            style={{
                                                width: '40px', background: 'none', border: 'none', color: 'white',
                                                textAlign: 'center', outline: 'none', fontSize: '16px', fontWeight: 800
                                            }}
                                        />
                                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>%</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '20px' }}>
                            <div style={{
                                width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px',
                                overflow: 'hidden', display: 'flex', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)'
                            }}>
                                <div style={{ width: `${trainRatio}%`, background: '#4ade80', transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                                <div style={{ width: `${valRatio}%`, background: '#fbbf24', transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                                <div style={{ width: `${testRatio}%`, background: '#3b82f6', transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                            </div>
                        </div>

                        {!isRatioValid && (
                            <div style={{
                                color: '#ff6b6b', fontSize: '12px', marginTop: '14px', padding: '10px',
                                background: 'rgba(255, 107, 107, 0.1)', borderRadius: '8px', textAlign: 'center', fontWeight: 700
                            }}>
                                比例总和需为 100% (目前: {totalRatio}%)
                            </div>
                        )}
                    </div>

                    {/* Section 4: Output Settings */}
                    <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        padding: '20px',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px'
                    }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            保存配置
                        </div>

                        <label className="checkbox-label" style={{ background: 'rgba(0,0,0,0.25)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <input
                                type="checkbox"
                                checked={shuffleData}
                                onChange={(e) => {
                                    setShuffleData(e.target.checked);
                                    saveSettings({ shuffle: e.target.checked });
                                }}
                            />
                            <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 500 }}>
                                <Shuffle size={16} className="text-accent" /> 随机打乱样本顺序
                            </span>
                        </label>

                        <div className="form-group" style={{ marginTop: '2px' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <input
                                        type="text"
                                        placeholder="默认项目路径"
                                        value={customPath}
                                        readOnly
                                        className="input-sm"
                                        style={{ width: '100%', height: '46px', paddingLeft: '16px', fontSize: '13px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                                    />
                                </div>
                                <button
                                    onClick={handleSelectFolder}
                                    className="btn-secondary"
                                    style={{
                                        width: '46px', height: '46px', padding: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        borderRadius: '12px', background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}
                                    title="选择保存位置"
                                >
                                    <FolderOpen size={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer" style={{ marginTop: '0.5rem', gap: '20px' }}>
                        <button
                            onClick={onClose}
                            className="btn-modern-secondary"
                            style={{ flex: 1, height: '52px', fontSize: '16px', borderRadius: '14px', fontWeight: 700 }}
                        >
                            取消
                        </button>
                        <button
                            onClick={handleExport}
                            className="btn-modern-primary"
                            style={{ flex: 2, height: '52px', fontSize: '16px', borderRadius: '14px', justifyContent: 'center', fontWeight: 800 }}
                            disabled={isExporting || !isRatioValid}
                        >
                            {isExporting ? '正在处理...' : '执行数据集导出'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
