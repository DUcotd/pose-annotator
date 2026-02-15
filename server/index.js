const path = require('path');
const fs = require('fs');
const createApp = require('./src/app');

const PROJECTS_DIR = (function() {
  if (process.versions?.electron) {
    const { app } = require('electron');
    const exePath = app.getPath('exe');
    const installDir = path.dirname(exePath);
    return path.join(installDir, 'projects');
  }
  return path.join(__dirname, 'projects');
})();

if (!fs.existsSync(PROJECTS_DIR)) {
  try {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create projects directory:', e.message);
  }
}

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
