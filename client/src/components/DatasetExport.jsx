import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useProject } from '../context/ProjectContext';
import {
    Download, Shuffle, FolderOpen, ArrowLeft, CheckCircle, Info, Database,
    Target, Layout, Share2, FileImage, Box, PieChart, TrendingUp, Loader2,
    ChevronRight, ExternalLink, Sparkles, Zap, ShieldCheck, Layers
} from 'lucide-react';

/* --- Premium Helper Components --- */

const StatCard = ({ icon: Icon, label, value, subValue, color, gradient }) => (
    <div className="stat-card-premium" style={{
        background: 'rgba(23, 23, 23, 0.4)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '1rem 1.5rem',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        flex: 1,
        minWidth: '240px'
    }}>
        <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: gradient || `rgba(${color}, 0.1)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: `rgb(${color})`,
            boxShadow: `0 8px 16px rgba(${color}, 0.1)`,
            zIndex: 2,
            flexShrink: 0
        }}>
            <Icon size={26} />
        </div>
        <div style={{ zIndex: 2 }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '1px', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
            {subValue && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', opacity: 0.8, whiteSpace: 'nowrap' }}>{subValue}</div>}
        </div>
        <div style={{
            position: 'absolute',
            bottom: '-15px',
            right: '-15px',
            opacity: 0.05,
            color: `rgb(${color})`,
            transform: 'rotate(-15deg)',
            zIndex: 1
        }}>
            <Icon size={100} />
        </div>
    </div>
);

const SectionCard = ({ icon: Icon, title, color, children, gradient, subtitle, action, stretch = false }) => (
    <div className="glass-panel-premium" style={{
        padding: '1.5rem',
        borderRadius: '32px',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(145deg, rgba(35,35,35,0.4), rgba(15,15,15,0.4))',
        backdropFilter: 'blur(30px)',
        height: stretch ? '100%' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        transition: 'all 0.3s ease'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                    background: gradient || `rgba(${color}, 0.12)`,
                    color: `rgb(${color})`,
                    padding: '12px',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 4px 12px rgba(${color}, 0.1)`
                }}>
                    <Icon size={22} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</h3>
                    {subtitle && <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{subtitle}</div>}
                </div>
            </div>
            {action && <div>{action}</div>}
        </div>
        <div style={{ flex: 1 }}>
            {children}
        </div>
    </div>
);

const Toggle = ({ checked, onChange, label, desc, icon: Icon }) => (
    <label className="toggle-premium" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem 1.5rem',
        borderRadius: '20px',
        background: checked ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.005)',
        border: checked ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        marginBottom: '1rem'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
            {Icon && <Icon size={20} style={{ color: checked ? 'var(--accent-primary)' : 'var(--text-tertiary)' }} />}
            <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{label}</div>
                {desc && <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px', lineHeight: 1.5 }}>{desc}</div>}
            </div>
        </div>
        <div style={{
            width: '48px',
            height: '26px',
            borderRadius: '13px',
            background: checked ? 'linear-gradient(135deg, #10b981, #34d399)' : 'rgba(255,255,255,0.1)',
            position: 'relative',
            flexShrink: 0,
            boxShadow: checked ? '0 0 15px rgba(16, 185, 129, 0.3)' : 'none'
        }}>
            <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: '3px',
                left: checked ? '25px' : '3px',
                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }} />
            <input type="checkbox" checked={checked} onChange={onChange} style={{ opacity: 0, position: 'absolute' }} />
        </div>
    </label>
);

/* --- Main Component --- */

