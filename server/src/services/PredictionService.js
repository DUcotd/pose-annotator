const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const ProcessManager = require('../managers/ProcessManager');
const PythonEnvService = require('./PythonEnvService');
const settings = require('../config/settings');

const JSON_LOG_PREFIX = '__JSON_LOG__';
const MAX_LOG_LENGTH = 1000;

class PredictionService {
  static ERROR_MAPPINGS = {
    model_not_found: {
      keywords: ['model not found', 'No such file', 'FileNotFoundError', 'model file'],
      type: 'model_not_found',
      title: '模型文件未找到',
      icon: '📁',
      suggestions: [
        '检查模型路径是否正确',
        '确认模型文件是否存在',
        '验证模型文件格式是否正确（.pt 文件）'
      ]
    },
    image_error: {
      keywords: ['image', 'Image', 'cannot identify image', 'corrupt', 'invalid image'],
      type: 'image_error',
      title: '图片处理错误',
      icon: '🖼️',
      suggestions: [
        '检查图片文件是否损坏',
        '确认图片格式是否支持',
        '尝试重新导入图片'
      ]
    },
    cuda_error: {
      keywords: ['cuda', 'CUDA', 'out of memory', 'OOM'],
      type: 'cuda_error',
      title: 'CUDA/显存错误',
      icon: '🖥️',
      suggestions: [
        '减小 batch_size 参数',
        '尝试使用 CPU 模式',
        '关闭其他占用显存的程序'
      ]
    },
    python_env: {
      keywords: ['ModuleNotFoundError', 'ImportError', 'No module named'],
      type: 'python_env',
      title: 'Python 环境错误',
      icon: '🐍',
      suggestions: [
        '检查 Python 环境是否正确配置',
        '确认 ultralytics 已安装: pip install ultralytics',
        '验证 PyTorch 安装正确'
      ]
    }
  };

  constructor() {
    this.processes = ProcessManager;
    this.predictionStates = new Map();
    this.pendingSaves = new Map();
    this.isShuttingDown = false;
    this.setupProcessCleanup();
  }

  setupProcessCleanup() {
    if (typeof process !== 'undefined') {
      process.on('exit', () => {
        this.killAllProcesses();
      });

      process.on('SIGINT', () => {
        this.gracefulShutdown('SIGINT');
      });

      process.on('SIGTERM', () => {
        this.gracefulShutdown('SIGTERM');
      });
    }
  }

  killProcess(pid, force = false) {
    if (!pid) return false;

    const isWindows = process.platform === 'win32';

    try {
      if (isWindows) {
        const { execSync } = require('child_process');
        const signal = force ? '/F' : '';
        execSync(`taskkill ${signal} /PID ${pid} /T`, { stdio: 'ignore' });
        logger.debug(`Killed process ${pid} via taskkill (force: ${force})`);
      } else {
        process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
        logger.debug(`Killed process ${pid} via signal ${force ? 'SIGKILL' : 'SIGTERM'}`);
      }
      return true;
    } catch (e) {
      if (e.code === 'ESRCH') {
        return true;
      }
      logger.debug(`Failed to kill process ${pid}: ${e.message}`);
      return false;
    }
  }

  async isProcessRunning(pid) {
    if (!pid) return false;

    const isWindows = process.platform === 'win32';

    try {
      if (isWindows) {
        const { execSync } = require('child_process');
        execSync(`tasklist /FI "PID eq ${pid}"`, { stdio: 'ignore' });
        return true;
      } else {
        process.kill(pid, 0);
        return true;
      }
    } catch (e) {
      return false;
    }
  }

  killAllProcesses() {
    const runningProcesses = this.processes.getRunning();
    runningProcesses.forEach(proc => {
      if (proc.pid) {
        this.killProcess(proc.pid, true);
        logger.info(`Killed prediction process ${proc.pid} for project ${proc.projectId}`);
      }
    });
  }

  async gracefulShutdown(signal) {
    this.isShuttingDown = true;
    const runningProcesses = this.processes.getRunning();

    for (const proc of runningProcesses) {
      if (proc.pid) {
        try {
          this.killProcess(proc.pid, false);
          const exited = await this.waitForProcessExit(proc.pid, 5000);
          if (!exited) {
            this.killProcess(proc.pid, true);
          }
          logger.info(`Terminated prediction process ${proc.pid} for project ${proc.projectId}`);
        } catch (e) {
          logger.debug(`Error terminating process ${proc.pid}: ${e.message}`);
        }
      }
    }

    process.exit(0);
  }

