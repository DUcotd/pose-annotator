const express = require('express');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const TrainingService = require('../services/TrainingService');
const ExportService = require('../services/ExportService');
const ProcessManager = require('../managers/ProcessManager');
const settings = require('../config/settings');
const PathUtils = require('../utils/PathUtils');
const { validateTrainConfig, formatValidationErrors } = require('../utils/ValidationUtils');

function createTrainingRouter(projectsDir) {
  const router = express.Router();

  router.post('/:projectId/train', async (req, res) => {
    const { projectId } = req.params;
    const config = req.body;

    const validationResult = validateTrainConfig(config);
    if (!validationResult.valid) {
      const formattedError = formatValidationErrors(validationResult);
      logger.warn(`Training config validation failed: ${JSON.stringify(formattedError)}`);
      return res.status(400).json(formattedError);
    }

    const paths = ExportService.getProjectPaths(projectId, projectsDir);
    const defaultYamlPath = PathUtils.join(paths.dataset, 'data.yaml');
    
    const parsedPath = PathUtils.parseYamlPath(config.data, defaultYamlPath, paths.root);
    const dataYamlPath = parsedPath.path;

    const pathBoundsCheck = PathUtils.validatePathWithinBounds(dataYamlPath, paths.root, {
      allowAbsolute: true,
      allowedExtensions: ['.yaml', '.yml']
    });
    if (!pathBoundsCheck.valid) {
      logger.warn(`Path security check failed: ${JSON.stringify(pathBoundsCheck.issues)}`);
      return res.status(400).json({
        error: `路径安全检查失败: ${pathBoundsCheck.issues.join('; ')}`,
        code: 'PATH_SECURITY_VIOLATION'
      });
    }

    const pathValidation = PathUtils.validateForYaml(dataYamlPath);
    if (!pathValidation.valid) {
      const errorMsg = PathUtils.formatErrorMessage(pathValidation, config.data);
      return res.status(400).json({
        error: errorMsg,
        code: 'INVALID_PATH'
      });
    }

    const existsCheck = PathUtils.checkFileExists(dataYamlPath);
    if (!existsCheck.exists) {
      const pathInfo = PathUtils.getDetailedPathInfo(dataYamlPath);
      let errorDetails = `配置文件未找到: ${dataYamlPath}`;
      
      if (pathInfo.error) {
        errorDetails += `\n系统错误: ${pathInfo.error}`;
      }
      
      errorDetails += '\n\n可能的解决方案:';
      errorDetails += '\n1. 请确保已导出数据集';
      errorDetails += '\n2. 检查 data.yaml 文件是否存在于正确位置';
      errorDetails += '\n3. 尝试重新导出数据集';
      
      return res.status(400).json({
        error: errorDetails,
        code: 'DATASET_NOT_FOUND',
        suggestedPath: PathUtils.toYoloFormat(defaultYamlPath),
        providedPath: config.data
      });
    }

    try {
      const yoloDataPath = PathUtils.toYoloFormat(dataYamlPath);
      const yoloProjectPath = config.project ? PathUtils.toYoloFormat(PathUtils.resolve(config.project)) : PathUtils.toYoloFormat(paths.root);
      
      const pathCheck = PathUtils.normalizeYamlPaths(dataYamlPath);
      if (!pathCheck.valid && pathCheck.issues) {
        logger.warn(`Detected backslash paths in YAML: ${JSON.stringify(pathCheck.issues)}`);
        const convertResult = PathUtils.convertYamlPaths(dataYamlPath);
        if (convertResult.success) {
          logger.info('Auto-converted backslash paths in YAML to forward slashes');
        }
      }
      
      const result = await TrainingService.start(projectId, {
        ...config,
        data: yoloDataPath,
        project: yoloProjectPath
      });
      res.json({ message: 'Training started', ...result });
    } catch (err) {
      logger.error(`Failed to start training for ${projectId}:`, err);
      
      let userFriendlyMessage = err.message;
      if (err.message.includes('CUDA') || err.message.includes('GPU') || err.message.includes('cuda')) {
        userFriendlyMessage = `硬件相关错误: ${err.message}`;
      } else if (err.message.includes('data.yaml') || err.message.includes('dataset')) {
        userFriendlyMessage = `数据集配置错误: ${err.message}`;
      }
      
      res.status(500).json({ error: userFriendlyMessage });
    }
  });

  router.get('/:projectId/train/status', (req, res) => {
    const { projectId } = req.params;
    const status = TrainingService.getStatus(projectId);
    const logStats = ProcessManager.getLogStats(projectId);
    status.logStats = logStats;
    res.json(status);
  });

  router.get('/:projectId/dataset/info', (req, res) => {
    const { projectId } = req.params;
    const paths = ExportService.getProjectPaths(projectId, projectsDir);
    const datasetPath = paths.dataset;
    const yamlPath = PathUtils.join(datasetPath, 'data.yaml');
    
    const result = {
      datasetPath,
      yamlPath,
      exists: fs.existsSync(yamlPath),
      imagesPath: {
        train: PathUtils.join(datasetPath, 'images', 'train'),
        val: PathUtils.join(datasetPath, 'images', 'val'),
        test: PathUtils.join(datasetPath, 'images', 'test')
      },
      labelsPath: {
        train: PathUtils.join(datasetPath, 'labels', 'train'),
        val: PathUtils.join(datasetPath, 'labels', 'val'),
        test: PathUtils.join(datasetPath, 'labels', 'test')
      }
    };
    
    if (result.exists) {
      try {
        const yamlContent = fs.readFileSync(yamlPath, 'utf8');
        const yaml = require('yaml');
        const parsed = yaml.parse(yamlContent);
        result.kptShape = parsed.kpt_shape;
        result.names = parsed.names;
      } catch (e) {
        result.parseError = e.message;
      }
    }
    
    res.json(result);
  });

  router.get('/:projectId/train/stream', (req, res) => {
    const { projectId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('connected', { projectId, time: Date.now() });

    const logHandler = ({ projectId: pId, log }) => {
      if (pId === projectId) {
        sendEvent('log', log);
      }
    };

    const metricHandler = ({ projectId: pId, metric }) => {
      if (pId === projectId) {
        sendEvent('metric', metric);
      }
    };

    const statusHandler = ({ projectId: pId, status }) => {
      if (pId === projectId) {
        sendEvent('status', { status, time: Date.now() });
      }
    };

    ProcessManager.on('log', logHandler);
    ProcessManager.on('metric', metricHandler);
    ProcessManager.on('statusChange', statusHandler);

    req.on('close', () => {
      ProcessManager.off('log', logHandler);
      ProcessManager.off('metric', metricHandler);
      ProcessManager.off('statusChange', statusHandler);
      res.end();
    });
  });

  router.post('/:projectId/train/stop', async (req, res) => {
    const { projectId } = req.params;
    try {
      await TrainingService.stop(projectId);
      res.json({ message: 'Training stopped' });
    } catch (err) {
      logger.error(`Failed to stop training for ${projectId}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:projectId/train/dry-run', async (req, res) => {
    const { projectId } = req.params;
    const config = req.body;

    const paths = ExportService.getProjectPaths(projectId, projectsDir);
    const defaultYamlPath = PathUtils.join(paths.dataset, 'data.yaml');
    
    const parsedPath = PathUtils.parseYamlPath(config.data, defaultYamlPath, paths.root);
    const dataYamlPath = parsedPath.path;

    const pathBoundsCheck = PathUtils.validatePathWithinBounds(dataYamlPath, paths.root, {
      allowAbsolute: true,
      allowedExtensions: ['.yaml', '.yml']
    });
    if (!pathBoundsCheck.valid) {
      logger.warn(`Path security check failed: ${JSON.stringify(pathBoundsCheck.issues)}`);
      return res.status(400).json({
        error: `路径安全检查失败: ${pathBoundsCheck.issues.join('; ')}`,
        code: 'PATH_SECURITY_VIOLATION'
      });
    }

    const pathValidation = PathUtils.validateForYaml(dataYamlPath);
    if (!pathValidation.valid) {
      const errorMsg = PathUtils.formatErrorMessage(pathValidation, config.data);
      return res.status(400).json({
        error: errorMsg,
        code: 'INVALID_PATH'
      });
    }

    const existsCheck = PathUtils.checkFileExists(dataYamlPath);
    if (!existsCheck.exists) {
      return res.status(400).json({
        error: `配置文件未找到: ${dataYamlPath}`,
        code: 'DATASET_NOT_FOUND'
      });
    }

    try {
      const yoloDataPath = PathUtils.toYoloFormat(dataYamlPath);
      const yoloProjectPath = config.project ? PathUtils.toYoloFormat(PathUtils.resolve(config.project)) : PathUtils.toYoloFormat(paths.root);
      
      const result = await TrainingService.startDryRun(projectId, {
        ...config,
        data: yoloDataPath,
        project: yoloProjectPath
      });
      res.json({ message: 'Dry run started', ...result });
    } catch (err) {
      logger.error(`Failed to start dry run for ${projectId}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/queue/status', (req, res) => {
    const queueStatus = TrainingService.getQueueStatus();
    res.json(queueStatus);
  });

  router.get('/:projectId/train/check-resume', (req, res) => {
    const { projectId } = req.params;
    const { name } = req.query;
    
    const paths = ExportService.getProjectPaths(projectId, projectsDir);
    const projectDir = paths.run;
    
    const weightsDir = path.join(projectDir, name || 'exp', 'weights');
    const lastPtPath = path.join(weightsDir, 'last.pt');
    
    const fs = require('fs');
    
    if (!fs.existsSync(lastPtPath)) {
      return res.json({
        available: false,
        message: 'No previous training found'
      });
    }
    
    res.json({
      available: true,
      lastPtPath: lastPtPath,
      message: 'Previous training checkpoint found'
    });
  });

  router.delete('/queue/job/:jobId', async (req, res) => {
    const { jobId } = req.params;
    try {
      const result = await TrainingService.removeJob(jobId);
      res.json(result);
    } catch (err) {
      logger.error(`Failed to remove job ${jobId}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/queue/job/:jobId/cancel', async (req, res) => {
    const { jobId } = req.params;
    try {
      const result = await TrainingService.cancelJob(jobId);
      res.json(result);
    } catch (err) {
      logger.error(`Failed to cancel job ${jobId}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/queue/reorder', async (req, res) => {
    const { fromIndex, toIndex } = req.body;
    try {
      const result = await TrainingService.reorderQueue(fromIndex, toIndex);
      res.json(result);
    } catch (err) {
      logger.error(`Failed to reorder queue:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/queue/clear', async (req, res) => {
    try {
      const result = await TrainingService.clearQueue();
      res.json(result);
    } catch (err) {
      logger.error(`Failed to clear queue:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:projectId/export/yolo', async (req, res) => {
    const { projectId } = req.params;
    const options = req.body;

    try {
      const result = await ExportService.exportToYolo(projectId, projectsDir, options);
      res.json(result);
    } catch (err) {
      logger.error(`Export failed for ${projectId}:`, err);
      res.status(500).json({ error: 'Export failed', details: err.message });
    }
  });

  return router;
}

function createSettingsRouter() {
  const router = express.Router();

  router.get('/', (req, res) => {
    const config = settings.load();
    res.json(config);
  });

  router.post('/', (req, res) => {
    const { pythonPath, projectsDir } = req.body;
    const updates = {};
    if (pythonPath !== undefined) updates.pythonPath = pythonPath;
    if (projectsDir !== undefined) updates.projectsDir = projectsDir;
    
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
      projectsDir, 
      defaultProjectsDirName: defaultName,
      hasCustomDir: !!projectsDir 
    });
  });

  router.post('/projects-dir', (req, res) => {
    const { projectsDir } = req.body;
    
    if (projectsDir && !fs.existsSync(projectsDir)) {
      return res.status(400).json({ 
        success: false, 
        error: '指定的目录不存在' 
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
    const { pythonPath } = req.body;
    const PythonEnvService = require('../services/PythonEnvService');
    const result = await PythonEnvService.validatePython(pythonPath);
    res.json(result);
  });

  router.get('/scan-envs', async (req, res) => {
    const PythonEnvService = require('../services/PythonEnvService');
    try {
      const results = await PythonEnvService.scanAll();
      res.json(results);
    } catch (err) {
      logger.error('Failed to scan Python environments:', err);
      res.status(500).json({ error: 'Failed to scan environments' });
    }
  });

  router.get('/check-env', async (req, res) => {
    const PythonEnvService = require('../services/PythonEnvService');
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

function createUtilsRouter(projectsDir) {
  const router = express.Router();

  router.post('/select-folder', async (req, res) => {
    let electron;
    try {
      electron = require('electron');
    } catch (e) { }

    if (electron && electron.dialog) {
      try {
        const { dialog, BrowserWindow } = electron;
        const win = BrowserWindow.getFocusedWindow();
        const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
        if (!result.canceled && result.filePaths.length > 0) {
          res.json({ path: result.filePaths[0] });
        } else {
          res.json({ path: null });
        }
      } catch (err) {
        res.status(500).json({ error: 'Failed to open folder dialog' });
      }
    } else {
      res.status(400).json({ error: 'Folder picker is only available in Desktop version' });
    }
  });

  router.post('/save-file-dialog', async (req, res) => {
    let electron;
    try {
      electron = require('electron');
    } catch (e) { }

    if (electron && electron.dialog) {
      try {
        const { dialog, BrowserWindow } = electron;
        const win = BrowserWindow.getFocusedWindow();
        const { title, defaultPath, filters } = req.body;

        const result = await dialog.showSaveDialog(win, {
          title: title || '保存文件',
          defaultPath: defaultPath || '',
          filters: filters || [{ name: 'ZIP Archive', extensions: ['zip'] }, { name: 'All Files', extensions: ['*'] }]
        });

        res.json({ path: result.canceled ? null : result.filePath });
      } catch (err) {
        res.status(500).json({ error: 'Failed to open save dialog' });
      }
    } else {
      res.status(400).json({ error: 'Save dialog is only available in Desktop version' });
    }
  });

  router.post('/select-file', async (req, res) => {
    let electron;
    try {
      electron = require('electron');
    } catch (e) { }

    if (electron && electron.dialog) {
      try {
        const { dialog, BrowserWindow } = electron;
        const win = BrowserWindow.getFocusedWindow();
        const { filters } = req.body;
        const defaultFilters = [
          { name: 'ZIP Archive', extensions: ['zip'] },
          { name: 'YAML Configuration', extensions: ['yaml', 'yml'] },
          { name: 'All Files', extensions: ['*'] }
        ];

        const result = await dialog.showOpenDialog(win, {
          properties: ['openFile'],
          filters: filters || defaultFilters
        });

        if (!result.canceled && result.filePaths.length > 0) {
          res.json({ path: result.filePaths[0] });
        } else {
          res.json({ path: null });
        }
      } catch (err) {
        res.status(500).json({ error: 'Failed to open file dialog' });
      }
    } else {
      res.status(400).json({ error: 'File picker is only available in Desktop version' });
    }
  });

  router.post('/select-python', async (req, res) => {
    let electron;
    try {
      electron = require('electron');
    } catch (e) { }

    if (electron && electron.dialog) {
      try {
        const { dialog, BrowserWindow } = electron;
        const win = BrowserWindow.getFocusedWindow();

        const result = await dialog.showOpenDialog(win, {
          properties: ['openFile'],
          filters: [
            { name: 'Python Executable', extensions: ['exe', 'py'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          title: '选择 Python 解释器'
        });

        if (!result.canceled && result.filePaths.length > 0) {
          res.json({ path: result.filePaths[0] });
        } else {
          res.json({ path: null });
        }
      } catch (err) {
        res.status(500).json({ error: 'Failed to open dialog' });
      }
    } else {
      res.status(400).json({ error: '此功能仅在桌面版应用中可用' });
    }
  });

  router.post('/scan-images', async (req, res) => {
    const { folderPath, maxResults = 5000 } = req.body;

    if (!folderPath) {
      return res.status(400).json({ error: '文件夹路径不能为空' });
    }

    if (!fs.existsSync(folderPath)) {
      return res.status(400).json({ error: '指定的文件夹不存在' });
    }

    try {
      const stat = fs.statSync(folderPath);
      if (!stat.isDirectory()) {
        return res.status(400).json({ error: '指定的路径不是文件夹' });
      }

      const SUPPORTED_EXTENSIONS = /\.(jpg|jpeg|png|gif|bmp|webp)$/i;
      const results = [];
      const errors = [];

      const scanDir = (dirPath) => {
        try {
          const items = fs.readdirSync(dirPath);
          for (const item of items) {
            if (item.startsWith('.') || item.startsWith('_to_delete_')) continue;

            const itemPath = path.join(dirPath, item);
            try {
              const itemStat = fs.statSync(itemPath);

              if (itemStat.isDirectory()) {
                scanDir(itemPath);
              } else if (itemStat.isFile() && SUPPORTED_EXTENSIONS.test(item)) {
                let dimensions = null;
                try {
                  dimensions = imageSize(itemPath);
                } catch (e) { }

                results.push({
                  name: item,
                  path: itemPath,
                  relativePath: path.relative(folderPath, itemPath),
                  size: itemStat.size,
                  width: dimensions ? dimensions.width : null,
                  height: dimensions ? dimensions.height : null,
                  createdTime: itemStat.birthtime,
                  modifiedTime: itemStat.mtime,
                  error: null
                });
              }
            } catch (e) {
              errors.push({ path: itemPath, error: e.message });
            }
          }
        } catch (e) {
          errors.push({ path: dirPath, error: e.message });
        }
      };

      const startTime = Date.now();
      scanDir(folderPath);
      const scanTime = Date.now() - startTime;

      const limitedResults = results.slice(0, maxResults);
      const wasLimited = results.length > maxResults;

      res.json({
        success: true,
        images: limitedResults,
        totalFound: results.length,
        returnedCount: limitedResults.length,
        wasLimited,
        errors: errors.slice(0, 50),
        errorCount: errors.length,
        scanTime
      });
    } catch (err) {
      res.status(500).json({ error: '扫描文件夹失败: ' + err.message });
    }
  });

  router.get('/import-history', (req, res) => {
    // This route was incorrectly placed here and moved to ProjectController.js
    res.status(410).json({ error: 'This route has moved to /api/projects/:projectId/import-history' });
  });

  return router;
}

module.exports = {
  createTrainingRouter,
  createSettingsRouter,
  createUtilsRouter
};
