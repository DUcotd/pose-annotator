const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const ProcessManager = require('../managers/ProcessManager');
const { JobQueue } = require('../managers/JobQueue');
const PythonEnvService = require('./PythonEnvService');
const settings = require('../config/settings');
const RemoteTrainingService = require('./RemoteTrainingService');
const TrainingLogV2Service = require('./TrainingLogV2Service');

const JSON_LOG_PREFIX = '__JSON_LOG__';
const MAX_LOG_LENGTH = 1000;
const MAX_OOM_RETRIES = 3;
const OOM_BATCH_DIVISOR = 2;

class TrainingService {
  static ERROR_MAPPINGS = {
    oom: {
      keywords: ['out of memory', 'OOM', 'CUDA out of memory', 'cudamalloc', 'memory allocation'],
      type: 'oom',
      title: '显存不足 (Out of Memory)',
      icon: '⚠️',
      suggestions: [
        '减小 batch_size 参数（当前值可能过大）',
        '减小 imgsz 图片尺寸（如从 1280 改为 640）',
        '尝试使用更小的模型（如 yolov8n 或 yolov8s）',
        '开启混合精度训练可减少显存占用',
        '关闭不必要的后台程序释放显存'
      ],
      docLink: 'https://docs.ultralytics.com/yolov5/train/#gpu-memory-issues'
    },
    cuda: {
      keywords: ['cuda', 'CUDA error', 'gpu device', 'device-side assert'],
      type: 'cuda',
      title: 'CUDA/GPU 错误',
      icon: '🖥️',
      suggestions: [
        '请确认已正确安装 NVIDIA 显卡驱动',
        '检查 PyTorch 是否支持 CUDA：python -c "import torch; print(torch.cuda.is_available())"',
        '尝试将 device 参数改为 "cpu" 使用 CPU 模式训练',
        '更新 NVIDIA 驱动到最新版本'
      ],
      docLink: 'https://pytorch.org/get-started/locally/'
    },
    cudnn: {
      keywords: ['cudnn', 'CUDNN', 'cuDNN'],
      type: 'cudnn',
      title: 'cuDNN 错误',
      icon: '🔧',
      suggestions: [
        '可能是 CUDA 版本与 cuDNN 不匹配',
        '尝试更新 NVIDIA 驱动到最新版本',
        '设置环境变量 CUDA_LAUNCH_BLOCKING=1 获取更多调试信息',
        '重新安装 PyTorch 和 CUDA 工具包'
      ]
    },
    no_gpu: {
      keywords: ['No CUDA GPUs are available', 'No GPU detected', 'CUDA is not available'],
      type: 'no_gpu',
      title: '未检测到可用 GPU',
      icon: '❓',
      suggestions: [
        '请确认电脑已安装 NVIDIA 显卡',
        '检查显卡驱动是否正确安装',
        '在设备管理器中确认显卡未被禁用',
        '可使用 device: "cpu" 使用 CPU 进行训练'
      ]
    },
    memory: {
      keywords: [
        'MemoryError',
        'cannot allocate memory',
        'Unable to allocate',
        'killed',
        'winerror 1455',
        '页面文件太小',
        'shm.dll'
      ],
      type: 'memory',
      title: '系统内存不足',
      icon: '💾',
      suggestions: [
        '系统内存不足，尝试关闭其他程序',
        '减小 batch_size 参数',
        '减小 workers 参数',
        '增大 Windows 虚拟内存（页面文件）',
        '检查是否有内存泄漏'
      ]
    },
    file_not_found: {
      keywords: ['FileNotFoundError', 'No such file or directory', 'not found'],
      type: 'file_not_found',
      title: '文件未找到',
      icon: '📁',
      suggestions: [
        '检查数据集路径是否正确',
        '确认 YAML 配置文件中的路径配置',
        '确保训练/验证图片目录存在',
        '检查文件权限'
      ]
    },
    yaml_error: {
      keywords: ['YAML', 'yaml', 'mapping values are not allowed'],
      type: 'yaml_error',
      title: 'YAML 配置错误',
      icon: '📄',
      suggestions: [
        '检查 YAML 文件语法是否正确',
        '确保缩进使用空格而非制表符',
        '验证 YAML 文件中的路径配置',
        '使用在线 YAML 验证器检查语法'
      ]
    },
    shape_error: {
      keywords: ['shape', 'dimension', 'size mismatch', 'RuntimeError: shape'],
      type: 'shape_error',
      title: '张量维度错误',
      icon: '📐',
      suggestions: [
        '检查数据集标注格式是否正确',
        '确认关键点数量与模型配置匹配',
        '验证图片尺寸与配置一致',
        '检查数据集类别数量'
      ]
    },
    permission: {
      keywords: ['Permission denied', 'Access is denied', 'permission error'],
      type: 'permission',
      title: '权限错误',
      icon: '🔒',
      suggestions: [
        '以管理员身份运行程序',
        '检查目标文件夹的写入权限',
        '关闭占用文件的其他程序',
        '更改输出目录到有权限的位置'
      ]
    },
    network: {
      keywords: ['ConnectionError', 'NetworkError', 'timeout', 'download failed'],
      type: 'network',
      title: '网络错误',
      icon: '🌐',
      suggestions: [
        '检查网络连接是否正常',
        '如果下载模型失败，尝试手动下载',
        '配置代理或镜像源',
        '使用离线模式或本地模型'
      ]
    },
    python_env: {
      keywords: ['ModuleNotFoundError', 'ImportError', 'No module named'],
      type: 'python_env',
      title: 'Python 环境错误',
      icon: '🐍',
      suggestions: [
        '检查 Python 环境是否正确激活',
        '安装缺失的依赖包',
        '确认 PyTorch 和 Ultralytics 已正确安装',
        '尝试重新创建虚拟环境'
      ]
    }
  };

  constructor() {
    this.processes = ProcessManager;
    this.logsV2 = TrainingLogV2Service;
    this.startLocks = new Set();
    this.retryState = {};
    this.isShuttingDown = false;
    this.jobQueue = new JobQueue();
    this.csvWatchers = new Map();
    this.jsonBuffer = new Map();

    this.setupProcessCleanup();
    this.setupQueueListeners();
  }

  setupQueueListeners() {
    this.jobQueue.on('jobStarted', (job) => {
      this.processes.addLog(job.config.project || 'unknown', {
        type: 'system',
        msg: `🔄 队列任务开始执行: ${job.id}`,
        time: Date.now()
      });
    });

    this.jobQueue.on('jobCompleted', (job) => {
      this.processes.addLog(job.config.project || 'unknown', {
        type: 'system',
        msg: `✅ 队列任务完成: ${job.id}`,
        time: Date.now()
      });

      this.processNextJob();
    });

    this.jobQueue.on('jobFailed', (job) => {
      this.processes.addLog(job.config.project || 'unknown', {
        type: 'system',
        msg: `❌ 队列任务失败: ${job.id} - ${job.error}`,
        time: Date.now()
      });

      this.processNextJob();
    });
  }

  processNextJob() {
    const nextJob = this.jobQueue.getNextJob();
    if (nextJob) {
      logger.info(`Starting next job from queue: ${nextJob.id}`);
      this.executeJob(nextJob);
    } else {
      logger.info('No more jobs in queue');
    }
  }

  async executeJob(job) {
    this.jobQueue.startJob(job.id);

    try {
      await this.startTraining(job.config.project, job.config, 0);
    } catch (err) {
      logger.error(`Job execution failed: ${err.message}`);
      this.jobQueue.completeJob(job.id, err.message);
    }
  }

  async addToQueue(config, priority = 0) {
    const job = this.jobQueue.addJob(config, priority);

    const currentRunning = this.processes.getRunning();
    // 当前策略为全局单任务串行，防止用户多GPU同时训练导致资源耗尽
    if (currentRunning.length === 0) {
      this.processNextJob();
    }

    return {
      success: true,
      jobId: job.id,
      message: '任务已加入队列',
      queuePosition: this.jobQueue.getPendingJobs().findIndex(j => j.id === job.id) + 1
    };
  }

