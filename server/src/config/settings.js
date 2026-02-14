const path = require('path');
const fs = require('fs');
const defaultConfig = require('./defaultConfig');

const GLOBAL_CONFIG_PATH = path.join(__dirname, '..', '..', 'settings.json');

class SettingsService {
  constructor() {
    this._config = null;
  }

  load() {
    try {
      if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
        const data = fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8');
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
      const toSave = { ...this._config, ...config };
      fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(toSave, null, 2), 'utf8');
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
}

module.exports = new SettingsService();