  async waitForProcessExit(pid, timeoutMs) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const running = await this.isProcessRunning(pid);
      if (!running) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
  }

  async getPythonCommand() {
    const env = await PythonEnvService.getBestPython();
    if (!env) {
      throw new Error('未找到可用 Python 环境，请先在设置中配置 Python 路径');
    }

    if (env.compatibility === 'incompatible') {
      const reason = env?.compatibilityDetails?.errors?.[0] || '当前 Python 环境与模型推理要求不兼容';
      throw new Error(`Python 环境不兼容: ${reason}`);
    }

    const missingDeps = [];
    if (env.hasUltralytics === false) missingDeps.push('ultralytics');
    if (env.hasTorch === false) missingDeps.push('torch');
    if (missingDeps.length > 0) {
      throw new Error(
        `当前 Python 环境缺少依赖: ${missingDeps.join(', ')}。请在设置页切换环境，或执行: pip install ${missingDeps.join(' ')}`
      );
    }

    return { cmd: env.path, info: env };
  }

  buildArgs(options) {
    const args = [
      path.join(__dirname, '..', '..', '..', 'scripts', 'predict.py'),
      '--model', options.modelPath,
      '--conf', String(options.confidenceThreshold || 0.25),
    ];

    if (options.device) {
      args.push('--device', options.device);
    }

    if (options.imgsz) {
      args.push('--imgsz', String(options.imgsz));
    }

    if (options.mode) {
      args.push('--mode', options.mode);
    }

    return args;
  }

  cleanString(str, preserveNewlines = false) {
    if (typeof str !== 'string') return str;

    let cleaned = str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');

    return preserveNewlines ? cleaned : cleaned.trim();
  }

  classifyError(errorMsg) {
    const lower = errorMsg.toLowerCase();

    for (const [key, mapping] of Object.entries(PredictionService.ERROR_MAPPINGS)) {
      for (const keyword of mapping.keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          return {
            type: mapping.type,
            title: mapping.title,
            icon: mapping.icon,
            suggestions: mapping.suggestions,
            rawError: errorMsg.substring(0, 500)
          };
        }
      }
    }

    return {
      type: 'unknown',
      title: '预标注错误',
      icon: '❌',
      suggestions: [
        '请检查模型和图片是否正确',
        '查看下方原始错误信息'
      ],
      rawError: errorMsg.substring(0, 500)
    };
  }

  toFiniteCount(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.floor(n);
  }

  buildFinalStats(state, { exitCode = 0 } = {}) {
    const totalImages = this.toFiniteCount(state?.totalImages, 0);
    let successCount = this.toFiniteCount(state?.processedImages, 0);
    let failedCount = Math.max(0, totalImages - successCount);

    const reportedSuccess = this.toFiniteCount(state?.reportedSuccess, null);
    const reportedFailed = this.toFiniteCount(state?.reportedFailed, null);

    if (reportedSuccess !== null) {
      successCount = reportedSuccess;
    }

    if (reportedFailed !== null) {
      failedCount = reportedFailed;
    } else if (totalImages > 0) {
      failedCount = Math.max(0, totalImages - successCount);
    }

    if (totalImages > 0) {
      successCount = Math.min(successCount, totalImages);
      failedCount = Math.min(Math.max(0, failedCount), totalImages);

      if (successCount + failedCount > totalImages) {
        if (reportedSuccess !== null) {
          failedCount = Math.max(0, totalImages - successCount);
        } else {
          successCount = Math.max(0, totalImages - failedCount);
        }
      } else if (successCount + failedCount < totalImages) {
        failedCount = totalImages - successCount;
      }
    }

    if (exitCode !== 0 && totalImages > 0 && failedCount === 0) {
      failedCount = Math.max(1, totalImages - successCount);
    }

    const processedImages = totalImages > 0
      ? Math.min(totalImages, Math.max(this.toFiniteCount(state?.processedImages, 0), successCount + failedCount))
      : this.toFiniteCount(state?.processedImages, 0);

    return {
      processedImages,
      totalImages,
      successCount,
      failedCount
    };
  }

  extractFinalErrorMessage(processState) {
    if (!processState) return '';
    const errorLogs = Array.isArray(processState.errorLogs) ? processState.errorLogs : [];
    if (errorLogs.length > 0) {
      const last = this.cleanString(String(errorLogs[errorLogs.length - 1] || ''));
      if (last) return last.substring(0, 500);
    }

    const logs = Array.isArray(processState.logs) ? processState.logs : [];
    for (let i = logs.length - 1; i >= 0; i--) {
      const entry = logs[i];
      const type = entry?.type;
      if (type !== 'error' && type !== 'stderr') continue;
      const msg = this.cleanString(String(entry?.msg || ''));
      if (msg) return msg.substring(0, 500);
    }

    return '';
  }

  async validateModel(modelPath) {
    if (!modelPath) {
      return { valid: false, error: '模型路径不能为空' };
    }

    if (!fs.existsSync(modelPath)) {
      return { valid: false, error: '模型文件不存在' };
    }

    const ext = path.extname(modelPath).toLowerCase();
    if (ext !== '.pt' && ext !== '.pth' && ext !== '.onnx') {
      return { valid: false, error: '不支持的模型格式，请使用 .pt, .pth 或 .onnx 文件' };
    }

    try {
      const stats = fs.statSync(modelPath);
      const sizeMB = stats.size / (1024 * 1024);

      if (sizeMB < 1) {
        return { valid: false, error: '模型文件过小，可能已损坏' };
      }

      return {
        valid: true,
        path: modelPath,
        size: sizeMB.toFixed(2) + ' MB',
        format: ext
      };
    } catch (e) {
      return { valid: false, error: `无法读取模型文件: ${e.message}` };
    }
  }

  convertToInternalFormat(predictions, imageWidth, imageHeight) {
    const annotations = [];

    if (!predictions || !Array.isArray(predictions)) {
      return annotations;
    }

    for (const pred of predictions) {
      if (pred.boxes && Array.isArray(pred.boxes)) {
        for (const box of pred.boxes) {
          const x = (box.x + box.width / 2) / imageWidth;
          const y = (box.y + box.height / 2) / imageHeight;
          const width = box.width / imageWidth;
          const height = box.height / imageHeight;

          annotations.push({
            type: 'bbox',
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y)),
            width: Math.max(0, Math.min(1, width)),
            height: Math.max(0, Math.min(1, height)),
            label: box.label || box.class || 'object',
            confidence: box.confidence || box.conf || 0
          });
        }
      }

      if (pred.keypoints && Array.isArray(pred.keypoints)) {
        for (const kp of pred.keypoints) {
          annotations.push({
            type: 'keypoint',
            x: Math.max(0, Math.min(1, kp.x / imageWidth)),
            y: Math.max(0, Math.min(1, kp.y / imageHeight)),
            label: kp.name || kp.label || `keypoint_${annotations.filter(a => a.type === 'keypoint').length}`,
            visibility: kp.visibility !== undefined ? kp.visibility : (kp.visible ? 2 : 0)
          });
        }
      }

      if (pred.bbox && !pred.boxes) {
        const box = pred.bbox;
        const x = (box.x + box.width / 2) / imageWidth;
        const y = (box.y + box.height / 2) / imageHeight;
        const width = box.width / imageWidth;
        const height = box.height / imageHeight;

        annotations.push({
          type: 'bbox',
          x: Math.max(0, Math.min(1, x)),
          y: Math.max(0, Math.min(1, y)),
          width: Math.max(0, Math.min(1, width)),
          height: Math.max(0, Math.min(1, height)),
          label: pred.label || pred.class || 'object',
          confidence: pred.confidence || pred.conf || 0
        });
      }
    }

    return annotations;
  }

  convertPredictionsToAnnotations(predictions) {
    const annotations = [];

    if (!predictions || !Array.isArray(predictions)) {
      return annotations;
    }

    for (const pred of predictions) {
      if (pred.bbox) {
        const box = pred.bbox;
        annotations.push({
          id: Date.now() + Math.random(),
          type: 'bbox',
          x: Math.max(0, box.x),
          y: Math.max(0, box.y),
          width: Math.max(0, box.width),
          height: Math.max(0, box.height),
          label: '',
          classIndex: box.class_id || 0
        });
      }

      if (pred.keypoints && Array.isArray(pred.keypoints)) {
        const bboxId = annotations.length > 0 ? annotations[annotations.length - 1].id : null;
        for (const kp of pred.keypoints) {
          annotations.push({
            id: Date.now() + Math.random(),
            type: 'keypoint',
            x: Math.max(0, kp.x),
            y: Math.max(0, kp.y),
            label: 'Keypoint',
            keypointIndex: kp.id !== undefined ? kp.id : annotations.filter(a => a.type === 'keypoint').length,
            parentId: bboxId
          });
        }
      }
    }

    return annotations;
  }

  async saveAnnotations(projectId, imageId, annotations, projectsDir) {
    const PathService = require('./PathService');
    const paths = PathService.getProjectPaths(projectId, projectsDir);

    const annotationPath = path.join(paths.annotations, `${imageId}.json`);

    try {
      await fs.promises.mkdir(paths.annotations, { recursive: true });
      await fs.promises.writeFile(annotationPath, JSON.stringify(annotations, null, 2));
      logger.info(`[Prediction] Saved ${annotations.length} annotations to ${annotationPath}`);
      return { success: true, path: annotationPath };
    } catch (e) {
      logger.error(`Failed to save annotations for ${imageId}:`, e);
      return { success: false, error: e.message };
    }
  }

  async executePrediction(projectId, options) {
    const existing = this.processes.get(projectId);
    if (existing && existing.status === 'running') {
      throw new Error('预标注任务正在进行中');
    }

    const { modelPath, images, confidenceThreshold, mode, projectsDir, waitForCompletion = true } = options;

    const modelValidation = await this.validateModel(modelPath);
    if (!modelValidation.valid) {
      throw new Error(modelValidation.error);
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      throw new Error('图片列表不能为空');
    }

    // 获取项目的实际存储路径
    const PathService = require('./PathService');
    const projectRoot = PathService.findProjectRoot(projectId, projectsDir);
    // 使用项目根目录的父目录作为 projectsDir，这样 Python 脚本可以正确构建路径
    const actualProjectsDir = path.dirname(projectRoot);

    logger.debug(`[Prediction] Project ${projectId} root: ${projectRoot}`);
    logger.debug(`[Prediction] Using projectsDir: ${actualProjectsDir}`);

    const { cmd: pythonCmd } = await this.getPythonCommand();
    const args = this.buildArgs(options);

    logger.info(`Starting prediction for project ${projectId}: ${pythonCmd} ${args.join(' ')}`);

    const processState = this.processes.create(projectId, null);
    this.processes.setStatus(projectId, 'starting');
    this.processes.setErrorLogs(projectId, []);

    this.predictionStates.set(projectId, {
      totalImages: images.length,
      processedImages: 0,
      failedImages: 0,
      reportedSuccess: null,
      reportedFailed: null,
      activeIndex: -1,
      currentImage: null,
      results: [],
      startTime: Date.now()
    });
    this.pendingSaves.set(projectId, new Set());

    const child = spawn(pythonCmd, args, {
      windowsHide: true,
      env: {
        ...process.env,
        KMP_DUPLICATE_LIB_OK: 'TRUE',
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        PREDICTION_IMAGES: JSON.stringify(images),
        PREDICTION_PROJECT_ID: projectId,
        PREDICTION_PROJECTS_DIR: actualProjectsDir
      }
    });

    this.processes.setPid(projectId, child.pid);
    this.processes.setStatus(projectId, 'running');

    this.processes.addLog(projectId, {
      type: 'system',
      msg: `预标注进程已启动，PID: ${child.pid}，共 ${images.length} 张图片`,
      time: Date.now()
    });

    // 记录启动命令和参数用于调试
    logger.debug(`[Prediction] Command: ${pythonCmd} ${args.join(' ')}`);
    logger.debug(`[Prediction] Images count: ${images.length}, first image: ${images[0] || 'N/A'}`);
    logger.debug(`[Prediction] PREDICTION_IMAGES env: ${JSON.stringify(images).substring(0, 200)}...`);

    let jsonBuffer = '';

    child.stdout.on('data', (data) => {
      const chunk = this.cleanString(data.toString(), true);
      jsonBuffer += chunk;

      const lines = jsonBuffer.split('\n');
      jsonBuffer = lines.pop();

      lines.forEach(line => {
        if (!line.trim()) return;

        if (line.startsWith(JSON_LOG_PREFIX)) {
          try {
            const jsonStr = line.slice(JSON_LOG_PREFIX.length);
            const jsonData = JSON.parse(jsonStr);
            logger.debug(`[Prediction] Parsed JSON event: ${jsonData.event}`);
            this.handlePredictionProgress(projectId, jsonData, projectsDir);
          } catch (e) {
            logger.warn(`Failed to parse JSON log: ${e.message}, line: ${line.substring(0, 100)}`);
          }
        } else {
          const trimmed = line.trim();
          if (trimmed) {
            this.processes.addLog(projectId, {
              type: 'stdout',
              msg: trimmed,
              time: Date.now()
            });
          }
        }
      });
    });

    let stderrBuffer = '';
    let isCapturingTraceback = false;

    child.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      const lines = stderrBuffer.split('\n');

      if (stderrBuffer.endsWith('\n')) {
        stderrBuffer = '';
      } else {
        stderrBuffer = lines.pop();
      }

      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed && !isCapturingTraceback) return;

        if (line.includes('Traceback (most recent call last):')) {
          isCapturingTraceback = true;
          this.processes.addLog(projectId, {
            type: 'stderr',
            msg: '🔴 ' + line,
            time: Date.now()
          });
          this.processes.addErrorLog(projectId, line);
          return;
        }

        if (isCapturingTraceback) {
          this.processes.addLog(projectId, {
            type: 'stderr',
            msg: '  ' + line,
            time: Date.now()
          });
          this.processes.addErrorLog(projectId, line);

          if (!line.startsWith(' ') && !line.startsWith('\t') && line.includes(':')) {
            isCapturingTraceback = false;
            const classified = this.classifyError(line);
            if (classified.type !== 'unknown') {
              this.processes.addLog(projectId, {
                type: 'error',
                msg: `${classified.icon} ${classified.title}: ${classified.rawError}`,
                errorType: classified.type,
                time: Date.now()
              });
            }
          }
          return;
        }

        const cleanedLine = this.cleanString(trimmed);
        if (cleanedLine) {
          this.processes.addLog(projectId, {
            type: 'stderr',
            msg: cleanedLine,
            time: Date.now()
          });
          this.processes.addErrorLog(projectId, cleanedLine);
        }
      });
    });

    const completionPromise = new Promise((resolve, reject) => {
      child.on('close', async (code) => {
        // 等待一小段时间确保所有输出都被捕获
        await new Promise(resolve => setTimeout(resolve, 100));

        // 处理剩余的 stdout buffer
        const leftover = (jsonBuffer || '').trim();
        if (leftover && leftover.startsWith(JSON_LOG_PREFIX)) {
          try {
            const jsonStr = leftover.slice(JSON_LOG_PREFIX.length);
            const jsonData = JSON.parse(jsonStr);
            logger.debug(`[Prediction] Parsed JSON event (flush): ${jsonData.event}`);
            this.handlePredictionProgress(projectId, jsonData, projectsDir);
          } catch (e) {
            logger.warn(`Failed to parse flushed JSON log: ${e.message}, line: ${leftover.substring(0, 100)}`);
          }
        }

        // 处理剩余的 stderr buffer
        if (stderrBuffer && stderrBuffer.trim()) {
          const remainingLines = stderrBuffer.split('\n');
          remainingLines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed) {
              // 检查是否是错误信息
              if (trimmed.includes('ERROR:') || trimmed.includes('TRACEBACK:') || trimmed.toLowerCase().includes('error')) {
                this.processes.addLog(projectId, {
                  type: 'stderr',
                  msg: '🔴 ' + trimmed,
                  time: Date.now()
                });
                this.processes.addErrorLog(projectId, trimmed);
              } else if (trimmed.includes('DEBUG:')) {
                this.processes.addLog(projectId, {
                  type: 'stderr',
                  msg: '🔍 ' + trimmed,
                  time: Date.now()
                });
                this.processes.addErrorLog(projectId, trimmed);
              } else if (trimmed) {
                this.processes.addLog(projectId, {
                  type: 'stderr',
                  msg: trimmed,
                  time: Date.now()
                });
                this.processes.addErrorLog(projectId, trimmed);
              }
            }
          });
        }

        // 记录进程退出信息用于调试
        logger.debug(`[Prediction] Process ${child.pid} exited with code ${code} for project ${projectId}`);
        logger.debug(`[Prediction] Final stderrBuffer length: ${stderrBuffer ? stderrBuffer.length : 0}`);
        logger.debug(`[Prediction] Final jsonBuffer length: ${jsonBuffer ? jsonBuffer.length : 0}`);

        const pending = this.pendingSaves.get(projectId);
        if (pending && pending.size > 0) {
          await Promise.allSettled(Array.from(pending));
        }

        const state = this.predictionStates.get(projectId);
        const finalStats = this.buildFinalStats(state, { exitCode: code });
        const processState = this.processes.get(projectId);
        if (processState) {
          processState.finalStats = finalStats;
        }

        if (code === 0) {
          this.processes.setStatus(projectId, 'completed');
          if (processState) {
            processState.finalErrorMessage = '';
          }
          this.processes.addLog(projectId, {
            type: 'system',
            msg: `✅ 预标注完成！共处理 ${finalStats.processedImages} 张图片`,
            time: Date.now()
          });
          logger.info(`Prediction completed for project ${projectId}`);
          this.pendingSaves.delete(projectId);
          resolve({
            success: true,
            processedImages: finalStats.processedImages,
            totalImages: finalStats.totalImages
          });
        } else {
          this.processes.setStatus(projectId, 'failed');
          this.processes.addLog(projectId, {
            type: 'system',
            msg: `❌ 预标注失败！进程退出码: ${code}`,
            time: Date.now()
          });

          // 获取并显示详细的错误日志
          const errorLogs = this.processes.getErrorLogs(projectId) || [];
          const recentErrors = errorLogs.slice(-20);

          if (recentErrors.length > 0) {
            this.processes.addLog(projectId, {
              type: 'error',
              msg: `📋 错误详情:\n${recentErrors.join('\n')}`,
              time: Date.now()
            });

            // 尝试分类错误并给出建议
            const allErrorText = recentErrors.join('\n').toLowerCase();
            const classified = this.classifyError(allErrorText);
            if (classified.type !== 'unknown') {
              this.processes.addLog(projectId, {
                type: 'error',
                msg: `${classified.icon} ${classified.title}: ${classified.rawError}`,
                errorType: classified.type,
                time: Date.now()
              });

              if (classified.suggestions && classified.suggestions.length > 0) {
                this.processes.addLog(projectId, {
                  type: 'suggestion',
                  msg: `💡 解决建议:\n${classified.suggestions.map((s, i) => `   ${i + 1}. ${s}`).join('\n')}`,
                  time: Date.now()
                });
              }
            }

            if (processState) {
              processState.finalErrorMessage = this.cleanString(String(recentErrors[recentErrors.length - 1] || ''));
            }
          } else {
            this.processes.addLog(projectId, {
              type: 'error',
              msg: `⚠️ 未捕获到具体错误信息，请检查:\n1. 模型文件是否存在且格式正确\n2. Python环境是否配置正确（需要安装 ultralytics）\n3. 图片文件是否存在且格式支持\n4. 检查系统日志获取更多信息`,
              time: Date.now()
            });
            if (processState) {
              processState.finalErrorMessage = '未捕获到具体错误信息，请检查 Python 环境或模型配置';
            }
          }

          logger.error(`Prediction failed for project ${projectId} with code ${code}`);
          this.pendingSaves.delete(projectId);
          reject(new Error(`预标注进程异常退出，代码: ${code}`));
        }

        this.predictionStates.delete(projectId);
      });

      child.on('error', (err) => {
        logger.error(`Prediction process error for ${projectId}:`, err);
        const state = this.predictionStates.get(projectId);
        const processState = this.processes.get(projectId);
        if (processState) {
          processState.finalStats = this.buildFinalStats(state, { exitCode: 1 });
          processState.finalErrorMessage = err.message || '预标注进程启动失败';
        }
        this.processes.setStatus(projectId, 'failed');
        this.processes.addLog(projectId, {
          type: 'system',
          msg: `启动失败: ${err.message}`,
          time: Date.now()
        });
        this.predictionStates.delete(projectId);
        this.pendingSaves.delete(projectId);
        reject(err);
      });
    });

    if (!waitForCompletion) {
      completionPromise.catch((err) => {
        logger.error(`Background prediction task failed for ${projectId}:`, err);
      });
      return {
        success: true,
        message: '预标注任务已启动',
        pid: child.pid,
        totalImages: images.length
      };
    }

    return completionPromise;
  }

  handlePredictionProgress(projectId, data, projectsDir) {
    const state = this.predictionStates.get(projectId);
    if (!state) return;

    if (data.event === 'progress') {
      state.currentImage = data.image;
      if (Number.isFinite(data.index)) {
        state.activeIndex = data.index;
      }
      // 更新进度信息，但不增加processedImages（因为图片还在处理中）
      this.processes.addLog(projectId, {
        type: 'progress',
        msg: `处理图片: ${data.image} (${data.index + 1}/${data.total})`,
        time: Date.now()
      });
      this.processes.addMetric(projectId, {
        event: 'image_start',
        image: data.image,
        index: data.index,
        total: data.total,
        progress: ((data.index + 1) / data.total * 100).toFixed(1),
        time: Date.now()
      });
    }

    if (data.event === 'result') {
      state.processedImages++;
      if (Number.isFinite(data.index)) {
        state.activeIndex = Math.max(state.activeIndex ?? -1, data.index);
      }
      logger.info(`[Prediction] Received result for ${data.image}, predictions: ${JSON.stringify(data.predictions)}`);
      const annotations = this.convertPredictionsToAnnotations(data.predictions);
      logger.info(`[Prediction] Converted to ${annotations.length} annotations`);

      state.results.push({
        image: data.image,
        predictions: data.predictions,
        annotations
      });

      if (annotations && annotations.length > 0) {
        const pending = this.pendingSaves.get(projectId);
        let savePromise;
        savePromise = this.saveAnnotations(projectId, data.image, annotations, projectsDir)
          .then(result => {
            if (result.success) {
              this.processes.addLog(projectId, {
                type: 'success',
                msg: `✓ ${data.image}: 检测到 ${annotations.length} 个标注`,
                time: Date.now()
              });
            }
          })
          .catch(err => {
            logger.error(`[Prediction] Failed to save annotations for ${projectId}/${data.image}:`, err);
          })
          .finally(() => {
            const set = this.pendingSaves.get(projectId);
            if (set) set.delete(savePromise);
          });
        if (pending) pending.add(savePromise);
      } else {
        this.processes.addLog(projectId, {
          type: 'info',
          msg: `- ${data.image}: 未检测到目标`,
          time: Date.now()
        });
      }

      // 记录图片完成事件，无论是否有标注都算成功处理
      this.processes.addMetric(projectId, {
        event: 'image_complete',
        image: data.image,
        index: state.processedImages - 1,
        total: state.totalImages,
        progress: (state.processedImages / state.totalImages * 100).toFixed(1),
        annotationsCount: annotations ? annotations.length : 0,
        processed: true, // 标记为已处理
        time: Date.now()
      });
    }

    if (data.event === 'error') {
      state.failedImages = this.toFiniteCount(state.failedImages, 0) + 1;
      this.processes.addLog(projectId, {
        type: 'error',
        msg: `处理 ${data.image} 时出错: ${data.error}`,
        time: Date.now()
      });
    }

    if (data.event === 'complete') {
      state.reportedSuccess = this.toFiniteCount(data.success, null);
      state.reportedFailed = this.toFiniteCount(data.failed, null);
      this.processes.addLog(projectId, {
        type: 'info',
        msg: `预标注完成: 成功 ${data.success}, 失败 ${data.failed}`,
        time: Date.now()
      });
    }

    if (data.event === 'image_start') {
      state.currentImage = data.image;
      this.processes.addLog(projectId, {
        type: 'progress',
        msg: `处理图片: ${data.image} (${data.index + 1}/${state.totalImages})`,
        time: Date.now()
      });
      this.processes.addMetric(projectId, {
        event: 'image_start',
        image: data.image,
        index: data.index,
        total: state.totalImages,
        progress: ((data.index + 1) / state.totalImages * 100).toFixed(1),
        time: Date.now()
      });
    }

    if (data.event === 'image_complete') {
      state.processedImages++;
      state.results.push({
        image: data.image,
        predictions: data.predictions
      });

      if (data.annotations && data.annotations.length > 0) {
        this.saveAnnotations(projectId, data.image, data.annotations, projectsDir)
          .then(result => {
            if (result.success) {
              this.processes.addLog(projectId, {
                type: 'success',
                msg: `✓ ${data.image}: 检测到 ${data.annotations.length} 个标注`,
                time: Date.now()
              });
            }
          });
      } else {
        this.processes.addLog(projectId, {
          type: 'info',
          msg: `- ${data.image}: 未检测到目标`,
          time: Date.now()
        });
      }

      this.processes.addMetric(projectId, {
        event: 'image_complete',
        image: data.image,
        index: data.index,
        total: state.totalImages,
        progress: (state.processedImages / state.totalImages * 100).toFixed(1),
        annotationsCount: data.annotations ? data.annotations.length : 0,
        time: Date.now()
      });
    }

    if (data.event === 'prediction_error') {
      state.failedImages = this.toFiniteCount(state.failedImages, 0) + 1;
      this.processes.addLog(projectId, {
        type: 'error',
        msg: `处理 ${data.image} 时出错: ${data.error}`,
        time: Date.now()
      });
    }
  }

  getStatus(projectId) {
    const processState = this.processes.get(projectId);
    const predictionState = this.predictionStates.get(projectId);

    if (!processState) {
      return { status: 'idle', logs: [], metrics: [], progress: 0 };
    }

    const response = {
      status: processState.status,
      logs: processState.logs.slice(-100),
      metrics: processState.metrics,
      pid: processState.pid,
      startTime: processState.startTime,
      endTime: processState.endTime,
      errorMessage: processState.finalErrorMessage || ''
    };

    // 如果任务已结束且 predictionState 已被删除，使用保存的 finalStats
    if (
      (processState.status === 'completed' || processState.status === 'failed' || processState.status === 'stopped')
      && processState.finalStats
    ) {
      response.progress = {
        total: processState.finalStats.totalImages,
        processed: processState.finalStats.processedImages,
        percentage: processState.finalStats.totalImages > 0
          ? (processState.finalStats.processedImages / processState.finalStats.totalImages * 100).toFixed(1)
          : '0',
        currentImage: null,
        successCount: processState.finalStats.successCount,
        failedCount: processState.finalStats.failedCount
      };
      if (!response.errorMessage && processState.status === 'failed') {
        response.errorMessage = this.extractFinalErrorMessage(processState);
      }
      return response;
    }

    if (predictionState) {
      // 统计成功和失败的数量
      let successCount = 0;
      let failedCount = 0;

      // 如果任务已完成，优先使用processedImages作为成功数（最可靠）
      if (processState.status === 'completed') {
        successCount = predictionState.processedImages || 0;
        failedCount = Math.max(0, predictionState.totalImages - successCount);
      } else {
        // 任务进行中时，从metrics和logs中统计

        // 从metrics中统计 - 所有image_complete事件都算成功处理
        if (processState.metrics && Array.isArray(processState.metrics)) {
          processState.metrics.forEach(metric => {
            if (metric.event === 'image_complete') {
              // 所有完成的事件都算成功，无论是否有标注
              successCount++;
            }
          });
        }

        // 从logs中统计错误数量
        if (processState.logs && Array.isArray(processState.logs)) {
          processState.logs.forEach(log => {
            if (log.type === 'error' && log.msg && log.msg.includes('出错')) {
              failedCount++;
            }
          });
        }

        // 如果metrics中没有数据，从logs中统计成功数
        if (successCount === 0 && processState.logs) {
          processState.logs.forEach(log => {
            if (log.type === 'success' || (log.msg && log.msg.includes('检测到') && log.msg.includes('个标注'))) {
              successCount++;
            } else if (log.type === 'info' && log.msg && log.msg.includes('未检测到目标')) {
              // 未检测到目标也算成功处理（图片已处理，只是没有检测到目标）
              successCount++;
            }
          });
        }

        // 如果还是没有统计到，使用processedImages作为成功数
        if (successCount === 0) {
          successCount = predictionState.processedImages || 0;
        }

        // 计算失败数（如果还没有统计到）
        if (failedCount === 0 && successCount > 0) {
          failedCount = Math.max(0, predictionState.totalImages - successCount);
        }
      }

      response.progress = {
        total: predictionState.totalImages,
        processed: predictionState.processedImages,
        percentage: (predictionState.processedImages / predictionState.totalImages * 100).toFixed(1),
        active: (() => {
          const active = Math.max(
            predictionState.processedImages,
            (Number.isFinite(predictionState.activeIndex) && predictionState.activeIndex >= 0)
              ? (predictionState.activeIndex + 1)
              : 0
          );
          return active;
        })(),
        activePercentage: (() => {
          const total = predictionState.totalImages || 0;
          if (total <= 0) return '0';
          const active = Math.max(
            predictionState.processedImages,
            (Number.isFinite(predictionState.activeIndex) && predictionState.activeIndex >= 0)
              ? (predictionState.activeIndex + 1)
              : 0
          );
          return (active / total * 100).toFixed(1);
        })(),
        currentImage: predictionState.currentImage,
        successCount: successCount,
        failedCount: failedCount
      };
    }

    if (!response.errorMessage && processState.status === 'failed') {
      response.errorMessage = this.extractFinalErrorMessage(processState);
    }

    return response;
  }

  async cancelPrediction(projectId) {
    const processState = this.processes.get(projectId);
    if (!processState || processState.status !== 'running' || !processState.pid) {
      throw new Error('没有正在运行的预标注任务');
    }

    try {
      const predictionState = this.predictionStates.get(projectId);
      processState.finalStats = this.buildFinalStats(predictionState, { exitCode: 1 });
      processState.finalErrorMessage = '用户手动停止预标注';
      this.killProcess(processState.pid, true);
      this.processes.setStatus(projectId, 'stopped');
      this.processes.addLog(projectId, {
        type: 'system',
        msg: '用户手动停止预标注',
        time: Date.now()
      });
      this.predictionStates.delete(projectId);
      return { success: true };
    } catch (err) {
      logger.error(`Failed to cancel prediction for ${projectId}:`, err);
      throw new Error(`停止预标注失败: ${err.message}`);
    }
  }

  async runPredictionOnImages(projectId, options) {
    const { modelPath, images, confidenceThreshold = 0.25, projectsDir } = options;

    const PathService = require('./PathService');
    const paths = PathService.getProjectPaths(projectId, projectsDir);

    const filteredImages = this.filterImagesByMode(images, options.mode, paths);

    if (filteredImages.length === 0) {
      return {
        success: true,
        message: '没有需要处理的图片',
        processedImages: 0
      };
    }

    return this.executePrediction(projectId, {
      ...options,
      images: filteredImages,
      projectsDir
    });
  }

  filterImagesByMode(images, mode, paths) {
    if (mode === 'all') {
      return images;
    }

    if (mode === 'unannotated') {
      return images.filter(img => {
        const imgName = img.name || img;
        const annotationPath = path.join(paths.annotations, `${imgName}.json`);
        if (!fs.existsSync(annotationPath)) {
          return true;
        }
        try {
          const content = fs.readFileSync(annotationPath, 'utf8');
          const annotations = JSON.parse(content);
          return !annotations || annotations.length === 0;
        } catch (e) {
          return true;
        }
      });
    }

    if (mode === 'selected') {
      return images.filter(img => img.selected);
    }

    return images;
  }
}

module.exports = new PredictionService();