  setupProcessCleanup() {
    if (typeof process !== 'undefined') {
      process.on('exit', (code) => {
        logger.info(`Process exit event: ${code}, cleaning up child processes...`);
        this.killAllProcesses();
      });

      process.on('SIGINT', () => {
        logger.info('Received SIGINT signal, gracefully shutting down...');
        this.gracefulShutdown('SIGINT');
      });

      process.on('SIGTERM', () => {
        logger.info('Received SIGTERM signal, shutting down...');
        this.gracefulShutdown('SIGTERM');
      });

      process.on('uncaughtException', (err) => {
        logger.error('Uncaught exception, cleaning up...', err);
        this.killAllProcesses();
      });

      logger.info('Process cleanup handlers registered');
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
    logger.info(`Cleaning up ${runningProcesses.length} running processes`);

    runningProcesses.forEach(proc => {
      if (proc.pid) {
        this.killProcess(proc.pid, true);
        logger.info(`Killed process ${proc.pid} for project ${proc.projectId}`);
      }
    });
  }

  async gracefulShutdown(signal) {
    this.isShuttingDown = true;
    const runningProcesses = this.processes.getRunning();

    logger.info(`Graceful shutdown: ${runningProcesses.length} processes to terminate`);

    for (const proc of runningProcesses) {
      if (proc.pid) {
        try {
          logger.info(`Sending SIGTERM to process ${proc.pid} (project: ${proc.projectId})`);
          this.killProcess(proc.pid, false);

          const exited = await this.waitForProcessExit(proc.pid, 5000);

          if (!exited) {
            logger.warn(`Process ${proc.pid} did not exit gracefully, sending SIGKILL`);
            this.killProcess(proc.pid, true);
          }

          this.processes.addLog(proc.projectId, {
            type: 'system',
            msg: `进程被 ${signal} 信号终止`,
            time: Date.now()
          });

          logger.info(`Terminated process ${proc.pid} for project ${proc.projectId}`);
        } catch (e) {
          logger.debug(`Error terminating process ${proc.pid}: ${e.message}`);
        }
      }
    }

    logger.info('Graceful shutdown completed');
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
      throw new Error('No valid Python environment found');
    }
    return { cmd: env.path, info: env };
  }

