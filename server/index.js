const path = require('path');
const fs = require('fs');
const createApp = require('./src/app');
const SafeFileOp = require('./src/services/FileService');
const projectRegistry = require('./src/services/ProjectRegistryService');
const settings = require('./src/config/settings');
const logger = require('./src/utils/logger');

const PROJECTS_DIR = (function() {
  if (process.versions?.electron) {
    const { app } = require('electron');
    const exePath = app.getPath('exe');
    const installDir = path.dirname(exePath);
    return path.join(installDir, 'projects');
  }
  return path.join(__dirname, 'projects');
})();

async function performStartupTasks() {
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
  if (config.additionalProjectPaths && Array.isArray(config.additionalProjectPaths)) {
    config.additionalProjectPaths.forEach(p => {
      if (p && !allPaths.includes(p)) {
        allPaths.push(p);
      }
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

const app = createApp(PROJECTS_DIR);
const PORT = process.env.PORT || 5000;

performStartupTasks().then(() => {
  const server = app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    console.log(`Server running on http://localhost:${PORT}`);
  });

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

  module.exports = { app, server };
}).catch(err => {
  logger.error('[FATAL] Startup failed:', err);
  console.error('[FATAL] Startup failed:', err);
  process.exit(1);
});
