const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

class JobQueue {
  constructor(storagePath = null) {
    this.jobs = new Map();
    this.storagePath = storagePath || path.join(__dirname, '..', '..', 'data', 'job_queue.json');
    this.currentJobId = null;
    this.listeners = new Set();
    
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf-8');
        const parsed = JSON.parse(data);
        
        if (parsed.jobs) {
          for (const [id, job] of Object.entries(parsed.jobs)) {
            if (job.status !== JOB_STATUS.COMPLETED && job.status !== JOB_STATUS.CANCELLED) {
              job.status = JOB_STATUS.PENDING;
              this.jobs.set(id, job);
            }
          }
        }
        
        this.currentJobId = parsed.currentJobId || null;
        logger.info(`Loaded ${this.jobs.size} jobs from disk`);
      }
    } catch (err) {
      logger.error('Failed to load job queue from disk:', err);
    }
  }

  saveToDisk() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const jobsObj = {};
      for (const [id, job] of this.jobs) {
        jobsObj[id] = job;
      }
      
      const data = JSON.stringify({
        jobs: jobsObj,
        currentJobId: this.currentJobId
      }, null, 2);
      
      fs.writeFileSync(this.storagePath, data, 'utf-8');
    } catch (err) {
      logger.error('Failed to save job queue to disk:', err);
    }
  }

  addJob(config, priority = 0) {
    const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job = {
      id,
      config,
      priority,
      status: JOB_STATUS.PENDING,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      error: null,
      retryCount: 0,
      maxRetries: config.maxRetries || 0
    };
    
    this.jobs.set(id, job);
    this.saveToDisk();
    
    this.emit('jobAdded', job);
    logger.info(`Job ${id} added to queue with priority ${priority}`);
    
    return job;
  }

  getJob(id) {
    return this.jobs.get(id);
  }

  getAllJobs() {
    return Array.from(this.jobs.values()).sort((a, b) => {
      if (a.status === JOB_STATUS.RUNNING && b.status !== JOB_STATUS.RUNNING) return -1;
      if (b.status === JOB_STATUS.RUNNING && a.status !== JOB_STATUS.RUNNING) return 1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.createdAt - b.createdAt;
    });
  }

  getPendingJobs() {
    return this.getAllJobs().filter(j => j.status === JOB_STATUS.PENDING);
  }

  getNextJob() {
    const pending = this.getPendingJobs();
    return pending.length > 0 ? pending[0] : null;
  }

  startJob(id) {
    const job = this.jobs.get(id);
    if (!job) return null;
    
    job.status = JOB_STATUS.RUNNING;
    job.startedAt = Date.now();
    this.currentJobId = id;
    this.saveToDisk();
    
    this.emit('jobStarted', job);
    logger.info(`Job ${id} started`);
    
    return job;
  }

  completeJob(id, error = null) {
    const job = this.jobs.get(id);
    if (!job) return;
    
    if (error) {
      if (job.retryCount < job.maxRetries) {
        job.retryCount++;
        job.status = JOB_STATUS.PENDING;
        job.startedAt = null;
        this.emit('jobRetrying', job);
        logger.info(`Job ${id} will retry (${job.retryCount}/${job.maxRetries})`);
      } else {
        job.status = JOB_STATUS.FAILED;
        job.error = error;
        job.completedAt = Date.now();
        this.emit('jobFailed', job);
        logger.info(`Job ${id} failed: ${error}`);
      }
    } else {
      job.status = JOB_STATUS.COMPLETED;
      job.completedAt = Date.now();
      this.emit('jobCompleted', job);
      logger.info(`Job ${id} completed`);
    }
    
    if (job.status === JOB_STATUS.COMPLETED || job.status === JOB_STATUS.FAILED) {
      this.currentJobId = null;
    }
    
    this.saveToDisk();
    
    return job;
  }

  cancelJob(id) {
    const job = this.jobs.get(id);
    if (!job) return null;
    
    if (job.status === JOB_STATUS.RUNNING) {
      return { success: false, message: 'Cannot cancel running job' };
    }
    
    job.status = JOB_STATUS.CANCELLED;
    job.completedAt = Date.now();
    this.saveToDisk();
    
    this.emit('jobCancelled', job);
    logger.info(`Job ${id} cancelled`);
    
    return { success: true };
  }

  removeJob(id) {
    const job = this.jobs.get(id);
    if (job && job.status === JOB_STATUS.RUNNING) {
      return { success: false, message: 'Cannot remove running job' };
    }
    
    this.jobs.delete(id);
    this.saveToDisk();
    
    this.emit('jobRemoved', { id });
    return { success: true };
  }

  reorderJobs(fromIndex, toIndex) {
    const jobs = this.getPendingJobs();
    if (fromIndex < 0 || fromIndex >= jobs.length || toIndex < 0 || toIndex >= jobs.length) {
      return { success: false, message: 'Invalid indices' };
    }
    
    const movedJob = jobs[fromIndex];
    const otherJobs = jobs.filter((_, i) => i !== fromIndex);
    otherJobs.splice(toIndex, 0, movedJob);
    
    otherJobs.forEach((job, index) => {
      job.priority = jobs.length - index;
    });
    
    this.saveToDisk();
    this.emit('queueReordered', { jobs: otherJobs });
    
    return { success: true };
  }

  clearCompleted() {
    const toRemove = [];
    for (const [id, job] of this.jobs) {
      if (job.status === JOB_STATUS.COMPLETED || job.status === JOB_STATUS.CANCELLED) {
        toRemove.push(id);
      }
    }
    
    toRemove.forEach(id => this.jobs.delete(id));
    this.saveToDisk();
    
    return { success: true, removed: toRemove.length };
  }

  getStats() {
    const jobs = this.getAllJobs();
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === JOB_STATUS.PENDING).length,
      running: jobs.filter(j => j.status === JOB_STATUS.RUNNING).length,
      completed: jobs.filter(j => j.status === JOB_STATUS.COMPLETED).length,
      failed: jobs.filter(j => j.status === JOB_STATUS.FAILED).length,
      currentJobId: this.currentJobId
    };
  }

  on(event, callback) {
    this.listeners.add({ event, callback });
  }

  off(event, callback) {
    this.listeners.delete({ event, callback });
  }

  emit(event, data) {
    for (const listener of this.listeners) {
      if (listener.event === event) {
        try {
          listener.callback(data);
        } catch (err) {
          logger.error('Error in queue listener:', err);
        }
      }
    }
  }
}

module.exports = { JobQueue, JOB_STATUS };
