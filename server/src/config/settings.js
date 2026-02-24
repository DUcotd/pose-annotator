const path = require('path');
const fs = require('fs');
const defaultConfig = require('./defaultConfig');

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

function resolveDefaultConfigPath() {
  const userDataDir = resolveElectronUserDataDir();
  if (userDataDir) {
    return path.join(userDataDir, 'settings.json');
  }
  return path.join(__dirname, '..', '..', 'settings.json');
}

const getConfigPath = () => process.env.POSE_ANNOTATOR_SETTINGS_PATH || resolveDefaultConfigPath();

class SettingsService {
  constructor() {
    this._config = null;
  }

  load() {
    try {
      const configPath = getConfigPath();
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf8');
        this._config = { ...defaultConfig, ...JSON.parse(data) };
      } else {
        this._config = { ...defaultConfig };
      }
    } catch (e) {
      console.error('[Settings] Failed to load config:', e.message);
      this._config = { ...defaultConfig };
    }
    return this._config;
  }

  get(key) {
    if (!this._config) this.load();
    return this._config[key];
  }

  set(key, value) {
    if (!this._config) this.load();
    this._config[key] = value;
  }

  save(config) {
    try {
      if (!this._config) this.load();
      const toSave = { ...this._config, ...config };
      const configPath = getConfigPath();
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const json = JSON.stringify(toSave, null, 2);
      const tmpPath = `${configPath}.tmp_${process.pid}_${Date.now()}`;
      fs.writeFileSync(tmpPath, json, 'utf8');

      let backupPath = null;
      try {
        if (fs.existsSync(configPath)) {
          backupPath = `${configPath}.bak_${process.pid}_${Date.now()}`;
          fs.renameSync(configPath, backupPath);
        }
        fs.renameSync(tmpPath, configPath);
        if (backupPath && fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
      } catch (e) {
        try {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch {}
        if (backupPath && fs.existsSync(backupPath) && !fs.existsSync(configPath)) {
          try { fs.renameSync(backupPath, configPath); } catch {}
        }
        throw e;
      }

      this._config = toSave;
      return true;
    } catch (e) {
      console.error('[Settings] Failed to save config:', e.message);
      return false;
    }
  }

  getPythonPath() {
    const config = this.load();
    if (config.pythonPath && fs.existsSync(config.pythonPath)) {
      return config.pythonPath;
    }
    return null;
  }

  setPythonPath(pythonPath) {
    return this.save({ pythonPath });
  }

  getProjectsDir() {
    const config = this.load();
    if (config.projectsDir && fs.existsSync(config.projectsDir)) {
      return config.projectsDir;
    }
    return null;
  }

  setProjectsDir(projectsDir) {
    return this.save({ projectsDir });
  }

  getDefaultProjectsDirName() {
    const config = this.load();
    return config.defaultProjectsDirName || 'projects';
  }
}

module.exports = new SettingsService();
