
import React from 'react';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { MainLayout } from './components/MainLayout';
import { ProjectDashboard } from './components/ProjectDashboard';
import { ImageGallery } from './components/ImageGallery';
import { AnnotationEditor } from './components/AnnotationEditor';
import { ImageUpload } from './components/ImageUpload';
import { TrainingConfig } from './components/TrainingConfig';


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
  const { view, projects, createProject, selectProject, deleteProject, currentProject, images, selectedImage, openEditor, goBack, refreshImages } = useProject();

  if (view === 'dashboard') {
    return (
      <div className="animate-fade-in page-dashboard">
        <header className="page-dashboard-header">
          <h1>欢迎回来</h1>
          <p>管理您的数据集项目</p>
        </header>
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
      <div className="animate-fade-in page-gallery">
        <div className="page-gallery-header">
          <div>
            <h2>{currentProject} / 图库</h2>
            <p>{images.length} 张图片</p>
          </div>
        </div>

        <div className="page-gallery-body">
          <ImageGallery
            images={images}
            projectId={currentProject}
            onSelectImage={openEditor}
          />
          <div className="upload-section">
            <h3>快速上传</h3>
            <ImageUpload projectId={currentProject} onUploadComplete={refreshImages} />
          </div>
        </div>
      </div>
    );
  }

  if (view === 'training') {
    return (
      <div className="animate-fade-in" style={{ height: '100%', overflow: 'hidden' }}>
        <TrainingConfig />
      </div>
    );
  }

  if (view === 'editor' && selectedImage) {
    return (
      <div className="animate-fade-in" style={{ height: '100%', overflow: 'hidden' }}>
        <AnnotationEditor
          image={selectedImage}
          projectId={currentProject}
          onBack={goBack}
        />
      </div>
    );
  }

  return null;
}

export default App;
