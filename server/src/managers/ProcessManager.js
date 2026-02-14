const EventEmitter = require('events');
const logger = require('../utils/logger');

class ProcessManager extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map();
  }

  create(projectId) {
    this.processes.set(projectId, {
      projectId,
      status: 'idle',
      pid: null,
      logs: [],
      metrics: [],
      startTime: null,
      endTime: null
    });
    return this.get(projectId);
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
    process.logs.push(log);

    const maxLogs = 1000;
    if (process.logs.length > maxLogs) {
      process.logs = process.logs.slice(-maxLogs);
    }

    this.emit('log', { projectId, log });
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

  getLogs(projectId, limit = 100) {
    const process = this.get(projectId);
    const logs = process.logs;
    return logs.slice(-limit);
  }

  getMetrics(projectId) {
    const process = this.get(projectId);
    return process.metrics;
  }

  clear(projectId) {
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
}

module.exports = new ProcessManager();
