import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getImageName, validateSequentialNumbering } from '../utils/imageNumbering';

const ProjectContext = createContext();

export const useProject = () => useContext(ProjectContext);

export const ProjectProvider = ({ children }) => {
    const [projects, setProjects] = useState([]);
    const [currentProject, setCurrentProject] = useState(null);
    const [images, setImages] = useState([]);
    const [view, setView] = useState('dashboard');
    const [previousView, setPreviousView] = useState('dashboard');
    const [selectedImage, setSelectedImage] = useState(null);
    const [editorNavImages, setEditorNavImages] = useState(null);
    const [editorReloadToken, setEditorReloadToken] = useState(0);
    const [galleryFilters, setGalleryFilters] = useState({
        search: '',
        annotated: 'all',
        keypointsMin: '',
        keypointsMax: '',
        bboxesMin: '',
        bboxesMax: ''
    });
    const [loading, setLoading] = useState(false);
    const [configLoading, setConfigLoading] = useState(false);
    const [projectConfig, setProjectConfig] = useState({ classMapping: {}, exportSettings: {}, trainingSettings: {} });
    const [deletingProjects, setDeletingProjects] = useState(new Set());
    const updateTimeoutRef = useRef(null);
    const editorAttemptNavigationRef = useRef(null);

    const registerEditorAttemptNavigation = useCallback((fn) => {
        editorAttemptNavigationRef.current = fn;
        return () => {
            if (editorAttemptNavigationRef.current === fn) {
                editorAttemptNavigationRef.current = null;
            }
        };
    }, []);

    const navigateTo = useCallback(async (nextView) => {
        const runNavigation = async () => {
            if (nextView === 'settings') setPreviousView(view);
            setView(nextView);
        };

        const attemptNavigation = editorAttemptNavigationRef.current;
        if (view === 'editor' && attemptNavigation) {
            return await attemptNavigation({ type: 'switchView', view: nextView }, runNavigation);
        }

        await runNavigation();
        return true;
    }, [view]);

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

            // If first time and no selection, default to the first image
            const savedImage = localStorage.getItem(`lastImage_${projectId}`);
            if (!savedImage && data.length > 0) {
                const firstImage = getImageName(data[0]);
                setSelectedImage(firstImage);
            }
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

        setProjectConfig(prev => {
            const next = { ...prev, ...updates };

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

    const createProject = async (name, customPath = null) => {
        try {
            const res = await fetch('http://localhost:5000/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, customPath })
            });
            const data = await res.json();
            if (res.ok) {
                await fetchProjects();
                return data.id;
            } else {
                console.error("Failed to create project:", data.error);
            }
        } catch (err) {
            console.error("Failed to create project", err);
        }
        return null;
    };

    const deleteProject = async (projectId) => {
        if (deletingProjects.has(projectId)) {
            return { success: false, message: '项目正在删除中...' };
        }

        setDeletingProjects(prev => new Set([...prev, projectId]));

        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (res.ok) {
                setProjects(prev => prev.filter(p => p.id !== projectId));
                localStorage.removeItem(`lastImage_${projectId}`);
                await fetchProjects();
                if (currentProject === projectId) {
                    setCurrentProject(null);
                    setView('dashboard');
                }

                if (data.pendingCleanup) {
                    return {
                        success: true,
                        message: '项目已删除（部分文件被占用，将在重启后完全清理）',
                        pendingCleanup: true
                    };
                }
                return { success: true, message: data.message || '项目已删除' };
            } else {
                return { success: false, message: data.error || '删除失败', details: data.details };
            }
        } catch (err) {
            console.error("Failed to delete project", err);
            return { success: false, message: '删除失败：网络错误' };
        } finally {
            setDeletingProjects(prev => {
                const next = new Set(prev);
                next.delete(projectId);
                return next;
            });
        }
    };

    const isProjectDeleting = (projectId) => {
        return deletingProjects.has(projectId);
    };

    const selectProject = (projectId) => {
        setImages([]);
        setCurrentProject(projectId);
        setView('gallery');
        setEditorNavImages(null);
        setGalleryFilters({
            search: '',
            annotated: 'all',
            keypointsMin: '',
            keypointsMax: '',
            bboxesMin: '',
            bboxesMax: ''
        });

        // Load persistent editor state
        const lastImage = localStorage.getItem(`lastImage_${projectId}`);
        if (lastImage) {
            setSelectedImage(lastImage);
        } else {
            setSelectedImage(null);
        }

        fetchImages(projectId);
        fetchProjectConfig(projectId);
    };

    const openEditor = (image, options = null) => {
        setSelectedImage(image);
        if (options && Array.isArray(options.navImages)) {
            setEditorNavImages(options.navImages);
        }
        setView('editor');
    };

    const goBack = () => {
        if (view === 'editor') {
            setView('gallery');
            // We keep selectedImage to allow returning to the editor
            if (currentProject) fetchImages(currentProject);
        } else if (view === 'export' || view === 'training') {
            setView('gallery');
            if (currentProject) fetchImages(currentProject);
        } else if (view === 'settings') {
            setView(previousView);
        } else if (view === 'gallery') {
            exitProject();
        }
    };

    const exitProject = useCallback(() => {
        setView('dashboard');
        setCurrentProject(null);
        setSelectedImage(null); // Clear image when leaving project
        setImages([]);
        fetchProjects();
    }, [fetchProjects]);

    const goToTraining = (projectId) => {
        if (projectId) {
            setCurrentProject(projectId);
        }
        setView('training');
    };

    const openSettings = () => {
        navigateTo('settings');
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

    const exportDatasetZip = async (projectId, options) => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/export/yolo-zip`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(options)
            });
            const data = await res.json();
            return {
                success: data.success !== undefined ? data.success : res.ok,
                message: data.message || (data.details ? `${data.error || 'ZIP export failed'}: ${data.details}` : data.error),
                path: data.path,
                zipSize: data.zipSize,
                stats: data.stats,
                error: data.error
            };
        } catch (err) {
            console.error("Failed to export dataset as ZIP", err);
            return { success: false, message: 'ZIP export failed due to network error' };
        }
    };

    const exportCollaboration = async (projectId) => {
        try {
            if (window.electronAPI) {
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
                return { success: false, message: '已取消导出' };
            }

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



    const inspectCollaboration = async (zipPath) => {
        try {
            const res = await fetch('http://localhost:5000/api/projects/collaboration/inspect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: zipPath })
            });
            const data = await res.json();
            return data;
        } catch (err) {
            console.error("Failed to inspect collaboration package", err);
            return { success: false, error: '检查失败：网络错误' };
        }
    };

    const importCollaboration = async (zipPath, customPath = null) => {
        try {
            if (!zipPath) {
                const resDir = await fetch('http://localhost:5000/api/utils/select-file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filters: [{ name: '项目协作包 (ZIP)', extensions: ['zip'] }]
                    })
                });
                const dirData = await resDir.json();
                zipPath = dirData.path;
            }

            if (zipPath) {
                const res = await fetch('http://localhost:5000/api/projects/collaboration/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: zipPath, customPath })
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

    const deleteImage = async (projectId, imageId, navigateToNextOrOptions = false, currentIndex = 0) => {
        const opts = (navigateToNextOrOptions && typeof navigateToNextOrOptions === 'object')
            ? navigateToNextOrOptions
            : null;
        const navigateToNext = opts ? !!opts.navigateToNext : !!navigateToNextOrOptions;
        const effectiveCurrentIndex = opts && Number.isFinite(opts.currentIndex) ? opts.currentIndex : currentIndex;
        const renumberAfterDelete = opts ? !!opts.renumberAfterDelete : false;
        let renumberInfo = null;

        console.log('deleteImage called:', { projectId, imageId, navigateToNext, currentIndex: effectiveCurrentIndex, renumberAfterDelete });
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/images/${encodeURIComponent(imageId)}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            console.log('Delete API response:', data);
            if (res.ok) {
                if (navigateToNext) {
                    if (data.remainingCount > 0) {
                        const targetIndex = Math.max(0, Math.min(effectiveCurrentIndex, data.remainingCount - 1));
                        console.log('Target index for navigation:', targetIndex);

                        if (renumberAfterDelete) {
                            try {
                                const renumberRes = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/renumber-all`, {
                                    method: 'POST'
                                });
                                renumberInfo = await renumberRes.json();
                                if (!renumberRes.ok) {
                                    renumberInfo = { error: renumberInfo?.error || '重命名失败' };
                                }
                            } catch {
                                renumberInfo = { error: '重命名失败：网络错误' };
                            }
                        }

                        const imagesRes = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/images`);
                        const newImages = await imagesRes.json();
                        console.log('New images list:', newImages);

                        const validation = validateSequentialNumbering(newImages);
                        if (validation.checked && !validation.ok) {
                            console.warn('Image numbering validation failed:', validation);
                        }

                        if (newImages.length > targetIndex) {
                            const newImageName = getImageName(newImages[targetIndex]);
                            console.log('Setting selectedImage to:', newImageName);
                            setImages(newImages);
                            setEditorNavImages(newImages);
                            if (newImageName === imageId) {
                                setEditorReloadToken(prev => prev + 1);
                            }
                            setSelectedImage(newImageName);
                        } else if (newImages.length > 0) {
                            const newImageName = getImageName(newImages[newImages.length - 1]);
                            setImages(newImages);
                            setEditorNavImages(newImages);
                            if (newImageName === imageId) {
                                setEditorReloadToken(prev => prev + 1);
                            }
                            setSelectedImage(newImageName);
                        } else {
                            setImages([]);
                            setView('gallery');
                            setSelectedImage(null);
                            setEditorNavImages(null);
                        }

                    } else {
                        console.log('No remaining images, going to gallery');
                        setImages([]);
                        setView('gallery');
                        setSelectedImage(null);
                        setEditorNavImages(null);
                    }
                } else {
                    await fetchImages(projectId);
                }

                await fetchProjects();

                return { success: true, message: data.message, remainingCount: data.remainingCount, renumber: renumberInfo };
            } else {
                return { success: false, message: data.error || '删除失败' };
            }
        } catch (err) {
            console.error("Failed to delete image", err);
            return { success: false, message: '删除失败：网络错误' };
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

    const getPredictionSettings = async (projectId) => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/prediction-settings`);
            const data = await res.json();
            return data;
        } catch (err) {
            console.error("Failed to get prediction settings", err);
            return { modelPath: '', confidenceThreshold: 0.5, lastPredictionTime: null };
        }
    };

    const savePredictionSettings = async (projectId, settings) => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/prediction-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const data = await res.json();
            return { success: res.ok, message: data.message || data.error, data };
        } catch (err) {
            console.error("Failed to save prediction settings", err);
            return { success: false, message: '保存失败：网络错误' };
        }
    };

    const runPrediction = async (projectId, options) => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(options)
            });
            const data = await res.json();
            return { success: res.ok, taskId: data.taskId, message: data.message || data.error };
        } catch (err) {
            console.error("Failed to run prediction", err);
            return { success: false, message: '预标注失败：网络错误' };
        }
    };

    const getPredictionStatus = async (projectId) => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/predict/status`);
            const data = await res.json();
            return data;
        } catch (err) {
            console.error("Failed to get prediction status", err);
            return { isRunning: false, progress: 0, current: 0, total: 0, message: '' };
        }
    };

    const cancelPrediction = async (projectId) => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/predict/cancel`, {
                method: 'POST'
            });
            const data = await res.json();
            return { success: res.ok, message: data.message || data.error };
        } catch (err) {
            console.error("Failed to cancel prediction", err);
            return { success: false, message: '取消失败：网络错误' };
        }
    };

    const validateModel = async (projectId, modelPath) => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/predict/validate-model`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelPath })
            });
            const data = await res.json();
            return { success: res.ok, ...data };
        } catch (err) {
            console.error("Failed to validate model", err);
            return { success: false, error: '验证失败：网络错误' };
        }
    };

    const predictSingleImage = async (projectId, imageName, modelPath, confidenceThreshold = 0.25) => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/predict/single`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageName, modelPath, confidenceThreshold })
            });
            const data = await res.json();
            return { success: res.ok, ...data };
        } catch (err) {
            console.error("Failed to predict single image", err);
            return { success: false, error: '预标注失败：网络错误' };
        }
    };

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    // Save persistent editor state
    useEffect(() => {
        if (currentProject && selectedImage) {
            localStorage.setItem(`lastImage_${currentProject}`, selectedImage);
        }
    }, [currentProject, selectedImage]);

    const value = {
        projects,
        currentProject,
        images,
        view,
        selectedImage,
        editorNavImages,
        editorReloadToken,
        galleryFilters,
        setGalleryFilters,
        loading,
        setView,
        navigateTo,
        registerEditorAttemptNavigation,
        createProject,
        deleteProject,
        isProjectDeleting,
        selectProject,
        openEditor,
        goBack,
        exitProject,
        goToTraining,
        openSettings,
        refreshImages: () => fetchImages(currentProject),
        exportProject,
        exportDatasetZip,
        exportCollaboration,
        inspectCollaboration,
        importCollaboration,
        renumberProject,
        deleteImage,
        selectFolder,
        scanImages,
        importImages,
        getImportHistory,
        projectConfig,
        configLoading,
        updateProjectConfig,
        getPredictionSettings,
        savePredictionSettings,
        runPrediction,
        getPredictionStatus,
        cancelPrediction,
        validateModel,
        predictSingleImage
    };

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
};
