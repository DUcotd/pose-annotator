
import React, { useState } from 'react';
import { Download, X, Shuffle, FolderOpen } from 'lucide-react';

export const ExportModal = ({ isOpen, onClose, onExport }) => {
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

    if (!isOpen) return null;

    const totalRatio = trainRatio + valRatio + testRatio;
    const isRatioValid = totalRatio === 100;

    const handleSelectFolder = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/utils/select-folder', { method: 'POST' });
            const data = await res.json();
            if (data.path) {
                setCustomPath(data.path);
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
        if (t + valRatio > 100) setValRatio(100 - t);
        setTestRatio(Math.max(0, 100 - t - Math.min(valRatio, 100 - t)));
    };

    const handleValChange = (v) => {
        const val = Math.max(0, Math.min(100, parseInt(v) || 0));
        setValRatio(val);
        setTestRatio(Math.max(0, 100 - trainRatio - val));
    };

    const handleTestChange = (v) => {
        const t = Math.max(0, Math.min(100, parseInt(v) || 0));
        setTestRatio(t);
        setValRatio(Math.max(0, 100 - trainRatio - t));
    };

    return (
        <div className="modal-overlay">
            <div className="animate-fade-in modal-panel modal-panel-md">
                <div className="modal-header-between">
                    <h3>
                        <Download size={20} color="var(--accent-primary)" /> 导出数据集
                    </h3>
                    <button onClick={onClose} className="icon-btn"><X size={20} /></button>
                </div>

                <div className="modal-body">
                    {/* Visibility */}
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={includeVisibility}
                            onChange={(e) => setIncludeVisibility(e.target.checked)}
                        />
                        <span>包含可见性 (v=2)</span>
                    </label>

                    {/* Include Unannotated */}
                    <label className="checkbox-label" style={{ marginTop: '4px' }}>
                        <input
                            type="checkbox"
                            checked={includeUnannotated}
                            onChange={(e) => setIncludeUnannotated(e.target.checked)}
                        />
                        <span>包含未标注数据 (生成空标签文件)</span>
                    </label>

                    {/* Keypoint Count */}
                    <div>
                        <label className="form-label" style={{ fontSize: '13px' }}>关键点数量</label>
                        <input
                            type="number"
                            min="1"
                            max="100"
                            value={numKeypoints}
                            onChange={(e) => setNumKeypoints(parseInt(e.target.value) || 17)}
                            className="input-sm"
                        />
                        <div className="form-hint">
                            默认为 17 (COCO标准)。请设置为您的实际关键点数量。
                        </div>
                    </div>

                    {/* Dataset Split */}
                    <div style={{ marginTop: '4px' }}>
                        <label className="form-label" style={{ fontSize: '13px', marginBottom: '8px', display: 'block' }}>
                            数据集划分比例
                        </label>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                                    Train (%)
                                </label>
                                <input
                                    type="number" min="0" max="100"
                                    value={trainRatio}
                                    onChange={(e) => handleTrainChange(e.target.value)}
                                    className="input-sm"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                                    Val (%)
                                </label>
                                <input
                                    type="number" min="0" max="100"
                                    value={valRatio}
                                    onChange={(e) => handleValChange(e.target.value)}
                                    className="input-sm"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                                    Test (%)
                                </label>
                                <input
                                    type="number" min="0" max="100"
                                    value={testRatio}
                                    onChange={(e) => handleTestChange(e.target.value)}
                                    className="input-sm"
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>

                        {/* Visual ratio bar */}
                        <div style={{
                            display: 'flex', height: '6px', borderRadius: '3px',
                            overflow: 'hidden', marginTop: '8px', background: 'var(--bg-tertiary)'
                        }}>
                            {trainRatio > 0 && <div style={{ width: `${trainRatio}%`, background: 'var(--success)', transition: 'width 0.2s' }} />}
                            {valRatio > 0 && <div style={{ width: `${valRatio}%`, background: 'var(--warning)', transition: 'width 0.2s' }} />}
                            {testRatio > 0 && <div style={{ width: `${testRatio}%`, background: 'var(--accent-primary)', transition: 'width 0.2s' }} />}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            <span style={{ color: 'var(--success)' }}>■ Train {trainRatio}%</span>
                            <span style={{ color: 'var(--warning)' }}>■ Val {valRatio}%</span>
                            <span style={{ color: 'var(--accent-primary)' }}>■ Test {testRatio}%</span>
                        </div>

                        {!isRatioValid && (
                            <div style={{ color: 'var(--error)', fontSize: '12px', marginTop: '4px' }}>
                                ⚠ 比例总和必须等于 100% (当前: {totalRatio}%)
                            </div>
                        )}
                    </div>

                    {/* Shuffle */}
                    <label className="checkbox-label" style={{ marginTop: '4px' }}>
                        <input
                            type="checkbox"
                            checked={shuffleData}
                            onChange={(e) => setShuffleData(e.target.checked)}
                        />
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Shuffle size={14} /> 随机打乱数据
                        </span>
                    </label>

                    {/* Custom Path */}
                    <div>
                        <label className="form-label" style={{ fontSize: '13px' }}>自定义导出路径 (可选)</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                placeholder="未选择路径 (默认为项目目录)"
                                value={customPath}
                                readOnly
                                className="input-sm"
                                style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}
                            />
                            <button
                                onClick={handleSelectFolder}
                                className="btn-secondary"
                                style={{ padding: '8px 12px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <FolderOpen size={16} /> 选择文件夹
                            </button>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button onClick={onClose} className="btn-secondary">取消</button>
                        <button
                            onClick={handleExport}
                            className="btn-primary"
                            disabled={isExporting || !isRatioValid}
                        >
                            {isExporting ? '导出中...' : '导出 YOLO 格式'}
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
};
