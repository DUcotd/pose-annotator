const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const logger = require('./utils/logger');
const settings = require('./config/settings');
const ProcessManager = require('./managers/ProcessManager');
const { createTrainingRouter, createSettingsRouter, createUtilsRouter } = require('./controllers/TrainingController');
const createProjectRouter = require('./controllers/ProjectController');

function createApp(PROJECTS_DIR) {
  const app = express();

  app.use(cors());
  app.use(bodyParser.json());

  app.use((req, res, next) => {
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info(`[${req.requestId}] ${req.method} ${req.path}`);
    next();
  });

  const projectsDir = PROJECTS_DIR || path.join(__dirname, '..', 'projects');

  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true });
  }

  const LEGACY_UPLOADS = path.join(__dirname, '..', '..', 'uploads');
  const LEGACY_ANNOTATIONS = path.join(__dirname, '..', '..', 'annotations');

  if (fs.existsSync(LEGACY_UPLOADS)) {
    logger.info("Found legacy data. Migrating to 'Default_Project'...");
    const defaultProjPath = path.join(projectsDir, 'Default_Project');

    if (!fs.existsSync(defaultProjPath)) {
      fs.mkdirSync(defaultProjPath);
      fs.renameSync(LEGACY_UPLOADS, path.join(defaultProjPath, 'uploads'));
      if (fs.existsSync(LEGACY_ANNOTATIONS)) {
        fs.renameSync(LEGACY_ANNOTATIONS, path.join(defaultProjPath, 'annotations'));
      }
    }
    logger.info("Migration complete.");
  }

  app.use('/api/projects', createProjectRouter(projectsDir));
  app.use('/api/projects', createTrainingRouter(projectsDir));
  app.use('/api/settings', createSettingsRouter());
  app.use('/api/utils', createUtilsRouter(projectsDir));

  app.use((req, res, next) => {
    logger.warn(`[404] ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Route not found', method: req.method, path: req.path });
  });

  app.use((err, req, res, next) => {
    logger.error(`[500] ${req.method} ${req.path}:`, err);
    res.status(500).json({
      error: 'Internal server error',
      details: err.message,
      requestId: req.requestId
    });
  });

  return app;
}

module.exports = createApp;
