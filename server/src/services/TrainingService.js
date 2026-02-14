const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const ProcessManager = require('../managers/ProcessManager');
const PythonEnvService = require('./PythonEnvService');
const settings = require('../config/settings');

const JSON_LOG_PREFIX = '__JSON_LOG__';
const MAX_LOG_LENGTH = 1000;

class TrainingService {
  constructor() {
    this.processes = ProcessManager;
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
      args.push('--mixup', String(config.mixup || 0));
      args.push('--copy_paste', String(config.copy_paste || 0));
      args.push('--erasing', String(config.erasing || 0.4));
      args.push('--crop_fraction', String(config.crop_fraction || 1.0));
    } else {
      args.push('--degrees', '0', '--translate', '0', '--scale', '0');
      args.push('--mosaic', '0');
    }

    return args;
  }

  async start(projectId, config) {
    const existing = this.processes.get(projectId);
    if (existing && existing.status === 'running') {
      throw new Error('Training is already in progress for this project');
    }

    const { cmd: pythonCmd } = await this.getPythonCommand();
    const args = this.buildArgs(config);

    logger.info(`Starting training for project ${projectId}: ${pythonCmd} ${args.join(' ')}`);

    const processState = this.processes.create(projectId);
    this.processes.setStatus(projectId, 'starting');

    const child = spawn(pythonCmd, args, {
      windowsHide: true,
      env: { ...process.env, KMP_DUPLICATE_LIB_OK: 'TRUE' }
    });

    this.processes.setPid(projectId, child.pid);
    this.processes.setStatus(projectId, 'running');

    this.processes.addLog(projectId, {
      type: 'system',
      msg: `Training process started with PID: ${child.pid}`,
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
            this.processes.addLog(projectId, {
              type: 'metric',
              msg: `Epoch ${jsonData.epoch}/${jsonData.epochs}: box_loss=${jsonData.box_loss?.toFixed(4)}, mAP50=${jsonData.mAP50?.toFixed(4)}`,
              time: Date.now()
            });
          } catch (e) {
            logger.debug(`Failed to parse JSON log: ${e.message}`);
          }
        } else {
          this.processes.addLog(projectId, {
            type: 'stdout',
            msg: line.trim(),
            time: Date.now()
          });
        }
      });
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          logger.error(`[Train ${projectId}] ${line}`);
          this.processes.addLog(projectId, {
            type: 'stderr',
            msg: line.trim(),
            time: Date.now()
          });
        }
      });
    });

    child.on('close', (code) => {
      const status = code === 0 ? 'completed' : 'failed';
      this.processes.setStatus(projectId, status);
      this.processes.addLog(projectId, {
        type: 'system',
        msg: `Process exited with code ${code}`,
        time: Date.now()
      });
      logger.info(`Training for project ${projectId} ${status}`);
    });

    child.on('error', (err) => {
      logger.error(`Training process error for ${projectId}:`, err);
      this.processes.setStatus(projectId, 'failed');
      this.processes.addLog(projectId, {
        type: 'system',
        msg: `Failed to start: ${err.message}`,
        time: Date.now()
      });
    });

    return { success: true, pid: child.pid, name: config.name || 'exp_auto' };
  }

  async stop(projectId) {
    const processState = this.processes.get(projectId);
    if (!processState || processState.status !== 'running' || !processState.pid) {
      throw new Error('No running training process found');
    }

    try {
      process.kill(processState.pid);
      this.processes.setStatus(projectId, 'stopped');
      this.processes.addLog(projectId, {
        type: 'system',
        msg: 'Process stopped by user',
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
    if (!processState) {
      return { status: 'idle', logs: [], metrics: [] };
    }
    return {
      status: processState.status,
      logs: processState.logs.slice(-100),
      metrics: processState.metrics,
      pid: processState.pid,
      startTime: processState.startTime,
      endTime: processState.endTime
    };
  }
}

module.exports = new TrainingService();
