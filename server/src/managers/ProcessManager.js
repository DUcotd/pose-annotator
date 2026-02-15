const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const LOG_DIR = path.join(__dirname, '..', '..', 'data', 'training_logs');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_MEMORY_LOGS = 500;

class ProcessManager extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map();
    this.fileHandles = new Map();
    this.ensureLogDir();
  }

  ensureLogDir() {
    try {
      if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
      }
    } catch (err) {
      logger.error('Failed to create log directory:', err);
    }
  }

  getLogFilePath(projectId, name = 'exp') {
    return path.join(LOG_DIR, `${projectId}_${name}_train.log`);
  }

  create(projectId) {
    const logPath = this.getLogFilePath(projectId);
    
    this.processes.set(projectId, {
      projectId,
      status: 'idle',
      pid: null,
      logs: [],
      metrics: [],
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
    if (!handle) return;
    
    try {
      fs.closeSync(handle);
      
      const logPath = this.getLogFilePath(projectId);
      const rotatedPath = logPath.replace('.log', `_${Date.now()}.log`);
      
      fs.renameSync(logPath, rotatedPath);
      
      const newHandle = fs.openSync(logPath, 'a');
      this.fileHandles.set(projectId, newHandle);
      
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

  getLogs(projectId, limit = 100, useFile = false) {
    const process = this.get(projectId);
    
    if (useFile) {
      return this.readLogsFromFile(projectId, limit);
    }
    
    const logs = process.logs;
    return logs.slice(-limit);
  }

  readLogsFromFile(projectId, limit = 100) {
    const logPath = this.getLogFilePath(projectId);
    
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
    const logPath = this.getLogFilePath(projectId);
    
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

  exportLogsAsText(projectId, options = {}) {
    const process = this.get(projectId);
    const { includeMetrics = true, includeConfig = true, includeTimestamps = true } = options;
    
    const lines = [];
    
    lines.push('='.repeat(80));
    lines.push('训练日志导出报告');
    lines.push('='.repeat(80));
    lines.push('');
    
    lines.push('基本信息');
    lines.push('-'.repeat(40));
    lines.push(`项目ID: ${projectId}`);
    lines.push(`导出时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
    lines.push(`训练状态: ${process.status}`);
    
    if (process.startTime) {
      lines.push(`开始时间: ${new Date(process.startTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
    }
    if (process.endTime) {
      lines.push(`结束时间: ${new Date(process.endTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
      const duration = Math.round((process.endTime - process.startTime) / 1000);
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      const seconds = duration % 60;
      lines.push(`训练时长: ${hours}小时 ${minutes}分钟 ${seconds}秒`);
    }
    lines.push('');
    
    if (includeMetrics && process.metrics.length > 0) {
      lines.push('训练指标');
      lines.push('-'.repeat(40));
      
      const header = 'Epoch'.padEnd(8) + 'Train Loss'.padEnd(14) + 'Val Loss'.padEnd(14) + 
                     'mAP50'.padEnd(12) + 'mAP50-95'.padEnd(12) + 'LR'.padEnd(14);
      lines.push(header);
      lines.push('-'.repeat(header.length));
      
      process.metrics.forEach(m => {
        const epoch = String(m.epoch || '-').padEnd(8);
        const trainLoss = (m.train_loss !== undefined ? m.train_loss.toFixed(4) : '-').padEnd(14);
        const valLoss = (m.val_loss !== undefined ? m.val_loss.toFixed(4) : '-').padEnd(14);
        const map50 = (m.map50 !== undefined ? (m.map50 * 100).toFixed(2) + '%' : '-').padEnd(12);
        const map5095 = (m.map5095 !== undefined ? (m.map5095 * 100).toFixed(2) + '%' : '-').padEnd(12);
        const lr = (m.lr !== undefined ? m.lr.toExponential(4) : '-').padEnd(14);
        lines.push(`${epoch}${trainLoss}${valLoss}${map50}${map5095}${lr}`);
      });
      lines.push('');
    }
    
    lines.push('训练日志');
    lines.push('-'.repeat(40));
    
    const logs = this.readLogsFromFile(projectId, 10000);
    const allLogs = [...logs, ...process.logs];
    const uniqueLogs = allLogs.filter((log, index, self) => 
      index === self.findIndex(l => l.time === log.time && l.msg === log.msg)
    ).sort((a, b) => (a.time || 0) - (b.time || 0));
    
    uniqueLogs.forEach(log => {
      const time = includeTimestamps 
        ? `[${new Date(log.time || Date.now()).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}] `
        : '';
      const type = log.type ? `[${log.type.toUpperCase()}] ` : '';
      const msg = typeof log.msg === 'object' ? JSON.stringify(log.msg) : (log.msg || String(log));
      lines.push(`${time}${type}${msg}`);
    });
    
    lines.push('');
    lines.push('='.repeat(80));
    lines.push('报告结束');
    lines.push('='.repeat(80));
    
    return lines.join('\n');
  }

  saveLogsToFile(projectId, outputPath, options = {}) {
    const content = this.exportLogsAsText(projectId, options);
    
    try {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, content, 'utf-8');
      
      logger.info(`Logs exported to: ${outputPath}`);
      return { success: true, path: outputPath, size: content.length };
    } catch (err) {
      logger.error(`Failed to export logs: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new ProcessManager();
