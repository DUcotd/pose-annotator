const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const DEFAULT_LOG_DIR = path.join(__dirname, '..', '..', 'data', 'training_logs');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_MEMORY_LOGS = 500;

class ProcessManager extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map();
    this.fileHandles = new Map();
    this.projectPaths = new Map();
  }

  ensureLogDir(logDir) {
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (err) {
      logger.error('Failed to create log directory:', err);
    }
  }

  setProjectPath(projectId, projectPath) {
    this.projectPaths.set(projectId, projectPath);
  }

  getLogFilePath(projectId, name = 'exp') {
    const projectPath = this.projectPaths.get(projectId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (projectPath) {
      const logDir = path.join(projectPath, 'logs', 'raw');
      this.ensureLogDir(logDir);
      return path.join(logDir, `training_${timestamp}.log`);
    }

    this.ensureLogDir(DEFAULT_LOG_DIR);
    return path.join(DEFAULT_LOG_DIR, `training_${projectId}_${timestamp}.log`);
  }

  create(projectId, projectPath = null) {
    if (projectPath) {
      this.setProjectPath(projectId, projectPath);
    }

    const logPath = this.getLogFilePath(projectId);

    this.processes.set(projectId, {
      projectId,
      status: 'idle',
      pid: null,
      logs: [],
      metrics: [],
      errorLogs: [],
      startTime: null,
      endTime: null,
      logFile: logPath
    });

    this.initLogFile(projectId, logPath);

    return this.get(projectId);
  }

  initLogFile(projectId, logPath) {
    try {
      const handle = fs.openSync(logPath, 'a');
      this.fileHandles.set(projectId, handle);

      const header = `\n${'='.repeat(60)}
Training Session Started: ${new Date().toISOString()}
Project ID: ${projectId}
${'='.repeat(60)}\n`;
      fs.writeSync(handle, header);

    } catch (err) {
      logger.error(`Failed to initialize log file for ${projectId}:`, err);
    }
  }

  writeToFile(projectId, message) {
    const handle = this.fileHandles.get(projectId);
    if (!handle) return;

    try {
      const stats = fs.fstatSync(handle);
      if (stats.size > MAX_FILE_SIZE) {
        this.rotateLogFile(projectId);
      }

      const timestamp = new Date().toISOString();
      fs.writeSync(handle, `[${timestamp}] ${message}\n`);
    } catch (err) {
      logger.debug(`Failed to write to log file: ${err.message}`);
    }
  }

  rotateLogFile(projectId) {
    const handle = this.fileHandles.get(projectId);
    const process = this.processes.get(projectId);
    if (!handle || !process) return;

    try {
      fs.closeSync(handle);

      const logPath = process.logFile;
      const rotatedPath = logPath.replace('.log', `_${Date.now()}.log`);

      fs.renameSync(logPath, rotatedPath);

      const newHandle = fs.openSync(logPath, 'a');
      this.fileHandles.set(projectId, newHandle);
      process.logFile = logPath;

      logger.info(`Rotated log file for ${projectId}`);
    } catch (err) {
      logger.error(`Failed to rotate log file: ${err.message}`);
    }
  }

  closeLogFile(projectId) {
    const handle = this.fileHandles.get(projectId);
    if (handle) {
      try {
        const footer = `\n${'='.repeat(60)}
Training Session Ended: ${new Date().toISOString()}
${'='.repeat(60)}\n`;
        fs.writeSync(handle, footer);
        fs.closeSync(handle);
      } catch (err) {
        logger.debug(`Error closing log file: ${err.message}`);
      }
      this.fileHandles.delete(projectId);
    }
  }

  get(projectId) {
    if (!this.processes.has(projectId)) {
      return this.create(projectId);
    }
    return this.processes.get(projectId);
  }

  setStatus(projectId, status) {
    const process = this.get(projectId);
    process.status = status;
    if (status === 'running' && !process.startTime) {
      process.startTime = Date.now();
    } else if (status === 'completed' || status === 'failed' || status === 'stopped') {
      process.endTime = Date.now();
      this.closeLogFile(projectId);
    }
    this.emit('statusChange', { projectId, status });
    return process;
  }

  setPid(projectId, pid) {
    const process = this.get(projectId);
    process.pid = pid;
    return process;
  }

  addLog(projectId, log) {
    const process = this.get(projectId);

    let logMessage;
    if (typeof log === 'object') {
      logMessage = `[${log.type || 'info'}] ${log.msg || JSON.stringify(log)}`;
    } else {
      logMessage = String(log);
    }

    const logEntry = {
      ...(typeof log === 'object' ? log : { type: 'info', msg: log }),
      time: log.time || Date.now()
    };

    process.logs.push(logEntry);

    if (process.logs.length > MAX_MEMORY_LOGS) {
      process.logs = process.logs.slice(-MAX_MEMORY_LOGS);
    }

    this.writeToFile(projectId, logMessage);

    this.emit('log', { projectId, log: logEntry });
    return process;
  }

  addMetric(projectId, metric) {
    const process = this.get(projectId);
    const existingIdx = process.metrics.findIndex(m => m.epoch === metric.epoch);

    if (existingIdx !== -1) {
      process.metrics[existingIdx] = { ...process.metrics[existingIdx], ...metric };
    } else {
      process.metrics.push(metric);
    }

    this.emit('metric', { projectId, metric });
    return process;
  }

  setErrorLogs(projectId, errorLogs) {
    const process = this.get(projectId);
    process.errorLogs = errorLogs;
    return process;
  }

  addErrorLog(projectId, errorLog) {
    const process = this.get(projectId);
    process.errorLogs.push(errorLog);
    if (process.errorLogs.length > 50) {
      process.errorLogs = process.errorLogs.slice(-50);
    }
    return process;
  }

  getErrorLogs(projectId) {
    const process = this.get(projectId);
    return process.errorLogs || [];
  }

  getLogs(projectId, limit = 100, useFile = false) {
    const process = this.get(projectId);

    if (useFile) {
      return this.readLogsFromFile(projectId, limit);
    }

    const logs = process.logs;
    return logs.slice(-limit);
  }

  readLogsFromFile(projectId, limit = 100) {
    const process = this.get(projectId);
    const logPath = process.logFile || this.getLogFilePath(projectId);

    try {
      if (!fs.existsSync(logPath)) {
        return [];
      }

      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      return lines.slice(-limit).map(line => {
        const match = line.match(/^\[(.+?)\]\s*(.+)$/);
        if (match) {
          return {
            time: new Date(match[1]).getTime() || Date.now(),
            msg: match[2],
            type: 'file'
          };
        }
        return { time: Date.now(), msg: line, type: 'file' };
      });
    } catch (err) {
      logger.error(`Failed to read log file: ${err.message}`);
      return [];
    }
  }

  searchLogs(projectId, keyword, useFile = false) {
    const logs = useFile ? this.readLogsFromFile(projectId, 10000) : this.get(projectId).logs;

    return logs.filter(log => {
      const msg = typeof log === 'string' ? log : (log.msg || JSON.stringify(log));
      return msg.toLowerCase().includes(keyword.toLowerCase());
    });
  }

  getLogsByTimeRange(projectId, startTime, endTime, useFile = false) {
    const logs = useFile ? this.readLogsFromFile(projectId, 10000) : this.get(projectId).logs;

    return logs.filter(log => {
      const logTime = log.time || Date.now();
      return logTime >= startTime && logTime <= endTime;
    });
  }

  getMetrics(projectId) {
    const process = this.get(projectId);
    return process.metrics;
  }

  clear(projectId) {
    this.closeLogFile(projectId);
    this.projectPaths.delete(projectId);

    if (this.processes.has(projectId)) {
      this.processes.delete(projectId);
    }
  }

  getAll() {
    return Array.from(this.processes.values());
  }

  getRunning() {
    return Array.from(this.processes.values()).filter(p => p.status === 'running');
  }

  getLogStats(projectId) {
    const process = this.get(projectId);
    const logPath = process.logFile || this.getLogFilePath(projectId);

    let fileSize = 0;
    let fileLineCount = 0;

    try {
      if (fs.existsSync(logPath)) {
        const stats = fs.statSync(logPath);
        fileSize = stats.size;

        const content = fs.readFileSync(logPath, 'utf-8');
        fileLineCount = content.split('\n').length;
      }
    } catch (err) {
      logger.debug(`Failed to get log stats: ${err.message}`);
    }

    return {
      memoryLogCount: process.logs.length,
      fileSize,
      fileLineCount,
      logFilePath: logPath
    };
  }

  cleanString(str) {
    if (typeof str !== 'string') return str;

    let cleaned = str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

    cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');

    return cleaned.trim();
  }

  getStatusText(status) {
    const statusMap = {
      'idle': '空闲',
      'starting': '启动中',
      'running': '运行中',
      'completed': '已完成',
      'failed': '失败',
      'stopped': '已停止'
    };
    return statusMap[status] || status;
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours} 小时 ${minutes} 分钟 ${secs} 秒`;
    if (minutes > 0) return `${minutes} 分钟 ${secs} 秒`;
    return `${secs} 秒`;
  }

  padRight(str, length) {
    const chineseCount = (str.match(/[\u4e00-\u9fa5]/g) || []).length;
    const actualLength = str.length + chineseCount;
    return str + ' '.repeat(Math.max(0, length - actualLength));
  }

  deduplicateLogs(logs) {
    return logs.filter((log, index, self) =>
      index === self.findIndex(l => l.time === log.time && l.msg === log.msg)
    ).sort((a, b) => (a.time || 0) - (b.time || 0));
  }

  groupLogsByType(logs) {
    const groups = {};
    logs.forEach(log => {
      const type = log.type || 'info';
      if (!groups[type]) groups[type] = [];
      groups[type].push(log);
    });
    return groups;
  }

  exportLogsAsText(projectId, options = {}) {
    const process = this.get(projectId);
    const { includeMetrics = true, includeConfig = true, includeTimestamps = true, format = 'text' } = options;

    const lines = [];
    const separator = '═'.repeat(80);
    const subSeparator = '─'.repeat(40);

    lines.push(separator);
    lines.push('                    训练日志导出报告');
    lines.push(separator);
    lines.push('');

    lines.push('📋 基本信息');
    lines.push(subSeparator);
    lines.push(`项目 ID: ${projectId}`);
    lines.push(`导出时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
    lines.push(`训练状态: ${this.getStatusText(process.status)}`);

    if (process.startTime) {
      lines.push(`开始时间: ${new Date(process.startTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
    }
    if (process.endTime) {
      lines.push(`结束时间: ${new Date(process.endTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
      const duration = Math.round((process.endTime - process.startTime) / 1000);
      lines.push(`训练时长: ${this.formatDuration(duration)}`);
    }
    lines.push('');

    // --- 关键错误分析 (Critical Error Analysis) ---
    // If the process failed, prioritizing detailed error info is crucial.
    if (process.status === 'failed' || process.errorLogs.length > 0) {
      lines.push('🛑 关键错误分析 (CRITICAL ERRORS)');
      lines.push(subSeparator);

      // 1. Check for captured Traceback blocks (most important)
      const allLogs = [...this.readLogsFromFile(projectId, 2000), ...process.logs];
      const tracebackLines = [];
      let capturingTraceback = false;

      // Scan specifically for Python tracebacks in recent logs
      // We scan from the end backwards to find the last error, or just scan all and filter
      // Better to scan all efficiently.
      for (const log of allLogs) {
        const msg = (log.msg || String(log));
        if (msg.includes('Traceback (most recent call last):')) {
          capturingTraceback = true;
          tracebackLines.push('\n--- PYTHON TRACEBACK START ---');
        }

        if (capturingTraceback) {
          tracebackLines.push(this.cleanString(msg));
          // Heuristic to stop capturing if we hit a new log prefix that isn't indented
          // Python tracebacks usually are indented except for the start errors.
          // But mixed output makes this hard. We'll capture until next explicit known system log or enough lines.
        }

        // Reset if we see a clear system log start, but be careful not to cut off the error
        if (capturingTraceback && (msg.startsWith('Training completed') || msg.includes('Training failed'))) {
          capturingTraceback = false;
          tracebackLines.push('--- PYTHON TRACEBACK END ---\n');
        }
      }

      if (tracebackLines.length > 0) {
        lines.push('检测到 Python 堆栈跟踪 (Traceback):');
        lines.push('```');
        lines.push(tracebackLines.join('\n'));
        lines.push('```');
        lines.push('');
      }

      // 2. Print collected raw error logs (stderr)
      const errorLogs = process.errorLogs || [];
      if (errorLogs.length > 0) {
        lines.push('最近的 stderr 错误输出:');
        errorLogs.slice(-20).forEach(err => {
          lines.push(`  > ${err}`);
        });
        lines.push('');
      }

      lines.push('');
    }

    if (includeMetrics && process.metrics.length > 0) {
      lines.push('📊 训练指标');
      lines.push(subSeparator);

      const header = this.padRight('Epoch', 8) +
        this.padRight('Box Loss', 12) +
        this.padRight('Pose Loss', 12) +
        this.padRight('mAP@50', 10) +
        this.padRight('mAP@50-95', 10) +
        this.padRight('LR', 14);
      lines.push(header);
      lines.push('─'.repeat(header.length));

      process.metrics.forEach(m => {
        const epoch = this.padRight(String(m.epoch || '-'), 8);
        const boxLoss = this.padRight(m.box_loss !== undefined ? m.box_loss.toFixed(4) : '-', 12);
        const poseLoss = this.padRight(m.pose_loss !== undefined ? m.pose_loss.toFixed(4) : '-', 12);
        const map50 = this.padRight(m.mAP50 !== undefined ? (m.mAP50 * 100).toFixed(2) + '%' : '-', 10);
        const map5095 = this.padRight(m.mAP50_95 !== undefined ? (m.mAP50_95 * 100).toFixed(2) + '%' : '-', 10);
        const lr = this.padRight(m.learning_rate !== undefined ? m.learning_rate.toExponential(4) : '-', 14);
        lines.push(`${epoch}${boxLoss}${poseLoss}${map50}${map5095}${lr}`);
      });
      lines.push('');

      const latest = process.metrics[process.metrics.length - 1];
      if (latest) {
        lines.push('📈 最终指标摘要');
        lines.push(subSeparator);
        if (latest.mAP50 !== undefined) lines.push(`  Box mAP@50: ${(latest.mAP50 * 100).toFixed(2)}%`);
        if (latest.mAP50_95 !== undefined) lines.push(`  Box mAP@50-95: ${(latest.mAP50_95 * 100).toFixed(2)}%`);
        if (latest.pose_mAP50 !== undefined) lines.push(`  Pose mAP@50: ${(latest.pose_mAP50 * 100).toFixed(2)}%`);
        if (latest.box_loss !== undefined) lines.push(`  最终 Box Loss: ${latest.box_loss.toFixed(4)}`);
        if (latest.pose_loss !== undefined) lines.push(`  最终 Pose Loss: ${latest.pose_loss.toFixed(4)}`);
        lines.push('');
      }
    }

    lines.push('📝 训练日志 (完整)');
    lines.push(subSeparator);

    const logs = this.readLogsFromFile(projectId, 10000);
    const allLogs = [...logs, ...process.logs];
    const uniqueLogs = this.deduplicateLogs(allLogs);

    // Grouping is good, but for debugging, chronological order is often better.
    // However, the user specifically hated the "useless info". 
    // Let's provide a chronological tail of the logs, including stderr.

    const groupedLogs = this.groupLogsByType(uniqueLogs);
    if (groupedLogs.suggestion && groupedLogs.suggestion.length > 0) {
      lines.push('💡 智能建议 (AI Suggestions)');
      groupedLogs.suggestion.forEach(log => {
        lines.push(this.cleanString(log.msg || String(log)));
      });
      lines.push('');
    }

    lines.push('📄 详细运行日志 (最近 200 条)');
    const tailLogs = uniqueLogs.slice(-200);
    tailLogs.forEach(log => {
      const timeStr = includeTimestamps
        ? `[${new Date(log.time || Date.now()).toLocaleTimeString('zh-CN', { hour12: false })}] `
        : '';

      let prefix = '';
      if (log.type === 'error' || log.type === 'stderr') prefix = '🔴 ';
      else if (log.type === 'warning') prefix = '⚠️ ';
      else if (log.type === 'system') prefix = '⚙️ ';

      const msg = this.cleanString(log.msg || String(log));
      lines.push(`${timeStr}${prefix}${msg}`);
    });

    lines.push('');
    lines.push(separator);
    lines.push('                       报告结束');
    lines.push(separator);

    return lines.join('\n');
  }

  exportLogsAsJson(projectId, options = {}) {
    const process = this.get(projectId);
    const { includeMetrics = true, includeLogs = true } = options;

    const exportData = {
      meta: {
        projectId,
        exportTime: new Date().toISOString(),
        status: process.status,
        startTime: process.startTime ? new Date(process.startTime).toISOString() : null,
        endTime: process.endTime ? new Date(process.endTime).toISOString() : null,
        duration: process.startTime && process.endTime
          ? Math.round((process.endTime - process.startTime) / 1000)
          : null
      }
    };

    if (includeMetrics) {
      exportData.metrics = process.metrics.map(m => ({
        epoch: m.epoch,
        timestamp: m.time ? new Date(m.time).toISOString() : null,
        losses: {
          box: m.box_loss,
          pose: m.pose_loss,
          cls: m.cls_loss,
          dfl: m.dfl_loss,
          kobj: m.kobj_loss
        },
        performance: {
          mAP50: m.mAP50,
          mAP50_95: m.mAP50_95,
          pose_mAP50: m.pose_mAP50,
          pose_mAP50_95: m.pose_mAP50_95,
          precision: m.box_precision || m.precision,
          recall: m.box_recall || m.recall
        },
        gpu: {
          memoryUsedGB: m.gpu_memory_used_gb,
          memoryPercent: m.gpu_memory_percent,
          utilization: m.gpu_utilization_percent,
          temperature: m.gpu_temperature
        },
        learning: {
          learningRate: m.learning_rate,
          etaSeconds: m.eta_seconds
        }
      }));
    }

    if (includeLogs) {
      const logs = this.readLogsFromFile(projectId, 10000);
      const allLogs = [...logs, ...process.logs];
      const uniqueLogs = this.deduplicateLogs(allLogs);

      exportData.logs = uniqueLogs.map(log => ({
        timestamp: log.time ? new Date(log.time).toISOString() : null,
        type: log.type || 'info',
        message: this.cleanString(log.msg || String(log))
      }));
    }

    return JSON.stringify(exportData, null, 2);
  }

  generateTrainingReport(projectId) {
    const process = this.get(projectId);
    const latest = process.metrics[process.metrics.length - 1] || {};

    const report = {
      title: '训练报告',
      generatedAt: new Date().toISOString(),
      projectId,
      status: process.status,

      summary: {
        startTime: process.startTime ? new Date(process.startTime).toISOString() : null,
        endTime: process.endTime ? new Date(process.endTime).toISOString() : null,
        duration: process.startTime && process.endTime
          ? this.formatDuration(Math.round((process.endTime - process.startTime) / 1000))
          : null,
        totalEpochs: latest.totalEpochs || latest.epochs || null,
        completedEpochs: latest.epoch || null
      },

      finalMetrics: {
        box: {
          mAP50: latest.mAP50,
          mAP50_95: latest.mAP50_95,
          precision: latest.box_precision || latest.precision,
          recall: latest.box_recall || latest.recall
        },
        pose: {
          mAP50: latest.pose_mAP50,
          mAP50_95: latest.pose_mAP50_95,
          precision: latest.pose_precision,
          recall: latest.pose_recall
        },
        losses: {
          box: latest.box_loss,
          pose: latest.pose_loss,
          cls: latest.cls_loss,
          dfl: latest.dfl_loss
        }
      },

      gpu: {
        avgMemoryPercent: process.metrics.reduce((sum, m) => sum + (m.gpu_memory_percent || 0), 0) / process.metrics.length,
        maxMemoryPercent: Math.max(...process.metrics.map(m => m.gpu_memory_percent || 0)),
        avgUtilization: process.metrics.reduce((sum, m) => sum + (m.gpu_utilization_percent || 0), 0) / process.metrics.length
      },

      errors: process.logs.filter(l => l.type === 'error').map(l => l.msg),
      warnings: process.logs.filter(l => l.type === 'warning' || l.type === 'suggestion').map(l => l.msg)
    };

    return report;
  }

  saveLogsToFile(projectId, outputPath, options = {}) {
    const format = options.format || 'text';

    let content;
    if (format === 'json') {
      content = this.exportLogsAsJson(projectId, options);
    } else if (format === 'report') {
      content = JSON.stringify(this.generateTrainingReport(projectId), null, 2);
    } else {
      content = this.exportLogsAsText(projectId, options);
    }

    try {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(outputPath, content, 'utf-8');

      logger.info(`Logs exported to: ${outputPath}`);
      return { success: true, path: outputPath, size: content.length, format };
    } catch (err) {
      logger.error(`Failed to export logs: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new ProcessManager();
