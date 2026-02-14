const express = require('express');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const TrainingService = require('../services/TrainingService');
const ExportService = require('../services/ExportService');
const ProcessManager = require('../managers/ProcessManager');
const settings = require('../config/settings');

function createTrainingRouter(projectsDir) {
  const router = express.Router();

  router.post('/:projectId/train', async (req, res) => {
    const { projectId } = req.params;
    const config = req.body;

    const paths = ExportService.getProjectPaths(projectId, projectsDir);
    const dataYamlPath = config.data && typeof config.data === 'string' && config.data.trim() !== ''
      ? (path.isAbsolute(config.data) ? config.data : path.join(paths.root, config.data))
      : path.join(paths.dataset, 'data.yaml');

    if (!fs.existsSync(dataYamlPath)) {
      return res.status(400).json({
        error: `Dataset config not found at: ${dataYamlPath}. Please ensure the path is correct or export the dataset first.`
      });
    }

    try {
      const result = await TrainingService.start(projectId, {
        ...config,
        data: dataYamlPath,
        project: config.project || paths.root
      });
      res.json({ message: 'Training started', ...result });
    } catch (err) {
      logger.error(`Failed to start training for ${projectId}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:projectId/train/status', (req, res) => {
    const { projectId } = req.params;
    const status = TrainingService.getStatus(projectId);
    res.json(status);
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
    const { pythonPath } = req.body;
    if (settings.setPythonPath(pythonPath)) {
      res.json({ success: true, message: 'Settings saved', pythonPath });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save settings' });
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
