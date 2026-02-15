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
        setNotification({
            type: result.success ? 'success' : 'error',
            message: result.message
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

    const handleCreateProject = (name) => {
        onCreateProject(name);
    };

    const closeNotification = () => setNotification(null);

    return (
        <div style={{
            padding: '0 3rem 0 3rem',
            maxWidth: '1600px',
            margin: '0 auto',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <HeroSection
                onCreate={() => setIsCreating(true)}
                onImport={() => setIsImporting(true)}
                onGuide={() => setIsGuideOpen(true)}
            />

            <DashboardStats projects={projects} />

            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '3rem', paddingRight: '12px' }} className="custom-scrollbar">
                <div className="project-grid-modern" style={{ marginTop: '1rem' }}>
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

            <div style={{
                height: '1px',
                background: 'linear-gradient(to right, transparent, var(--border-subtle), transparent)',
                width: '100%',
                opacity: 0.5,
                marginTop: 'auto'
            }} />

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
