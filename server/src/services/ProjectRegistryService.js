const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const settings = require('../config/settings');

class ProjectRegistryService {
  constructor() {
    this.registryPath = null;
    this.registry = null;
  }

  init(projectsDir) {
    this.registryPath = path.join(path.dirname(projectsDir), 'project-registry.json');
    this.load();
  }

  load() {
    if (!this.registryPath) {
      this.registry = { projects: {}, version: 1 };
      return this.registry;
    }

    try {
      if (fs.existsSync(this.registryPath)) {
        const data = fs.readFileSync(this.registryPath, 'utf8');
        this.registry = JSON.parse(data);
        if (!this.registry.projects) {
          this.registry.projects = {};
        }
      } else {
        this.registry = { projects: {}, version: 1 };
      }
    } catch (e) {
      logger.warn('[ProjectRegistry] Failed to load registry, creating new one:', e.message);
      this.registry = { projects: {}, version: 1 };
    }

    return this.registry;
  }

  save() {
    if (!this.registryPath) return false;

    try {
      fs.writeFileSync(this.registryPath, JSON.stringify(this.registry, null, 2), 'utf8');
      return true;
    } catch (e) {
      logger.error('[ProjectRegistry] Failed to save registry:', e.message);
      return false;
    }
  }

  registerProject(projectId, projectPath, metadata = {}) {
    if (!this.registry) this.load();

    this.registry.projects[projectId] = {
      id: projectId,
      path: projectPath,
      createdAt: metadata.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: metadata.name || projectId,
      status: 'active',
      ...metadata
    };

    this.save();
    logger.info(`[ProjectRegistry] Registered project: ${projectId} at ${projectPath}`);
    return this.registry.projects[projectId];
  }

  unregisterProject(projectId) {
    if (!this.registry) this.load();

    if (this.registry.projects[projectId]) {
      delete this.registry.projects[projectId];
      this.save();
      logger.info(`[ProjectRegistry] Unregistered project: ${projectId}`);
      return true;
    }
    return false;
  }

  markProjectDeleted(projectId) {
    if (!this.registry) this.load();

    if (this.registry.projects[projectId]) {
      this.registry.projects[projectId].status = 'deleted';
      this.registry.projects[projectId].deletedAt = new Date().toISOString();
      this.save();
      logger.info(`[ProjectRegistry] Marked project as deleted: ${projectId}`);
      return true;
    }
    return false;
  }

  getProject(projectId) {
    if (!this.registry) this.load();
    return this.registry.projects[projectId] || null;
  }

  getAllProjects() {
    if (!this.registry) this.load();
    return Object.values(this.registry.projects).filter(p => p.status !== 'deleted');
  }

  updateProject(projectId, updates) {
    if (!this.registry) this.load();

    if (this.registry.projects[projectId]) {
      this.registry.projects[projectId] = {
        ...this.registry.projects[projectId],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.save();
      return this.registry.projects[projectId];
    }
    return null;
  }

  validateProjectPath(projectId, projectPath) {
    try {
      return fs.existsSync(projectPath) && fs.statSync(projectPath).isDirectory();
    } catch (e) {
      return false;
    }
  }

  syncWithFilesystem(projectsDir) {
    if (!this.registry) this.load();

    const config = settings.load();
    const allPaths = [projectsDir];
    if (config.additionalProjectPaths && Array.isArray(config.additionalProjectPaths)) {
      config.additionalProjectPaths.forEach(p => {
        if (p && fs.existsSync(p) && !allPaths.includes(p)) {
          allPaths.push(p);
        }
      });
    }

    const filesystemProjects = new Map();
    allPaths.forEach(dir => {
      if (!fs.existsSync(dir)) return;
      try {
        const projects = fs.readdirSync(dir).filter(file => {
          if (file.startsWith('.') || file.startsWith('_to_delete_')) return false;
          try {
            return fs.statSync(path.join(dir, file)).isDirectory();
          } catch (e) { return false; }
        });

        projects.forEach(p => {
          if (!filesystemProjects.has(p)) {
            filesystemProjects.set(p, path.join(dir, p));
          }
        });
      } catch (e) {
        logger.error(`[ProjectRegistry] Failed to scan directory ${dir}:`, e);
      }
    });

    let added = 0;
    let removed = 0;

    filesystemProjects.forEach((projectPath, projectId) => {
      if (!this.registry.projects[projectId]) {
        this.registerProject(projectId, projectPath);
        added++;
      } else if (this.registry.projects[projectId].path !== projectPath) {
        this.updateProject(projectId, { path: projectPath, status: 'active' });
      } else if (this.registry.projects[projectId].status === 'deleted') {
        this.updateProject(projectId, { status: 'active' });
      }
    });

    Object.keys(this.registry.projects).forEach(projectId => {
      const project = this.registry.projects[projectId];
      if (project.status === 'deleted') return;

      if (!filesystemProjects.has(projectId)) {
        this.markProjectDeleted(projectId);
        removed++;
      }
    });

    if (added > 0 || removed > 0) {
      this.save();
      logger.info(`[ProjectRegistry] Sync complete: ${added} added, ${removed} removed`);
    }

    return { added, removed, total: filesystemProjects.size };
  }

  cleanupDeletedProjects(maxAgeDays = 7) {
    if (!this.registry) this.load();

    const now = new Date();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    let cleaned = 0;

    Object.keys(this.registry.projects).forEach(projectId => {
      const project = this.registry.projects[projectId];
      if (project.status === 'deleted' && project.deletedAt) {
        const deletedDate = new Date(project.deletedAt);
        if (now - deletedDate > maxAgeMs) {
          delete this.registry.projects[projectId];
          cleaned++;
        }
      }
    });

    if (cleaned > 0) {
      this.save();
      logger.info(`[ProjectRegistry] Cleaned up ${cleaned} old deleted project records`);
    }

    return cleaned;
  }
}

module.exports = new ProjectRegistryService();
