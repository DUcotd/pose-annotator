const path = require('path');
const createApp = require('./src/app');

const PROJECTS_DIR = (function() {
  if (process.versions?.electron) {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'projects');
  }
  return path.join(__dirname, 'projects');
})();

const app = createApp(PROJECTS_DIR);
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});

module.exports = { app, server };
