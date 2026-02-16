const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const PathService = require('./PathService');
const SafeFileOp = require('./FileService');

class RenumberService {
  constructor() {
    this.SUPPORTED_IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp)$/i;
  }

  async renumberProject(projectId, projectsDir) {
    const paths = PathService.getProjectPaths(projectId, projectsDir);
    const configPath = PathService.getConfigPath(projectId, projectsDir);
    const backupDir = path.join(paths.root, '.renumber_backup_' + Date.now());
    let backupComplete = false;
    let filesRenamed = [];

    try {
      logger.info(`[RenumberService] Starting renumber for project: ${projectId}`);

      if (!fsSync.existsSync(paths.uploads)) {
        logger.warn(`[RenumberService] Uploads directory not found for project: ${projectId}`);
        return { success: true, count: 0, message: 'No images to renumber' };
      }

      const files = await fs.readdir(paths.uploads);
      const imageFiles = files
        .filter(f => this.SUPPORTED_IMAGE_EXTENSIONS.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      if (imageFiles.length === 0) {
        logger.info(`[RenumberService] No images found for renumbering in project: ${projectId}`);
        return { success: true, count: 0, message: 'No images to renumber' };
      }

      logger.info(`[RenumberService] Found ${imageFiles.length} images to renumber`);

      await fs.mkdir(backupDir);
      logger.info(`[RenumberService] Created backup directory: ${backupDir}`);

      for (const file of imageFiles) {
        const srcPath = path.join(paths.uploads, file);
        const dstPath = path.join(backupDir, file);
        await fs.copyFile(srcPath, dstPath);

        const annPath = path.join(paths.annotations, `${file}.json`);
        if (fsSync.existsSync(annPath)) {
          await fs.copyFile(annPath, path.join(backupDir, `${file}.json`));
        }

        const thumbPath = path.join(paths.thumbnails, file);
        if (fsSync.existsSync(thumbPath)) {
          await fs.copyFile(thumbPath, path.join(backupDir, file));
        }
      }

      backupComplete = true;
      logger.info(`[RenumberService] Backup completed successfully`);

      for (let i = 0; i < imageFiles.length; i++) {
        const oldName = imageFiles[i];
        const ext = path.extname(oldName);
        const newName = String(i + 1).padStart(6, '0') + ext;

        if (oldName === newName) continue;

        const oldImagePath = path.join(paths.uploads, oldName);
        const newImagePath = path.join(paths.uploads, newName);

        await fs.rename(oldImagePath, newImagePath);

        const oldAnnPath = path.join(paths.annotations, `${oldName}.json`);
        const newAnnPath = path.join(paths.annotations, `${newName}.json`);
        if (fsSync.existsSync(oldAnnPath)) {
          await fs.rename(oldAnnPath, newAnnPath);
        }

        const oldThumbPath = path.join(paths.thumbnails, oldName);
        const newThumbPath = path.join(paths.thumbnails, newName);
        if (fsSync.existsSync(oldThumbPath)) {
          await fs.rename(oldThumbPath, newThumbPath);
        }

        filesRenamed.push({ old: oldName, new: newName });
      }

      let config = { classMapping: {} };
      if (fsSync.existsSync(configPath)) {
        try {
          config = JSON.parse(await fs.readFile(configPath, 'utf8'));
        } catch (e) {
          logger.warn(`[RenumberService] Failed to read config, using defaults: ${e.message}`);
        }
      }
      config.nextImageId = imageFiles.length + 1;
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

      logger.info(`[RenumberService] Renumbering completed successfully. Renamed ${filesRenamed.length} files`);

      try {
        await SafeFileOp.removeDir(backupDir);
        logger.info(`[RenumberService] Backup directory cleaned up`);
      } catch (cleanupErr) {
        logger.warn(`[RenumberService] Failed to cleanup backup directory: ${cleanupErr.message}`);
      }

      return {
        success: true,
        count: filesRenamed.length,
        totalImages: imageFiles.length,
        filesRenamed
      };

    } catch (err) {
      logger.error(`[RenumberService] Renumbering failed: ${err.message}`, err);

      if (backupComplete) {
        logger.info(`[RenumberService] Attempting rollback from backup: ${backupDir}`);
        try {
          await this._rollback(backupDir, paths);
          logger.info(`[RenumberService] Rollback completed successfully`);
        } catch (rollbackErr) {
          logger.error(`[RenumberService] Rollback failed: ${rollbackErr.message}`, rollbackErr);
          throw new Error(`重命名失败且回滚失败。备份保留在: ${backupDir}。错误: ${err.message}`);
        }
      }

      throw new Error(`重命名失败: ${err.message}`);
    }
  }

  async _rollback(backupDir, paths) {
    if (!fsSync.existsSync(backupDir)) {
      logger.warn(`[RenumberService] Backup directory not found for rollback: ${backupDir}`);
      return;
    }

    const backupFiles = await fs.readdir(backupDir);

    for (const file of backupFiles) {
      const srcPath = path.join(backupDir, file);
      let dstPath;

      if (file.endsWith('.json')) {
        dstPath = path.join(paths.annotations, file);
      } else if (this.SUPPORTED_IMAGE_EXTENSIONS.test(file)) {
        const imageDstPath = path.join(paths.uploads, file);
        const thumbDstPath = path.join(paths.thumbnails, file);

        if (fsSync.existsSync(imageDstPath)) {
          await fs.unlink(imageDstPath);
        }
        await fs.copyFile(srcPath, imageDstPath);

        if (fsSync.existsSync(path.join(backupDir, file)) && !file.endsWith('.json')) {
          const thumbBackupPath = path.join(backupDir, file);
          if (fsSync.existsSync(thumbBackupPath) && fsSync.statSync(thumbBackupPath).isFile()) {
            if (fsSync.existsSync(thumbDstPath)) {
              await fs.unlink(thumbDstPath);
            }
            await fs.copyFile(thumbBackupPath, thumbDstPath);
          }
        }
        continue;
      } else {
        continue;
      }

      if (fsSync.existsSync(dstPath)) {
        await fs.unlink(dstPath);
      }
      await fs.copyFile(srcPath, dstPath);
    }

    const uploadFiles = await fs.readdir(paths.uploads);
    for (const file of uploadFiles) {
      if (!fsSync.existsSync(path.join(backupDir, file))) {
        await fs.unlink(path.join(paths.uploads, file));
      }
    }

    const annFiles = await fs.readdir(paths.annotations);
    for (const file of annFiles) {
      if (!fsSync.existsSync(path.join(backupDir, file))) {
        await fs.unlink(path.join(paths.annotations, file));
      }
    }

    if (fsSync.existsSync(paths.thumbnails)) {
      const thumbFiles = await fs.readdir(paths.thumbnails);
      for (const file of thumbFiles) {
        if (!fsSync.existsSync(path.join(backupDir, file))) {
          await fs.unlink(path.join(paths.thumbnails, file));
        }
      }
    }
  }
}

module.exports = new RenumberService();
