const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const logger = require('./utils/logger');
const { createTrainingRouter, createUtilsRouter } = require('./controllers/TrainingController');
const createProjectRouter = require('./controllers/ProjectController');
const { createSettingsRouter, createEnvSettingsRouter } = require('./controllers/SettingsController');
const createSystemRouter = require('./controllers/SystemController');
const { attachResponseHelpers, buildRouteManifest } = require('./http/response');
const { AppError, toAppError } = require('./http/errors');
const { ERROR_CODES } = require('./http/errorCodes');

function createApp(PROJECTS_DIR, appOptions = {}) {
  const app = express();
  const recentErrors = [];
  let routeManifest = { routes: [], signature: '' };
  const startupState = {
    mode: 'strict',
    ready: false,
    error: null,
    appLogPath: appOptions.appLogPath || null
  };

  const pushRecentError = (entry) => {
    if (!entry) return;
    recentErrors.push(entry);
    if (recentErrors.length > 200) {
      recentErrors.splice(0, recentErrors.length - 200);
    }
  };

  app.use(cors());
  app.use((req, res, next) => {
    req.requestId = `req_${crypto.randomUUID().replace(/-/g, '')}`;
    logger.info(`[${req.requestId}] ${req.method} ${req.path}`);
    next();
  });
  app.use(attachResponseHelpers);
  app.use((req, res, next) => {
    const originalSendError = res.sendError.bind(res);
    res.sendError = (err, statusOverride = null) => {
      const appError = toAppError(err, req, statusOverride || res.statusCode || 500);
      pushRecentError({
        requestId: req.requestId,
        ts: new Date().toISOString(),
        code: appError.code || ERROR_CODES.INTERNAL_ERROR,
        message: appError.message || 'Internal server error',
        where: appError.where || { method: req.method, path: req.path }
      });
      return originalSendError(err, statusOverride);
    };
    next();
  });
  app.use(bodyParser.json());

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

  const projectRouter = createProjectRouter(projectsDir);
  const trainingRouter = createTrainingRouter(projectsDir);
  const settingsRouter = createSettingsRouter();
  const envSettingsRouter = createEnvSettingsRouter();
  const utilsRouter = createUtilsRouter(projectsDir);
  const systemRouter = createSystemRouter({
    getRouteManifest: () => routeManifest,
    getRecentErrors: () => recentErrors,
    getStartupState: () => startupState,
    getLoggerInfo: () => ({
      logsDir: logger.logsDir,
      errorLogPath: logger.errorLogPath,
      combinedLogPath: logger.combinedLogPath
    })
  });

  const routeMounts = [
    { base: '/api/projects', router: projectRouter },
    { base: '/api/projects', router: trainingRouter },
    { base: '/api/settings', router: settingsRouter },
    { base: '/api/settings', router: envSettingsRouter },
    { base: '/api/utils', router: utilsRouter },
    { base: '/api/system', router: systemRouter }
  ];
  routeManifest = buildRouteManifest(routeMounts);

  for (const mount of routeMounts) {
    app.use(mount.base, mount.router);
  }

  app.use((req, res, next) => {
    const appError = new AppError({
      code: ERROR_CODES.ROUTE_NOT_FOUND,
      message: '请求的接口不存在',
      status: 404,
      details: {
        method: req.method,
        path: req.path
      },
      where: { method: req.method, path: req.path },
      retryable: false
    });
    logger.warn(`[404] ${req.method} ${req.path}`);
    res.sendError(appError, 404);
  });

  app.use((err, req, res, next) => {
    const status = Number.isInteger(err?.status)
      ? err.status
      : (Number.isInteger(err?.statusCode) ? err.statusCode : 500);
    logger.error(`[${status}] ${req.method} ${req.path}:`, err);
    startupState.error = startupState.error || err.message;

    if (typeof res.sendError === 'function') {
      return res.sendError(err, status);
    }

    const appError = toAppError(err, req, status);
    return res.status(status).json({
      ok: false,
      error: {
        code: appError.code || ERROR_CODES.INTERNAL_ERROR,
        message: appError.message || 'Internal server error',
        hint: appError.hint,
        where: appError.where || { method: req?.method, path: req?.path },
        details: appError.details || {},
        retryable: !!appError.retryable,
        requestId: req?.requestId || null
      },
      meta: {
        requestId: req?.requestId || null,
        timestamp: new Date().toISOString()
      }
    });
  });

  app.locals.routeManifest = routeManifest;
  app.locals.getRecentErrors = () => recentErrors;
  app.locals.startupState = startupState;
  startupState.ready = true;

  return app;
}

module.exports = createApp;
