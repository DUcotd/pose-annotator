import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { Layers, Image as ImageIcon, Box, ArrowLeft, Settings, Home, Download, CheckCircle, AlertTriangle, Terminal } from 'lucide-react';
import { ExportModal } from './ExportModal';

export const MainLayout = ({ children }) => {
    const { currentProject, view, goBack, setView, exportProject } = useProject();
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [notification, setNotification] = useState(null);

    const handleExport = async (options) => {
        const result = await exportProject(currentProject, options);
        let message = result.message;
        if (result.success && result.stats) {
            const s = result.stats;
            const splitInfo = [
                s.train > 0 && `train: ${s.train}`,
                s.val > 0 && `val: ${s.val}`,
                s.test > 0 && `test: ${s.test}`
            ].filter(Boolean).join(', ');
            message = `导出成功！已标注 ${s.images}/${s.totalImages} 张图片 (${splitInfo})，${s.objects} 个目标`;
        }
        setNotification({ type: result.success ? 'success' : 'error', message });
        setTimeout(() => setNotification(null), 8000);
    };

    return (
        <div className="app-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <Box size={28} />
                    <h1>数据标注平台</h1>
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-section">
                        {currentProject ? (
                            <>
                                <button onClick={goBack} className="nav-btn-back">
                                    <ArrowLeft size={18} />
                                    <span>返回</span>
                                </button>
                                <div style={{ marginTop: '1rem', padding: '0 5px' }}>
                                    <small className="sidebar-label">当前项目</small>
                                    <div className="sidebar-project">
                                        <Layers size={16} color="var(--accent-primary)" />
                                        {currentProject}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="nav-info">
                                <Home size={18} />
                                <span>项目仪表盘</span>
                            </div>
                        )}
                    </div>

                    {currentProject && (
                        <>
                            <NavButton
                                active={view === 'gallery' || view === 'upload'}
                                onClick={() => setView('gallery')}
                                icon={<ImageIcon size={18} />}
                                label="图库"
                            />

                            {view === 'editor' && (
                                <NavButton
                                    active={true}
                                    onClick={() => { }}
                                    icon={<Box size={18} />}
                                    label="编辑器"
                                />
                            )}

                            <NavButton
                                active={false}
                                onClick={() => setIsExportModalOpen(true)}
                                icon={<Download size={18} />}
                                label="导出数据集"
                            />

                            <NavButton
                                active={view === 'training'}
                                onClick={() => setView('training')}
                                icon={<Terminal size={18} />}
                                label="模型训练"
                            />
                        </>
                    )}

                </nav>

                <div className="sidebar-footer">
                    <button className="nav-btn">
                        <Settings size={18} />
                        <span>设置</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                {children}

                {notification && (
                    <div className={`animate-fade-in notification ${notification.type}`}>
                        {notification.type === 'success' ? <CheckCircle color="var(--success)" size={20} /> : <AlertTriangle color="var(--danger)" size={20} />}
                        <span>{notification.message}</span>
                    </div>
                )}
            </main>

            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                onExport={handleExport}
            />
        </div>
    );
};

const NavButton = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`nav-btn ${active ? 'active' : ''}`}
    >
        {icon}
        <span>{label}</span>
    </button>
);
