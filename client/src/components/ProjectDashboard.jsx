import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import {
    ProjectCard,
    CreateProjectCard,
    EmptyState,
    HeroSection,
    DashboardStats,
    CreateProjectModal,
    ConfirmModal,
    QuickGuideModal,
    Toast
} from './dashboard';
import { ImportCollaborationModal } from './dashboard/ImportCollaborationModal';

export const ProjectDashboard = ({ projects = [], onCreateProject, onSelectProject, onDeleteProject }) => {
    const { importCollaboration, renumberProject, isProjectDeleting } = useProject();
    const [isCreating, setIsCreating] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [notification, setNotification] = useState(null);

    const handleRenumber = async (projectId) => {
        const result = await renumberProject(projectId);
        setNotification({ type: result.success ? 'success' : 'error', message: result.message });
    };

    const handleDeleteProject = (projectId) => {
        if (isProjectDeleting(projectId)) {
            setNotification({ type: 'info', message: '项目正在删除中，请稍候...' });
            return;
        }
        setProjectToDelete(projectId);
        setIsConfirming(true);
    };

    const confirmDelete = async () => {
        if (!projectToDelete) return;
        const result = await onDeleteProject(projectToDelete);
        
        let message = result.message;
        if (!result.success && result.details) {
            message = `${result.message}: ${result.details}`;
        }
        
        setNotification({
            type: result.success ? 'success' : 'error',
            message: message
        });
        
        if (result.pendingCleanup) {
            setNotification({
                type: 'warning',
                message: result.message
            });
        }
        setProjectToDelete(null);
    };

    const handleImportProject = async (zipPath, customPath) => {
        const result = await importCollaboration(zipPath, customPath);
        if (result.success) {
            setNotification({ type: 'success', message: result.message });
        } else if (result.message !== '取消导入') {
            setNotification({ type: 'error', message: result.message });
        }
        return result;
    };

    const handleCreateProject = async (name, customPath) => {
        const result = await onCreateProject(name, customPath);
        if (result && typeof result === 'object' && !result.success) {
            setNotification({ type: 'error', message: result.message || '项目创建失败' });
        }
        return result;
    };

    const totalImages = projects.reduce((acc, p) => acc + (p.imageCount || 0), 0);
    const totalAnnotated = projects.reduce((acc, p) => acc + (p.annotatedCount || 0), 0);
    const readyProjects = projects.filter((project) => (project.imageCount || 0) > 0).length;
    const pendingAnnotations = Math.max(totalImages - totalAnnotated, 0);
    const annotationRate = totalImages > 0 ? Math.round((totalAnnotated / totalImages) * 100) : 0;

    const closeNotification = () => setNotification(null);

    return (
        <div className="dashboard-shell">
            <div className="dashboard-top">
                <HeroSection
                    onCreate={() => setIsCreating(true)}
                    onImport={() => setIsImporting(true)}
                    onGuide={() => setIsGuideOpen(true)}
                    summary={{
                        projects: projects.length,
                        images: totalImages,
                        rate: annotationRate
                    }}
                />

                <DashboardStats projects={projects} />
            </div>

            <div className="dashboard-content-header">
                <div>
                    <h2 className="dashboard-content-title">项目工作区</h2>
                    <p className="dashboard-content-subtitle">
                        {projects.length === 0
                            ? '当前没有项目，先创建一个开始标注。'
                            : `共 ${projects.length} 个项目，已标注 ${totalAnnotated}/${totalImages} 张图片。`}
                    </p>
                    <div className="dashboard-content-chips" aria-label="工作区摘要">
                        <span className="dashboard-content-chip">
                            就绪项目 {readyProjects}
                        </span>
                        <span className="dashboard-content-chip">
                            待标注 {pendingAnnotations} 张
                        </span>
                        <span className="dashboard-content-chip">
                            平均标注率 {annotationRate}%
                        </span>
                    </div>
                </div>
            </div>

            <div className="dashboard-scroll custom-scrollbar">
                <div className="project-grid-modern">
                    {projects.length === 0 ? (
                        <EmptyState onCreate={() => setIsCreating(true)} />
                    ) : (
                        <>
                            <CreateProjectCard onClick={() => setIsCreating(true)} />
                            {projects.map((project, index) => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    index={index}
                                    onClick={() => onSelectProject(project.id)}
                                    onDelete={handleDeleteProject}
                                    onRenumber={handleRenumber}
                                    isDeleting={isProjectDeleting(project.id)}
                                />
                            ))}
                        </>
                    )}
                </div>
            </div>

            <div className="dashboard-spacer" />

            <CreateProjectModal
                isOpen={isCreating}
                onClose={() => setIsCreating(false)}
                onSubmit={handleCreateProject}
            />

            <QuickGuideModal
                isOpen={isGuideOpen}
                onClose={() => setIsGuideOpen(false)}
            />

            <ConfirmModal
                isOpen={isConfirming}
                onClose={() => setIsConfirming(false)}
                onConfirm={confirmDelete}
                title="删除项目"
                message={`确定要删除项目 "${projectToDelete}" 吗？此操作不可撤销，所有图片和标注都将丢失。`}
                confirmText="彻底删除"
                type="danger"
            />

            <ImportCollaborationModal
                isOpen={isImporting}
                onClose={() => setIsImporting(false)}
                onImport={handleImportProject}
            />

            <Toast
                notification={notification}
                onClose={closeNotification}
            />

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin-animation {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );
};
