const winston = require('winston');
const path = require('path');
const fs = require('fs');

function resolveElectronUserDataDir() {
  if (!process.versions?.electron) return null;
  try {
    const { app } = require('electron');
    if (!app || typeof app.getPath !== 'function') return null;
    return app.getPath('userData');
  } catch {
    return null;
  }
}

function resolveLogsDir() {
  if (process.env.POSE_ANNOTATOR_LOGS_DIR) {
    return process.env.POSE_ANNOTATOR_LOGS_DIR;
  }
  const userDataDir = resolveElectronUserDataDir();
  if (userDataDir) {
    return path.join(userDataDir, 'logs');
  }
  return path.join(__dirname, '..', '..', 'logs');
}

const logsDir = resolveLogsDir();
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const errorLogPath = path.join(logsDir, 'error.log');
const combinedLogPath = path.join(logsDir, 'combined.log');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'pose-annotator' },
  transports: [
    new winston.transports.File({
      filename: errorLogPath,
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: combinedLogPath,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

logger.logsDir = logsDir;
logger.errorLogPath = errorLogPath;
logger.combinedLogPath = combinedLogPath;

module.exports = logger;
