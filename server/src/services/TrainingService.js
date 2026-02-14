const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const ProcessManager = require('../managers/ProcessManager');
const JobQueue = require('../managers/JobQueue');
const PythonEnvService = require('./PythonEnvService');
const settings = require('../config/settings');

const JSON_LOG_PREFIX = '__JSON_LOG__';
const MAX_LOG_LENGTH = 1000;
const MAX_OOM_RETRIES = 3;
const OOM_BATCH_DIVISOR = 2;

class TrainingService {
  constructor() {
    this.processes = ProcessManager;
    this.retryState = {};
    this.isShuttingDown = false;
    this.jobQueue = new JobQueue();
    this.csvWatchers = new Map();
    
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

  killAllProcesses() {
    const runningProcesses = this.processes.getRunning();
    logger.info(`Cleaning up ${runningProcesses.length} running processes`);
    
    runningProcesses.forEach(proc => {
      if (proc.pid) {
        try {
          process.kill(proc.pid);
          logger.info(`Killed process ${proc.pid} for project ${proc.projectId}`);
        } catch (e) {
          logger.debug(`Failed to kill process ${proc.pid}: ${e.message}`);
        }
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
          process.kill(proc.pid, 'SIGTERM');
          
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              logger.warn(`Process ${proc.pid} did not exit gracefully, sending SIGKILL`);
              try {
                process.kill(proc.pid, 'SIGKILL');
              } catch (e) {}
              resolve();
            }, 5000);
            
            try {
              process.kill(proc.pid, 'SIGKILL');
            } catch (e) {}
            clearTimeout(timeout);
            resolve();
          });
          
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

  async getPythonCommand() {
    const env = await PythonEnvService.getBestPython();
    if (!env) {
      throw new Error('No valid Python environment found');
    }
    return { cmd: env.path, info: env };
  }

  buildArgs(config) {
    const args = [
      path.join(__dirname, '..', '..', 'scripts', 'train.py'),
      '--data', config.data,
      '--model', config.model,
      '--epochs', String(config.epochs),
      '--batch', String(config.batch),
      '--imgsz', String(config.imgsz),
      '--project', config.project || '',
      '--name', config.name || 'exp_auto',
      '--device', config.device || '0',
      '--workers', String(config.workers || 0)
    ];

    if (config.resume === true) {
      args.push('--resume');
    }

    if (config.cache_images) args.push('--cache_images');
    args.push('--patience', String(config.patience || 60));
    if (config.cos_lr) args.push('--cos_lr');
    args.push('--optimizer', config.optimizer || 'auto');
    if (config.rect) args.push('--rect');

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

    args.push('--loss_pose', String(config.loss_pose || 25.0));
    args.push('--loss_box', String(config.loss_box || 7.5));
    args.push('--loss_cls', String(config.loss_cls || 0.5));

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

  async start(projectId, config) {
    const existing = this.processes.get(projectId);
    if (existing && existing.status === 'running') {
      return this.addToQueue({ ...config, project: projectId }, config.priority || 0);
    }
    
    return this.startTraining(projectId, config, 0);
  }

  async startTraining(projectId, config, retryCount = 0) {
    const existing = this.processes.get(projectId);
    if (existing && existing.status === 'running') {
      throw new Error('Training is already in progress for this project');
    }

    const { cmd: pythonCmd } = await this.getPythonCommand();
    const args = this.buildArgs(config);

    logger.info(`Starting training for project ${projectId} (attempt ${retryCount + 1}): ${pythonCmd} ${args.join(' ')}`);

    if (retryCount > 0) {
      this.processes.addLog(projectId, {
        type: 'system',
        msg: `🔄 重试训练 (尝试 ${retryCount + 1}/${MAX_OOM_RETRIES + 1})，Batch Size: ${config.batch}`,
        time: Date.now()
      });
    }

    const processState = this.processes.create(projectId);
    this.processes.setStatus(projectId, 'starting');

    const projectPath = config.project || '';
    const csvWatcher = this.watchResultsCSV(projectId, projectPath);
    if (csvWatcher) {
      this.csvWatchers.set(projectId, csvWatcher);
    }

    const child = spawn(pythonCmd, args, {
      windowsHide: true,
      env: { ...process.env, KMP_DUPLICATE_LIB_OK: 'TRUE' }
    });

    this.processes.setPid(projectId, child.pid);
    this.processes.setStatus(projectId, 'running');

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
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (!line.trim()) return;

        if (line.startsWith(JSON_LOG_PREFIX)) {
          try {
            const jsonData = JSON.parse(line.slice(JSON_LOG_PREFIX.length));
            this.processes.addMetric(projectId, {
              ...jsonData,
              time: Date.now()
            });
            
            if (jsonData.event === 'epoch_end') {
              this.processes.addLog(projectId, {
                type: 'metric',
                msg: `Epoch ${jsonData.epoch}/${jsonData.epochs}: box_loss=${jsonData.box_loss?.toFixed(4)}, mAP50=${jsonData.mAP50?.toFixed(4)}`,
                time: Date.now()
              });
            }
            
            if (jsonData.event === 'validation_complete') {
              this.processes.addLog(projectId, {
                type: 'metric',
                msg: `✅ 验证完成 - mAP50: ${jsonData.metrics?.mAP50?.toFixed(4) || '--'}, Precision: ${jsonData.metrics?.precision?.toFixed(4) || '--'}`,
                time: Date.now()
              });
            }
          } catch (e) {
            logger.debug(`Failed to parse JSON log: ${e.message}`);
          }
        } else {
          const trimmed = line.trim();
          this.processes.addLog(projectId, {
            type: 'stdout',
            msg: trimmed,
            time: Date.now()
          });

          const metricMatch = trimmed.match(/^(\d+)\/(\d+)\s+([\d.]+G)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
          if (metricMatch) {
            const [full, epoch, totalEpochs, gpuMem, boxLoss, clsLoss, dflLoss] = metricMatch;
            this.processes.addMetric(projectId, {
              epoch: parseInt(epoch),
              totalEpochs: parseInt(totalEpochs),
              gpu_mem: gpuMem,
              box_loss: parseFloat(boxLoss),
              cls_loss: parseFloat(clsLoss),
              dfl_loss: parseFloat(dflLoss),
              time: Date.now()
            });
          }

          const mapMatch = trimmed.match(/^all\s+\d+\s+\d+\s+[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/);
          if (mapMatch) {
            const map50 = parseFloat(mapMatch[1]);
            const map50_95 = parseFloat(mapMatch[2]);
            this.processes.addMetric(projectId, {
              mAP50: map50,
              mAP50_95: map50_95,
              time: Date.now()
            });
          }
        }
      });
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          const trimmed = line.trim();
          logger.error(`[Train ${projectId}] ${trimmed}`);
          
          let errorType = null;
          let errorSuggestions = [];
          const lowerLine = trimmed.toLowerCase();
          
          if (this.isOOMError(trimmed)) {
            errorType = '显存不足 (OOM)';
            errorSuggestions = [
              '减小 batch_size 参数',
              '减小 imgsz 图片尺寸',
              '尝试使用更小的模型'
            ];
            
            this.processes.addLog(projectId, {
              type: 'error',
              msg: `⚠️ 检测到显存不足 (OOM) 错误！`,
              time: Date.now()
            });
            
            this.handleOOMError(projectId, config, retryCount);
          }
          else if (lowerLine.includes('no cuda gpu') || lowerLine.includes('no gpu') || lowerLine.includes('cuda is not available')) {
            errorType = 'GPU 不可用';
            errorSuggestions = [
              '请确认已正确安装 NVIDIA 显卡驱动',
              '将 device 参数改为 cpu 使用 CPU 模式'
            ];
          }
          else if (lowerLine.includes('cuda') && (lowerLine.includes('error') || lowerLine.includes('failed'))) {
            errorType = 'CUDA 相关错误';
            errorSuggestions = [
              '可能是 CUDA 版本与显卡驱动不匹配',
              '尝试更新 NVIDIA 驱动到最新版本'
            ];
          }
          
          let displayMsg = trimmed;
          if (errorType) {
            displayMsg = `[${errorType}] ${trimmed}`;
            if (errorSuggestions.length > 0) {
              this.processes.addLog(projectId, {
                type: 'suggestion',
                msg: `💡 建议: ${errorSuggestions.join('; ')}`,
                time: Date.now()
              });
            }
          }
          
          this.processes.addLog(projectId, {
            type: 'stderr',
            msg: displayMsg,
            time: Date.now()
          });
        }
      });
    });

    child.on('close', (code) => {
      const retryState = this.retryState[projectId];
      
      const watcher = this.csvWatchers.get(projectId);
      if (watcher) {
        watcher.close();
        this.csvWatchers.delete(projectId);
        logger.debug(`Closed CSV watcher for project ${projectId}`);
      }
      
      if (code === 0) {
        const status = 'completed';
        this.processes.setStatus(projectId, status);
        this.processes.addLog(projectId, {
          type: 'system',
          msg: `✅ 训练完成！进程退出码: ${code}`,
          time: Date.now()
        });
        logger.info(`Training for project ${projectId} ${status}`);
      } 
      else if (retryState && retryState.isRetrying && retryState.retryCount <= MAX_OOM_RETRIES) {
        logger.info(`Waiting for OOM retry for project ${projectId}`);
      }
      else {
        const status = 'failed';
        this.processes.setStatus(projectId, status);
        this.processes.addLog(projectId, {
          type: 'system',
          msg: `❌ 训练失败！进程退出码: ${code}`,
          time: Date.now()
        });
        logger.info(`Training for project ${projectId} ${status}`);
      }
      
      delete this.retryState[projectId];
    });

    child.on('error', (err) => {
      logger.error(`Training process error for ${projectId}:`, err);
      this.processes.setStatus(projectId, 'failed');
      this.processes.addLog(projectId, {
        type: 'system',
        msg: `启动失败: ${err.message}`,
        time: Date.now()
      });
    });

    return { success: true, pid: child.pid, name: config.name || 'exp_auto', batch: config.batch };
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

    logger.info(`OOM detected for project ${projectId}, will retry with batch size ${newBatch}`);

    try {
      if (this.processes.get(projectId) && this.processes.get(projectId).pid) {
        try {
          process.kill(this.processes.get(projectId).pid);
          logger.info(`Killed old process for project ${projectId}`);
        } catch (e) {
          logger.debug(`Error killing process: ${e.message}`);
        }
      }
    } catch (e) {
      logger.debug(`Error during cleanup: ${e.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

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
      process.kill(processState.pid);
      this.processes.setStatus(projectId, 'stopped');
      this.processes.addLog(projectId, {
        type: 'system',
        msg: '用户手动停止训练',
        time: Date.now()
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
    });

    watcher.on('error', (err) => {
      logger.error(`CSV watcher error: ${err.message}`);
    });

    return watcher;
  }

  async startDryRun(projectId, config) {
    const dryRunConfig = {
      ...config,
      epochs: 1,
      batch: Math.min(config.batch || 16, 2),
      name: (config.name || 'exp') + '_dryrun',
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
