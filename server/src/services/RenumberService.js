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
    const backupUploadsDir = path.join(backupDir, 'uploads');
    const backupAnnotationsDir = path.join(backupDir, 'annotations');
    const backupThumbnailsDir = path.join(backupDir, 'thumbnails');
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
      await fs.mkdir(backupUploadsDir);
      await fs.mkdir(backupAnnotationsDir);
      await fs.mkdir(backupThumbnailsDir);
      logger.info(`[RenumberService] Created backup directory: ${backupDir}`);

      for (const file of imageFiles) {
        const srcPath = path.join(paths.uploads, file);
        const dstPath = path.join(backupUploadsDir, file);
        await fs.copyFile(srcPath, dstPath);

        const annPath = path.join(paths.annotations, `${file}.json`);
        if (fsSync.existsSync(annPath)) {
          await fs.copyFile(annPath, path.join(backupAnnotationsDir, `${file}.json`));
        }

        const thumbPath = path.join(paths.thumbnails, file);
        if (fsSync.existsSync(thumbPath)) {
          await fs.copyFile(thumbPath, path.join(backupThumbnailsDir, file));
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

    const backupUploadsDir = path.join(backupDir, 'uploads');
    const backupAnnotationsDir = path.join(backupDir, 'annotations');
    const backupThumbnailsDir = path.join(backupDir, 'thumbnails');

    const hasStructuredBackup =
      fsSync.existsSync(backupUploadsDir) ||
      fsSync.existsSync(backupAnnotationsDir) ||
      fsSync.existsSync(backupThumbnailsDir);

    const restoreDir = async (srcDir, dstDir) => {
      if (!fsSync.existsSync(srcDir)) return new Set();
      const files = await fs.readdir(srcDir);
      for (const file of files) {
        const srcPath = path.join(srcDir, file);
        const dstPath = path.join(dstDir, file);
        if (fsSync.existsSync(dstPath)) {
          await fs.unlink(dstPath);
        }
        await fs.copyFile(srcPath, dstPath);
      }
      return new Set(files);
    };

    const pruneDir = async (dstDir, keepSet) => {
      if (!fsSync.existsSync(dstDir)) return;
      const files = await fs.readdir(dstDir);
      for (const file of files) {
        if (!keepSet.has(file)) {
          await fs.unlink(path.join(dstDir, file));
        }
      }
    };

    if (hasStructuredBackup) {
      const keepUploads = await restoreDir(backupUploadsDir, paths.uploads);
      const keepAnnotations = await restoreDir(backupAnnotationsDir, paths.annotations);
      const keepThumbnails = await restoreDir(backupThumbnailsDir, paths.thumbnails);

      await pruneDir(paths.uploads, keepUploads);
      await pruneDir(paths.annotations, keepAnnotations);
      await pruneDir(paths.thumbnails, keepThumbnails);
      return;
    }

    const backupFiles = await fs.readdir(backupDir);
    const keepUploads = new Set();
    const keepAnnotations = new Set();

    for (const file of backupFiles) {
      const srcPath = path.join(backupDir, file);
      if (file.endsWith('.json')) {
        const dstPath = path.join(paths.annotations, file);
        if (fsSync.existsSync(dstPath)) await fs.unlink(dstPath);
        await fs.copyFile(srcPath, dstPath);
        keepAnnotations.add(file);
        continue;
      }

      if (this.SUPPORTED_IMAGE_EXTENSIONS.test(file)) {
        const imageDstPath = path.join(paths.uploads, file);
        if (fsSync.existsSync(imageDstPath)) await fs.unlink(imageDstPath);
        await fs.copyFile(srcPath, imageDstPath);
        keepUploads.add(file);
        continue;
      }
    }

    await pruneDir(paths.uploads, keepUploads);
    await pruneDir(paths.annotations, keepAnnotations);
  }
}

module.exports = new RenumberService();
