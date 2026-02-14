const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: (options) => ipcRenderer.invoke('dialog:selectFile', options),

  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

  selectPython: () => ipcRenderer.invoke('dialog:selectPython'),

  getPythonPath: () => ipcRenderer.invoke('config:getPythonPath'),

  setPythonPath: (path) => ipcRenderer.invoke('config:setPythonPath', path),

  getAppPath: (name) => ipcRenderer.invoke('app:getPath', name),

  onTrainingLog: (callback) => {
    ipcRenderer.on('training:log', (event, data) => callback(data));
  },

  onTrainingMetric: (callback) => {
    ipcRenderer.on('training:metric', (event, data) => callback(data));
  },

  onTrainingStatus: (callback) => {
    ipcRenderer.on('training:status', (event, data) => callback(data));
  },

  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

window.electronAPI = {
  selectFile: (options) => ipcRenderer.invoke('dialog:selectFile', options),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  selectPython: () => ipcRenderer.invoke('dialog:selectPython'),
  getPythonPath: () => ipcRenderer.invoke('config:getPythonPath'),
  setPythonPath: (path) => ipcRenderer.invoke('config:setPythonPath', path),
  getAppPath: (name) => ipcRenderer.invoke('app:getPath', name),
  onTrainingLog: (callback) => ipcRenderer.on('training:log', (event, data) => callback(data)),
  onTrainingMetric: (callback) => ipcRenderer.on('training:metric', (event, data) => callback(data)),
  onTrainingStatus: (callback) => ipcRenderer.on('training:status', (event, data) => callback(data)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
};
