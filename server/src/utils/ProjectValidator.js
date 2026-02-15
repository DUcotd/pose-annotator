const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class ProjectValidator {
  constructor() {
    this.excludedPaths = new Set();
    this.initExcludedPaths();
  }

  initExcludedPaths() {
    try {
      const serverDir = path.resolve(__dirname, '..');
      const appDir = path.resolve(serverDir, '..');
      
      this.excludedPaths.add(path.normalize(appDir));
      this.excludedPaths.add(path.normalize(serverDir));
      this.excludedPaths.add(path.normalize(path.join(appDir, 'client')));
      this.excludedPaths.add(path.normalize(path.join(appDir, 'node_modules')));
      this.excludedPaths.add(path.normalize(path.join(appDir, 'dist')));
      this.excludedPaths.add(path.normalize(path.join(appDir, 'docs')));
      this.excludedPaths.add(path.normalize(path.join(appDir, 'scripts')));
      
      logger.info('[ProjectValidator] Excluded paths initialized:', Array.from(this.excludedPaths));
    } catch (err) {
      logger.error('[ProjectValidator] Failed to initialize excluded paths:', err);
    }
  }

  isExcludedPath(dirPath) {
    const normalizedPath = path.normalize(dirPath);
    
    for (const excluded of this.excludedPaths) {
      if (normalizedPath === excluded || normalizedPath.startsWith(excluded + path.sep)) {
        logger.warn(`[ProjectValidator] Path excluded: ${dirPath} (matches ${excluded})`);
        return true;
      }
    }
    
    return false;
  }

  isValidProjectStructure(dirPath) {
    try {
      const uploadsDir = path.join(dirPath, 'uploads');
      const annotationsDir = path.join(dirPath, 'annotations');
      
      const hasUploads = fs.existsSync(uploadsDir) && fs.statSync(uploadsDir).isDirectory();
      const hasAnnotations = fs.existsSync(annotationsDir) && fs.statSync(annotationsDir).isDirectory();
      
      if (!hasUploads && !hasAnnotations) {
        logger.debug(`[ProjectValidator] Invalid project structure (missing uploads and annotations): ${dirPath}`);
        return false;
      }
      
      return true;
    } catch (err) {
      logger.error(`[ProjectValidator] Error checking project structure: ${dirPath}`, err);
      return false;
    }
  }

  isProgramSourceCode(dirPath) {
    try {
      const markers = [
        'package.json',
        'node_modules',
        'server.js',
        'electron-main.js',
        'vite.config.js',
        '.git'
      ];
      
      for (const marker of markers) {
        const markerPath = path.join(dirPath, marker);
        if (fs.existsSync(markerPath)) {
          logger.warn(`[ProjectValidator] Detected source code marker '${marker}' in: ${dirPath}`);
          return true;
        }
      }
      
      const clientDir = path.join(dirPath, 'client');
      const serverDir = path.join(dirPath, 'server');
      
      if (fs.existsSync(clientDir) && fs.existsSync(serverDir)) {
        const clientPackageJson = path.join(clientDir, 'package.json');
        const serverPackageJson = path.join(serverDir, 'package.json');
        
        if (fs.existsSync(clientPackageJson) || fs.existsSync(serverPackageJson)) {
          logger.warn(`[ProjectValidator] Detected source code structure in: ${dirPath}`);
          return true;
        }
      }
      
      return false;
    } catch (err) {
      logger.error(`[ProjectValidator] Error checking source code: ${dirPath}`, err);
      return false;
    }
  }

  validateProject(dirPath, projectName) {
    const result = {
      valid: true,
      reason: null,
      warnings: []
    };

    if (this.isExcludedPath(dirPath)) {
      result.valid = false;
      result.reason = '路径在排除列表中（程序目录）';
      return result;
    }

    if (this.isProgramSourceCode(dirPath)) {
      result.valid = false;
      result.reason = '检测到程序源代码目录';
      return result;
    }

    if (!this.isValidProjectStructure(dirPath)) {
      result.valid = false;
      result.reason = '无效的项目结构（缺少 uploads 或 annotations 目录）';
      return result;
    }

    return result;
  }

  addExcludedPath(dirPath) {
    this.excludedPaths.add(path.normalize(dirPath));
    logger.info(`[ProjectValidator] Added excluded path: ${dirPath}`);
  }

  getExcludedPaths() {
    return Array.from(this.excludedPaths);
  }
}

module.exports = new ProjectValidator();
