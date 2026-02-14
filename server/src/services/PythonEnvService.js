const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const settings = require('../config/settings');
const defaultConfig = require('../config/defaultConfig');

class PythonEnvService {
  constructor() {
    this._cache = null;
  }

  getCandidates() {
    const userPath = settings.getPythonPath();
    const candidates = [];

    if (userPath) candidates.push({ path: userPath, source: 'user_config' });

    const projectVenv = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
    if (fs.existsSync(projectVenv)) {
      candidates.push({ path: projectVenv, source: 'project_venv' });
    }

    candidates.push({ path: 'python', source: 'system' });
    candidates.push({ path: 'python3', source: 'system' });

    defaultConfig.python.defaultPaths.forEach(p => {
      if (!candidates.find(c => c.path === p)) {
        candidates.push({ path: p, source: 'default' });
      }
    });

    return candidates;
  }

  async validatePython(pythonPath) {
    try {
      const versionCmd = `"${pythonPath}" --version`;
      const version = execSync(versionCmd, { encoding: 'utf8', timeout: 5000, windowsHide: true });

      if (!version.toLowerCase().includes('python')) {
        return { valid: false, error: 'Not a valid Python interpreter' };
      }

      let hasUltralytics = false;
      let hasTorch = false;
      let cudaAvailable = false;
      let torchVersion = null;

      try {
        const checkCmd = `"${pythonPath}" -c "import ultralytics; import torch; print('OK'); print(torch.__version__); print('CUDA' if torch.cuda.is_available() else 'CPU')"`;
        const output = execSync(checkCmd, { encoding: 'utf8', timeout: 10000, windowsHide: true });
        const lines = output.trim().split('\n');
        if (lines[0] === 'OK') {
          hasUltralytics = true;
          hasTorch = lines[1]?.startsWith('2.') || lines[1]?.startsWith('1.');
          torchVersion = lines[1];
          cudaAvailable = lines[2] === 'CUDA';
        }
      } catch (e) {
        logger.debug(`Python validation: optional packages check failed: ${e.message}`);
      }

      return {
        valid: true,
        version: version.trim(),
        hasUltralytics,
        hasTorch,
        torchVersion,
        cudaAvailable,
        message: hasUltralytics
          ? `Python ${version.trim()}, PyTorch ${torchVersion}, CUDA: ${cudaAvailable ? 'Yes' : 'No'}`
          : 'Python 有效（建议安装 ultralytics: pip install ultralytics）'
      };
    } catch (err) {
      logger.error(`Python validation failed for ${pythonPath}:`, err.message);
      return { valid: false, error: err.message };
    }
  }

  async autoDetect() {
    const candidates = this.getCandidates();

    for (const candidate of candidates) {
      if (!candidate.path) continue;
      const result = await this.validatePython(candidate.path);
      if (result.valid) {
        logger.info(`Auto-detected Python: ${candidate.path} (${candidate.source})`);
        return { path: candidate.path, ...result };
      }
    }

    logger.warn('No valid Python environment found');
    return null;
  }

  async getBestPython() {
    const userPath = settings.getPythonPath();
    if (userPath) {
      const result = await this.validatePython(userPath);
      if (result.valid) {
        return { path: userPath, ...result };
      }
    }

    return await this.autoDetect();
  }

  async checkEnv() {
    const best = await this.getBestPython();
    if (best) {
      return {
        available: true,
        path: best.path,
        version: best.version,
        ultralytics: best.hasUltralytics,
        torch: best.hasTorch,
        torchVersion: best.torchVersion,
        cuda: best.cudaAvailable,
        message: best.message
      };
    }
    return {
      available: false,
      message: 'No valid Python environment found. Please configure Python path in settings.'
    };
  }
}

module.exports = new PythonEnvService();
