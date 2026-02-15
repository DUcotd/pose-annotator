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
    const { retries = 3, delay = 1000 } = options;
    
    logger.info(`[SafeFileOp] Starting removal of: ${dirPath}`);
    
    if (!(await this.exists(dirPath))) {
      logger.info(`[SafeFileOp] Directory does not exist: ${dirPath}`);
      return { success: true, alreadyGone: true };
    }

    const tempPath = dirPath + '_to_delete_' + Date.now();
    logger.info(`[SafeFileOp] Will rename to: ${tempPath}`);
    
    let renameSuccess = false;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await fs.rename(dirPath, tempPath);
        logger.info(`[SafeFileOp] Successfully renamed: ${dirPath} -> ${tempPath}`);
        renameSuccess = true;
        break;
      } catch (renameErr) {
        logger.warn(`[SafeFileOp] Rename attempt ${attempt}/${retries} failed: ${renameErr.code} - ${renameErr.message}`);
        
        if (renameErr.code === 'ENOENT') {
          logger.info(`[SafeFileOp] Directory already removed: ${dirPath}`);
          return { success: true, alreadyGone: true };
        }
        
        if (attempt === retries) {
          logger.error(`[SafeFileOp] Failed to rename directory after ${retries} attempts: ${dirPath}`);
          
          if (renameErr.code === 'EBUSY' || renameErr.code === 'EPERM' || 
              renameErr.code === 'ENOTEMPTY' || renameErr.code === 'EACCES') {
            logger.info(`[SafeFileOp] Trying direct removal as fallback...`);
            try {
              await fs.rm(dirPath, { recursive: true, force: true });
              logger.info(`[SafeFileOp] Direct removal succeeded: ${dirPath}`);
              return { success: true, cleaned: true };
            } catch (directErr) {
              logger.error(`[SafeFileOp] Direct removal also failed: ${directErr.message}`);
              throw new Error(`无法删除目录，文件可能被占用。请关闭所有打开的文件后重试。错误: ${renameErr.message}`);
            }
          }
          
          throw new Error(`无法重命名目录: ${renameErr.message}`);
        }
        
        logger.info(`[SafeFileOp] Waiting ${delay * attempt}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }

    if (!renameSuccess) {
      throw new Error('重命名操作失败');
    }

    logger.info(`[SafeFileOp] Starting removal of temp directory: ${tempPath}`);
    
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await fs.rm(tempPath, { recursive: true, force: true });
        logger.info(`[SafeFileOp] Successfully removed temp directory: ${tempPath}`);
        return { success: true, cleaned: true };
      } catch (rmErr) {
        logger.warn(`[SafeFileOp] Removal attempt ${attempt}/5 failed: ${rmErr.code} - ${rmErr.message}`);
        
        if (rmErr.code === 'ENOENT') {
          logger.info(`[SafeFileOp] Temp directory already removed: ${tempPath}`);
          return { success: true, cleaned: true };
        }
        
        if (rmErr.code === 'EBUSY' || rmErr.code === 'EPERM' || rmErr.code === 'ENOTEMPTY') {
          if (attempt < 5) {
            logger.info(`[SafeFileOp] Waiting ${delay * attempt}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
            continue;
          }
          logger.warn(`[SafeFileOp] Directory still locked after 5 attempts, will cleanup on restart: ${tempPath}`);
          return { success: true, pendingCleanup: true, tempPath };
        }
        
        logger.error(`[SafeFileOp] Failed to remove temp directory: ${tempPath}`, rmErr);
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
