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

  parseVersion(versionString) {
    if (!versionString) return null;
    const match = versionString.match(/(\d+)\.(\d+)\.?(\d*)/);
    if (!match) return null;
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: match[3] ? parseInt(match[3], 10) : 0,
      toString: () => versionString
    };
  }

  compareVersions(v1, v2) {
    const parsed1 = typeof v1 === 'string' ? this.parseVersion(v1) : v1;
    const parsed2 = typeof v2 === 'string' ? this.parseVersion(v2) : v2;
    
    if (!parsed1 || !parsed2) return 0;
    
    if (parsed1.major !== parsed2.major) {
      return parsed1.major > parsed2.major ? 1 : -1;
    }
    if (parsed1.minor !== parsed2.minor) {
      return parsed1.minor > parsed2.minor ? 1 : -1;
    }
    if (parsed1.patch !== parsed2.patch) {
      return parsed1.patch > parsed2.patch ? 1 : -1;
    }
    return 0;
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
      const { stdout: versionOutput } = await execAsync(versionCmd, { timeout: 5000, windowsHide: true });
      const version = versionOutput.trim();

      if (!version.toLowerCase().includes('python')) {
        return { valid: false, error: 'Not a valid Python interpreter' };
      }

      const pythonVersion = version.replace(/Python\s+/i, '');
      let hasUltralytics = false;
      let hasTorch = false;
      let cudaAvailable = false;
      let torchVersion = null;
      let ultralyticsVersion = null;
      let cudaVersion = null;

      try {
        const checkCmd = `"${pythonPath}" -c "import ultralytics; import torch; print('OK'); print(torch.__version__); print('CUDA' if torch.cuda.is_available() else 'CPU'); print(ultralytics.__version__); print(torch.version.cuda if torch.cuda.is_available() and hasattr(torch.version, 'cuda') else 'N/A')"`;
        const { stdout: checkOutput } = await execAsync(checkCmd, { timeout: 10000, windowsHide: true });
        const lines = checkOutput.trim().split('\n');

        const okIndex = lines.findIndex(l => l.trim() === 'OK');
        if (okIndex !== -1 && lines.length > okIndex + 4) {
          hasUltralytics = true;
          torchVersion = lines[okIndex + 1].trim();
          hasTorch = torchVersion.startsWith('2.') || torchVersion.startsWith('1.');
          cudaAvailable = lines[okIndex + 2].trim() === 'CUDA';
          ultralyticsVersion = lines[okIndex + 3].trim();
          const cudaVerStr = lines[okIndex + 4].trim();
          cudaVersion = cudaVerStr !== 'N/A' ? cudaVerStr : null;
        }
      } catch (e) {
        logger.debug(`Python validation: optional packages check failed for ${pythonPath}: ${e.message}`);
      }

      return {
        valid: true,
        version: version,
        pythonVersion: pythonVersion,
        hasUltralytics,
        hasTorch,
        torchVersion,
        ultralyticsVersion,
        cudaAvailable,
        cudaVersion,
        message: hasUltralytics
          ? `Python ${pythonVersion}, PyTorch ${torchVersion}, CUDA: ${cudaAvailable ? 'Yes' : 'No'}`
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

    try {
      execSync('conda --version', { stdio: 'ignore', windowsHide: true });
      return 'conda';
    } catch (e) { }

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

  checkCompatibility(envInfo) {
    const { versionRequirements, incompatibleVersions } = defaultConfig.python;
    
    const result = {
      compatible: true,
      status: 'compatible',
      warnings: [],
      errors: []
    };

    if (!envInfo.valid) {
      result.compatible = false;
      result.status = 'invalid';
      result.errors.push('环境无效或无法验证');
      return result;
    }

    const pythonVer = envInfo.pythonVersion || this.extractPythonVersion(envInfo.version);
    if (pythonVer) {
      const req = versionRequirements.python;
      const parsedPython = this.parseVersion(pythonVer);
      
      if (req.min && this.compareVersions(parsedPython, req.min) < 0) {
        result.compatible = false;
        result.status = 'incompatible';
        result.errors.push(`Python 版本过低: ${pythonVer}，最低要求 ${req.min}`);
      }
      
      if (req.max && this.compareVersions(parsedPython, req.max) > 0) {
        result.warnings.push(`Python 版本 ${pythonVer} 高于推荐的最大版本 ${req.max}，可能存在兼容性问题`);
      }

      if (incompatibleVersions.python && incompatibleVersions.python.includes(pythonVer)) {
        result.compatible = false;
        result.status = 'incompatible';
        result.errors.push(`Python 版本 ${pythonVer} 已知不兼容`);
      }
    }

    if (envInfo.hasTorch && envInfo.torchVersion) {
      const req = versionRequirements.pytorch;
      const parsedTorch = this.parseVersion(envInfo.torchVersion);
      
      if (req.min && this.compareVersions(parsedTorch, req.min) < 0) {
        result.compatible = false;
        result.status = 'incompatible';
        result.errors.push(`PyTorch 版本过低: ${envInfo.torchVersion}，最低要求 ${req.min}`);
      }

      if (incompatibleVersions.pytorch && incompatibleVersions.pytorch.includes(envInfo.torchVersion)) {
        result.warnings.push(`PyTorch 版本 ${envInfo.torchVersion} 已知存在问题，建议升级`);
      }
    } else if (envInfo.valid) {
      result.warnings.push('未检测到 PyTorch，训练功能将不可用');
    }

    if (envInfo.hasUltralytics && envInfo.ultralyticsVersion) {
      const req = versionRequirements.ultralytics;
      const parsedUltralytics = this.parseVersion(envInfo.ultralyticsVersion);
      
      if (req.min && this.compareVersions(parsedUltralytics, req.min) < 0) {
        result.warnings.push(`Ultralytics 版本过低: ${envInfo.ultralyticsVersion}，推荐 ${req.recommended || req.min}`);
      }
    } else if (envInfo.valid) {
      result.warnings.push('未检测到 Ultralytics，请运行: pip install ultralytics');
    }

    if (!envInfo.cudaAvailable && envInfo.hasTorch) {
      result.warnings.push('CUDA 不可用，训练将使用 CPU，速度较慢');
    }

    if (result.errors.length > 0) {
      result.status = 'incompatible';
      result.compatible = false;
    } else if (result.warnings.length > 0) {
      result.status = 'warning';
    }

    return result;
  }

  extractPythonVersion(versionString) {
    if (!versionString) return null;
    const match = versionString.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  }

  getCompatibilityMatrix() {
    return defaultConfig.python.compatibilityMatrix;
  }

  getRecommendedVersions(cudaVersion = null) {
    const { compatibilityMatrix } = defaultConfig.python;
    
    if (!cudaVersion) {
      return {
        ...compatibilityMatrix.cpu,
        key: 'cpu',
        description: 'CPU 版本（无 GPU 加速）'
      };
    }

    const cudaVer = cudaVersion.toString();
    
    if (cudaVer.startsWith('12.4') || cudaVer.startsWith('124')) {
      return {
        ...compatibilityMatrix.cuda124,
        key: 'cuda124',
        description: 'CUDA 12.4 配置'
      };
    }
    
    if (cudaVer.startsWith('12.1') || cudaVer.startsWith('121') || cudaVer.startsWith('12.0')) {
      return {
        ...compatibilityMatrix.cuda121,
        key: 'cuda121',
        description: 'CUDA 12.1 配置'
      };
    }
    
    if (cudaVer.startsWith('11.8') || cudaVer.startsWith('118') || cudaVer.startsWith('11.')) {
      return {
        ...compatibilityMatrix.cuda118,
        key: 'cuda118',
        description: 'CUDA 11.8 配置'
      };
    }

    return {
      ...compatibilityMatrix.cuda121,
      key: 'cuda121',
      description: 'CUDA 12.1 配置（默认推荐）'
    };
  }

  async scanAll() {
    const candidates = new Map();

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

    const condaEnvs = await this.listCondaEnvs();
    condaEnvs.forEach(env => {
      if (fs.existsSync(env.path)) {
        candidates.set(env.path, env);
      }
    });

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

    const projectVenv = process.platform === 'win32'
      ? path.join(process.cwd(), 'venv', 'Scripts', 'python.exe')
      : path.join(process.cwd(), 'venv', 'bin', 'python');
    if (fs.existsSync(projectVenv)) {
      candidates.set(projectVenv, { path: projectVenv, name: 'Project Venv', source: 'venv' });
    }

    defaultConfig.python.defaultPaths.forEach(p => {
      if (fs.existsSync(p)) {
        candidates.set(p, { path: p, name: path.basename(path.dirname(p)), source: 'default' });
      }
    });

    const validationPromises = Array.from(candidates.values()).map(async (info) => {
      const validation = await this.validatePython(info.path);
      if (validation.valid) {
        const envInfo = { ...info, ...validation };
        const compatibility = this.checkCompatibility(envInfo);
        return {
          ...envInfo,
          compatibility: compatibility.status,
          compatibilityDetails: compatibility
        };
      }
      return null;
    });

    const results = (await Promise.all(validationPromises)).filter(r => r !== null);
    return results;
  }

  async autoDetect() {
    const results = await this.scanAll();
    if (results.length > 0) {
      const prio = { 'venv': 0, 'conda': 1, 'system': 2, 'default': 3 };
      const compatibleResults = results.filter(r => r.compatibility !== 'incompatible');
      if (compatibleResults.length > 0) {
        compatibleResults.sort((a, b) => (prio[a.source] || 99) - (prio[b.source] || 99));
        return compatibleResults[0];
      }
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
        const compatibility = this.checkCompatibility(result);
        return { 
          path: userPath, 
          ...result,
          compatibility: compatibility.status,
          compatibilityDetails: compatibility
        };
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
        pythonVersion: best.pythonVersion,
        ultralytics: best.hasUltralytics,
        ultralyticsVersion: best.ultralyticsVersion,
        torch: best.hasTorch,
        torchVersion: best.torchVersion,
        cuda: best.cudaAvailable,
        cudaVersion: best.cudaVersion,
        compatibility: best.compatibility,
        compatibilityDetails: best.compatibilityDetails,
        message: best.message
      };
    }
    return {
      available: false,
      message: 'No valid Python environment found. Please configure Python path in settings.'
    };
  }

  getEnvCreationStatus() {
    return this._creationStatus || {
      isCreating: false,
      progress: 0,
      stage: 'idle',
      message: ''
    };
  }

  async detectCuda() {
    try {
      const cudaVersion = await this.detectCudaVersion();
      if (cudaVersion) {
        return {
          available: true,
          version: cudaVersion,
          message: `检测到 CUDA ${cudaVersion}`
        };
      }
    } catch (e) {
      logger.debug('CUDA detection failed:', e.message);
    }
    
    return {
      available: false,
      message: '未检测到 NVIDIA GPU 或驱动未安装'
    };
  }

  async createEnv({ name, pythonVersion = '3.10', cudaVersion = 'auto' }) {
    const sanitizedName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    
    if (!sanitizedName) {
      return { success: false, error: '环境名称无效' };
    }

    let actualCudaVersion = cudaVersion;
    if (cudaVersion === 'auto') {
      const cudaInfo = await this.detectCuda();
      if (cudaInfo.available && cudaInfo.version) {
        actualCudaVersion = cudaInfo.version;
      } else {
        actualCudaVersion = 'cpu';
      }
    }

    return await this.createEnvironment({
      name: sanitizedName,
      pythonVersion,
      cudaVersion: actualCudaVersion
    });
  }

  async detectCudaVersion() {
    try {
      const { stdout: nvidiaSmi } = await execAsync('nvidia-smi --query-gpu=driver_version,cuda_version --format=csv,noheader', { 
        timeout: 5000, 
        windowsHide: true 
      }).catch(() => ({ stdout: '' }));
      
      if (nvidiaSmi) {
        const lines = nvidiaSmi.trim().split('\n');
        if (lines.length > 0) {
          const parts = lines[0].split(',');
          if (parts.length >= 2) {
            const cudaVer = parts[1].trim();
            if (cudaVer && cudaVer !== 'N/A') {
              return cudaVer;
            }
          }
        }
      }
      
      const { stdout: nvccOutput } = await execAsync('nvcc --version', { 
        timeout: 5000, 
        windowsHide: true 
      }).catch(() => ({ stdout: '' }));
      
      if (nvccOutput) {
        const match = nvccOutput.match(/release\s+(\d+\.\d+)/i);
        if (match) {
          return match[1];
        }
      }
      
      return null;
    } catch (error) {
      logger.debug('CUDA detection failed:', error.message);
      return null;
    }
  }

  async createEnvironment({ name, pythonVersion, cudaVersion, onProgress }) {
    let condaExec = this.searchCondaExecutable();
    
    if (!condaExec) {
      return {
        success: false,
        error: '未找到 Conda，请先安装 Miniconda 或 Anaconda'
      };
    }

    if (condaExec === 'conda') {
      const roots = [
        path.join(process.env.USERPROFILE || '', 'miniconda3'),
        path.join(process.env.USERPROFILE || '', 'anaconda3'),
        'C:\\ProgramData\\miniconda3',
        'C:\\ProgramData\\anaconda3',
        'D:\\miniconda3',
        'D:\\anaconda3'
      ];
      const subPaths = [
        path.join('Scripts', 'conda.exe'),
        path.join('condabin', 'conda.bat'),
        path.join('condabin', 'conda.exe')
      ];
      for (const root of roots) {
        for (const sub of subPaths) {
          const fullPath = path.join(root, sub);
          if (fs.existsSync(fullPath)) {
            condaExec = fullPath;
            break;
          }
        }
        if (condaExec !== 'conda') break;
      }
    }

    logger.info(`Using conda executable: ${condaExec}`);

    this._creationStatus = {
      isCreating: true,
      progress: 0,
      stage: 'preparing',
      message: '准备创建环境...'
    };

    try {
      onProgress && onProgress(this._creationStatus);

      this._creationStatus = {
        ...this._creationStatus,
        progress: 10,
        stage: 'creating',
        message: `正在创建 Conda 环境: ${name}`
      };
      onProgress && onProgress(this._creationStatus);

      const isWindows = process.platform === 'win32';
      const isBatFile = condaExec.endsWith('.bat');
      
      let createCmd;
      if (isWindows && isBatFile) {
        createCmd = `cmd.exe /c "${condaExec}" create -n "${name}" python=${pythonVersion || '3.10'} -y`;
      } else {
        createCmd = `"${condaExec}" create -n "${name}" python=${pythonVersion || '3.10'} -y`;
      }
      
      logger.info(`Executing: ${createCmd}`);
      
      await execAsync(createCmd, {
        timeout: 300000,
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      this._creationStatus = {
        ...this._creationStatus,
        progress: 40,
        stage: 'installing_pytorch',
        message: '正在安装 PyTorch...'
      };
      onProgress && onProgress(this._creationStatus);

      let condaRoot = path.dirname(path.dirname(condaExec));
      if (condaExec.includes('condabin')) {
        condaRoot = path.dirname(path.dirname(path.dirname(condaExec)));
      }
      
      let envPath = path.join(condaRoot, 'envs', name);
      if (!fs.existsSync(envPath)) {
        const altRoots = [
          path.join(process.env.USERPROFILE || '', 'miniconda3'),
          path.join(process.env.USERPROFILE || '', 'anaconda3'),
          'D:\\miniconda3',
          'D:\\anaconda3'
        ];
        for (const altRoot of altRoots) {
          const altEnvPath = path.join(altRoot, 'envs', name);
          if (fs.existsSync(altEnvPath)) {
            envPath = altEnvPath;
            break;
          }
        }
      }
      
      logger.info(`Environment path: ${envPath}`);
      
      const pipPath = isWindows 
        ? path.join(envPath, 'Scripts', 'pip.exe')
        : path.join(envPath, 'bin', 'pip');

      if (!fs.existsSync(pipPath)) {
        throw new Error(`pip not found at ${pipPath}. Environment creation may have failed.`);
      }

      let pytorchCmd;
      if (cudaVersion && cudaVersion !== 'cpu') {
        if (cudaVersion.startsWith('12.')) {
          pytorchCmd = `"${pipPath}" install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121`;
        } else if (cudaVersion.startsWith('11.8')) {
          pytorchCmd = `"${pipPath}" install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118`;
        } else {
          pytorchCmd = `"${pipPath}" install torch torchvision torchaudio`;
        }
      } else {
        pytorchCmd = `"${pipPath}" install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu`;
      }

      logger.info(`Executing: ${pytorchCmd}`);
      
      await execAsync(pytorchCmd, {
        timeout: 600000,
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      this._creationStatus = {
        ...this._creationStatus,
        progress: 80,
        stage: 'installing_ultralytics',
        message: '正在安装 Ultralytics...'
      };
      onProgress && onProgress(this._creationStatus);

      const ultralyticsCmd = `"${pipPath}" install ultralytics`;
      logger.info(`Executing: ${ultralyticsCmd}`);
      
      await execAsync(ultralyticsCmd, {
        timeout: 300000,
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      this._creationStatus = {
        isCreating: false,
        progress: 100,
        stage: 'completed',
        message: '环境创建完成'
      };
      onProgress && onProgress(this._creationStatus);

      const pythonPath = isWindows 
        ? path.join(envPath, 'python.exe')
        : path.join(envPath, 'bin', 'python');

      return {
        success: true,
        envName: name,
        pythonPath: pythonPath,
        message: '环境创建成功'
      };
    } catch (error) {
      this._creationStatus = {
        isCreating: false,
        progress: 0,
        stage: 'error',
        message: error.message
      };
      onProgress && onProgress(this._creationStatus);

      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new PythonEnvService();
