import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const ProjectContext = createContext();

export const useProject = () => useContext(ProjectContext);

export const ProjectProvider = ({ children }) => {
    const [projects, setProjects] = useState([]);
    const [currentProject, setCurrentProject] = useState(null); // String ID
    const [images, setImages] = useState([]);
    const [view, setView] = useState('dashboard'); // 'dashboard', 'gallery', 'editor', 'export', 'training'
    const [previousView, setPreviousView] = useState('dashboard');
    const [selectedImage, setSelectedImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [configLoading, setConfigLoading] = useState(false);
    const [projectConfig, setProjectConfig] = useState({ classMapping: {}, exportSettings: {}, trainingSettings: {} });
    const updateTimeoutRef = useRef(null);

    // --- Actions ---

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:5000/api/projects');
            const data = await res.json();
            setProjects(data);
        } catch (err) {
            console.error("Failed to fetch projects", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchImages = useCallback(async (projectId) => {
        if (!projectId) return;
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/images`);
            const data = await res.json();
            setImages(data);
        } catch (err) {
            console.error("Failed to fetch images", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchProjectConfig = useCallback(async (projectId) => {
        if (!projectId) return;
        setConfigLoading(true);
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/config`);
            const data = await res.json();
            setProjectConfig(data);
        } catch (err) {
            console.error("Failed to fetch project config", err);
        } finally {
            setConfigLoading(false);
        }
    }, []);

    const updateProjectConfig = (projectId, updates) => {
        if (!projectId) return;

        // Update local state immediately for UI responsiveness
        setProjectConfig(prev => {
            const next = { ...prev, ...updates };

            // Debounce the backend update
            if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
            updateTimeoutRef.current = setTimeout(async () => {
                try {
                    await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/config`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(next)
                    });
                } catch (err) {
                    console.error("Failed to sync project config to backend", err);
                }
            }, 500);

            return next;
        });
    };

    const createProject = async (name) => {
        try {
            const res = await fetch('http://localhost:5000/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (res.ok) {
                await fetchProjects();
                return data.id;
            }
        } catch (err) {
            console.error("Failed to create project", err);
        }
        return null;
    };

    const deleteProject = async (projectId) => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
            if (res.ok) {
                await fetchProjects();
                if (currentProject === projectId) {
                    setCurrentProject(null);
                    setView('dashboard');
                }
                return { success: true, message: '项目已删除' };
            } else {
                const data = await res.json();
                return { success: false, message: data.error || '删除失败' };
            }
        } catch (err) {
            console.error("Failed to delete project", err);
            return { success: false, message: '删除失败：网络错误' };
        }
    };

    const selectProject = (projectId) => {
        setImages([]);
        setCurrentProject(projectId);
        setView('gallery');
        fetchImages(projectId);
        fetchProjectConfig(projectId);
    };

    const openEditor = (image) => {
        setSelectedImage(image);
        setView('editor');
    };

    const goBack = () => {
        if (view === 'editor') {
            setView('gallery');
            setSelectedImage(null);
            if (currentProject) fetchImages(currentProject);
        } else if (view === 'export' || view === 'training') {
            setView('gallery');
            if (currentProject) fetchImages(currentProject);
        } else if (view === 'settings') {
            setView(previousView);
        } else if (view === 'gallery') {
            setView('dashboard');
            setCurrentProject(null);
            setImages([]);
            fetchProjects(); // Refresh counts
        }
    };

    const goToTraining = (projectId) => {
        if (projectId) {
            setCurrentProject(projectId);
        }
        setView('training');
    };

    const openSettings = () => {
        setPreviousView(view);
        setView('settings');
    };

    const exportProject = async (projectId, options) => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/export/yolo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(options)
            });
            const data = await res.json();
            return {
                success: res.ok,
                message: data.details ? `${data.error || 'Export failed'}: ${data.details}` : (data.message || data.error),
                path: data.path,
                stats: data.stats
            };
        } catch (err) {
            console.error("Failed to export project", err);
            return { success: false, message: 'Export failed due to network error' };
        }
    };

    const exportCollaboration = async (projectId) => {
        try {
            // If in Electron, use the native save dialog
            if (window.electronAPI) {
                // 1. Show save dialog
                const saveDialogRes = await fetch('http://localhost:5000/api/utils/save-file-dialog', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: '导出协作包',
                        defaultPath: `${projectId}_collaboration.zip`,
                        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
                    })
                });
                const dialogData = await saveDialogRes.json();

                if (dialogData.path) {
                    // 2. Perform export to path
                    const exportRes = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/collaboration/export-to-path`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ savePath: dialogData.path })
                    });
                    const result = await exportRes.json();

                    if (result.success) {
                        return {
                            success: true,
                            message: `✅ 协作包已成功保存至：${dialogData.path}`,
                            path: dialogData.path
                        };
                    } else {
                        return { success: false, message: result.error || '导出失败' };
                    }
                }
                return { success: false, message: '已取消导出' }; // User canceled
            }

            // Fallback for non-electron: use direct download link
            const url = `http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/collaboration/export`;
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${projectId}_collaboration.zip`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            return { success: true, message: '正在导出协作包，请查看浏览器下载记录' };
        } catch (err) {
            console.error("Failed to export collaboration package", err);
            return { success: false, message: '导出失败：网络错误或服务器异常' };
        }
    };



    const importCollaboration = async () => {
        try {
            // First select a file via Electron if possible
            const resDir = await fetch('http://localhost:5000/api/utils/select-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filters: [{ name: '项目协作包 (ZIP)', extensions: ['zip'] }]
                })
            });
            const dirData = await resDir.json();

            if (dirData.path) {
                const res = await fetch('http://localhost:5000/api/projects/collaboration/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: dirData.path })
                });
                const data = await res.json();
                if (res.ok) {
                    await fetchProjects();
                    return { success: true, message: '项目导入成功' };
                } else {
                    return { success: false, message: data.error || '项目导入失败' };
                }
            }
        } catch (err) {
            console.error("Failed to import collaboration package", err);
            return { success: false, message: '导入失败：网络错误' };
        }
        return { success: false, message: '取消导入' };
    };

    const renumberProject = async (projectId) => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/renumber-all`, {
                method: 'POST'
            });
            const data = await res.json();
            if (res.ok) {
                await fetchProjects();
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.error || '重命名失败' };
            }
        } catch (err) {
            console.error("Failed to renumber project", err);
            return { success: false, message: '重命名失败：网络错误' };
        }
    };

    const selectFolder = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/utils/select-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            return data;
        } catch (err) {
            console.error("Failed to select folder", err);
            return { path: null, error: '选择文件夹失败' };
        }
    };

    const scanImages = async (folderPath, maxResults = 5000) => {
        try {
            const res = await fetch('http://localhost:5000/api/utils/scan-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath, maxResults })
            });
            const data = await res.json();
            if (res.ok) {
                return { success: true, ...data };
            } else {
                return { success: false, error: data.error || '扫描失败' };
            }
        } catch (err) {
            console.error("Failed to scan images", err);
            return { success: false, error: '扫描失败：网络错误' };
        }
    };

    const importImages = async (projectId, images, mode = 'copy') => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/import-images`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images, mode })
            });
            const data = await res.json();
            if (res.ok) {
                return { success: true, ...data };
            } else {
                return { success: false, error: data.error || '导入失败' };
            }
        } catch (err) {
            console.error("Failed to import images", err);
            return { success: false, error: '导入失败：网络错误' };
        }
    };

    const getImportHistory = async (projectId) => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/import-history`);
            const data = await res.json();
            return data.history || [];
        } catch (err) {
            console.error("Failed to get import history", err);
            return [];
        }
    };

    // Initial Load
    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const value = {
        projects,
        currentProject,
        images,
        view,
        selectedImage,
        loading,
        setView,
        createProject,
        deleteProject,
        selectProject,
        openEditor,
        goBack,
        goToTraining,
        openSettings,
        refreshImages: () => fetchImages(currentProject),
        exportProject,
        exportCollaboration,
        importCollaboration,
        renumberProject,
        selectFolder,
        scanImages,
        importImages,
        getImportHistory,
        projectConfig,
        configLoading,
        updateProjectConfig
    };

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
};
