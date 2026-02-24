const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
Menu.setApplicationMenu(null);
const path = require('path');
const fs = require('fs');
const http = require('http');
const { startServer, stopServer } = require('./server/index.js');

let mainWindow;
let serverInstance;

const logPath = path.join(app.getPath('userData'), 'app.log');
function log(msg) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
  console.log(msg);
}

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createStartupFailureWindow(error) {
  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Pose Annotator - Startup Failed</title>
    <style>
      body { margin: 0; font-family: "Segoe UI", sans-serif; background: #0b1220; color: #e2e8f0; }
      .wrap { max-width: 900px; margin: 24px auto; padding: 24px; }
      .card { background: #111b2e; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-top: 16px; }
      .title { font-size: 22px; font-weight: 700; color: #fca5a5; }
      .sub { margin-top: 8px; color: #93c5fd; }
      .label { color: #94a3b8; font-size: 13px; margin-bottom: 8px; }
      pre { white-space: pre-wrap; word-break: break-word; color: #f8fafc; background: #020617; padding: 12px; border-radius: 8px; max-height: 360px; overflow: auto; }
      button { border: 1px solid #64748b; background: #1e293b; color: #e2e8f0; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
      .actions { margin-top: 12px; display: flex; gap: 8px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="title">后端启动失败，应用已阻断运行</div>
      <div class="sub">请修复启动错误后重启应用。此窗口用于直接定位根因，避免出现模糊路由错误。</div>
      <div class="card">
        <div class="label">日志文件</div>
        <pre>${escapeHtml(logPath)}</pre>
      </div>
      <div class="card">
        <div class="label">错误详情</div>
        <pre id="err">${escapeHtml(error)}</pre>
        <div class="actions">
          <button onclick="navigator.clipboard.writeText(document.getElementById('err').innerText)">复制错误详情</button>
        </div>
      </div>
    </div>
  </body>
  </html>`;

  const win = new BrowserWindow({
    width: 1000,
    height: 760,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'Pose Annotator - Startup Failed'
  });
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function waitForBackendReady(timeoutMs = 12000, intervalMs = 300) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: 5000,
          path: '/api/system/health',
          method: 'GET',
          timeout: 1500
        },
        (res) => {
          let buf = '';
          res.on('data', (d) => (buf += d));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(buf);
              if (res.statusCode === 200 && parsed?.ok === true && parsed?.data?.responseEnvelope) {
                return resolve(parsed.data);
              }
            } catch {}

            if (Date.now() - started >= timeoutMs) {
              return reject(new Error('Backend health check timed out'));
            }
            setTimeout(tick, intervalMs);
          });
        }
      );
      req.on('error', () => {
        if (Date.now() - started >= timeoutMs) {
          return reject(new Error('Backend health check failed'));
        }
        setTimeout(tick, intervalMs);
      });
      req.on('timeout', () => req.destroy());
      req.end();
    };
    tick();
  });
}

function createWindow() {
  log('Creating window...');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Pose Annotator'
  });

  const isDev = !app.isPackaged;
  const prodPath = path.join(__dirname, 'client', 'dist', 'index.html');

  if (isDev) {
    log('Running in development mode, loading dev server (http://localhost:5173)...');
    mainWindow.loadURL('http://localhost:5173');
  } else if (fs.existsSync(prodPath)) {
    log(`Loading production build from: ${prodPath}`);
    mainWindow.loadFile(prodPath);
  } else {
    const err = `Production build not found: ${prodPath}`;
    log(`CRITICAL: ${err}`);
    createStartupFailureWindow(err);
    return;
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIPC() {
  ipcMain.handle('dialog:selectFile', async (_event, options) => {
    const defaultFilters = [
      { name: 'ZIP Archive', extensions: ['zip'] },
      { name: 'YAML Configuration', extensions: ['yaml', 'yml'] },
      { name: 'All Files', extensions: ['*'] }
    ];
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: options?.filters || defaultFilters
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:selectPython', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Python Executable', extensions: ['exe', 'py'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: '选择 Python 解释器'
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('config:getPythonPath', async () => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath));
        return settings.pythonPath || '';
      } catch {
        return '';
      }
    }
    return '';
  });

  ipcMain.handle('config:setPythonPath', async (_event, pythonPath) => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath));
      } catch {}
    }
    settings.pythonPath = pythonPath;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return true;
  });

  ipcMain.handle('app:getPath', async (_event, name) => app.getPath(name));
}

async function startBackend() {
  log('Starting backend server...');
  const started = await startServer({
    port: 5000,
    appLogPath: logPath
  });
  serverInstance = started.server;
  await waitForBackendReady();
  log('Backend server started and health check passed');
}

app.on('ready', async () => {
  log('App ready event received');
  setupIPC();
  try {
    await startBackend();
    createWindow();
  } catch (err) {
    const msg = err?.stack || err?.message || String(err);
    log(`CRITICAL: Failed to start backend: ${msg}`);
    createStartupFailureWindow(msg);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', async () => {
  if (serverInstance && serverInstance.close) {
    try {
      await stopServer();
    } catch (err) {
      log(`Failed to stop backend cleanly: ${err?.message || err}`);
    }
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
