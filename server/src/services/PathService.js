const path = require('path');
const fs = require('fs');
const settings = require('../config/settings');
const SafeFileOp = require('./FileService');
const logger = require('../utils/logger');

class PathService {
  constructor() {
    this._projectsDir = null;
  }

  getAllProjectPaths(projectsDir) {
    const config = settings.load();
    const paths = [projectsDir];
    
    if (config.additionalProjectPaths && Array.isArray(config.additionalProjectPaths)) {
      config.additionalProjectPaths.forEach(p => {
        if (p && fs.existsSync(p) && !paths.includes(p)) {
          paths.push(p);
        }
      });
    }
    
    return paths;
  }

  findProjectRoot(projectId, projectsDir) {
    const allPaths = this.getAllProjectPaths(projectsDir);
    
    for (const dir of allPaths) {
      const root = path.join(dir, projectId);
      if (fs.existsSync(root)) {
        return root;
      }
    }
    
    return path.join(projectsDir, projectId);
  }

  getProjectPaths(projectId, projectsDir) {
    const root = this.findProjectRoot(projectId, projectsDir);
    
    return {
      root,
      uploads: path.join(root, 'uploads'),
      annotations: path.join(root, 'annotations'),
      thumbnails: path.join(root, 'thumbnails'),
      dataset: path.join(root, 'dataset'),
      runs: path.join(root, 'runs'),
      imagesDir: path.join(root, 'dataset', 'images'),
      labelsDir: path.join(root, 'dataset', 'labels')
    };
  }

  getIndexPath(projectId, projectsDir) {
    const root = this.findProjectRoot(projectId, projectsDir);
    return path.join(root, 'index.json');
  }

  getConfigPath(projectId, projectsDir) {
    const root = this.findProjectRoot(projectId, projectsDir);
    return path.join(root, 'config.json');
  }

  getImportHistoryPath(projectId, projectsDir) {
    const root = this.findProjectRoot(projectId, projectsDir);
    return path.join(root, 'import-history.json');
  }

  async ensureProjectDirs(projectId, projectsDir, targetDir = null) {
    const root = targetDir 
      ? path.join(targetDir, projectId) 
      : this.findProjectRoot(projectId, projectsDir);
    
    const paths = {
      root,
      uploads: path.join(root, 'uploads'),
      annotations: path.join(root, 'annotations'),
      thumbnails: path.join(root, 'thumbnails'),
      dataset: path.join(root, 'dataset')
    };

    await SafeFileOp.ensureDir(paths.root);
    await SafeFileOp.ensureDir(paths.uploads);
    await SafeFileOp.ensureDir(paths.annotations);
    await SafeFileOp.ensureDir(paths.thumbnails);

    return paths;
  }

  resolveExportPath(customPath, projectsDir, projectId = null) {
    if (!customPath || typeof customPath !== 'string' || customPath.trim() === '') {
      if (projectId && projectsDir) {
        const paths = this.getProjectPaths(projectId, projectsDir);
        return paths.dataset;
      }
      return null;
    }

    const trimmedPath = customPath.trim();
    
    if (path.isAbsolute(trimmedPath)) {
      return path.join(trimmedPath, 'dataset');
    }
    
    if (projectId && projectsDir) {
      const projectRoot = this.findProjectRoot(projectId, projectsDir);
      return path.join(projectRoot, trimmedPath, 'dataset');
    }
    
    if (projectsDir) {
      return path.join(projectsDir, trimmedPath, 'dataset');
    }
    
    return path.join(trimmedPath, 'dataset');
  }

  resolveCustomProjectPath(customPath, projectsDir) {
    if (!customPath || typeof customPath !== 'string' || customPath.trim() === '') {
      return projectsDir;
    }

    const trimmedPath = customPath.trim();
    
    if (path.isAbsolute(trimmedPath)) {
      return trimmedPath;
    }
    
    return path.resolve(projectsDir, trimmedPath);
  }

  addToAdditionalPaths(newPath) {
    const config = settings.load();
    const additionalPaths = config.additionalProjectPaths || [];
    
    if (!additionalPaths.includes(newPath)) {
      additionalPaths.push(newPath);
      settings.save({ additionalProjectPaths: additionalPaths });
      logger.info(`[PathService] Added new project path: ${newPath}`);
    }
    
    return additionalPaths;
  }

  validateProjectPath(projectPath, projectId) {
    const issues = [];
    
    if (!fs.existsSync(projectPath)) {
      issues.push('项目路径不存在');
      return { valid: false, issues };
    }

    const stats = fs.statSync(projectPath);
    if (!stats.isDirectory()) {
      issues.push('项目路径不是目录');
      return { valid: false, issues };
    }

    const uploadsPath = path.join(projectPath, 'uploads');
    const annotationsPath = path.join(projectPath, 'annotations');
    
    if (!fs.existsSync(uploadsPath)) {
      issues.push('缺少 uploads 目录');
    }
    
    if (!fs.existsSync(annotationsPath)) {
      issues.push('缺少 annotations 目录');
    }

    return {
      valid: issues.length === 0,
      issues,
      hasUploads: fs.existsSync(uploadsPath),
      hasAnnotations: fs.existsSync(annotationsPath)
    };
  }

  getNextFileIndex(uploadsDir) {
    if (!fs.existsSync(uploadsDir)) return 0;
    
    try {
      const files = fs.readdirSync(uploadsDir);
      let maxIndex = -1;
      
      files.forEach(f => {
        const match = f.match(/^(\d{6})\./);
        if (match) {
          const idx = parseInt(match[1], 10);
          if (idx > maxIndex) maxIndex = idx;
        }
      });
      
      return maxIndex + 1;
    } catch (e) {
      logger.error('Failed to get next file index:', e);
      return 0;
    }
  }

  sanitizeProjectName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  }

  getRegistryPath(projectsDir) {
    return path.join(path.dirname(projectsDir), 'project-registry.json');
  }

  getGlobalSettingsPath() {
    const config = settings.load();
    return config.settingsPath || null;
  }
}

module.exports = new PathService();
