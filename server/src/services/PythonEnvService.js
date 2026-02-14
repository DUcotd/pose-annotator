const { exec, execSync } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
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
      // Use execAsync for true async execution
      const { stdout: versionOutput } = await execAsync(versionCmd, { timeout: 5000, windowsHide: true });
      const version = versionOutput.trim();

      if (!version.toLowerCase().includes('python')) {
        return { valid: false, error: 'Not a valid Python interpreter' };
      }

      let hasUltralytics = false;
      let hasTorch = false;
      let cudaAvailable = false;
      let torchVersion = null;

      try {
        const checkCmd = `"${pythonPath}" -c "import ultralytics; import torch; print('OK'); print(torch.__version__); print('CUDA' if torch.cuda.is_available() else 'CPU')"`;
        const { stdout: checkOutput } = await execAsync(checkCmd, { timeout: 10000, windowsHide: true });
        const lines = checkOutput.trim().split('\n');

        // Find 'OK' index as some warnings might precede it
        const okIndex = lines.findIndex(l => l.trim() === 'OK');
        if (okIndex !== -1 && lines.length > okIndex + 2) {
          hasUltralytics = true;
          torchVersion = lines[okIndex + 1].trim();
          hasTorch = torchVersion.startsWith('2.') || torchVersion.startsWith('1.');
          cudaAvailable = lines[okIndex + 2].trim() === 'CUDA';
        }
      } catch (e) {
        logger.debug(`Python validation: optional packages check failed for ${pythonPath}: ${e.message}`);
      }

      return {
        valid: true,
        version: version,
        hasUltralytics,
        hasTorch,
        torchVersion,
        cudaAvailable,
        message: hasUltralytics
          ? `Python ${version}, PyTorch ${torchVersion}, CUDA: ${cudaAvailable ? 'Yes' : 'No'}`
          : 'Python 有效（建议安装 ultralytics: pip install ultralytics）'
      };
    } catch (err) {
      logger.debug(`Python validation failed for ${pythonPath}: ${err.message}`);
      return { valid: false, error: err.message };
    }
  }

  searchCondaExecutable() {
    const roots = [
      path.join(process.env.USERPROFILE || '', 'miniconda3'),
      path.join(process.env.USERPROFILE || '', 'anaconda3'),
      'C:\\ProgramData\\miniconda3',
      'C:\\ProgramData\\anaconda3',
      'D:\\miniconda3',
      'D:\\anaconda3'
    ];

    const subPaths = [
      path.join('condabin', 'conda.bat'),
      path.join('Scripts', 'conda.exe'),
      path.join('bin', 'conda')
    ];

    // 1. Try PATH
    try {
      execSync('conda --version', { stdio: 'ignore', windowsHide: true });
      return 'conda';
    } catch (e) { }

    // 2. Try common installation roots
    for (const root of roots) {
      for (const sub of subPaths) {
        const fullPath = path.join(root, sub);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
    }
    return null;
  }

  async listCondaEnvs() {
    const condaExec = this.searchCondaExecutable();
    if (!condaExec) {
      logger.debug('Conda executable not found in common locations');
      return [];
    }

    try {
      logger.debug(`Using conda executable: ${condaExec}`);
      const output = execSync(`"${condaExec}" env list --json`, { encoding: 'utf8', windowsHide: true });
      const data = JSON.parse(output);
      if (data.envs && Array.isArray(data.envs)) {
        return data.envs.map(envPath => {
          const isWindows = process.platform === 'win32';
          const pythonPath = isWindows ? path.join(envPath, 'python.exe') : path.join(envPath, 'bin', 'python');
          const name = path.basename(envPath);
          return {
            path: pythonPath,
            name: name === 'anaconda3' || name === 'miniconda3' ? 'base' : name,
            source: 'conda'
          };
        });
      }
    } catch (e) {
      logger.error('Failed to list conda envs:', e.message);
    }
    return [];
  }

  async scanAll() {
    const candidates = new Map();

    // 1. Current system path
    try {
      if (process.platform === 'win32') {
        const output = execSync('where.exe python.exe', { encoding: 'utf8', windowsHide: true });
        output.split('\r\n').forEach(p => {
          const trimmed = p.trim();
          if (trimmed && fs.existsSync(trimmed)) {
            candidates.set(trimmed, { path: trimmed, name: 'System', source: 'system' });
          }
        });
      } else {
        const output = execSync('which python3', { encoding: 'utf8', windowsHide: true });
        const trimmed = output.trim();
        if (trimmed && fs.existsSync(trimmed)) {
          candidates.set(trimmed, { path: trimmed, name: 'System', source: 'system' });
        }
      }
    } catch (e) { }

    // 2. Conda environments (via command)
    const condaEnvs = await this.listCondaEnvs();
    condaEnvs.forEach(env => {
      if (fs.existsSync(env.path)) {
        candidates.set(env.path, env);
      }
    });

    // 2.1 Conda environments (direct FS fallback)
    const roots = [
      path.join(process.env.USERPROFILE || '', 'miniconda3'),
      path.join(process.env.USERPROFILE || '', 'anaconda3'),
      'C:\\ProgramData\\miniconda3',
      'C:\\ProgramData\\anaconda3',
      'D:\\miniconda3',
      'D:\\anaconda3'
    ];
    for (const root of roots) {
      const envsDir = path.join(root, 'envs');
      if (fs.existsSync(envsDir)) {
        try {
          const envs = fs.readdirSync(envsDir);
          for (const envName of envs) {
            const envPath = path.join(envsDir, envName);
            const isWindows = process.platform === 'win32';
            const pythonPath = isWindows ? path.join(envPath, 'python.exe') : path.join(envPath, 'bin', 'python');
            if (fs.existsSync(pythonPath) && !candidates.has(pythonPath)) {
              candidates.set(pythonPath, { path: pythonPath, name: envName, source: 'conda' });
            }
          }
        } catch (e) { }
      }
    }

    // 3. Project venv
    const projectVenv = process.platform === 'win32'
      ? path.join(process.cwd(), 'venv', 'Scripts', 'python.exe')
      : path.join(process.cwd(), 'venv', 'bin', 'python');
    if (fs.existsSync(projectVenv)) {
      candidates.set(projectVenv, { path: projectVenv, name: 'Project Venv', source: 'venv' });
    }

    // 4. Default fixed paths
    defaultConfig.python.defaultPaths.forEach(p => {
      if (fs.existsSync(p)) {
        candidates.set(p, { path: p, name: path.basename(path.dirname(p)), source: 'default' });
      }
    });

    const validationPromises = Array.from(candidates.values()).map(async (info) => {
      const validation = await this.validatePython(info.path);
      if (validation.valid) {
        return { ...info, ...validation };
      }
      return null;
    });

    const results = (await Promise.all(validationPromises)).filter(r => r !== null);
    return results;
  }

  async autoDetect() {
    const results = await this.scanAll();
    if (results.length > 0) {
      // Prioritize: user_config (handled by getBestPython) > venv > conda > system
      const prio = { 'venv': 0, 'conda': 1, 'system': 2, 'default': 3 };
      results.sort((a, b) => (prio[a.source] || 99) - (prio[b.source] || 99));
      return results[0];
    }
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
