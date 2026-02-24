const path = require('path');
const fs = require('fs');
const settings = require('../config/settings');
const SafeFileOp = require('./FileService');
const logger = require('../utils/logger');

class PathService {
  constructor() {
    this._projectsDir = null;
  }

  normalizePath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') return null;
    return path.normalize(path.resolve(inputPath));
  }

  pathKey(inputPath) {
    const normalized = this.normalizePath(inputPath);
    if (!normalized) return null;
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
  }

  addPathIfValid(pathSet, rawPath) {
    const normalized = this.normalizePath(rawPath);
    if (!normalized) return;
    try {
      if (!fs.existsSync(normalized)) return;
      if (!fs.statSync(normalized).isDirectory()) return;
      pathSet.set(this.pathKey(normalized), normalized);
    } catch (err) {
      logger.warn(`[PathService] Unable to use path '${normalized}': ${err.message}`);
    }
  }

  getAllProjectPaths(projectsDir) {
    const config = settings.load();
    const pathSet = new Map();
    this.addPathIfValid(pathSet, projectsDir);

    if (config.additionalProjectPaths && Array.isArray(config.additionalProjectPaths)) {
      config.additionalProjectPaths.forEach(p => {
        if (!p || typeof p !== 'string') return;
        if (path.isAbsolute(p)) {
          this.addPathIfValid(pathSet, p);
          return;
        }
        this.addPathIfValid(pathSet, path.resolve(projectsDir, p));
      });
    }

    // Fallback from registry to avoid losing scan paths when settings miss custom dirs.
    try {
      const registryPath = this.getRegistryPath(projectsDir);
      if (fs.existsSync(registryPath)) {
        const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        const projects = registry && registry.projects ? registry.projects : {};
        Object.values(projects).forEach(project => {
          if (!project || project.status === 'deleted' || !project.path) return;
          this.addPathIfValid(pathSet, path.dirname(project.path));
        });
      }
    } catch (err) {
      logger.warn(`[PathService] Failed to read registry for additional paths: ${err.message}`);
    }

    return Array.from(pathSet.values());
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
    const additionalPaths = Array.isArray(config.additionalProjectPaths) ? config.additionalProjectPaths : [];
    const normalizedNewPath = this.normalizePath(newPath);
    if (!normalizedNewPath) {
      return additionalPaths;
    }

    const existingKeys = new Set(
      additionalPaths
        .filter(p => typeof p === 'string' && p.trim() !== '')
        .map(p => this.pathKey(p))
        .filter(Boolean)
    );

    const newKey = this.pathKey(normalizedNewPath);
    if (!existingKeys.has(newKey)) {
      additionalPaths.push(normalizedNewPath);
      settings.save({ additionalProjectPaths: additionalPaths });
      logger.info(`[PathService] Added new project path: ${normalizedNewPath}`);
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
    if (!fs.existsSync(uploadsDir)) return 1; // 从1开始，而不是0
    
    try {
      const files = fs.readdirSync(uploadsDir);
      let maxIndex = 0; // 初始化为0，这样如果没有文件或文件编号都小于1时，返回1
      
      files.forEach(f => {
        const match = f.match(/^(\d{6})\./);
        if (match) {
          const idx = parseInt(match[1], 10);
          if (idx > maxIndex) maxIndex = idx;
        }
      });
      
      // 返回最大值+1，确保从1开始
      return maxIndex + 1;
    } catch (e) {
      logger.error('Failed to get next file index:', e);
      return 1; // 错误时也返回1，而不是0
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
