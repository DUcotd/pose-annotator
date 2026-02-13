import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useProject } from '../context/ProjectContext';
import { Download, Shuffle, FolderOpen, ArrowLeft, CheckCircle, Info, Database, Target, Layout, Share2 } from 'lucide-react';

export const DatasetExport = () => {
    const { currentProject, exportProject, exportCollaboration, goBack } = useProject();
    const [includeVisibility, setIncludeVisibility] = useState(true);
    const [customPath, setCustomPath] = useState('');
    const [numKeypoints, setNumKeypoints] = useState(17);
    const [isExporting, setIsExporting] = useState(false);
    const [notification, setNotification] = useState(null);

    // Dataset split options
    const [trainRatio, setTrainRatio] = useState(80);
    const [valRatio, setValRatio] = useState(20);
    const [testRatio, setTestRatio] = useState(0);
    const [shuffleData, setShuffleData] = useState(true);
    const [includeUnannotated, setIncludeUnannotated] = useState(true);

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
        const result = await exportProject(currentProject, {
            includeVisibility,
            customPath,
            numKeypoints,
            trainRatio: trainRatio / 100,
            valRatio: valRatio / 100,
            testRatio: testRatio / 100,
            shuffle: shuffleData,
            includeUnannotated
        });

        let message = result.message;
        if (result.success && result.stats) {
            const s = result.stats;
            const splitInfo = [
                s.train > 0 && `训练集: ${s.train}`,
                s.val > 0 && `验证集: ${s.val}`,
                s.test > 0 && `测试集: ${s.test}`
            ].filter(Boolean).join(', ');
            message = `导出成功！已标注 ${s.images}/${s.totalImages} 张图片 (${splitInfo})，共 ${s.objects} 个目标`;
        }

        setNotification({ type: result.success ? 'success' : 'error', message });
        setIsExporting(false);
        if (result.success) {
            setTimeout(() => setNotification(null), 10000);
        }
    };

    const handleCollaborationExport = () => {
        setNotification({ type: 'success', message: '正在准备项目协作包，即将开始下载...' });
        exportCollaboration(currentProject);
        setTimeout(() => setNotification(null), 5000);
    };

    const handleTrainChange = (v) => {
        const t = Math.max(0, Math.min(100, parseInt(v) || 0));
        setTrainRatio(t);
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
        <div className="page-container" style={{ padding: '2rem 3rem', height: '100%', overflowY: 'auto' }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                    <button onClick={goBack} className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', width: '40px', height: '40px' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                        导出数据集
                    </h2>
                    <div style={{
                        background: 'var(--accent-dim)',
                        color: 'var(--accent-primary)',
                        padding: '4px 12px',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        textTransform: 'uppercase'
                    }}>
                        YOLO Pose
                    </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0, paddingLeft: '56px' }}>
                    为项目 <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentProject}</span> 配置并生成训练用的数据集
                </p>
            </div>

            {notification && (
                <div style={{
                    marginBottom: '2rem',
                    padding: '1.25rem 1.5rem',
                    borderRadius: '16px',
                    background: notification.type === 'success' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${notification.type === 'success' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                    color: notification.type === 'success' ? '#4ade80' : '#f87171',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    animation: 'slideDown 0.3s ease-out'
                }}>
                    {notification.type === 'success' ? <CheckCircle size={20} /> : <Info size={20} />}
                    <span style={{ fontWeight: 500 }}>{notification.message}</span>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>

                {/* Section 1: Data Options */}
                <div className="glass-card" style={{ padding: '2rem', borderRadius: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                        <div style={{ background: 'rgba(88, 166, 255, 0.1)', color: '#4da1ff', padding: '10px', borderRadius: '12px' }}>
                            <Database size={20} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>数据范围控制</h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <label className="checkbox-label" style={{ padding: '1.25rem', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <input
                                type="checkbox"
                                checked={includeVisibility}
                                onChange={(e) => setIncludeVisibility(e.target.checked)}
                            />
                            <div style={{ marginLeft: '12px' }}>
                                <div style={{ fontSize: '14px', fontWeight: 600 }}>包含可见性标志 (v=2)</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>在标签文件中包含关键点是否可见的信息</div>
                            </div>
                        </label>

                        <label className="checkbox-label" style={{ padding: '1.25rem', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <input
                                type="checkbox"
                                checked={includeUnannotated}
                                onChange={(e) => setIncludeUnannotated(e.target.checked)}
                            />
                            <div style={{ marginLeft: '12px' }}>
                                <div style={{ fontSize: '14px', fontWeight: 600 }}>包含未标注数据</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>为未进行任何标注的图片生成空标签文件（背景样本）</div>
                            </div>
                        </label>
                    </div>

                    <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
                            <div style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '10px', borderRadius: '12px' }}>
                                <Target size={20} />
                            </div>
                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>关键点配置</h4>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '16px' }}>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={numKeypoints}
                                onChange={(e) => setNumKeypoints(parseInt(e.target.value) || 17)}
                                className="input-sm"
                                style={{ width: '80px', height: '48px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', fontWeight: 800, fontSize: '1.2rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 600 }}>关键点数量</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>默认为 17 (COCO标准)</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 2: Split & Save */}
                <div className="glass-card" style={{ padding: '2rem', borderRadius: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                        <div style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', padding: '10px', borderRadius: '12px' }}>
                            <Layout size={20} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>数据集划分</h4>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '1.5rem' }}>
                            {[
                                { label: '训练 (Train)', value: trainRatio, setter: handleTrainChange, color: '#4ade80' },
                                { label: '验证 (Val)', value: valRatio, setter: handleValChange, color: '#fbbf24' },
                                { label: '测试 (Test)', value: testRatio, setter: handleTestChange, color: '#3b82f6' }
                            ].map(item => (
                                <div key={item.label} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '11px', color: item.color, fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase' }}>{item.label}</div>
                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                        <input
                                            type="number" min="0" max="100"
                                            value={item.value}
                                            onChange={(e) => item.setter(e.target.value)}
                                            style={{
                                                width: '60px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white',
                                                textAlign: 'center', outline: 'none', fontSize: '1.1rem', fontWeight: 700, borderRadius: '8px', padding: '8px 4px'
                                            }}
                                        />
                                        <span style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-tertiary)' }}>%</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ position: 'relative', padding: '4px 0' }}>
                            <div style={{
                                width: '100%', height: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '7px',
                                overflow: 'hidden', display: 'flex', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)'
                            }}>
                                <div style={{ width: `${trainRatio}%`, background: 'linear-gradient(90deg, #22c55e, #4ade80)', transition: 'width 0.5s ease' }} />
                                <div style={{ width: `${valRatio}%`, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', transition: 'width 0.5s ease' }} />
                                <div style={{ width: `${testRatio}%`, background: 'linear-gradient(90deg, #2563eb, #3b82f6)', transition: 'width 0.5s ease' }} />
                            </div>
                        </div>

                        {!isRatioValid && (
                            <div style={{
                                color: '#f87171', fontSize: '12px', marginTop: '1rem', padding: '10px',
                                background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', textAlign: 'center', fontWeight: 600
                            }}>
                                比例之和必须等于 100% (当前: {totalRatio}%)
                            </div>
                        )}
                        <p style={{ margin: '14px 0 0 0', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                            只有已标注的图片会被包含在最终的数据集中
                        </p>
                    </div>

                    <div style={{ marginTop: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
                            <div style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', padding: '10px', borderRadius: '12px' }}>
                                <FolderOpen size={20} />
                            </div>
                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>输出与保存</h4>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <label className="checkbox-label" style={{ padding: '1rem 1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <input
                                    type="checkbox"
                                    checked={shuffleData}
                                    onChange={(e) => setShuffleData(e.target.checked)}
                                />
                                <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Shuffle size={14} />
                                    <span style={{ fontSize: '14px', fontWeight: 600 }}>随机打乱数据顺序</span>
                                </div>
                            </label>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <input
                                    type="text"
                                    placeholder="默认导出至项目根目录"
                                    value={customPath}
                                    readOnly
                                    style={{ flex: 1, height: '48px', padding: '0 16px', fontSize: '13px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'var(--text-secondary)' }}
                                />
                                <button
                                    onClick={handleSelectFolder}
                                    className="btn-secondary"
                                    style={{ width: '48px', height: '48px', padding: 0, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="选择保存位置"
                                >
                                    <FolderOpen size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 3: Collaboration & Sharing */}
                <div className="glass-card" style={{ padding: '2rem', borderRadius: '24px', gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: 'rgba(77, 161, 255, 0.1)', color: '#4da1ff', padding: '10px', borderRadius: '12px' }}>
                                <Share2 size={20} />
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>项目分享与备份</h4>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>
                                    将整个项目打包为 ZIP，方便分享给他人标注或进行数据备份
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleCollaborationExport}
                            className="btn-modern-secondary"
                            style={{ padding: '0 2rem', height: '52px', borderRadius: '14px', gap: '8px' }}
                        >
                            <Share2 size={18} /> 导出协作包 (ZIP)
                        </button>
                    </div>
                </div>

                {/* Confirm Action */}
                <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                    <button
                        onClick={handleExport}
                        disabled={isExporting || !isRatioValid}
                        className="btn-modern-primary"
                        style={{
                            width: '100%',
                            height: '64px',
                            fontSize: '1.2rem',
                            fontWeight: 800,
                            borderRadius: '20px',
                            justifyContent: 'center',
                            boxShadow: '0 8px 32px rgba(88, 166, 255, 0.2)',
                            gap: '12px'
                        }}
                    >
                        {isExporting ? (
                            <>
                                <div className="spinner-sm" /> 正在导出数据集...
                            </>
                        ) : (
                            <>
                                <Download size={22} /> 执行数据集导出
                            </>
                        )}
                    </button>
                    <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        导出过程可能需要几秒钟，请稍候
                    </p>
                </div>

            </div>

            {notification && createPortal(
                <div style={{
                    position: 'fixed',
                    bottom: '40px',
                    right: '40px',
                    zIndex: 9999,
                    animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    <div style={{
                        padding: '16px 24px',
                        background: notification.type === 'success' ? '#065f46' : '#991b1b',
                        border: `1px solid ${notification.type === 'success' ? '#10b981' : '#ef4444'}`,
                        borderRadius: '16px',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
                    }}>
                        <Info size={20} />
                        <span style={{ fontWeight: 600 }}>{notification.message}</span>
                    </div>
                </div>,
                document.body
            )}

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes slideDown {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .glass-card {
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    transition: all 0.3s ease;
                }
                .glass-card:hover {
                    border-color: rgba(255, 255, 255, 0.15);
                    background: rgba(255, 255, 255, 0.04);
                }
                .checkbox-label {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .checkbox-label:hover {
                    background: rgba(255, 255, 255, 0.05) !important;
                }
                .checkbox-label input[type="checkbox"] {
                    width: 20px;
                    height: 20px;
                    border-radius: 6px;
                    cursor: pointer;
                }
                .spinner-sm {
                    width: 20px;
                    height: 20px;
                    border: 3px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
