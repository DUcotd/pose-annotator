import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { Layers, Image as ImageIcon, Box, ArrowLeft, Settings, Home, Download, CheckCircle, AlertTriangle, Terminal, Menu, X } from 'lucide-react';
import { ExportModal } from './ExportModal';

export const MainLayout = ({ children }) => {
    const { currentProject, view, goBack, setView, exportProject, openSettings } = useProject();
    const [notification, setNotification] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 992) {
                setSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        setSidebarOpen(false);
    }, [view, currentProject]);

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
            <button 
                className="mobile-menu-btn"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Toggle menu"
            >
                {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <div 
                className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-brand">
                    <div className="brand-logo">
                        <Box size={24} strokeWidth={2.5} />
                    </div>
                    <div className="brand-text">
                        <h1>数据标注平台</h1>
                        <span className="brand-tagline">AI Smart Labeling</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-section">
                        {currentProject ? (
                            <>
                                <button onClick={() => { goBack(); setSidebarOpen(false); }} className="nav-btn-back">
                                    <ArrowLeft size={16} strokeWidth={2.5} />
                                    <span>返回项目列表</span>
                                </button>
                                <div className="sidebar-project-card">
                                    <div className="project-card-header">
                                        <div className="project-card-icon">
                                            <Layers size={14} strokeWidth={2.5} />
                                        </div>
                                        <span className="sidebar-label" style={{ margin: 0, fontSize: '10px' }}>CURRENT PROJECT</span>
                                    </div>
                                    <div className="project-card-name" title={currentProject}>
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
                                onClick={() => { setView('gallery'); setSidebarOpen(false); }}
                                icon={<ImageIcon size={18} />}
                                label="图库"
                            />

                            {view === 'editor' && (
                                <NavButton
                                    active={true}
                                    onClick={() => {}}
                                    icon={<Box size={18} />}
                                    label="编辑器"
                                />
                            )}

                            <NavButton
                                active={view === 'export'}
                                onClick={() => { setView('export'); setSidebarOpen(false); }}
                                icon={<Download size={18} />}
                                label="导出数据集"
                            />

                            <NavButton
                                active={view === 'training'}
                                onClick={() => { setView('training'); setSidebarOpen(false); }}
                                icon={<Terminal size={18} />}
                                label="模型训练"
                            />
                        </>
                    )}

                </nav>

                <div className="sidebar-footer">
                    <button className="nav-btn" onClick={() => { openSettings(); setSidebarOpen(false); }}>
                        <Settings size={18} strokeWidth={2} />
                        <span>系统设置</span>
                    </button>
                </div>
            </aside>

            <main className="main-content">
                {children}

                {notification && (
                    <div className={`animate-fade-in notification ${notification.type}`}>
                        {notification.type === 'success' ? <CheckCircle color="var(--success)" size={20} /> : <AlertTriangle color="var(--danger)" size={20} />}
                        <span>{notification.message}</span>
                    </div>
                )}
            </main>

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