  resolveExperimentName(config, retryCount = 0) {
    const rawName = typeof config?.name === 'string' ? config.name.trim() : '';
    const baseName = rawName || 'exp_auto';

    // Keep a stable run directory name when retrying after OOM or restart logic.
    if (retryCount > 0) {
      return baseName;
    }

    const projectDir = typeof config?.project === 'string' ? config.project.trim() : '';
    if (!projectDir || !fs.existsSync(projectDir)) {
      return baseName;
    }

    try {
      const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`^${escapedBaseName}(?:_(\\d+))?$`);

      let maxSuffix = -1;
      const entries = fs.readdirSync(projectDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const match = entry.name.match(pattern);
        if (!match) continue;

        const suffix = match[1] === undefined ? 0 : Number.parseInt(match[1], 10);
        if (Number.isNaN(suffix) || suffix < 0) continue;

        maxSuffix = Math.max(maxSuffix, suffix);
      }

      return maxSuffix < 0 ? baseName : `${baseName}_${maxSuffix + 1}`;
    } catch (err) {
      logger.warn(`Failed to resolve experiment name for ${projectDir}: ${err.message}`);
      return baseName;
    }
  }

  buildArgs(config) {
    const args = [
      path.join(__dirname, '..', '..', '..', 'scripts', 'train.py'),
      '--data', config.data,
      '--model', config.model,
      '--epochs', String(config.epochs),
      '--batch', String(config.batch),
      '--imgsz', String(config.imgsz),
      '--project', config.project || '',
      '--name', config.name || 'exp_auto',
    ];

    if (config.project) {
      const modelsDir = path.join(config.project, 'models');
      args.push('--models_dir', modelsDir);
    }

    if (config.hardwareEnabled !== false) {
      args.push('--device', config.device || '0');
      args.push('--workers', String(config.workers || 0));
      if (config.cache_images) args.push('--cache_images');
    } else {
      args.push('--device', '0');
      args.push('--workers', '0');
    }

    if (config.strategyEnabled !== false) {
      if (config.resume === true) {
        args.push('--resume');
      }
      args.push('--patience', String(config.patience || 60));
      if (config.cos_lr) args.push('--cos_lr');
      args.push('--optimizer', config.optimizer || 'auto');
      if (config.rect) args.push('--rect');
    } else {
      args.push('--patience', '50');
      args.push('--optimizer', 'auto');
    }

    if (config.augmentationEnabled !== false) {
      args.push('--degrees', String(config.degrees || 0));
      args.push('--translate', String(config.translate || 0.1));
      args.push('--scale', String(config.scale || 0.5));
      args.push('--shear', String(config.shear || 0));
      args.push('--perspective', String(config.perspective || 0));
      args.push('--fliplr', String(config.fliplr || 0.5));
      args.push('--flipud', String(config.flipud || 0));
      args.push('--hsv_h', String(config.hsv_h || 0.015));
      args.push('--hsv_s', String(config.hsv_s || 0.7));
      args.push('--hsv_v', String(config.hsv_v || 0.4));
      args.push('--mosaic', String(config.mosaic || 1.0));
      args.push('--close_mosaic', String(config.close_mosaic || 0));
      args.push('--mixup', String(config.mixup || 0));
      args.push('--copy_paste', String(config.copy_paste || 0));
      args.push('--erasing', String(config.erasing || 0.4));
      args.push('--crop_fraction', String(config.crop_fraction || 1.0));
    } else {
      args.push('--degrees', '0', '--translate', '0', '--scale', '0');
      args.push('--mosaic', '0');
    }

    if (config.lossEnabled !== false) {
      args.push('--loss_pose', String(config.loss_pose || 25.0));
      args.push('--loss_box', String(config.loss_box || 7.5));
      args.push('--loss_cls', String(config.loss_cls || 0.5));
    } else {
      args.push('--loss_pose', '12.0');
      args.push('--loss_box', '7.5');
      args.push('--loss_cls', '0.5');
    }

    if (config.export_formats) {
      args.push('--export_formats', config.export_formats);
    }

    return args;
  }

  isOOMError(line) {
    const lower = line.toLowerCase();
    return lower.includes('out of memory') ||
      lower.includes('cuda out of memory') ||
      lower.includes('oom') ||
      lower.includes('cudamalloc');
  }

  cleanString(str) {
    if (typeof str !== 'string') return str;

    let cleaned = str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

    cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');

    const progressChars = ['━', '─', '╸', '█', '▓', '▒', '░', '►', '▸', '▶'];
    progressChars.forEach(char => {
      cleaned = cleaned.split(char).join('');
    });

    return cleaned.trim();
  }

  shouldSkipLog(line) {
    if (!line || line.length === 0) return true;

    const skipPatterns = [
      /^\s*$/,
      /^\s*Class\s+Images\s+Instances\s+Box/,
      /^\s*Epoch\s+GPU_mem\s+box_loss/,
      /^[\d.]+it\/s/,
      /^\d+%\s*[━─╸]+/,
      /^\s*all\s+\d+\s+\d+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+$/,
      /^optimizer/,
      /^albumentations/,
      /^Scanning/,
      /^Adding/,
      /^AutoAnchor/,
      /^Freezing/,
      /^image\s+\d+/,
      /^results\.csv/,
    ];

    for (const pattern of skipPatterns) {
      if (pattern.test(line)) return true;
    }

    if (line.includes('━━━━') || line.includes('────') || line.includes('╸') ||
      line.includes('█') || line.includes('▓') || line.includes('▒') || line.includes('░')) {
      return true;
    }

    return false;
  }

  isBenignWarningLine(line) {
    const lower = String(line || '').toLowerCase();
    if (!lower) return false;

    // Treat Python warning categories as non-fatal diagnostics.
    if (lower.includes('futurewarning') ||
      lower.includes('deprecationwarning') ||
      lower.includes('userwarning') ||
      lower.includes('runtimewarning')) {
      return true;
    }

    // Common NVML deprecation message from torch.cuda init should not fail a run.
    if (lower.includes('the pynvml package is deprecated') ||
      lower.includes('please install nvidia-ml-py instead')) {
      return true;
    }

    // Source line printed for warnings, e.g. "import pynvml  # type: ignore[import]"
    if (lower.includes('import pynvml') && !lower.includes('modulenotfounderror')) {
      return true;
    }

    return false;
  }

  classifyError(errorMsg) {
    if (this.isBenignWarningLine(errorMsg)) {
      return {
        type: 'unknown',
        title: '非致命告警',
        icon: '⚠️',
        suggestions: [],
        rawError: String(errorMsg || '').substring(0, 500)
      };
    }

    const lower = errorMsg.toLowerCase();

    for (const [key, mapping] of Object.entries(TrainingService.ERROR_MAPPINGS)) {
      for (const keyword of mapping.keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          return {
            type: mapping.type,
            title: mapping.title,
            icon: mapping.icon,
            suggestions: mapping.suggestions,
            docLink: mapping.docLink || null,
            rawError: errorMsg.substring(0, 500)
          };
        }
      }
    }

    return {
      type: 'unknown',
      title: '训练错误',
      icon: '❌',
      suggestions: [
        '请检查配置参数是否正确',
        '查看下方原始错误信息',
        '尝试降低模型复杂度或数据量'
      ],
      rawError: errorMsg.substring(0, 500)
    };
  }

  inferStageFromEvent(eventName) {
    const event = String(eventName || '').toLowerCase();
    if (!event) return 'unknown';
    if (event.includes('preflight') || event.includes('validation_passed') || event.includes('validation_failed')) return 'preflight';
    if (event.includes('validation') || event.includes('map') || event.includes('metric')) return 'validate';
    if (event.includes('export')) return 'export';
    if (event.includes('train') || event.includes('epoch') || event.includes('resume') || event.includes('gpu')) return 'train';
    if (event.includes('model_load') || event.includes('hardware_check') || event.includes('config_snapshot') || event.includes('dataset_stats')) return 'bootstrap';
    if (event.includes('summary') || event.includes('complete') || event.includes('stop') || event.includes('error')) return 'teardown';
    return 'unknown';
  }

  mapErrorTypeToCode(errorType) {
    const upper = String(errorType || 'UNKNOWN').toUpperCase();
    const mapping = {
      OOM: 'CUDA_OOM',
      CUDA: 'CUDA_RUNTIME_ERROR',
      CUDNN: 'CUDNN_ERROR',
      NO_GPU: 'GPU_NOT_AVAILABLE',
      MEMORY: 'SYSTEM_MEMORY_ERROR',
      FILE_NOT_FOUND: 'DATASET_FILE_NOT_FOUND',
      YAML_ERROR: 'DATASET_YAML_ERROR',
      SHAPE_ERROR: 'TENSOR_SHAPE_ERROR',
      PERMISSION: 'PERMISSION_ERROR',
      NETWORK: 'NETWORK_ERROR',
      PYTHON_ENV: 'PYTHON_ENV_ERROR'
    };
    return mapping[upper] || `${upper}_ERROR`;
  }

  normalizeLineToEventV2(line, source = 'py_stdout', extra = {}) {
    const cleaned = this.cleanString(line || '');
    if (!cleaned) return null;

    const level = extra.level || (source === 'py_stderr' ? 'warn' : 'info');
    const stage = extra.stage || 'train';
    const kind = extra.kind || 'raw';
    const code = extra.code || (source === 'py_stderr' ? 'STDERR_LINE' : 'STDOUT_LINE');

    return {
      source,
      level,
      stage,
      kind,
      code,
      message: cleaned,
      details: extra.details,
      raw: String(line || cleaned)
    };
  }

  normalizeJsonLogToV2(jsonData) {
    const rawEventName = String(jsonData?.event || 'unknown');
    const eventName = rawEventName.toLowerCase();
    const stage = jsonData?.stage || this.inferStageFromEvent(eventName);
    const level = String((jsonData?.level || 'INFO')).toLowerCase();
    const message = jsonData?.message || rawEventName;
    const code = jsonData?.code || (rawEventName ? rawEventName.toUpperCase() : 'JSON_EVENT');

    const details = {
      ...jsonData,
      context: jsonData?.context || {}
    };

    const metricEvents = new Set([
      'epoch_end',
      'validation_complete',
      'performance_benchmark',
      'per_keypoint_metrics',
      'gpu_summary',
      'visual_validation',
      'gpu_warning'
    ]);

    // Some script events are emitted with kind=raw but carry structured metric payload.
    // We normalize them to metric to keep dashboard signals real-time.
    const forceMetricEvents = new Set(['gpu_warning']);
    const kind = forceMetricEvents.has(eventName)
      ? 'metric'
      : (jsonData?.kind || (metricEvents.has(eventName) ? 'metric' : (eventName.includes('error') ? 'diagnostic' : 'status')));

    return {
      source: 'py_stdout',
      level: ['debug', 'info', 'warn', 'error', 'fatal'].includes(level) ? level : 'info',
      stage,
      kind,
      code,
      message,
      details
    };
  }

  toFiniteNumber(value) {
    if (value === null || value === undefined || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  parseGpuMemToGb(value) {
    if (typeof value !== 'string') return undefined;
    const match = value.match(/([\d.]+)\s*G/i);
    if (!match) return undefined;
    return this.toFiniteNumber(match[1]);
  }

  normalizeMetricPayload(metricPayload = {}) {
    const root = metricPayload && typeof metricPayload === 'object' ? metricPayload : {};
    const details = root.details && typeof root.details === 'object' ? root.details : {};
    const rootContext = root.context && typeof root.context === 'object' ? root.context : {};
    const rootStats = root.stats && typeof root.stats === 'object' ? root.stats : {};
    const detailsStats = details.stats && typeof details.stats === 'object' ? details.stats : {};
    const rootContextStats = rootContext.stats && typeof rootContext.stats === 'object' ? rootContext.stats : {};
    const nestedMetrics = root.metrics && typeof root.metrics === 'object'
      ? root.metrics
      : (details.metrics && typeof details.metrics === 'object' ? details.metrics : {});
    const context = details.context && typeof details.context === 'object' ? details.context : {};
    const contextStats = context.stats && typeof context.stats === 'object' ? context.stats : {};
    const nestedRootContextMetrics = rootContext.metrics && typeof rootContext.metrics === 'object'
      ? rootContext.metrics
      : {};
    const nestedContextMetrics = context.metrics && typeof context.metrics === 'object'
      ? context.metrics
      : {};

    const merged = {
      ...rootStats,
      ...detailsStats,
      ...rootContextStats,
      ...contextStats,
      ...rootContext,
      ...context,
      ...details,
      ...root,
      ...nestedMetrics,
      ...nestedRootContextMetrics,
      ...nestedContextMetrics
    };

    const normalized = {
      event: String(merged.event || root.event || 'metric'),
      timestamp: merged.timestamp || root.timestamp || new Date().toISOString()
    };

    const numericKeys = [
      'epoch',
      'epochs',
      'totalEpochs',
      'box_loss',
      'pose_loss',
      'kobj_loss',
      'cls_loss',
      'dfl_loss',
      'train_loss',
      'mAP50',
      'mAP50_95',
      'pose_mAP50',
      'pose_mAP50_95',
      'box_precision',
      'box_recall',
      'pose_precision',
      'pose_recall',
      'learning_rate',
      'lr0',
      'lrf',
      'eta_seconds',
      'gpu_memory_used_gb',
      'gpu_memory_total_gb',
      'gpu_memory_percent',
      'gpu_utilization_percent',
      'gpu_temperature',
      'gpu_power_draw',
      'avg_memory_percent',
      'max_memory_percent',
      'avg_utilization_percent',
      'max_utilization_percent',
      'realtime_fps'
    ];

    numericKeys.forEach((key) => {
      const num = this.toFiniteNumber(merged[key]);
      if (num !== undefined) normalized[key] = num;
    });

    if (normalized.totalEpochs === undefined) {
      const fallbackTotal = this.toFiniteNumber(merged.total_epochs) ?? this.toFiniteNumber(merged.epochs);
      if (fallbackTotal !== undefined) normalized.totalEpochs = fallbackTotal;
    }
    if (normalized.epoch === undefined) {
      const fallbackEpoch = this.toFiniteNumber(merged.current_epoch) ?? this.toFiniteNumber(merged.currentEpoch);
      if (fallbackEpoch !== undefined) normalized.epoch = fallbackEpoch;
    }

    if (normalized.mAP50 === undefined) {
      const map50 = this.toFiniteNumber(merged.map50);
      if (map50 !== undefined) normalized.mAP50 = map50;
    }
    if (normalized.mAP50_95 === undefined) {
      const map5095 = this.toFiniteNumber(merged['mAP50-95'])
        ?? this.toFiniteNumber(merged['map50_95'])
        ?? this.toFiniteNumber(merged['map50-95'])
        ?? this.toFiniteNumber(merged.map);
      if (map5095 !== undefined) normalized.mAP50_95 = map5095;
    }
    if (normalized.pose_mAP50_95 === undefined) {
      const poseMap5095 = this.toFiniteNumber(merged['pose_mAP50-95'])
        ?? this.toFiniteNumber(merged['pose_map50_95'])
        ?? this.toFiniteNumber(merged.pose_map);
      if (poseMap5095 !== undefined) normalized.pose_mAP50_95 = poseMap5095;
    }
    if (normalized.box_precision === undefined) {
      const p = this.toFiniteNumber(merged.precision) ?? this.toFiniteNumber(merged.box_p);
      if (p !== undefined) normalized.box_precision = p;
    }
    if (normalized.box_recall === undefined) {
      const r = this.toFiniteNumber(merged.recall) ?? this.toFiniteNumber(merged.box_r);
      if (r !== undefined) normalized.box_recall = r;
    }
    if (normalized.gpu_memory_used_gb === undefined) {
      const gpuMem = this.parseGpuMemToGb(merged.gpu_mem);
      if (gpuMem !== undefined) normalized.gpu_memory_used_gb = gpuMem;
    }
    if (normalized.box_loss === undefined) {
      const trainBoxLoss = this.toFiniteNumber(merged.train_box_loss);
      if (trainBoxLoss !== undefined) normalized.box_loss = trainBoxLoss;
    }
    if (normalized.pose_loss === undefined) {
      const trainPoseLoss = this.toFiniteNumber(merged.train_pose_loss);
      if (trainPoseLoss !== undefined) normalized.pose_loss = trainPoseLoss;
    }
    if (normalized.kobj_loss === undefined) {
      const trainKobjLoss = this.toFiniteNumber(merged.train_kobj_loss);
      if (trainKobjLoss !== undefined) normalized.kobj_loss = trainKobjLoss;
    }
    if (normalized.cls_loss === undefined) {
      const trainClsLoss = this.toFiniteNumber(merged.train_cls_loss);
      if (trainClsLoss !== undefined) normalized.cls_loss = trainClsLoss;
    }
    if (normalized.dfl_loss === undefined) {
      const trainDflLoss = this.toFiniteNumber(merged.train_dfl_loss);
      if (trainDflLoss !== undefined) normalized.dfl_loss = trainDflLoss;
    }

    if (merged.latency && typeof merged.latency === 'object') {
      normalized.latency = merged.latency;
    }
    if (merged.throughput && typeof merged.throughput === 'object') {
      normalized.throughput = merged.throughput;
    }
    if (Array.isArray(merged.keypoints)) {
      normalized.keypoints = merged.keypoints;
    }
    if (Array.isArray(merged.samples)) {
      normalized.samples = merged.samples;
    }
    if (typeof merged.output_dir === 'string') {
      normalized.output_dir = merged.output_dir;
    }
    if (typeof merged.meets_realtime_requirement === 'boolean') {
      normalized.meets_realtime_requirement = merged.meets_realtime_requirement;
    }
    if (Array.isArray(merged.gpu_warnings)) {
      normalized.gpu_warnings = merged.gpu_warnings;
    } else if (Array.isArray(merged.warnings)) {
      normalized.gpu_warnings = merged.warnings;
    }

    return normalized;
  }

  async start(projectId, config) {
    if (this.startLocks.has(projectId)) {
      throw new Error('Training is already starting for this project');
    }

    this.startLocks.add(projectId);
    try {
      const existing = this.processes.get(projectId);
      if (existing && existing.status === 'running') {
        return this.addToQueue({ ...config, project: projectId }, config.priority || 0);
      }
      if (existing && existing.status === 'starting') {
        throw new Error('Training is already starting for this project');
      }

      return this.startTraining(projectId, config, 0);
    } finally {
      this.startLocks.delete(projectId);
    }
  }

  async startTraining(projectId, config, retryCount = 0) {
    const existing = this.processes.get(projectId);
    if (existing && (existing.status === 'running' || existing.status === 'starting')) {
      throw new Error('Training is already in progress for this project');
    }

    config = {
      ...config,
      name: this.resolveExperimentName(config, retryCount)
    };

    const runState = retryCount === 0
      ? this.logsV2.createRun(
        projectId,
        config.projectRoot || config.project || null,
        {
          model: config.model,
          epochs: config.epochs,
          batch: config.batch,
          imgsz: config.imgsz,
          name: config.name
        }
      )
      : this.logsV2.ensureActiveRun(projectId, config.projectRoot || config.project || null);

    this.jsonBuffer.set(projectId, '');

    const { cmd: pythonCmd } = await this.getPythonCommand();
    const args = this.buildArgs(config);

    this.logsV2.setStatus(projectId, 'starting');
    this.logsV2.appendEvent(projectId, {
      source: 'server',
      level: 'info',
      stage: 'bootstrap',
      kind: 'status',
      code: retryCount > 0 ? 'TRAIN_RETRY_STARTING' : 'TRAIN_STARTING',
      message: retryCount > 0
        ? `训练重试启动中 (第 ${retryCount + 1} 次)`
        : '训练任务启动中',
      details: {
        runId: runState.runId,
        retryCount,
        model: config.model,
        epochs: config.epochs,
        batch: config.batch,
        imgsz: config.imgsz
      }
    });

    if (config.remoteEnabled) {
      this.logsV2.appendEvent(projectId, {
        source: 'server',
        level: 'info',
        stage: 'bootstrap',
        kind: 'status',
        code: 'REMOTE_TRAINING_ENABLED',
        message: '已启用远程训练模式',
        details: { remoteHost: config.remoteHost, remotePath: config.remotePath }
      });
      return RemoteTrainingService.start(projectId, {
        ...config,
        projectRoot: config.projectRoot || config.project
      });
    }

    logger.info(`Starting training for project ${projectId} (attempt ${retryCount + 1}): ${pythonCmd} ${args.join(' ')}`);

    if (retryCount > 0) {
      this.processes.addLog(projectId, {
        type: 'system',
        msg: `🔄 重试训练 (尝试 ${retryCount + 1}/${MAX_OOM_RETRIES + 1})，Batch Size: ${config.batch}`,
        time: Date.now()
      });
    }

    const processState = this.processes.create(projectId, config.projectRoot || config.project || null);
    this.processes.setStatus(projectId, 'starting');
    this.processes.setErrorLogs(projectId, []);

    const projectPath = config.project || '';
    const csvWatcher = this.watchResultsCSV(projectId, projectPath);
    if (csvWatcher) {
      this.csvWatchers.set(projectId, csvWatcher);
    }

    const child = spawn(pythonCmd, args, {
      windowsHide: true,
      env: {
        ...process.env,
        KMP_DUPLICATE_LIB_OK: 'TRUE',
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      }
    });

    this.processes.setPid(projectId, child.pid);
    this.processes.setStatus(projectId, 'running');
    this.logsV2.setStatus(projectId, 'running');
    this.logsV2.appendEvent(projectId, {
      source: 'system',
      level: 'info',
      stage: 'bootstrap',
      kind: 'status',
      code: 'TRAIN_PROCESS_STARTED',
      message: `训练进程已启动，PID: ${child.pid}`,
      details: { pid: child.pid, batch: config.batch, runId: runState.runId }
    });

    this.retryState[projectId] = {
      retryCount,
      originalBatch: config.batch,
      batchHistory: [config.batch],
      isRetrying: false
    };

    this.processes.addLog(projectId, {
      type: 'system',
      msg: `训练进程已启动，PID: ${child.pid}，Batch Size: ${config.batch}`,
      time: Date.now()
    });

    child.stdout.on('data', (data) => {
      const chunk = data.toString('utf8');
      let buffer = this.jsonBuffer.get(projectId) || '';
      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop();

      lines.forEach(line => {
        if (!line.trim()) return;

        if (line.startsWith(JSON_LOG_PREFIX)) {
          try {
            const jsonStr = line.slice(JSON_LOG_PREFIX.length);
            const jsonData = JSON.parse(jsonStr);
            const v2Event = this.normalizeJsonLogToV2(jsonData);
            const normalizedMetric = this.normalizeMetricPayload(jsonData);

            if (v2Event.kind === 'metric') {
              this.logsV2.appendMetric(projectId, normalizedMetric, {
                source: v2Event.source,
                level: v2Event.level,
                stage: v2Event.stage,
                code: v2Event.code,
                message: v2Event.message,
                raw: line
              });
              this.processes.addMetric(projectId, {
                ...normalizedMetric,
                time: Date.now()
              });
            } else {
              this.logsV2.appendEvent(projectId, {
                ...v2Event,
                raw: line
              });

              if (v2Event.level === 'error' || v2Event.level === 'fatal') {
                const classified = this.classifyError(v2Event.message);
                this.logsV2.updateDiagnosis(projectId, {
                  status: 'failed',
                  stage: v2Event.stage,
                  code: this.mapErrorTypeToCode(classified.type),
                  rootCause: classified.title,
                  evidence: [v2Event.message],
                  suggestions: classified.suggestions,
                  rawTail: this.logsV2.getRawTail(projectId)
                });
              }
            }

            if (jsonData.event === 'epoch_end') {
              const parts = [];
              parts.push(`Epoch ${normalizedMetric.epoch || jsonData.epoch}/${normalizedMetric.totalEpochs || jsonData.epochs || '--'}`);
              if (normalizedMetric.box_loss !== undefined) parts.push(`box_loss=${normalizedMetric.box_loss.toFixed(4)}`);
              if (normalizedMetric.pose_loss !== undefined) parts.push(`pose_loss=${normalizedMetric.pose_loss.toFixed(4)}`);
              if (normalizedMetric.mAP50 !== undefined) parts.push(`mAP50=${(normalizedMetric.mAP50 * 100).toFixed(1)}%`);
              if (normalizedMetric.pose_mAP50 !== undefined) parts.push(`pose_mAP50=${(normalizedMetric.pose_mAP50 * 100).toFixed(1)}%`);

              this.processes.addLog(projectId, {
                type: 'metric',
                msg: parts.join(' | '),
                time: Date.now()
              });
            }

            if (jsonData.event === 'validation_complete') {
              const m = normalizedMetric;
              this.processes.addLog(projectId, {
                type: 'metric',
                msg: `✅ 验证完成 - Box mAP@50: ${(m.mAP50 * 100 || 0).toFixed(1)}%, Pose mAP@50: ${(m.pose_mAP50 * 100 || 0).toFixed(1)}%`,
                time: Date.now()
              });
            }
          } catch (e) {
            logger.debug(`Failed to parse JSON log: ${e.message}, raw: ${line.slice(0, 100)}`);
          }
        } else {
          const trimmed = line.trim();

          if (this.shouldSkipLog(trimmed)) {
            const noisyEvent = this.normalizeLineToEventV2(trimmed, 'py_stdout', {
              level: 'debug',
              stage: 'train',
              kind: 'raw',
              code: 'TRAIN_NOISE_LINE'
            });
            if (noisyEvent) {
              this.logsV2.appendEvent(projectId, noisyEvent);
            }
            return;
          }

          const progressMatch = trimmed.match(/(\d+)\/(\d+)\s+([\d.]+G)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
          if (progressMatch) {
            const [full, epoch, totalEpochs, gpuMem, boxLoss, poseLoss, kobjLoss, clsLoss, dflLoss] = progressMatch;
            const parsedMetric = {
              epoch: parseInt(epoch),
              totalEpochs: parseInt(totalEpochs),
              gpu_mem: gpuMem,
              box_loss: parseFloat(boxLoss),
              pose_loss: parseFloat(poseLoss),
              kobj_loss: parseFloat(kobjLoss),
              cls_loss: parseFloat(clsLoss),
              dfl_loss: parseFloat(dflLoss),
              time: Date.now()
            };
            this.processes.addMetric(projectId, {
              ...parsedMetric
            });
            this.logsV2.appendMetric(projectId, parsedMetric, {
              source: 'py_stdout',
              level: 'info',
              stage: 'train',
              code: 'TRAIN_PROGRESS_ROW',
              message: '解析训练进度行',
              raw: trimmed
            });
            return;
          }

          const mapMatch = trimmed.match(/all\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
          if (mapMatch) {
            const [full, images, instances, boxP, boxR, boxMAP50, boxMAP5095, poseP, poseR, poseMAP50, poseMAP5095] = mapMatch;
            const latestEpochMetric = [...(this.processes.getMetrics(projectId) || [])]
              .reverse()
              .find((metric) => this.toFiniteNumber(metric?.epoch) !== undefined);
            const currentEpoch = this.toFiniteNumber(latestEpochMetric?.epoch);
            const currentTotalEpochs = this.toFiniteNumber(latestEpochMetric?.totalEpochs)
              ?? this.toFiniteNumber(latestEpochMetric?.epochs);
            const parsedMetric = {
              box_precision: parseFloat(boxP),
              box_recall: parseFloat(boxR),
              mAP50: parseFloat(boxMAP50),
              mAP50_95: parseFloat(boxMAP5095),
              pose_precision: parseFloat(poseP),
              pose_recall: parseFloat(poseR),
              pose_mAP50: parseFloat(poseMAP50),
              pose_mAP50_95: parseFloat(poseMAP5095),
              ...(currentEpoch !== undefined ? { epoch: currentEpoch } : {}),
              ...(currentTotalEpochs !== undefined ? { totalEpochs: currentTotalEpochs } : {}),
              time: Date.now()
            };
            this.processes.addMetric(projectId, {
              ...parsedMetric
            });
            this.logsV2.appendMetric(projectId, parsedMetric, {
              source: 'py_stdout',
              level: 'info',
              stage: 'validate',
              code: 'VALIDATION_ROW',
              message: '解析验证指标行',
              raw: trimmed
            });

            this.processes.addLog(projectId, {
              type: 'metric',
              msg: `📊 验证指标 - Box: P=${boxP} R=${boxR} mAP@50=${(parseFloat(boxMAP50) * 100).toFixed(1)}% | Pose: P=${poseP} R=${poseR} mAP@50=${(parseFloat(poseMAP50) * 100).toFixed(1)}%`,
              time: Date.now()
            });
            return;
          }

          if (trimmed.includes('Class') && trimmed.includes('Images') && trimmed.includes('Box(P')) {
            return;
          }

          if (trimmed.startsWith('Epoch') && trimmed.includes('GPU_mem')) {
            return;
          }

          if (trimmed.includes('━━━━') || trimmed.includes('────') || trimmed.includes('╸')) {
            return;
          }

          this.processes.addLog(projectId, {
            type: 'stdout',
            msg: trimmed,
            time: Date.now()
          });
          const stdoutEvent = this.normalizeLineToEventV2(trimmed, 'py_stdout', {
            level: 'info',
            stage: 'train',
            kind: 'raw',
            code: 'STDOUT_LINE'
          });
          if (stdoutEvent) {
            this.logsV2.appendEvent(projectId, stdoutEvent);
          }
        }
      });
    });

    let stderrBuffer = '';
    let isCapturingTraceback = false;
    let tracebackLines = [];

    // Helper to process a complete line from stderr
    // We define this inside to share closure scope
    const processStderrLine = (line) => {
      // Don't modify the line yet if we are capturing traceback, we want raw indent
      const trimmed = line.trim();
      if (!trimmed && !isCapturingTraceback) return;

      const cleanedLine = this.cleanString(trimmed);
      if (!cleanedLine && !isCapturingTraceback) return;

      if (!isCapturingTraceback && this.isBenignWarningLine(cleanedLine)) {
        const warningEvent = this.normalizeLineToEventV2(cleanedLine, 'py_stderr', {
          level: 'warn',
          stage: 'train',
          kind: 'raw',
          code: 'STDERR_WARNING'
        });
        if (warningEvent) {
          this.logsV2.appendEvent(projectId, warningEvent);
        }
        this.processes.addLog(projectId, {
          type: 'stderr',
          msg: cleanedLine,
          time: Date.now()
        });
        return;
      }

      // 1. Traceback Start Detection
      if (line.includes('Traceback (most recent call last):')) {
        isCapturingTraceback = true;
        tracebackLines = [line];
        this.processes.addLog(projectId, {
          type: 'stderr',
          msg: '🔴 ' + line, // Keep raw line structure
          time: Date.now()
        });
        const tracebackStartEvent = this.normalizeLineToEventV2(line, 'py_stderr', {
          level: 'error',
          stage: 'train',
          kind: 'diagnostic',
          code: 'PY_TRACEBACK_START'
        });
        if (tracebackStartEvent) {
          this.logsV2.appendEvent(projectId, tracebackStartEvent);
        }
        // Also ensure this gets into the error logs for the report
        this.processes.addErrorLog(projectId, line);
        return;
      }

      if (isCapturingTraceback) {
        tracebackLines.push(line);
        // Log formatted traceback lines
        this.processes.addLog(projectId, {
          type: 'stderr',
          msg: '  ' + line, // Indent slightly in UI
          time: Date.now()
        });

        // Add to error logs for report
        this.processes.addErrorLog(projectId, line);

        // Heuristic: End of traceback usually is the error type line (e.g. "ValueError: ...")
        // It starts at the beginning of the line (no indent)
        if (!line.startsWith(' ') && !line.startsWith('\t') && line.includes(':')) {
          isCapturingTraceback = false;

          // Try to classify the final error
          const classified = this.classifyError(line);
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

          this.logsV2.appendEvent(projectId, {
            source: 'py_stderr',
            level: 'error',
            stage: 'train',
            kind: 'diagnostic',
            code: this.mapErrorTypeToCode(classified.type),
            message: classified.title,
            details: {
              rawError: line,
              suggestions: classified.suggestions
            },
            raw: line
          });
          this.logsV2.updateDiagnosis(projectId, {
            status: 'failed',
            stage: 'train',
            code: this.mapErrorTypeToCode(classified.type),
            rootCause: classified.title,
            evidence: tracebackLines.slice(-20),
            suggestions: classified.suggestions,
            rawTail: this.logsV2.getRawTail(projectId)
          });
          tracebackLines = [];
        }
        return;
      }

      // 2. Normal Stderr Processing
      logger.error(`[Train ${projectId}] ${cleanedLine}`);

      // Try to classify standalone errors that aren't part of a traceback
      const classified = this.classifyError(cleanedLine);

      if (classified.type !== 'unknown') {
        this.processes.addLog(projectId, {
          type: 'error',
          msg: `${classified.icon} ${classified.title}`,
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

        this.logsV2.appendEvent(projectId, {
          source: 'py_stderr',
          level: 'error',
          stage: 'train',
          kind: 'diagnostic',
          code: this.mapErrorTypeToCode(classified.type),
          message: `${classified.title}: ${classified.rawError}`,
          details: { suggestions: classified.suggestions },
          raw: cleanedLine
        });
        this.logsV2.updateDiagnosis(projectId, {
          status: 'failed',
          stage: 'train',
          code: this.mapErrorTypeToCode(classified.type),
          rootCause: classified.title,
          evidence: [cleanedLine],
          suggestions: classified.suggestions,
          rawTail: this.logsV2.getRawTail(projectId)
        });
      } else {
        const stderrEvent = this.normalizeLineToEventV2(cleanedLine, 'py_stderr', {
          level: 'warn',
          stage: 'train',
          kind: 'raw',
          code: 'STDERR_LINE'
        });
        if (stderrEvent) {
          this.logsV2.appendEvent(projectId, stderrEvent);
        }
      }

      // Always add to raw error logs for report
      this.processes.addErrorLog(projectId, cleanedLine);

      this.processes.addLog(projectId, {
        type: 'stderr',
        msg: cleanedLine,
        time: Date.now()
      });
    };

    child.stderr.on('data', (data) => {
      stderrBuffer += data.toString();

      // Split by newline but handle potential partial lines at the end
      let lines = stderrBuffer.split('\n');

      // If the buffer doesn't end with a newline, the last element is incomplete.
      // We keep it in the buffer for the next chunk.
      // But if the process ends, we might lose it? 
      // 'close' event handler usually doesn't flush stderr buffer?
      // Actually child_process usually emits all data.
      // A common pattern is:

      if (stderrBuffer.endsWith('\n')) {
        stderrBuffer = '';
      } else {
        stderrBuffer = lines.pop();
      }

      lines.forEach(line => processStderrLine(line));
    });

    child.on('close', (code) => {
      const retryState = this.retryState[projectId];

      const watcher = this.csvWatchers.get(projectId);
      if (watcher) {
        watcher.close();
        this.csvWatchers.delete(projectId);
        logger.debug(`Closed CSV watcher for project ${projectId}`);
      }

      const stdoutRemainder = (this.jsonBuffer.get(projectId) || '').trim();
      if (stdoutRemainder) {
        if (stdoutRemainder.startsWith(JSON_LOG_PREFIX)) {
          try {
            const jsonData = JSON.parse(stdoutRemainder.slice(JSON_LOG_PREFIX.length));
            const v2Event = this.normalizeJsonLogToV2(jsonData);
            const normalizedMetric = this.normalizeMetricPayload(jsonData);
            if (v2Event.kind === 'metric') {
              this.logsV2.appendMetric(projectId, normalizedMetric, {
                source: v2Event.source,
                level: v2Event.level,
                stage: v2Event.stage,
                code: v2Event.code,
                message: v2Event.message,
                raw: stdoutRemainder
              });
              this.processes.addMetric(projectId, {
                ...normalizedMetric,
                time: Date.now()
              });
            } else {
              this.logsV2.appendEvent(projectId, {
                ...v2Event,
                raw: stdoutRemainder
              });
            }
          } catch (err) {
            logger.debug(`Failed to parse remaining stdout JSON line: ${err.message}`);
          }
        } else {
          const cleanedRemainder = this.cleanString(stdoutRemainder);
          if (cleanedRemainder && !this.shouldSkipLog(cleanedRemainder)) {
            this.processes.addLog(projectId, {
              type: 'stdout',
              msg: cleanedRemainder,
              time: Date.now()
            });
            const stdoutEvent = this.normalizeLineToEventV2(cleanedRemainder, 'py_stdout', {
              level: 'info',
              stage: 'train',
              kind: 'raw',
              code: 'STDOUT_TAIL'
            });
            if (stdoutEvent) {
              this.logsV2.appendEvent(projectId, stdoutEvent);
            }
          }
        }
      }
      this.jsonBuffer.delete(projectId);

      if (stderrBuffer.trim()) {
        processStderrLine(stderrBuffer);
        stderrBuffer = '';
      }

      if (code === 0) {
        const status = 'completed';
        this.processes.setStatus(projectId, status);
        this.logsV2.setStatus(projectId, status);
        this.processes.addLog(projectId, {
          type: 'system',
          msg: `✅ 训练完成！进程退出码: ${code}`,
          time: Date.now()
        });
        this.logsV2.appendEvent(projectId, {
          source: 'system',
          level: 'info',
          stage: 'teardown',
          kind: 'status',
          code: 'TRAIN_COMPLETED',
          message: `训练完成，退出码 ${code}`,
          details: { exitCode: code }
        });
        logger.info(`Training for project ${projectId} ${status}`);
      }
      else if (retryState && retryState.isRetrying && retryState.retryCount <= MAX_OOM_RETRIES) {
        logger.info(`Waiting for OOM retry for project ${projectId}`);
        this.logsV2.appendEvent(projectId, {
          source: 'system',
          level: 'warn',
          stage: 'teardown',
          kind: 'status',
          code: 'TRAIN_WAITING_RETRY',
          message: '等待 OOM 自动重试',
          details: {
            retryCount: retryState.retryCount,
            maxRetries: MAX_OOM_RETRIES
          }
        });
      }
      else {
        const status = 'failed';
        this.processes.setStatus(projectId, status);
        this.logsV2.setStatus(projectId, status);

        const errorLogs = this.processes.getErrorLogs(projectId) || [];
        const recentErrors = errorLogs.slice(-10);

        this.processes.addLog(projectId, {
          type: 'system',
          msg: `❌ 训练失败！进程退出码: ${code}`,
          time: Date.now()
        });

        if (recentErrors.length > 0) {
          this.processes.addLog(projectId, {
            type: 'error',
            msg: `📋 错误详情:\n${recentErrors.join('\n')}`,
            time: Date.now()
          });
        } else {
          this.processes.addLog(projectId, {
            type: 'error',
            msg: `⚠️ 未捕获到具体错误信息，请检查:\n1. 数据集是否正确导出\n2. Python环境是否配置正确\n3. 模型文件是否存在`,
            time: Date.now()
          });
        }

        const currentV2 = this.logsV2.getStatus(projectId);
        if (!currentV2.diagnosis) {
          this.logsV2.updateDiagnosis(projectId, {
            status: 'failed',
            stage: 'teardown',
            code: 'TRAIN_PROCESS_FAILED',
            rootCause: `训练进程异常退出 (exitCode=${code})`,
            evidence: recentErrors,
            suggestions: [
              '检查数据集路径和 data.yaml 配置',
              '检查 Python 环境是否完整（ultralytics/torch）',
              '优先查看 stderr 与 traceback 关键行'
            ],
            rawTail: this.logsV2.getRawTail(projectId)
          });
        }
        this.logsV2.appendEvent(projectId, {
          source: 'system',
          level: 'error',
          stage: 'teardown',
          kind: 'status',
          code: 'TRAIN_FAILED',
          message: `训练失败，退出码 ${code}`,
          details: { exitCode: code, recentErrors }
        });

        logger.info(`Training for project ${projectId} ${status}`);
      }

      delete this.retryState[projectId];
    });

    child.on('error', (err) => {
      logger.error(`Training process error for ${projectId}:`, err);
      this.processes.setStatus(projectId, 'failed');
      this.logsV2.setStatus(projectId, 'failed');
      this.processes.addLog(projectId, {
        type: 'system',
        msg: `启动失败: ${err.message}`,
        time: Date.now()
      });
      this.logsV2.appendEvent(projectId, {
        source: 'system',
        level: 'fatal',
        stage: 'bootstrap',
        kind: 'diagnostic',
        code: 'TRAIN_PROCESS_SPAWN_ERROR',
        message: `训练进程启动失败: ${err.message}`,
        details: { error: err.message }
      });
      this.logsV2.updateDiagnosis(projectId, {
        status: 'failed',
        stage: 'bootstrap',
        code: 'TRAIN_PROCESS_SPAWN_ERROR',
        rootCause: '训练进程启动失败',
        evidence: [err.message],
        suggestions: [
          '检查 Python 解释器路径和权限',
          '检查训练脚本路径是否存在',
          '查看系统日志确认进程启动错误'
        ],
        rawTail: this.logsV2.getRawTail(projectId)
      });
    });

    return {
      success: true,
      pid: child.pid,
      name: config.name || 'exp_auto',
      batch: config.batch,
      runId: (this.logsV2.getStatus(projectId) || {}).runId || null
    };
  }

  async handleOOMError(projectId, config, retryCount) {
    const retryState = this.retryState[projectId];

    if (!retryState) {
      logger.error(`No retry state found for project ${projectId}`);
      return;
    }

    if (retryCount >= MAX_OOM_RETRIES) {
      this.processes.addLog(projectId, {
        type: 'system',
        msg: `❌ 已达到最大重试次数 (${MAX_OOM_RETRIES})，训练终止`,
        time: Date.now()
      });
      this.logsV2.appendEvent(projectId, {
        source: 'system',
        level: 'error',
        stage: 'train',
        kind: 'diagnostic',
        code: 'CUDA_OOM_MAX_RETRIES',
        message: `显存不足重试超过上限 (${MAX_OOM_RETRIES})`
      });
      this.logsV2.updateDiagnosis(projectId, {
        status: 'failed',
        stage: 'train',
        code: 'CUDA_OOM_MAX_RETRIES',
        rootCause: '显存不足且自动重试失败',
        evidence: ['多次重试后仍发生 OOM'],
        suggestions: [
          '进一步减小 batch 或 imgsz',
          '切换更小模型（如 yolov8n-pose）',
          '切换 CPU 训练或释放 GPU 显存'
        ],
        rawTail: this.logsV2.getRawTail(projectId)
      });

      this.processes.addLog(projectId, {
        type: 'suggestion',
        msg: `💡 建议解决方案:\n1. 使用更小的模型 (yolov8n 或 yolov8s)\n2. 减小 imgsz 图片尺寸\n3. 使用 CPU 模式训练 (device: cpu)\n4. 检查显卡驱动是否需要更新`,
        time: Date.now()
      });

      retryState.isRetrying = false;
      return;
    }

    retryState.isRetrying = true;
    retryState.retryCount = retryCount + 1;

    const newBatch = Math.max(1, Math.floor(config.batch / OOM_BATCH_DIVISOR));

    if (config.batch === 1 || newBatch === config.batch) {
      this.processes.addLog(projectId, {
        type: 'error',
        msg: `❌ Batch Size 已降至 1 仍然显存不足，无法继续自动修复。请尝试减小 imgsz 或更换更小的模型。`,
        time: Date.now()
      });

      this.processes.addLog(projectId, {
        type: 'suggestion',
        msg: `💡 建议解决方案:\n1. 使用更小的模型 (yolov8n 或 yolov8s)\n2. 减小 imgsz 图片尺寸\n3. 使用 CPU 模式训练 (device: cpu)\n4. 检查显卡驱动是否需要更新`,
        time: Date.now()
      });

      retryState.isRetrying = false;
      this.processes.setStatus(projectId, 'failed');
      return;
    }

    retryState.batchHistory.push(newBatch);

    this.processes.addLog(projectId, {
      type: 'system',
      msg: `🔄 显存不足！将在 3 秒后自动重试，Batch Size: ${config.batch} → ${newBatch}`,
      time: Date.now()
    });
    this.logsV2.appendEvent(projectId, {
      source: 'system',
      level: 'warn',
      stage: 'train',
      kind: 'diagnostic',
      code: 'CUDA_OOM_RETRYING',
      message: `显存不足，自动重试 batch: ${config.batch} -> ${newBatch}`,
      details: {
        oldBatch: config.batch,
        newBatch,
        retry: retryState.retryCount
      }
    });

    logger.info(`OOM detected for project ${projectId}, will retry with batch size ${newBatch}`);

    try {
      if (this.processes.get(projectId) && this.processes.get(projectId).pid) {
        this.killProcess(this.processes.get(projectId).pid, true);
        logger.info(`Killed old process for project ${projectId}`);
      }
    } catch (e) {
      logger.debug(`Error during cleanup: ${e.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    this.processes.setStatus(projectId, 'idle');
    logger.info(`Reset process status to 'idle' for OOM retry of project ${projectId}`);

    const newConfig = {
      ...config,
      batch: newBatch
    };

    try {
      await this.startTraining(projectId, newConfig, retryState.retryCount);
    } catch (err) {
      logger.error(`Retry failed for project ${projectId}:`, err);
      this.processes.setStatus(projectId, 'failed');
      this.processes.addLog(projectId, {
        type: 'system',
        msg: `❌ 重试失败: ${err.message}`,
        time: Date.now()
      });
    }
  }

  async stop(projectId) {
    const processState = this.processes.get(projectId);
    if (!processState || processState.status !== 'running' || !processState.pid) {
      throw new Error('No running training process found');
    }

    if (this.retryState[projectId]) {
      this.retryState[projectId].isRetrying = false;
    }

    try {
      this.killProcess(processState.pid, true);
      this.processes.setStatus(projectId, 'stopped');
      this.logsV2.setStatus(projectId, 'stopped');
      this.processes.addLog(projectId, {
        type: 'system',
        msg: '用户手动停止训练',
        time: Date.now()
      });
      this.logsV2.appendEvent(projectId, {
        source: 'system',
        level: 'warn',
        stage: 'teardown',
        kind: 'status',
        code: 'TRAIN_STOPPED_BY_USER',
        message: '用户手动停止训练'
      });
      return { success: true };
    } catch (err) {
      logger.error(`Failed to stop training for ${projectId}:`, err);
      throw new Error(`Failed to stop process: ${err.message}`);
    }
  }

  getStatus(projectId) {
    const processState = this.processes.get(projectId);
    const retryState = this.retryState[projectId];

    if (!processState) {
      return { status: 'idle', logs: [], metrics: [] };
    }

    const response = {
      status: processState.status,
      logs: processState.logs.slice(-100),
      metrics: processState.metrics,
      pid: processState.pid,
      startTime: processState.startTime,
      endTime: processState.endTime
    };

    if (retryState) {
      response.retryInfo = {
        retryCount: retryState.retryCount,
        originalBatch: retryState.originalBatch,
        batchHistory: retryState.batchHistory,
        isRetrying: retryState.isRetrying
      };
    }

    return response;
  }

  getQueueStatus() {
    return {
      stats: this.jobQueue.getStats(),
      jobs: this.jobQueue.getAllJobs().map(job => ({
        id: job.id,
        config: job.config,
        priority: job.priority,
        status: job.status,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
        retryCount: job.retryCount
      }))
    };
  }

  async cancelJob(jobId) {
    return this.jobQueue.cancelJob(jobId);
  }

  async removeJob(jobId) {
    return this.jobQueue.removeJob(jobId);
  }

  async reorderQueue(fromIndex, toIndex) {
    return this.jobQueue.reorderJobs(fromIndex, toIndex);
  }

  async clearQueue() {
    return this.jobQueue.clearCompleted();
  }

  watchResultsCSV(projectId, projectPath) {
    const csvPath = path.join(projectPath, 'results.csv');
    let lastSize = 0;
    let epochTimestamps = [];
    const WINDOW_SIZE = 5;

    if (!fs.existsSync(csvPath)) {
      logger.debug(`results.csv not found at ${csvPath}`);
      return null;
    }

    try {
      lastSize = fs.statSync(csvPath).size;
    } catch (e) {
      logger.debug(`Failed to get initial file size: ${e.message}`);
    }

    const watcher = fs.watch(csvPath, (eventType) => {
      if (eventType !== 'change') return;

      setTimeout(() => {
        try {
          const stats = fs.statSync(csvPath);
          const newSize = stats.size;

          if (newSize > lastSize) {
            const stream = fs.createReadStream(csvPath, {
              start: lastSize,
              end: newSize - 1,
              encoding: 'utf-8'
            });

            let newData = '';
            stream.on('data', (chunk) => {
              newData += chunk;
            });

            stream.on('end', () => {
              if (newData.trim()) {
                const lines = newData.trim().split('\n');

                for (const line of lines) {
                  if (line.includes('epoch')) continue;

                  const parts = line.split(',');
                  if (parts.length < 3) continue;

                  const epochMatch = parts[0].trim();
                  const epoch = parseInt(epochMatch);

                  if (isNaN(epoch)) continue;

                  const now = Date.now();
                  if (epochTimestamps.length > 0) {
                    const lastEpochTime = epochTimestamps[epochTimestamps.length - 1];
                    const epochDuration = now - lastEpochTime;

                    epochTimestamps.push(now);

                    if (epochTimestamps.length > WINDOW_SIZE + 10) {
                      epochTimestamps = epochTimestamps.slice(-WINDOW_SIZE);
                    }

                    const recentDurations = epochTimestamps.slice(-WINDOW_SIZE);
                    const avgDuration = recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length;
                    const remainingEpochs = 150 - epoch;
                    const etaSeconds = Math.round(remainingEpochs * avgDuration / 1000);

                    this.processes.addMetric(projectId, {
                      epoch,
                      eta_seconds: etaSeconds,
                      avg_epoch_time: Math.round(avgDuration),
                      time: now
                    });
                  } else {
                    epochTimestamps.push(now);
                  }

                  const metrics = {
                    epoch,
                    time: now
                  };

                  const metricNames = [
                    'train/box_loss', 'train/cls_loss', 'train/dfl_loss',
                    'metrics/precision', 'metrics/recall', 'metrics/map50', 'metrics/map50-95',
                    'val/box_loss', 'val/cls_loss', 'val/dfl_loss'
                  ];

                  metricNames.forEach((name, idx) => {
                    const colIdx = idx + 1;
                    if (parts[colIdx]) {
                      const val = parseFloat(parts[colIdx].trim());
                      if (!isNaN(val)) {
                        metrics[name] = val;
                      }
                    }
                  });

                  this.processes.addMetric(projectId, metrics);
                }
              }
              lastSize = newSize;
            });
          }
        } catch (e) {
          logger.debug(`Error reading CSV: ${e.message}`);
        }
      }, 100);
    });

    watcher.on('error', (err) => {
      logger.error(`CSV watcher error: ${err.message}`);
    });

    return watcher;
  }

  async startDryRun(projectId, config) {
    const runningProcesses = this.processes.getRunning();
    if (runningProcesses.length > 0) {
      return {
        success: false,
        error: '当前已有正在进行的训练任务，无法启动测试运行。请等待当前任务完成或终止后再试。'
      };
    }

    const dryRunConfig = {
      ...config,
      epochs: 1,
      batch: Math.min(config.batch || 16, 2),
      name: (config.name || 'exp_auto') + '_dryrun',
      project: config.project || 'dryrun_test'
    };

    logger.info(`Starting dry run for project ${projectId}`);

    this.processes.addLog(projectId, {
      type: 'system',
      msg: '🔬 开始测试运行 (Dry Run)...',
      time: Date.now()
    });

    this.processes.addLog(projectId, {
      type: 'system',
      msg: `   - Epochs: 1 (正式训练: ${config.epochs})`,
      time: Date.now()
    });

    this.processes.addLog(projectId, {
      type: 'system',
      msg: `   - Batch Size: ${dryRunConfig.batch} (正式训练: ${config.batch})`,
      time: Date.now()
    });

    try {
      await this.startTraining(projectId, dryRunConfig, 0);
      return { success: true, message: 'Dry run started' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = new TrainingService();
