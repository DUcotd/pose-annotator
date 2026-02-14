const fs = require('fs').promises;
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
    const { retries = 3, delay = 1000 } = options;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (await this.exists(dirPath)) {
          await fs.rm(dirPath, { recursive: true, force: true });
          logger.debug(`Successfully removed directory: ${dirPath}`);
        }
        return true;
      } catch (err) {
        if (err.code === 'EBUSY' || err.code === 'EPERM') {
          logger.warn(`Attempt ${attempt}/${retries}: Directory busy, retrying in ${delay}ms: ${dirPath}`);
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
          continue;
        }
        logger.error(`Failed to remove directory: ${dirPath}`, err);
        throw err;
      }
    }
    throw new Error(`Failed to remove directory after ${retries} attempts: ${dirPath}`);
  }

  static async removeDirRename(dirPath) {
    if (!(await this.exists(dirPath))) return true;

    const tempPath = dirPath + '_to_delete_' + Date.now();
    try {
      await fs.rename(dirPath, tempPath);
      await fs.rm(tempPath, { recursive: true, force: true });
      logger.debug(`Successfully removed directory via rename: ${dirPath}`);
      return true;
    } catch (err) {
      if (err.code === 'EBUSY' || err.code === 'EPERM') {
        logger.warn(`Directory busy, will cleanup later: ${tempPath}`);
        return true;
      }
      throw err;
    }
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
