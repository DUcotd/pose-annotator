import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getImageName, validateSequentialNumbering } from '../utils/imageNumbering';
import { apiUrl } from '../api';
import { apiClient } from '../lib/apiClient';
import { useErrorCenter } from '../error/ErrorCenter';

const ProjectContext = createContext();

export const useProject = () => useContext(ProjectContext);

export const ProjectProvider = ({ children }) => {
    const { reportError } = useErrorCenter();
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

    const reportProjectError = useCallback((err, source, extra = {}) => {
        reportError(err, {
            source,
            projectId: currentProject || null,
            ...extra
        });
    }, [reportError, currentProject]);

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
            const data = await apiClient.get('/api/projects');
            setProjects(data);
        } catch (err) {
            console.error("Failed to fetch projects", err);
            reportProjectError(err, 'project-context.fetch-projects');
        } finally {
            setLoading(false);
        }
    }, [reportProjectError]);

    const fetchImages = useCallback(async (projectId) => {
        if (!projectId) return;
        setLoading(true);
        try {
            const data = await apiClient.get(`/api/projects/${encodeURIComponent(projectId)}/images`);
            setImages(data);

            // If first time and no selection, default to the first image
            const savedImage = localStorage.getItem(`lastImage_${projectId}`);
            if (!savedImage && data.length > 0) {
                const firstImage = getImageName(data[0]);
                setSelectedImage(firstImage);
            }
        } catch (err) {
            console.error("Failed to fetch images", err);
            reportProjectError(err, 'project-context.fetch-images', { targetProjectId: projectId });
        } finally {
            setLoading(false);
        }
    }, [reportProjectError]);

    const fetchProjectConfig = useCallback(async (projectId) => {
        if (!projectId) return;
        setConfigLoading(true);
        try {
            const data = await apiClient.get(`/api/projects/${encodeURIComponent(projectId)}/config`);
            setProjectConfig(data);
        } catch (err) {
            console.error("Failed to fetch project config", err);
            reportProjectError(err, 'project-context.fetch-project-config', { targetProjectId: projectId });
        } finally {
            setConfigLoading(false);
        }
    }, [reportProjectError]);

    const updateProjectConfig = (projectId, updates) => {
        if (!projectId) return;

        setProjectConfig(prev => {
            const next = { ...prev, ...updates };

            if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
            updateTimeoutRef.current = setTimeout(async () => {
                try {
                    await apiClient.post(`/api/projects/${encodeURIComponent(projectId)}/config`, next);
                } catch (err) {
                    console.error("Failed to sync project config to backend", err);
                    reportProjectError(err, 'project-context.sync-project-config', { targetProjectId: projectId });
                }
            }, 500);

            return next;
        });
    };

    const createProject = async (name, customPath = null) => {
        try {
            const data = await apiClient.post('/api/projects', { name, customPath });
            if (data) {
                await fetchProjects();
                return {
                    success: true,
                    id: data.id,
                    message: data.message || '项目创建成功'
                };
            }
        } catch (err) {
            console.error("Failed to create project", err);
            reportProjectError(err, 'project-context.create-project', { name, customPath });
            return {
                success: false,
                message: err?.message || '创建项目失败：网络错误'
            };
        }
    };

    const deleteProject = async (projectId) => {
        if (deletingProjects.has(projectId)) {
            return { success: false, message: '项目正在删除中...' };
        }

        setDeletingProjects(prev => new Set([...prev, projectId]));

        try {
            const data = await apiClient.del(`/api/projects/${encodeURIComponent(projectId)}`);
            if (data) {
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
            }
        } catch (err) {
            console.error("Failed to delete project", err);
            reportProjectError(err, 'project-context.delete-project', { targetProjectId: projectId });
            return { success: false, message: err?.message || '删除失败：网络错误' };
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
            const data = await apiClient.post(`/api/projects/${encodeURIComponent(projectId)}/export/yolo`, options);
            return {
                success: true,
                message: data?.details ? `${data.error || 'Export failed'}: ${data.details}` : (data?.message || data?.error),
                path: data.path,
                stats: data.stats
            };
        } catch (err) {
            console.error("Failed to export project", err);
            reportProjectError(err, 'project-context.export-project', { targetProjectId: projectId });
            return { success: false, message: err?.message || 'Export failed due to network error' };
        }
    };

    const exportDatasetZip = async (projectId, options) => {
        try {
            const data = await apiClient.post(`/api/projects/${encodeURIComponent(projectId)}/export/yolo-zip`, options);
            return {
                success: data.success !== undefined ? data.success : true,
                message: data.message || (data.details ? `${data.error || 'ZIP export failed'}: ${data.details}` : data.error),
                path: data.path,
                zipSize: data.zipSize,
                stats: data.stats,
                error: data.error
            };
        } catch (err) {
            console.error("Failed to export dataset as ZIP", err);
            reportProjectError(err, 'project-context.export-dataset-zip', { targetProjectId: projectId });
            return { success: false, message: err?.message || 'ZIP export failed due to network error' };
        }
    };

    const exportCollaboration = async (projectId) => {
        try {
            if (window.electronAPI) {
                const dialogData = await apiClient.post('/api/utils/save-file-dialog', {
                    title: '导出协作包',
                    defaultPath: `${projectId}_collaboration.zip`,
                    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
                });

                if (dialogData.path) {
                    const result = await apiClient.post(`/api/projects/${encodeURIComponent(projectId)}/collaboration/export-to-path`, { savePath: dialogData.path });

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

            const url = apiUrl(`/api/projects/${encodeURIComponent(projectId)}/collaboration/export`);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${projectId}_collaboration.zip`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            return { success: true, message: '正在导出协作包，请查看浏览器下载记录' };
        } catch (err) {
            console.error("Failed to export collaboration package", err);
            reportProjectError(err, 'project-context.export-collaboration', { targetProjectId: projectId });
            return { success: false, message: err?.message || '导出失败：网络错误或服务器异常' };
        }
    };



    const inspectCollaboration = async (zipPath) => {
        try {
            return await apiClient.post('/api/projects/collaboration/inspect', { path: zipPath });
        } catch (err) {
            console.error("Failed to inspect collaboration package", err);
            reportProjectError(err, 'project-context.inspect-collaboration', { zipPath });
            return { success: false, error: err?.message || '检查失败：网络错误' };
        }
    };

    const importCollaboration = async (zipPath, customPath = null) => {
        try {
            if (!zipPath) {
                const dirData = await apiClient.post('/api/utils/select-file', {
                    filters: [{ name: '项目协作包 (ZIP)', extensions: ['zip'] }]
                });
                zipPath = dirData.path;
            }

            if (zipPath) {
                await apiClient.post('/api/projects/collaboration/import', { path: zipPath, customPath });
                await fetchProjects();
                return { success: true, message: '项目导入成功' };
            }
        } catch (err) {
            console.error("Failed to import collaboration package", err);
            reportProjectError(err, 'project-context.import-collaboration', { zipPath, customPath });
            return { success: false, message: err?.message || '导入失败：网络错误' };
        }
        return { success: false, message: '取消导入' };
    };

    const renumberProject = async (projectId) => {
        try {
            const data = await apiClient.post(`/api/projects/${encodeURIComponent(projectId)}/renumber-all`, {});
            await fetchProjects();
            return { success: true, message: data.message };
        } catch (err) {
            console.error("Failed to renumber project", err);
            reportProjectError(err, 'project-context.renumber-project', { targetProjectId: projectId });
            return { success: false, message: err?.message || '重命名失败：网络错误' };
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
            const data = await apiClient.del(`/api/projects/${encodeURIComponent(projectId)}/images/${encodeURIComponent(imageId)}`);
            console.log('Delete API response:', data);
            if (data) {
                if (navigateToNext) {
                    if (data.remainingCount > 0) {
                        const targetIndex = Math.max(0, Math.min(effectiveCurrentIndex, data.remainingCount - 1));
                        console.log('Target index for navigation:', targetIndex);

                        if (renumberAfterDelete) {
                            try {
                                renumberInfo = await apiClient.post(`/api/projects/${encodeURIComponent(projectId)}/renumber-all`, {});
                            } catch {
                                renumberInfo = { error: '重命名失败：网络错误' };
                            }
                        }

                        const newImages = await apiClient.get(`/api/projects/${encodeURIComponent(projectId)}/images`);
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
            }
        } catch (err) {
            console.error("Failed to delete image", err);
            reportProjectError(err, 'project-context.delete-image', { targetProjectId: projectId, imageId });
            return { success: false, message: err?.message || '删除失败：网络错误' };
        }
    };

    const selectFolder = async () => {
        try {
            return await apiClient.post('/api/utils/select-folder', {});
        } catch (err) {
            console.error("Failed to select folder", err);
            reportProjectError(err, 'project-context.select-folder');
            return { path: null, error: err?.message || '选择文件夹失败' };
        }
    };

    const scanImages = async (folderPath, maxResults = 5000) => {
        try {
            const data = await apiClient.post('/api/utils/scan-images', { folderPath, maxResults });
            return { success: true, ...data };
        } catch (err) {
            console.error("Failed to scan images", err);
            reportProjectError(err, 'project-context.scan-images', { folderPath });
            return { success: false, error: err?.message || '扫描失败：网络错误' };
        }
    };

    const importImages = async (projectId, images, mode = 'copy') => {
        try {
            const data = await apiClient.post(`/api/projects/${encodeURIComponent(projectId)}/import-images`, { images, mode });
            return { success: true, ...data };
        } catch (err) {
            console.error("Failed to import images", err);
            reportProjectError(err, 'project-context.import-images', { targetProjectId: projectId });
            return { success: false, error: err?.message || '导入失败：网络错误' };
        }
    };

    const getImportHistory = async (projectId) => {
        try {
            const data = await apiClient.get(`/api/projects/${encodeURIComponent(projectId)}/import-history`);
            return data.history || [];
        } catch (err) {
            console.error("Failed to get import history", err);
            reportProjectError(err, 'project-context.get-import-history', { targetProjectId: projectId });
            return [];
        }
    };

    const getPredictionSettings = async (projectId) => {
        try {
            return await apiClient.get(`/api/projects/${encodeURIComponent(projectId)}/prediction-settings`);
        } catch (err) {
            console.error("Failed to get prediction settings", err);
            reportProjectError(err, 'project-context.get-prediction-settings', { targetProjectId: projectId });
            return { modelPath: '', confidenceThreshold: 0.5, lastPredictionTime: null };
        }
    };

    const savePredictionSettings = async (projectId, settings) => {
        try {
            const data = await apiClient.post(`/api/projects/${encodeURIComponent(projectId)}/prediction-settings`, settings);
            return { success: true, message: data.message, data };
        } catch (err) {
            console.error("Failed to save prediction settings", err);
            reportProjectError(err, 'project-context.save-prediction-settings', { targetProjectId: projectId });
            return { success: false, message: err?.message || '保存失败：网络错误' };
        }
    };

    const runPrediction = async (projectId, options) => {
        try {
            const data = await apiClient.post(`/api/projects/${encodeURIComponent(projectId)}/predict`, options);
            return { success: true, taskId: data.taskId, message: data.message || data.error };
        } catch (err) {
            console.error("Failed to run prediction", err);
            reportProjectError(err, 'project-context.run-prediction', { targetProjectId: projectId });
            return { success: false, message: err?.message || '预标注失败：网络错误' };
        }
    };

    const getPredictionStatus = async (projectId) => {
        try {
            return await apiClient.get(`/api/projects/${encodeURIComponent(projectId)}/predict/status`);
        } catch (err) {
            console.error("Failed to get prediction status", err);
            reportProjectError(err, 'project-context.get-prediction-status', { targetProjectId: projectId });
            return { isRunning: false, progress: 0, current: 0, total: 0, message: '' };
        }
    };

    const cancelPrediction = async (projectId) => {
        try {
            const data = await apiClient.post(`/api/projects/${encodeURIComponent(projectId)}/predict/cancel`, {});
            return { success: true, message: data.message || data.error };
        } catch (err) {
            console.error("Failed to cancel prediction", err);
            reportProjectError(err, 'project-context.cancel-prediction', { targetProjectId: projectId });
            return { success: false, message: err?.message || '取消失败：网络错误' };
        }
    };

    const validateModel = async (projectId, modelPath) => {
        try {
            const data = await apiClient.post(`/api/projects/${encodeURIComponent(projectId)}/predict/validate-model`, { modelPath });
            return { success: true, ...data };
        } catch (err) {
            console.error("Failed to validate model", err);
            reportProjectError(err, 'project-context.validate-model', { targetProjectId: projectId, modelPath });
            return { success: false, error: err?.message || '验证失败：网络错误' };
        }
    };

    const predictSingleImage = async (projectId, imageName, modelPath, confidenceThreshold = 0.25) => {
        try {
            const data = await apiClient.post(`/api/projects/${encodeURIComponent(projectId)}/predict/single`, { imageName, modelPath, confidenceThreshold });
            return { success: true, ...data };
        } catch (err) {
            console.error("Failed to predict single image", err);
            reportProjectError(err, 'project-context.predict-single-image', { targetProjectId: projectId, imageName });
            return { success: false, error: err?.message || '预标注失败：网络错误' };
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