export const DatasetExport = () => {
    const { currentProject, projectConfig, configLoading, updateProjectConfig, exportProject, exportDatasetZip, exportCollaboration, goBack } = useProject();

    // States
    const [includeVisibility, setIncludeVisibility] = useState(true);
    const [customPath, setCustomPath] = useState('');
    const [numKeypoints, setNumKeypoints] = useState(17);
    const [isExporting, setIsExporting] = useState(false);
    const [isZipExporting, setIsZipExporting] = useState(false);
    const [isCollaborationExporting, setIsCollaborationExporting] = useState(false);
    const [notification, setNotification] = useState(null);
    const [exportStats, setExportStats] = useState(null);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [exportResult, setExportResult] = useState(null);
    const [showExportModal, setShowExportModal] = useState(false);

    const [trainRatio, setTrainRatio] = useState(80);
    const [valRatio, setValRatio] = useState(20);
    const [testRatio, setTestRatio] = useState(0);
    const [shuffleData, setShuffleData] = useState(true);
    const [includeUnannotated, setIncludeUnannotated] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(currentProject)}/dataset/stats`);
                const data = await res.json();
                setExportStats({
                    totalImages: data.total || 0,
                    images: data.annotated || 0,
                    bboxes: data.bboxes || 0,
                    keypoints: data.keypoints || 0
                });
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            } finally {
                setIsLoadingStats(false);
            }
        };
        fetchStats();

        if (projectConfig.exportSettings) {
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
    }, [currentProject, projectConfig]);

    const saveSettings = async (updates) => {
        const currentSettings = {
            includeVisibility, customPath, numKeypoints,
            trainRatio: (typeof trainRatio === 'number' ? trainRatio : 0) / 100,
            valRatio: (typeof valRatio === 'number' ? valRatio : 0) / 100,
            testRatio: (typeof testRatio === 'number' ? testRatio : 0) / 100,
            shuffle: shuffleData, includeUnannotated, ...updates
        };
        await updateProjectConfig(currentProject, { exportSettings: currentSettings });
    };

    const isRatioValid = (trainRatio + valRatio + testRatio) === 100;

    const handleSelectFolder = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/utils/select-folder', { method: 'POST' });
            const data = await res.json();
            if (data.path) { setCustomPath(data.path); saveSettings({ customPath: data.path }); }
        } catch (err) { }
    };

    const handleExport = async () => {
        if (!isRatioValid) return;
        setIsExporting(true);
        const result = await exportProject(currentProject, {
            includeVisibility, customPath, numKeypoints,
            trainRatio: trainRatio / 100, valRatio: valRatio / 100, testRatio: testRatio / 100,
            shuffle: shuffleData, includeUnannotated
        });
        setIsExporting(false);
        if (result.success) { setExportResult(result); setShowExportModal(true); if (result.stats) setExportStats(result.stats); }
        else { setNotification({ type: 'error', message: result.message || '导出失败' }); }
    };

    const handleZipExport = async () => {
        if (!isRatioValid) return;
        setIsZipExporting(true);
        setNotification({ type: 'success', message: '正在准备 ZIP 数据集，请稍候...' });
        const result = await exportDatasetZip(currentProject, {
            includeVisibility, customPath, numKeypoints,
            trainRatio: trainRatio / 100, valRatio: valRatio / 100, testRatio: testRatio / 100,
            shuffle: shuffleData, includeUnannotated
        });
        setIsZipExporting(false);
        setNotification(null);
        if (result.success) { setExportResult({ ...result, isZip: true }); setShowExportModal(true); if (result.stats) setExportStats(result.stats); }
        else { setNotification({ type: 'error', message: result.message || '导出失败' }); }
    };

    const handleCollaborationExport = async () => {
        setIsCollaborationExporting(true);
        setNotification({ type: 'success', message: '正在打包项目资产...' });
        const result = await exportCollaboration(currentProject);
        setIsCollaborationExporting(false);
        if (result.success) { setNotification({ type: 'success', message: '✅ 协作包导出成功' }); setTimeout(() => setNotification(null), 5000); }
        else { setNotification({ type: 'error', message: '❌ 导出失败' }); }
    };

    const handleRatioChange = (type, val) => {
        const v = Math.max(0, Math.min(100, parseInt(val.replace(/[^0-9]/g, '')) || 0));
        let nt = trainRatio, nv = valRatio, nts = testRatio;
        if (type === 'train') {
            nt = v; const rem = 100 - v;
            nv = Math.round((valRatio / (valRatio + testRatio || 1)) * rem);
            nts = rem - nv;
        } else if (type === 'val') {
            nv = v; if (trainRatio + v > 100) { nt = 100 - v; nts = 0; } else { nts = 100 - trainRatio - v; }
        } else {
            nts = v; if (trainRatio + v > 100) { nt = 100 - v; nv = 0; } else { nv = 100 - trainRatio - v; }
        }
        setTrainRatio(nt); setValRatio(nv); setTestRatio(nts);
        saveSettings({ trainRatio: nt / 100, valRatio: nv / 100, testRatio: nts / 100 });
    };

    if (configLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0d1117' }}>
                <Loader2 size={40} className="spin" style={{ color: 'var(--accent-primary)' }} />
            </div>
        );
    }

    return (
        <div style={{
            padding: '2.5rem 3.5rem',
            height: '100%',
            overflowY: 'auto',
            background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
            display: 'flex',
            flexDirection: 'column'
        }} className="custom-scrollbar">

            <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', paddingBottom: '3rem' }}>

                {/* Header (Relaxed) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        <button onClick={goBack} className="nav-btn-premium" style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>数据导出中心</h1>
                                <span style={{ background: 'rgba(77, 161, 255, 0.1)', color: '#4da1ff', padding: '4px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 900, border: '1px solid rgba(77, 161, 255, 0.2)', textTransform: 'uppercase' }}>YOLO-POSE</span>
                            </div>
                            <p style={{ margin: '6px 0 0 0', color: 'var(--text-tertiary)', fontSize: '14px', fontWeight: 500 }}>
                                状态: <span style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>就绪</span> · 目标项目: <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{currentProject}</span>
                            </p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 800, letterSpacing: '1px' }}>GLOBAL SYSTEM v2.5</div>
                        <div style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 600 }}>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</div>
                    </div>
                </div>

                {/* Stats Grid (Relaxed) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.75rem', marginBottom: '3rem' }}>
                    <StatCard icon={FileImage} label="资源总量" value={isLoadingStats ? '...' : (exportStats?.totalImages || 0)} subValue="张图片素材" color="99,102,241" />
                    <StatCard icon={Box} label="标注实体" value={isLoadingStats ? '...' : (exportStats?.bboxes || 0)} subValue="实体边界框总计" color="16,185,129" />
                    <StatCard icon={Target} label="关键点云" value={isLoadingStats ? '...' : (exportStats?.keypoints || 0)} subValue="标注关键点总计" color="245,158,11" />
                    <StatCard icon={PieChart} label="标注进度" value={isLoadingStats ? '...' : (exportStats?.totalImages ? Math.round((exportStats.images / exportStats.totalImages) * 100) + '%' : '0%')} subValue={`${exportStats?.images || 0} 已完成标注`} color="77,161,255" />
                </div>

                {/* Main Bento Layout (Relaxed & Scrollable) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', alignItems: 'start' }}>

                    {/* Column 1 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        <SectionCard icon={Database} title="数据配置与粒度" color="99,102,241" subtitle="控制导出的标签细节与负样本生成策略">
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <Toggle checked={includeVisibility} onChange={e => { setIncludeVisibility(e.target.checked); saveSettings({ includeVisibility: e.target.checked }); }} icon={ShieldCheck} label="包含关键点可见性标志" desc="在标签文件中包含遮挡状态信息 (v=2 规范)" />
                                <Toggle checked={includeUnannotated} onChange={e => { setIncludeUnannotated(e.target.checked); saveSettings({ includeUnannotated: e.target.checked }); }} icon={Sparkles} label="导出负样本支持" desc="为未标注图片生成关联的全空标签文件" />

                                <div style={{
                                    marginTop: '1.5rem', padding: '1.5rem 2rem', borderRadius: '24px',
                                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ color: 'rgb(168,85,247)', display: 'flex' }}><Target size={24} /></div>
                                        <div>
                                            <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)' }}>标准关键点输出数量</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>YOLO-Pose 标准默认为 17 点</div>
                                        </div>
                                    </div>
                                    <input type="number" value={numKeypoints} onChange={e => { const v = parseInt(e.target.value) || 17; setNumKeypoints(v); saveSettings({ numKeypoints: v }); }} style={{ width: '80px', height: '48px', textAlign: 'center', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontWeight: 900, fontSize: '1.3rem', outline: 'none' }} />
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard icon={Layers} title="容量集划分分配" color="245,158,11" subtitle="通过科学比例分配优化模型的泛化与推理能力">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                                    {[
                                        { id: 'train', label: '训练集', val: trainRatio, color: '#10b981', icon: Zap },
                                        { id: 'val', label: '验证集', val: valRatio, color: '#f59e0b', icon: Layout },
                                        { id: 'test', label: '测试集', val: testRatio, color: '#3b82f6', icon: FileImage }
                                    ].map(x => (
                                        <div key={x.id} style={{
                                            background: 'rgba(255,255,255,0.035)', padding: '1.5rem 1.25rem', borderRadius: '28px',
                                            border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }} className="input-focus-ring">
                                            <div style={{ fontSize: '14px', fontWeight: 900, color: x.color, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <x.icon size={16} /> {x.label}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '12px' }}>
                                                <input type="text" value={x.val} onChange={e => handleRatioChange(x.id, e.target.value)} style={{ width: '60px', background: 'transparent', border: 'none', textAlign: 'right', color: 'white', fontSize: '1.8rem', fontWeight: 900, outline: 'none' }} />
                                                <span style={{ fontSize: '1rem', color: 'var(--text-tertiary)', fontWeight: 800, marginTop: '8px' }}>%</span>
                                            </div>
                                            <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-secondary)' }}>
                                                {Math.round((x.val / 100) * (exportStats?.totalImages || 0))}
                                                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600, marginLeft: '4px' }}>张预期</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <div style={{ height: '64px', background: 'rgba(0,0,0,0.4)', borderRadius: '20px', overflow: 'hidden', display: 'flex', border: '2px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 4px 15px rgba(0,0,0,0.6)' }}>
                                        <div style={{ width: `${trainRatio}%`, background: 'linear-gradient(to right, #059669, #10b981)', transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)', position: 'relative' }}>
                                            {trainRatio > 15 && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 950, color: 'rgba(255,255,255,0.3)', letterSpacing: '2px' }}>TRAIN</div>}
                                        </div>
                                        <div style={{ width: `${valRatio}%`, background: 'linear-gradient(to right, #d97706, #f59e0b)', transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)', position: 'relative' }}>
                                            {valRatio > 15 && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 950, color: 'rgba(255,255,255,0.3)', letterSpacing: '2px' }}>VAL</div>}
                                        </div>
                                        <div style={{ width: `${testRatio}%`, background: 'linear-gradient(to right, #2563eb, #3b82f6)', transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)', position: 'relative' }}>
                                            {testRatio > 15 && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 950, color: 'rgba(255,255,255,0.3)', letterSpacing: '2px' }}>TEST</div>}
                                        </div>
                                    </div>
                                    {!isRatioValid && <div style={{ marginTop: '1.5rem', padding: '16px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '18px', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', fontSize: '15px', fontWeight: 900, textAlign: 'center' }}>⚠️ 校验失败：当前比例总和不等于 100% (当前总和: {trainRatio + valRatio + testRatio}%)</div>}
                                </div>
                            </div>
                        </SectionCard>
                    </div>

                    {/* Column 2 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        <SectionCard icon={Download} title="存储路径与导出" color="16,185,129" subtitle="配置物理存储位置并启动生产环境流水线">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                <Toggle checked={shuffleData} onChange={e => { setShuffleData(e.target.checked); saveSettings({ shuffle: e.target.checked }); }} icon={Shuffle} label="开启全局打乱 (Shuffle)" desc="确保样本在各分配子集中分布均匀，提高训练鲁棒性" />

                                <div style={{ padding: '1.75rem', borderRadius: '28px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <FolderOpen size={20} style={{ color: 'var(--text-tertiary)' }} />
                                        <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-secondary)' }}>导出物理路径设置</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        <div style={{
                                            flex: 1, background: 'rgba(0,0,0,0.4)', borderRadius: '18px', padding: '0 20px', height: '60px',
                                            display: 'flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.06)',
                                            fontSize: '15px', color: customPath ? '#4da1ff' : 'var(--text-tertiary)', fontWeight: 600,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                        }}>
                                            {customPath || '默认路径 (项目根目录 /dataset)'}
                                        </div>
                                        <button onClick={handleSelectFolder} className="nav-btn-premium" style={{ width: '60px', height: '60px', borderRadius: '18px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FolderOpen size={24} />
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <button onClick={handleExport} disabled={isExporting || !isRatioValid} className="action-btn-main" style={{
                                        height: '72px', borderRadius: '24px', background: (isExporting || !isRatioValid) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #10b981, #059669)',
                                        color: 'white', fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px',
                                        cursor: 'pointer', border: 'none', transition: 'all 0.3s ease',
                                        boxShadow: (!isExporting && isRatioValid) ? '0 10px 30px rgba(16,185,129,0.3)' : 'none'
                                    }}>
                                        {isExporting ? <Loader2 size={28} className="spin" /> : <><Sparkles size={24} /> 立即导出 YOLO 数据集</>}
                                    </button>
                                    <button onClick={handleZipExport} disabled={isZipExporting || !isRatioValid} className="action-btn-sub" style={{
                                        height: '60px', borderRadius: '22px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                                        color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', cursor: 'pointer'
                                    }}>
                                        {isZipExporting ? <Loader2 size={22} className="spin" /> : <><Box size={22} /> 打包生成 ZIP 压缩包</>}
                                    </button>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard icon={Share2} title="快速协作同步" color="77,161,255" subtitle="跨设备导出标注源文件与核心配置信息">
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: 'rgba(77, 161, 255, 0.08)', padding: '1.5rem 2rem',
                                borderRadius: '24px', border: '1px solid rgba(77, 161, 255, 0.15)'
                            }}>
                                <div>
                                    <div style={{ fontSize: '17px', fontWeight: 950, color: '#4da1ff' }}>生成项目协作包</div>
                                    <div style={{ fontSize: '13px', color: 'rgba(77, 161, 255, 0.8)', marginTop: '4px' }}>同步标注状态、类名定义及素材逻辑路径</div>
                                </div>
                                <button onClick={handleCollaborationExport} disabled={isCollaborationExporting} style={{
                                    padding: '14px 28px', borderRadius: '16px', background: '#2563eb', color: 'white',
                                    border: 'none', fontSize: '15px', fontWeight: 900, cursor: 'pointer',
                                    boxShadow: '0 8px 20px rgba(37, 99, 235, 0.4)'
                                }}>
                                    {isCollaborationExporting ? <Loader2 size={20} className="spin" /> : '立即打包'}
                                </button>
                            </div>
                        </SectionCard>

                    </div>
                </div>
            </div>

            {/* Notification & Result Modals (Preserved) */}
            {notification && createPortal(<div style={{ position: 'fixed', bottom: '40px', right: '40px', zIndex: 20000, animation: 'slideInRight 0.4s ease' }}><div style={{ padding: '18px 32px', background: notification.type === 'success' ? '#10b981' : '#ef4444', borderRadius: '20px', color: 'white', fontWeight: 800, fontSize: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', gap: '14px' }}>{notification.type === 'success' ? <CheckCircle size={24} /> : <Info size={24} />} <div>{notification.message}</div></div></div>, document.body)}

            {showExportModal && exportResult && createPortal(<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(25px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20001, animation: 'fadeIn 0.3s ease' }} onClick={() => setShowExportModal(false)}><div style={{ background: 'linear-gradient(135deg, #222, #111)', borderRadius: '40px', padding: '4rem', maxWidth: '700px', width: '90%', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', boxShadow: '0 50px 120px rgba(0,0,0,0.9)', animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }} onClick={e => e.stopPropagation()}><div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', margin: '0 auto 2rem', border: '4px solid rgba(16, 185, 129, 0.3)' }}><CheckCircle size={64} strokeWidth={2.5} /></div><h2 style={{ color: 'white', fontSize: '2.8rem', fontWeight: 950, marginBottom: '1rem' }}>数据集构建完成</h2><p style={{ color: 'var(--text-tertiary)', fontSize: '18px', marginBottom: '3rem', wordBreak: 'break-all' }}>目标位置: {exportResult.path}</p><button onClick={() => setShowExportModal(false)} style={{ width: '100%', height: '72px', borderRadius: '22px', background: 'white', color: 'black', fontSize: '1.4rem', fontWeight: 950, border: 'none', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 10px 30px rgba(255,255,255,0.2)' }}>确 定</button></div></div>, document.body)}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes slideInRight { from { transform: translateX(120px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes scaleIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .spin { animation: spin 0.8s linear infinite; }
                .nav-btn-premium:hover { background: rgba(255,255,255,0.12) !important; transform: scale(1.08) rotate(-5deg); border-color: rgba(255,255,255,0.3) !important; }
                .action-btn-main:hover:not(:disabled) { transform: translateY(-6px) scale(1.02); filter: brightness(1.2); }
                .action-btn-sub:hover:not(:disabled) { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.25) !important; transform: translateY(-3px); }
                .stat-card-premium:hover { transform: translateY(-8px); border-color: rgba(255,255,255,0.25) !important; background: rgba(40, 40, 40, 0.6) !important; }
                .toggle-premium:hover { border-color: rgba(255,255,255,0.2) !important; background: rgba(255,255,255,0.06) !important; transform: translateX(4px); }
                .input-focus-ring:focus-within { border-color: rgba(255,255,255,0.3) !important; background: rgba(255,255,255,0.1) !important; transform: translateY(-4px); }
            `}</style>
        </div>
    );
};
