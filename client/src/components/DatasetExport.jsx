import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useProject } from '../context/ProjectContext';
import {
    Download, Shuffle, FolderOpen, ArrowLeft, CheckCircle, Info, Database,
    Target, Layout, Share2, FileImage, Box, PieChart, TrendingUp, Loader2
} from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, subValue, color, gradient }) => (
    <div style={{
        background: 'rgba(0,0,0,0.25)',
        borderRadius: '16px',
        padding: '1.25rem',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        transition: 'all 0.3s ease'
    }}>
        <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: gradient || `rgba(${color}, 0.15)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: `rgb(${color})`
        }}>
            <Icon size={22} />
        </div>
        <div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
            {subValue && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{subValue}</div>}
        </div>
    </div>
);

const SectionCard = ({ icon: Icon, title, color, children, gradient }) => (
    <div className="glass-panel-modern" style={{
        padding: '1.75rem',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '1.5rem' }}>
            <div style={{
                background: gradient || `rgba(${color}, 0.12)`,
                color: `rgb(${color})`,
                padding: '12px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Icon size={22} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
        </div>
        {children}
    </div>
);

const Toggle = ({ checked, onChange, label, desc }) => (
    <label style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem',
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        transition: 'all 0.25s ease'
    }}>
        <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
            {desc && <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{desc}</div>}
        </div>
        <div style={{
            width: '48px',
            height: '26px',
            borderRadius: '13px',
            background: checked ? 'linear-gradient(135deg, #22c55e, #4ade80)' : 'rgba(255,255,255,0.1)',
            position: 'relative',
            transition: 'all 0.3s ease'
        }}>
            <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: '3px',
                left: checked ? '25px' : '3px',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }} />
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                style={{ opacity: 0, width: 0, height: 0 }}
            />
        </div>
    </label>
);

export const DatasetExport = () => {
    const { currentProject, exportProject, exportCollaboration, goBack } = useProject();
    const [includeVisibility, setIncludeVisibility] = useState(true);
    const [customPath, setCustomPath] = useState('');
    const [numKeypoints, setNumKeypoints] = useState(17);
    const [isExporting, setIsExporting] = useState(false);
    const [notification, setNotification] = useState(null);
    const [exportStats, setExportStats] = useState(null);
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    const [trainRatio, setTrainRatio] = useState(80);
    const [valRatio, setValRatio] = useState(20);
    const [testRatio, setTestRatio] = useState(0);
    const [shuffleData, setShuffleData] = useState(true);
    const [includeUnannotated, setIncludeUnannotated] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(currentProject)}/images`);
                const data = await res.json();
                const annotated = data.filter(img => img.hasAnnotation).length;
                setExportStats({
                    totalImages: data.length,
                    images: annotated,
                    objects: '—',
                    keypoints: '—'
                });
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            } finally {
                setIsLoadingStats(false);
            }
        };
        fetchStats();
    }, [currentProject]);

    const totalRatio = trainRatio + valRatio + testRatio;
    const isRatioValid = totalRatio === 100;

    useEffect(() => {
        if (isRatioValid) {
            const train = Math.round((trainRatio / 100) * (exportStats?.total || 0));
            const val = Math.round((valRatio / 100) * (exportStats?.total || 0));
            const test = Math.round((testRatio / 100) * (exportStats?.total || 0));
        }
    }, [trainRatio, valRatio, testRatio, exportStats, isRatioValid]);

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
            setExportStats(s);
            const splitInfo = [
                s.train > 0 && `训练: ${s.train}`,
                s.val > 0 && `验证: ${s.val}`,
                s.test > 0 && `测试: ${s.test}`
            ].filter(Boolean).join(' | ');
            message = `✅ 导出完成！${s.images}/${s.totalImages} 张图片 (${splitInfo})，共 ${s.objects} 个目标`;
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
        if (v === '') {
            setTrainRatio('');
            return;
        }
        const t = Math.max(0, Math.min(100, parseInt(v) || 0));
        setTrainRatio(t);
        // Auto-adjust val and test
        const remaining = 100 - t;
        if (valRatio + testRatio === 0) {
            setValRatio(remaining);
        } else {
            const currentSubtotal = valRatio + testRatio;
            const newVal = Math.round((valRatio / currentSubtotal) * remaining);
            setValRatio(newVal);
            setTestRatio(remaining - newVal);
        }
    };

    const handleValChange = (v) => {
        if (v === '') {
            setValRatio('');
            return;
        }
        const val = Math.max(0, Math.min(100, parseInt(v) || 0));
        setValRatio(val);
        // Adjust test to fit, if train + val > 100, adjust train
        if (trainRatio + val > 100) {
            setTrainRatio(100 - val);
            setTestRatio(0);
        } else {
            setTestRatio(100 - trainRatio - val);
        }
    };

    const handleTestChange = (v) => {
        if (v === '') {
            setTestRatio('');
            return;
        }
        const t = Math.max(0, Math.min(100, parseInt(v) || 0));
        setTestRatio(t);
        // Adjust val to fit, if train + test > 100, adjust train
        if (trainRatio + t > 100) {
            setTrainRatio(100 - t);
            setValRatio(0);
        } else {
            setValRatio(100 - trainRatio - t);
        }
    };

    return (

        <div style={{
            padding: '2rem 3rem',
            height: '100%',
            overflowY: 'auto',
            background: 'linear-gradient(135deg, rgba(13,17,23,0.95) 0%, rgba(22,27,34,0.98) 100%)'
        }} className="custom-scrollbar">
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '2.5rem' }}>
                    <button
                        onClick={goBack}
                        className="icon-btn"
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            marginBottom: '1rem',
                            border: '1px solid rgba(255,255,255,0.08)'
                        }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                            导出数据集
                        </h2>
                        <span style={{
                            background: 'linear-gradient(135deg, rgba(88,166,255,0.2), rgba(59,130,246,0.2))',
                            color: '#60a5fa',
                            padding: '6px 14px',
                            borderRadius: '10px',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            border: '1px solid rgba(96,165,250,0.3)'
                        }}>
                            YOLO Pose
                        </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', margin: '12px 0 0 0' }}>
                        为项目 <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{currentProject}</span> 配置并生成训练数据集
                    </p>
                </div>

                {/* Stats Preview */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginBottom: '2rem'
                }}>
                    <StatCard
                        icon={FileImage}
                        label="总图片数"
                        value={isLoadingStats ? <div className="skeleton-inline" /> : (exportStats?.totalImages || 0)}
                        subValue="项目中的所有图片"
                        color="99,102,241"
                        gradient="linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))"
                    />
                    <StatCard
                        icon={Box}
                        label="已标注"
                        value={isLoadingStats ? <div className="skeleton-inline" /> : (exportStats?.images || 0)}
                        subValue="将包含在数据集中"
                        color="34,197,94"
                        gradient="linear-gradient(135deg, rgba(34,197,94,0.2), rgba(74,222,128,0.1))"
                    />
                    <StatCard
                        icon={Target}
                        label="标注目标"
                        value={isLoadingStats ? <div className="skeleton-inline" /> : (exportStats?.totalImages ? Math.round(exportStats.images * 1.5) : '—')}
                        subValue="预估边界框 + 关键点"
                        color="251,191,36"
                        gradient="linear-gradient(135deg, rgba(251,191,36,0.2), rgba(252,211,77,0.1))"
                    />
                    <StatCard
                        icon={PieChart}
                        label="标注率"
                        value={isLoadingStats ? <div className="skeleton-inline" /> : (exportStats?.totalImages ? Math.round((exportStats.images / exportStats.totalImages) * 100) + '%' : '0%')}
                        subValue={!isLoadingStats ? `${exportStats?.images || 0} / ${exportStats?.totalImages || 0}` : '加载中...'}
                        color="77,161,255"
                        gradient="linear-gradient(135deg, rgba(77,161,255,0.2), rgba(96,165,250,0.1))"
                    />
                </div>

                {/* Notification */}
                {notification && (
                    <div style={{
                        marginBottom: '2rem',
                        padding: '1.25rem 1.5rem',
                        borderRadius: '16px',
                        background: notification.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        border: `1px solid ${notification.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                        color: notification.type === 'success' ? '#4ade80' : '#f87171',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        animation: 'slideDown 0.3s ease-out'
                    }}>
                        {notification.type === 'success' ? <CheckCircle size={20} /> : <Info size={20} />}
                        <span style={{ fontWeight: 500, fontSize: '14px' }}>{notification.message}</span>
                    </div>
                )}

                {/* Main Content Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>

                    {/* Data Options */}
                    <SectionCard icon={Database} title="数据配置" color="99,102,241">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <Toggle
                                checked={includeVisibility}
                                onChange={(e) => setIncludeVisibility(e.target.checked)}
                                label="包含可见性标志 (v=2)"
                                desc="在标签文件中包含关键点可见性信息"
                            />
                            <Toggle
                                checked={includeUnannotated}
                                onChange={(e) => setIncludeUnannotated(e.target.checked)}
                                label="包含未标注数据"
                                desc="为未标注图片生成空标签文件"
                            />
                        </div>

                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                                <Target size={18} style={{ color: 'rgb(168,85,247)' }} />
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>关键点数量</span>
                            </div>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '16px' }}>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={numKeypoints}
                                    onChange={(e) => setNumKeypoints(parseInt(e.target.value) || 17)}
                                    style={{
                                        width: '90px',
                                        height: '52px',
                                        textAlign: 'center',
                                        background: 'rgba(255,255,255,0.06)',
                                        fontWeight: 800,
                                        fontSize: '1.25rem',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white',
                                        outline: 'none'
                                    }}
                                />
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>COCO 标准关键点</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>默认为 17 点（COCO 格式）</div>
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Dataset Split */}
                    <SectionCard icon={Layout} title="数据集划分" color="251,191,36">
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '1.5rem' }}>
                                {[
                                    { label: '训练集', sub: 'Train', value: trainRatio, setter: handleTrainChange, color: '34,197,94', gradient: 'linear-gradient(135deg, #22c55e, #4ade80)' },
                                    { label: '验证集', sub: 'Val', value: valRatio, setter: handleValChange, color: '251,191,36', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
                                    { label: '测试集', sub: 'Test', value: testRatio, setter: handleTestChange, color: '59,130,246', gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)' }
                                ].map(item => (
                                    <div key={item.label} style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '11px', color: `rgb(${item.color})`, fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {item.sub}
                                        </div>
                                        <div style={{ position: 'relative', display: 'inline-block' }}>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                min="0" max="100"
                                                value={item.value}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                                    if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 100)) {
                                                        item.setter(val);
                                                    }
                                                }}
                                                style={{
                                                    width: '72px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: `1px solid rgba(255,255,255,0.1)`,
                                                    color: 'white',
                                                    textAlign: 'center',
                                                    outline: 'none',
                                                    fontSize: '1.25rem',
                                                    fontWeight: 700,
                                                    borderRadius: '12px',
                                                    padding: '10px 8px'
                                                }}
                                            />
                                            <span style={{ position: 'absolute', right: '-14px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--text-tertiary)' }}>%</span>
                                        </div>
                                        <div style={{
                                            marginTop: '10px',
                                            height: '6px',
                                            background: 'rgba(255,255,255,0.08)',
                                            borderRadius: '3px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                width: `${item.value}%`,
                                                height: '100%',
                                                background: item.gradient,
                                                transition: 'width 0.4s ease',
                                                borderRadius: '3px'
                                            }} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Visual Bar */}
                            <div style={{
                                position: 'relative',
                                padding: '4px 0',
                                marginBottom: '1rem'
                            }}>
                                <div style={{
                                    width: '100%',
                                    height: '16px',
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)'
                                }}>
                                    <div style={{ width: `${trainRatio}%`, background: 'linear-gradient(90deg, #22c55e, #4ade80)', transition: 'width 0.5s ease' }} />
                                    <div style={{ width: `${valRatio}%`, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', transition: 'width 0.5s ease' }} />
                                    <div style={{ width: `${testRatio}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', transition: 'width 0.5s ease' }} />
                                </div>
                            </div>

                            {!isRatioValid && (
                                <div style={{
                                    color: '#f87171',
                                    fontSize: '13px',
                                    marginTop: '1rem',
                                    padding: '12px',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    borderRadius: '12px',
                                    textAlign: 'center',
                                    fontWeight: 600
                                }}>
                                    ⚠️ 比例之和必须等于 100% (当前: {totalRatio}%)
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    {/* Export Options */}
                    <SectionCard icon={Download} title="导出设置" color="34,197,94">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <Toggle
                                checked={shuffleData}
                                onChange={(e) => setShuffleData(e.target.checked)}
                                label="随机打乱数据"
                                desc="使用 Fisher-Yates 算法确保分布均匀"
                            />

                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: 'var(--text-secondary)' }}>
                                    自定义导出路径
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <input
                                        type="text"
                                        placeholder="默认导出至项目根目录"
                                        value={customPath}
                                        readOnly
                                        style={{
                                            flex: 1,
                                            height: '52px',
                                            padding: '0 18px',
                                            fontSize: '13px',
                                            background: 'rgba(0,0,0,0.25)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '14px',
                                            color: 'var(--text-secondary)',
                                            outline: 'none'
                                        }}
                                    />
                                    <button
                                        onClick={handleSelectFolder}
                                        style={{
                                            width: '52px',
                                            height: '52px',
                                            padding: 0,
                                            borderRadius: '14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                        title="选择保存位置"
                                    >
                                        <FolderOpen size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Collaboration */}
                    <SectionCard icon={Share2} title="项目协作" color="77,161,255">
                        <div style={{
                            background: 'rgba(0,0,0,0.2)',
                            padding: '1.5rem',
                            borderRadius: '18px',
                            border: '1px solid rgba(255,255,255,0.04)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, rgba(77,161,255,0.2), rgba(96,165,250,0.1))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#60a5fa'
                                }}>
                                    <Share2 size={20} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>导出协作包 (ZIP)</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>打包项目数据，方便分享给他人</div>
                                </div>
                            </div>
                            <button
                                onClick={handleCollaborationExport}
                                style={{
                                    width: '100%',
                                    height: '48px',
                                    borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <Share2 size={16} /> 开始导出
                            </button>
                        </div>
                    </SectionCard>

                </div>

                {/* Export Button */}
                <div style={{ marginTop: '2rem', padding: '0 0.5rem' }}>
                    <button
                        onClick={handleExport}
                        disabled={isExporting || !isRatioValid}
                        style={{
                            width: '100%',
                            height: '64px',
                            fontSize: '1.15rem',
                            fontWeight: 800,
                            borderRadius: '20px',
                            justifyContent: 'center',
                            gap: '14px',
                            background: isExporting || !isRatioValid
                                ? 'rgba(255,255,255,0.05)'
                                : 'linear-gradient(135deg, #22c55e, #4ade80)',
                            border: 'none',
                            color: isExporting || !isRatioValid ? 'var(--text-tertiary)' : 'white',
                            cursor: isExporting || !isRatioValid ? 'not-allowed' : 'pointer',
                            boxShadow: isRatioValid ? '0 8px 32px rgba(34,197,94,0.25)' : 'none',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {isExporting ? (
                            <>
                                <Loader2 size={22} className="spin" /> 正在导出数据集...
                            </>
                        ) : (
                            <>
                                <Download size={22} /> 执行数据集导出
                            </>
                        )}
                    </button>
                    <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                        导出过程可能需要几秒钟，请稍候
                    </p>
                </div>

            </div>

            {/* Toast Notification */}
            {notification && createPortal(
                <div style={{
                    position: 'fixed',
                    bottom: '32px',
                    right: '32px',
                    zIndex: 9999,
                    animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    <div style={{
                        padding: '16px 24px',
                        background: notification.type === 'success' ? 'linear-gradient(135deg, #065f46, #047857)' : '#991b1b',
                        border: `1px solid ${notification.type === 'success' ? '#10b981' : '#ef4444'}`,
                        borderRadius: '16px',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)'
                    }}>
                        {notification.type === 'success' ? <CheckCircle size={20} /> : <Info size={20} />}
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{notification.message}</span>
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
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .glass-panel-modern {
                    background: rgba(255, 255, 255, 0.025);
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    transition: all 0.3s ease;
                }
                .glass-panel-modern:hover {
                    border-color: rgba(255, 255, 255, 0.12);
                    background: rgba(255, 255, 255, 0.03);
                }
                .skeleton-inline {
                    display: inline-block;
                    width: 60px;
                    height: 24px;
                    background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite linear;
                    border-radius: 6px;
                }
                @keyframes shimmer {
                    from { background-position: 200% 0; }
                    to { background-position: -200% 0; }
                }
            `}</style>
        </div>
    );
};
