const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class SafeFileOp {
  static async exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async removeDir(dirPath, options = {}) {
    const { retries = 5, delay = 500 } = options;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (await this.exists(dirPath)) {
          await fs.rm(dirPath, { recursive: true, force: true });
          logger.debug(`Successfully removed directory: ${dirPath}`);
        }
        return true;
      } catch (err) {
        if (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'ENOTEMPTY') {
          logger.warn(`Attempt ${attempt}/${retries}: Directory busy, retrying in ${delay * attempt}ms: ${dirPath}`);
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
          continue;
        }
        logger.error(`Failed to remove directory: ${dirPath}`, err);
        throw err;
      }
    }
    throw new Error(`Failed to remove directory after ${retries} attempts: ${dirPath}`);
  }

  static async removeDirRename(dirPath, options = {}) {
    const { retries = 3, delay = 500 } = options;
    
    if (!(await this.exists(dirPath))) {
      logger.debug(`Directory does not exist, nothing to remove: ${dirPath}`);
      return { success: true, alreadyGone: true };
    }

    const tempPath = dirPath + '_to_delete_' + Date.now();
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await fs.rename(dirPath, tempPath);
        logger.debug(`Renamed directory: ${dirPath} -> ${tempPath}`);
        break;
      } catch (renameErr) {
        if (renameErr.code === 'ENOENT') {
          logger.debug(`Directory already removed: ${dirPath}`);
          return { success: true, alreadyGone: true };
        }
        if (attempt === retries) {
          logger.error(`Failed to rename directory after ${retries} attempts: ${dirPath}`, renameErr);
          throw new Error(`无法重命名目录: ${renameErr.message}`);
        }
        logger.warn(`Rename attempt ${attempt}/${retries} failed, retrying: ${dirPath}`);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await fs.rm(tempPath, { recursive: true, force: true });
        logger.debug(`Successfully removed directory via rename: ${dirPath}`);
        return { success: true, cleaned: true };
      } catch (rmErr) {
        if (rmErr.code === 'ENOENT') {
          logger.debug(`Temp directory already removed: ${tempPath}`);
          return { success: true, cleaned: true };
        }
        
        if (rmErr.code === 'EBUSY' || rmErr.code === 'EPERM') {
          if (attempt < 5) {
            logger.warn(`Directory locked, attempt ${attempt}/5, waiting ${delay * attempt}ms: ${tempPath}`);
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
            continue;
          }
          logger.warn(`Directory still locked after 5 attempts, will cleanup on restart: ${tempPath}`);
          return { success: true, pendingCleanup: true, tempPath };
        }
        
        logger.error(`Failed to remove temp directory: ${tempPath}`, rmErr);
        throw new Error(`删除临时目录失败: ${rmErr.message}`);
      }
    }

    return { success: true, pendingCleanup: true, tempPath };
  }

  static async cleanupPendingDeletions(baseDir) {
    logger.info('[SafeFileOp] Checking for pending deletions...');
    let cleaned = 0;
    
    try {
      if (!fsSync.existsSync(baseDir)) {
        return cleaned;
      }

      const entries = fsSync.readdirSync(baseDir);
      const toDeletePattern = /_to_delete_\d+$/;
      
      for (const entry of entries) {
        if (toDeletePattern.test(entry)) {
          const fullPath = path.join(baseDir, entry);
          try {
            await fs.rm(fullPath, { recursive: true, force: true });
            logger.info(`[SafeFileOp] Cleaned up pending deletion: ${fullPath}`);
            cleaned++;
          } catch (err) {
            logger.warn(`[SafeFileOp] Could not clean up ${fullPath}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      logger.error('[SafeFileOp] Error during cleanup:', err);
    }

    if (cleaned > 0) {
      logger.info(`[SafeFileOp] Cleaned up ${cleaned} pending deletions`);
    }
    
    return cleaned;
  }

  static async ensureDir(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return true;
    } catch (err) {
      if (err.code !== 'EEXIST') {
        logger.error(`Failed to create directory: ${dirPath}`, err);
        throw err;
      }
      return false;
    }
  }

  static async copyFile(src, dest) {
    await fs.copyFile(src, dest);
  }

  static async readJson(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  static async writeJson(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

module.exports = SafeFileOp;
