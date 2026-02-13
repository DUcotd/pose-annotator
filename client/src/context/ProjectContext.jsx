import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProjectContext = createContext();

export const useProject = () => useContext(ProjectContext);

export const ProjectProvider = ({ children }) => {
    const [projects, setProjects] = useState([]);
    const [currentProject, setCurrentProject] = useState(null); // String ID
    const [images, setImages] = useState([]);
    const [view, setView] = useState('dashboard'); // 'dashboard', 'gallery', 'editor', 'export', 'training'
    const [selectedImage, setSelectedImage] = useState(null);
    const [loading, setLoading] = useState(false);

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
            await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
            await fetchProjects();
            if (currentProject === projectId) {
                setCurrentProject(null);
                setView('dashboard');
            }
        } catch (err) {
            console.error("Failed to delete project", err);
        }
    };

    const selectProject = (projectId) => {
        setImages([]);
        setCurrentProject(projectId);
        setView('gallery');
        fetchImages(projectId);
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
        } else if (view === 'gallery') {
            setView('dashboard');
            setCurrentProject(null);
            setImages([]);
            fetchProjects(); // Refresh counts
        }
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
            const url = `http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/collaboration/export`;
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${projectId}_collaboration.zip`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("Failed to export collaboration package", err);
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
        refreshImages: () => fetchImages(currentProject),
        exportProject,
        exportCollaboration,
        importCollaboration
    };

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
};
