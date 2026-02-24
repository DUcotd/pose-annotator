
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
import { ErrorCenterProvider } from './error/ErrorCenter';
import SystemHealthGate from './components/SystemHealthGate';


function App() {
  return (
    <ErrorCenterProvider>
      <SystemHealthGate>
        <ProjectProvider>
          <MainLayout>
            <AppContent />
          </MainLayout>
        </ProjectProvider>
      </SystemHealthGate>
    </ErrorCenterProvider>
  );
}

const AppContent = () => {
  const { view, projects, createProject, selectProject, deleteProject, currentProject, images, selectedImage, editorReloadToken, openEditor, goBack, refreshImages } = useProject();
  const galleryAnnotatedCount = images.filter((img) => typeof img !== 'string' && !!img?.hasAnnotation).length;
  const galleryPendingCount = Math.max(images.length - galleryAnnotatedCount, 0);
  const galleryAnnotationRate = images.length > 0 ? Math.round((galleryAnnotatedCount / images.length) * 100) : 0;

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
      <div className="page-gallery">
        {/* Background Decorative Blobs */}
        {images.length === 0 && (
          <>
            <div className="glow-blob glow-blob-1" />
            <div className="glow-blob glow-blob-2" />
          </>
        )}

        <div className="page-gallery-header">
          <div className="page-gallery-heading">
            <div className="page-gallery-title-row">
              <h2 className="page-gallery-project">
                {currentProject}
              </h2>
              <span className="page-gallery-divider">/</span>
              <div className="page-gallery-tag">
                GALLERY
              </div>
            </div>
            <p className="page-gallery-meta">
              管理项目资源 · {images.length} 张图片
            </p>
            <div className="page-gallery-kpis" aria-label="图库摘要">
              <span className="page-gallery-kpi is-success">
                已标注 {galleryAnnotatedCount}
              </span>
              <span className="page-gallery-kpi">
                待标注 {galleryPendingCount}
              </span>
              <span className="page-gallery-kpi is-info">
                标注率 {galleryAnnotationRate}%
              </span>
            </div>
          </div>

          <div className="page-gallery-header-side" aria-label="项目资源概览">
            <span className="page-gallery-header-side-label">项目资源</span>
            <span className="page-gallery-header-side-value">{images.length} 张图片</span>
          </div>
        </div>

        <div className="page-gallery-body">
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
      <div className="page-workspace page-training">
        <TrainingConfig />
      </div>
    );
  }

  if (view === 'export') {
    return (
      <div className="page-workspace page-export">
        <DatasetExport />
      </div>
    );
  }

  if (view === 'editor' && selectedImage) {
    return (
      <div className="page-workspace page-editor">
        <AnnotationEditor
          key={`${selectedImage}-${editorReloadToken}`}
          image={selectedImage}
          projectId={currentProject}
          onBack={goBack}
        />
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div className="page-workspace page-settings">
        <Settings onBack={goBack} />
      </div>
    );
  }

  return null;
}

export default App;
