const { app, BrowserWindow, Menu } = require('electron');
Menu.setApplicationMenu(null);
const path = require('path');
const { app: expressApp, startServer } = require('./server.js');
const fs = require('fs');

const logPath = path.join(app.getPath('userData'), 'app.log');
function log(msg) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
    console.log(msg);
}

let mainWindow;
let serverInstance;

function createWindow() {
    log('Creating window...');
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
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
        // Try alternate path variation often used by electron-builder
        const altPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
        if (fs.existsSync(altPath)) {
            mainWindow.loadFile(altPath);
        } else {
            // Last resort
            mainWindow.loadURL('http://localhost:5173');
        }
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function startBackend() {
    try {
        log('Starting backend server...');
        serverInstance = startServer(5000);
        log('Backend server started on port 5000');
    } catch (err) {
        log(`CRITICAL: Failed to start backend: ${err.message}`);
    }
}

app.on('ready', () => {
    log('App ready event received');
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
