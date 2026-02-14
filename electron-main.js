const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
Menu.setApplicationMenu(null);
const path = require('path');
const fs = require('fs');

let mainWindow;
let serverInstance;
let expressApp;

const logPath = path.join(app.getPath('userData'), 'app.log');
function log(msg) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
    console.log(msg);
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
        title: "Pose Annotator"
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
        log('Production build not found, checking alternate paths...');
        const altPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
        if (fs.existsSync(altPath)) {
            mainWindow.loadFile(altPath);
        } else {
            mainWindow.loadURL('http://localhost:5173');
        }
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function setupIPC() {
    ipcMain.handle('dialog:selectFile', async (event, options) => {
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
            } catch (e) {
                return '';
            }
        }
        return '';
    });

    ipcMain.handle('config:setPythonPath', async (event, pythonPath) => {
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        let settings = {};
        if (fs.existsSync(settingsPath)) {
            try {
                settings = JSON.parse(fs.readFileSync(settingsPath));
            } catch (e) { }
        }
        settings.pythonPath = pythonPath;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        return true;
    });

    ipcMain.handle('app:getPath', async (event, name) => {
        return app.getPath(name);
    });
}

function startBackend() {
    try {
        log('Starting backend server...');
        const serverModule = require('./server/index.js');
        expressApp = serverModule.app;
        serverInstance = serverModule.server;
        log('Backend server started on port 5000');
    } catch (err) {
        log(`CRITICAL: Failed to start backend: ${err.message}`);
        try {
            const legacyServer = require('./server.js');
            expressApp = legacyServer.app;
            serverInstance = legacyServer.startServer(5000);
            log('Backend server started (legacy mode) on port 5000');
        } catch (e) {
            log(`CRITICAL: Failed to start legacy backend: ${e.message}`);
        }
    }
}

app.on('ready', () => {
    log('App ready event received');
    setupIPC();
    startBackend();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('quit', () => {
    if (serverInstance && serverInstance.close) {
        serverInstance.close();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
