const path = require('path');
const fs = require('fs');
const createApp = require('./src/app');
const SafeFileOp = require('./src/services/FileService');
const projectRegistry = require('./src/services/ProjectRegistryService');
const settings = require('./src/config/settings');
const logger = require('./src/utils/logger');

let activeInstance = null;
let handlersRegistered = false;

function resolveElectronUserDataDir() {
  if (!process.versions?.electron) return null;
  try {
    const { app } = require('electron');
    if (!app || typeof app.getPath !== 'function') return null;
    return app.getPath('userData');
  } catch {
    return null;
  }
}

function resolveProjectsDir() {
  const config = settings.load();
  if (typeof config.projectsDir === 'string' && config.projectsDir.trim()) {
    const explicit = path.resolve(config.projectsDir);
    logger.info(`[Config] Using projectsDir from settings: ${explicit}`);
    return explicit;
  }

  const userDataDir = resolveElectronUserDataDir();
  if (userDataDir) {
    const defaultName = settings.getDefaultProjectsDirName() || 'projects';
    const fromUserData = path.join(userDataDir, defaultName);
    logger.info(`[Config] Using projectsDir from userData: ${fromUserData}`);
    return fromUserData;
  }

  return path.join(__dirname, 'projects');
}

async function performStartupTasks(PROJECTS_DIR) {
  logger.info('[Startup] Performing startup tasks...');

  if (!fs.existsSync(PROJECTS_DIR)) {
    try {
      fs.mkdirSync(PROJECTS_DIR, { recursive: true });
      logger.info(`[Startup] Created projects directory: ${PROJECTS_DIR}`);
    } catch (e) {
      logger.error('[Startup] Failed to create projects directory:', e.message);
    }
  }

  projectRegistry.init(PROJECTS_DIR);

  const syncResult = projectRegistry.syncWithFilesystem(PROJECTS_DIR);
  logger.info(`[Startup] Registry sync: ${syncResult.added} added, ${syncResult.removed} removed, ${syncResult.total} total`);

  const config = settings.load();
  const allPaths = [PROJECTS_DIR];
  if (Array.isArray(config.additionalProjectPaths)) {
    config.additionalProjectPaths.forEach((p) => {
      if (p && !allPaths.includes(p)) allPaths.push(p);
    });
  }

  let totalCleaned = 0;
  for (const dir of allPaths) {
    if (fs.existsSync(dir)) {
      const cleaned = await SafeFileOp.cleanupPendingDeletions(dir);
      totalCleaned += cleaned;
    }
  }
  if (totalCleaned > 0) {
    logger.info(`[Startup] Cleaned up ${totalCleaned} pending deletions`);
  }

  projectRegistry.cleanupDeletedProjects(7);
  logger.info('[Startup] Startup tasks completed');
}

function registerProcessHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  process.on('uncaughtException', (err) => {
    logger.error('[FATAL] Uncaught Exception:', err.message);
    logger.error(err.stack);
    console.error('[FATAL] Uncaught Exception:', err.message);
    console.error(err.stack);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('[FATAL] Unhandled Rejection:', reason);
    console.error('[FATAL] Unhandled Rejection:', reason);
  });
}

async function startServer(options = {}) {
  if (activeInstance?.server) {
    return activeInstance;
  }

  const port = Number(options.port || process.env.PORT || 5000);
  const PROJECTS_DIR = resolveProjectsDir();
  await performStartupTasks(PROJECTS_DIR);

  const app = createApp(PROJECTS_DIR, {
    appLogPath: options.appLogPath || null
  });

  const server = await new Promise((resolve, reject) => {
    const httpServer = app.listen(port, () => resolve(httpServer));
    httpServer.on('error', reject);
  });

  logger.info(`Server running on http://localhost:${port}`);
  console.log(`Server running on http://localhost:${port}`);

  registerProcessHandlers();
  activeInstance = { app, server, port, projectsDir: PROJECTS_DIR };
  return activeInstance;
}

async function stopServer() {
  if (!activeInstance?.server) return;
  const { server } = activeInstance;
  await new Promise((resolve) => server.close(resolve));
  activeInstance = null;
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error('[FATAL] Startup failed:', err);
    console.error('[FATAL] Startup failed:', err);
    process.exit(1);
  });
}

module.exports = {
  startServer,
  stopServer
};

