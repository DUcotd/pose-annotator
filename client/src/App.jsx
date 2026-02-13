
import React from 'react';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { MainLayout } from './components/MainLayout';
import { ProjectDashboard } from './components/ProjectDashboard';
import { ImageGallery } from './components/ImageGallery';
import { AnnotationEditor } from './components/AnnotationEditor';
import { ImageUpload } from './components/ImageUpload';
import { TrainingConfig } from './components/TrainingConfig';
import { DatasetExport } from './components/DatasetExport';
import { Settings } from './components/Settings';


function App() {
  return (
    <ProjectProvider>
      <MainLayout>
        <AppContent />
      </MainLayout>
    </ProjectProvider>
  );
}

const AppContent = () => {
  const { view, projects, createProject, selectProject, deleteProject, currentProject, images, selectedImage, openEditor, goBack, refreshImages, openSettings } = useProject();

  if (view === 'dashboard') {
    return (
      <div className="page-dashboard">

        <ProjectDashboard
          projects={projects}
          onCreateProject={createProject}
          onSelectProject={selectProject}
          onDeleteProject={deleteProject}
        />
      </div>
    );
  }

  if (view === 'gallery') {
    return (
      <div className="page-gallery" style={{ padding: '2rem 3rem', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {/* Background Decorative Blobs */}
        {images.length === 0 && (
          <>
            <div className="glow-blob glow-blob-1" />
            <div className="glow-blob glow-blob-2" />
          </>
        )}

        <div className="page-gallery-header" style={{ marginBottom: '2rem', flexShrink: 0, position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: 0 }}>
              {currentProject}
            </h2>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '1.2rem', fontWeight: 300, transform: 'translateY(1px)' }}>/</span>
            <div style={{
              background: 'rgba(88, 166, 255, 0.1)',
              color: '#4da1ff',
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              GALLERY
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500, margin: 0, paddingLeft: '2px' }}>
            管理项目资源 · {images.length} 张图片
          </p>
        </div>

        <div className="page-gallery-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 2 }}>
          <ImageGallery
            images={images}
            projectId={currentProject}
            onSelectImage={openEditor}
            onUpload={refreshImages}
            selectedImage={selectedImage}
          />
        </div>
      </div >
    );
  }

  if (view === 'training') {
    return (
      <div style={{ height: '100%', overflow: 'hidden' }}>
        <TrainingConfig />
      </div>
    );
  }

  if (view === 'export') {
    return (
      <div style={{ height: '100%', overflow: 'hidden' }}>
        <DatasetExport />
      </div>
    );
  }

  if (view === 'editor' && selectedImage) {
    return (
      <div style={{ height: '100%', overflow: 'hidden' }}>
        <AnnotationEditor
          image={selectedImage}
          projectId={currentProject}
          onBack={goBack}
        />
      </div>
    );
  }

  if (view === 'settings') {
    return <Settings onBack={goBack} />;
  }

  return null;
}

export default App;
