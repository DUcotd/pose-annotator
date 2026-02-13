import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
    ProjectCard, 
    CreateProjectCard, 
    EmptyState, 
    HeroSection, 
    DashboardStats,
    CreateProjectModal, 
    QuickGuideModal,
    Toast 
} from './dashboard';

export const ProjectDashboard = ({ projects = [], onCreateProject, onSelectProject, onDeleteProject }) => {
    const { importCollaboration, renumberProject } = useProject();
    const [isCreating, setIsCreating] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [notification, setNotification] = useState(null);

    const handleRenumber = async (projectId) => {
        const result = await renumberProject(projectId);
        setNotification({ type: result.success ? 'success' : 'error', message: result.message });
    };

    const handleImportProject = async () => {
        const result = await importCollaboration();
        if (result.success) {
            setNotification({ type: 'success', message: result.message });
        } else if (result.message !== '取消导入') {
            setNotification({ type: 'error', message: result.message });
        }
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
            {/* Hero Section */}
            <HeroSection 
                onCreate={() => setIsCreating(true)}
                onImport={handleImportProject}
                onGuide={() => setIsGuideOpen(true)}
            />

            {/* Dashboard Stats */}
            <DashboardStats projects={projects} />

            {/* Projects Grid */}
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
                                    onDelete={onDeleteProject}
                                    onRenumber={handleRenumber}
                                />
                            ))}
                        </>
                    )}
                </div>
            </div>

            {/* Footer Divider */}
            <div style={{
                height: '1px',
                background: 'linear-gradient(to right, transparent, var(--border-subtle), transparent)',
                width: '100%',
                opacity: 0.5,
                marginTop: 'auto'
            }} />

            {/* Modals */}
            <CreateProjectModal 
                isOpen={isCreating}
                onClose={() => setIsCreating(false)}
                onSubmit={handleCreateProject}
            />

            <QuickGuideModal 
                isOpen={isGuideOpen}
                onClose={() => setIsGuideOpen(false)}
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
            `}</style>
        </div>
    );
};
