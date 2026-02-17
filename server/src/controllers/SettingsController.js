const express = require('express');
const logger = require('../utils/logger');
const settings = require('../config/settings');
const PythonEnvService = require('../services/PythonEnvService');

function createSettingsRouter() {
  const router = express.Router();
  const fs = require('fs');

  const normalizePathValue = (v) => {
    if (v === null) return null;
    if (v === undefined) return undefined;
    if (typeof v !== 'string') return undefined;
    const s = v.trim();
    return s ? s : null;
  };

  const isExistingDir = (p) => {
    try {
      return !!p && fs.existsSync(p) && fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  };

  const isExistingFile = (p) => {
    try {
      return !!p && fs.existsSync(p) && fs.statSync(p).isFile();
    } catch {
      return false;
    }
  };

  router.get('/', (req, res) => {
    const config = settings.load();
    res.json({ success: true, ...config });
  });

  router.post('/', (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, error: '请求体格式错误' });
    }

    const pythonPath = normalizePathValue(req.body.pythonPath);
    const projectsDir = normalizePathValue(req.body.projectsDir);
    const updates = {};

    if (pythonPath !== undefined) {
      if (pythonPath && !isExistingFile(pythonPath)) {
        return res.status(400).json({ success: false, error: 'Python 路径不存在或不是文件' });
      }
      updates.pythonPath = pythonPath;
    }

    if (projectsDir !== undefined) {
      if (projectsDir && !isExistingDir(projectsDir)) {
        return res.status(400).json({ success: false, error: '项目目录不存在或不是文件夹' });
      }
      updates.projectsDir = projectsDir;
    }
    
    if (settings.save(updates)) {
      res.json({ success: true, message: 'Settings saved', ...updates });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save settings' });
    }
  });

  router.get('/projects-dir', (req, res) => {
    const projectsDir = settings.getProjectsDir();
    const defaultName = settings.getDefaultProjectsDirName();
    res.json({ 
      success: true,
      projectsDir, 
      defaultProjectsDirName: defaultName,
      hasCustomDir: !!projectsDir 
    });
  });

  router.post('/projects-dir', (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, error: '请求体格式错误' });
    }

    const projectsDir = normalizePathValue(req.body.projectsDir);

    if (projectsDir && !isExistingDir(projectsDir)) {
      return res.status(400).json({ 
        success: false, 
        error: '指定的目录不存在或不是文件夹' 
      });
    }
    
    if (settings.setProjectsDir(projectsDir || null)) {
      res.json({ 
        success: true, 
        message: projectsDir ? '项目目录已更新，重启应用后生效' : '已恢复默认项目目录，重启应用后生效',
        projectsDir 
      });
    } else {
      res.status(500).json({ success: false, error: '保存设置失败' });
    }
  });

  router.post('/validate-python', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, valid: false, error: '请求体格式错误' });
    }
    const pythonPath = normalizePathValue(req.body.pythonPath);
    if (!pythonPath) {
      return res.status(400).json({ success: false, valid: false, error: '请提供 Python 路径' });
    }
    const result = await PythonEnvService.validatePython(pythonPath);
    res.json({ success: true, ...result });
  });

  router.get('/scan-envs', async (req, res) => {
    try {
      const results = await PythonEnvService.scanAll();
      res.json(results);
    } catch (err) {
      logger.error('Failed to scan Python environments:', err);
      res.status(500).json({ error: 'Failed to scan environments' });
    }
  });

  router.get('/check-env', async (req, res) => {
    try {
      const result = await PythonEnvService.checkEnv();
      res.json(result);
    } catch (err) {
      logger.error('Failed to check environment:', err);
      res.status(500).json({ error: 'Failed to check environment' });
    }
  });

  return router;
}

function createEnvSettingsRouter() {
  const router = express.Router();

  router.get('/envs', async (req, res) => {
    try {
      const envs = await PythonEnvService.scanAll();
      res.json({ success: true, envs });
    } catch (error) {
      logger.error('Failed to get environments:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/envs/create', async (req, res) => {
    try {
      const { name, pythonVersion, cudaVersion } = req.body;
      
      const result = await PythonEnvService.createEnvironment({
        name,
        pythonVersion,
        cudaVersion,
        onProgress: (progress) => {
          logger.info(`Environment creation progress: ${JSON.stringify(progress)}`);
        }
      });
      
      res.json({ success: result.success, result });
    } catch (error) {
      logger.error('Failed to create environment:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/envs/compatibility', (req, res) => {
    try {
      const matrix = PythonEnvService.getCompatibilityMatrix();
      const recommended = PythonEnvService.getRecommendedVersions();
      res.json({ success: true, matrix, recommended });
    } catch (error) {
      logger.error('Failed to get compatibility:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/envs/creation-status', (req, res) => {
    try {
      const status = PythonEnvService.getEnvCreationStatus();
      res.json({ success: true, status });
    } catch (error) {
      logger.error('Failed to get creation status:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/envs/detect-cuda', async (req, res) => {
    try {
      const cudaVersion = await PythonEnvService.detectCudaVersion();
      res.json({ success: true, cudaVersion });
    } catch (error) {
      logger.error('Failed to detect CUDA:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = {
  createSettingsRouter,
  createEnvSettingsRouter
};
