const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const logger = require('../utils/logger');
const SafeFileOp = require('../services/FileService');
const settings = require('../config/settings');
const PathService = require('../services/PathService');
const projectRegistry = require('../services/ProjectRegistryService');
const projectValidator = require('../utils/ProjectValidator');
const { extractZipAsync } = require('../utils/zipUtils');
const RenumberService = require('../services/RenumberService');
const PredictionService = require('../services/PredictionService');

function createProjectRouter(projectsDir) {
  const router = express.Router();

  projectRegistry.init(projectsDir);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const projectId = req.params.projectId;
      if (!projectId) {
        const tempDir = path.join(projectsDir, '.temp_uploads');
        SafeFileOp.ensureDir(tempDir);
        return cb(null, tempDir);
      }
      const paths = PathService.getProjectPaths(projectId, projectsDir);
      SafeFileOp.ensureDir(paths.uploads);
      cb(null, paths.uploads);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });

  const upload = multer({ storage });

  router.get('/', (req, res) => {
    try {
      const allPaths = PathService.getAllProjectPaths(projectsDir);
      const projectMap = new Map();
      let skippedCount = 0;

      allPaths.forEach(dir => {
        if (!fs.existsSync(dir)) return;
        try {
          const projects = fs.readdirSync(dir).filter(file => {
            if (file.startsWith('.') || file.includes('_to_delete_')) return false;
            try {
              return fs.statSync(path.join(dir, file)).isDirectory();
            } catch (e) { return false; }
          });

          projects.forEach(p => {
            if (!projectMap.has(p)) {
              const projectPath = path.join(dir, p);
              
              const validation = projectValidator.validateProject(projectPath, p);
              if (!validation.valid) {
                logger.warn(`[Projects] Skipping invalid project '${p}': ${validation.reason}`);
                skippedCount++;
                return;
              }
              
              projectMap.set(p, projectPath);
            }
          });
        } catch (e) {
          logger.error(`Failed to scan directory ${dir}:`, e);
        }
      });

      if (skippedCount > 0) {
        logger.info(`[Projects] Skipped ${skippedCount} invalid projects`);
      }

      const projectList = Array.from(projectMap.entries()).map(([p, root]) => {
        const paths = PathService.getProjectPaths(p, projectsDir);
        let imageCount = 0;
        let annotatedCount = 0;
        try {
          if (fs.existsSync(paths.uploads)) {
            const files = fs.readdirSync(paths.uploads).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
            imageCount = files.length;
            files.forEach(file => {
              const annotationPath = path.join(paths.annotations, `${file}.json`);
              if (fs.existsSync(annotationPath)) {
                try {
                  const data = JSON.parse(fs.readFileSync(annotationPath));
                  if (data.some(a => a.type === 'bbox' || a.type === 'keypoint')) {
                    annotatedCount++;
                  }
                } catch (e) { }
              }
            });
          }
        } catch (e) { }
        
        const registryProject = projectRegistry.getProject(p);
        if (!registryProject) {
          projectRegistry.registerProject(p, root);
        }
        
        return { id: p, name: p, imageCount, annotatedCount, path: root };
      });

      res.json(projectList);
    } catch (err) {
      logger.error('Failed to list projects:', err);
      res.status(500).json({ error: 'Failed to list projects' });
    }
  });

  router.post('/', async (req, res) => {
    const { name, customPath } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name required' });

    const safeName = PathService.sanitizeProjectName(name);
    
    let targetDir = projectsDir;
    if (customPath) {
      targetDir = PathService.resolveCustomProjectPath(customPath, projectsDir);
      try {
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
      } catch (e) {
        return res.status(400).json({ error: `无法创建目录: ${e.message}` });
      }
    }

    const projectRoot = path.join(targetDir, safeName);
    if (fs.existsSync(projectRoot)) {
      return res.status(400).json({ error: '该项目名称已存在' });
    }

    try {
      const paths = await PathService.ensureProjectDirs(safeName, projectsDir, targetDir);

      projectRegistry.registerProject(safeName, projectRoot, { name });

      if (customPath && customPath !== projectsDir) {
        PathService.addToAdditionalPaths(customPath);
      }

      logger.info(`Project created: ${safeName} at ${targetDir}`);
      res.json({ message: 'Project created', id: safeName, path: projectRoot });
    } catch (e) {
      logger.error('Failed to create project:', e);
      res.status(500).json({ error: `创建项目失败: ${e.message}` });
    }
  });

  router.get('/:projectId/config', (req, res) => {
    const { projectId } = req.params;
    const configPath = PathService.getConfigPath(projectId, projectsDir);

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath));
        res.json(config);
      } catch (e) {
        res.status(500).json({ error: 'Failed to read project config' });
      }
    } else {
      res.json({ classMapping: {} });
    }
  });

  router.post('/:projectId/config', async (req, res) => {
    const { projectId } = req.params;
    const config = req.body;
    await PathService.ensureProjectDirs(projectId, projectsDir);
    const configPath = PathService.getConfigPath(projectId, projectsDir);

    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      res.json({ message: 'Project config saved' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to save project config' });
    }
  });

  router.delete('/:projectId', async (req, res) => {
    const { projectId } = req.params;
    
    logger.info(`[Delete] Attempting to delete project: ${projectId}`);
    
    const paths = PathService.getProjectPaths(projectId, projectsDir);
    logger.info(`[Delete] Project path: ${paths.root}`);

    if (!fs.existsSync(paths.root)) {
      logger.info(`[Delete] Project directory not found, removing from registry: ${projectId}`);
      projectRegistry.unregisterProject(projectId);
      return res.json({ message: '项目不存在，已从注册表中移除' });
    }

    try {
      logger.info(`[Delete] Marking project as deleted in registry: ${projectId}`);
      projectRegistry.markProjectDeleted(projectId);
      
      logger.info(`[Delete] Starting directory removal: ${paths.root}`);
      const result = await SafeFileOp.removeDirRename(paths.root);
      
      logger.info(`[Delete] Removal result:`, result);
      
      if (result.success) {
        if (result.pendingCleanup) {
          logger.info(`[Delete] Project deletion pending cleanup: ${projectId}`);
          res.json({ 
            message: '项目删除中（部分文件被占用，将在重启后清理）',
            pendingCleanup: true 
          });
        } else {
          projectRegistry.unregisterProject(projectId);
          logger.info(`[Delete] Project deleted successfully: ${projectId}`);
          res.json({ message: '项目已成功删除' });
        }
      } else {
        throw new Error('删除操作未完成');
      }
    } catch (err) {
      logger.error(`[Delete] Failed to delete project ${projectId}:`, err);
      
      const registryProject = projectRegistry.getProject(projectId);
      if (registryProject && registryProject.status === 'deleted') {
        projectRegistry.updateProject(projectId, { status: 'active' });
      }
      
      res.status(500).json({ 
        error: '删除项目失败', 
        details: err.message,
        path: paths.root
      });
    }
  });

  router.get('/:projectId/uploads/:filename', (req, res) => {
    const { projectId, filename } = req.params;
    const paths = PathService.getProjectPaths(projectId, projectsDir);
    const projectPath = path.join(paths.uploads, filename);
    if (fs.existsSync(projectPath)) {
      res.sendFile(projectPath);
    } else {
      res.status(404).send('File not found');
    }
  });

  router.get('/:projectId/thumbnails/:filename', async (req, res) => {
    const { projectId, filename } = req.params;
    const paths = await PathService.ensureProjectDirs(projectId, projectsDir);
    const originalPath = path.join(paths.uploads, filename);
    const thumbPath = path.join(paths.thumbnails, filename);

    if (fs.existsSync(thumbPath)) {
      return res.sendFile(thumbPath);
    }

    if (!fs.existsSync(originalPath)) {
      return res.status(404).send('Original file not found');
    }

    try {
      await sharp(originalPath)
        .resize(300, 300, { fit: 'cover', position: 'center' })
        .toFile(thumbPath);
      res.sendFile(path.resolve(thumbPath));
    } catch (err) {
      logger.error('Thumbnail generation failed:', err);
      res.sendFile(originalPath);
    }
  });

  router.post('/:projectId/upload', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { projectId } = req.params;
    const paths = PathService.getProjectPaths(projectId, projectsDir);

    try {
      const ext = path.extname(req.file.originalname) || '.jpg';
      const nextIdx = PathService.getNextFileIndex(paths.uploads);
      const newFilename = String(nextIdx).padStart(6, '0') + ext;
      const targetPath = path.join(paths.uploads, newFilename);

      await fs.promises.rename(req.file.path, targetPath);

      res.json({ message: 'File uploaded and encoded successfully', filename: newFilename });
    } catch (err) {
      logger.error('Failed to rename uploaded file:', err);
      res.status(500).json({ error: 'Failed to encode uploaded file', details: err.message });
    }
  });

  router.get('/:projectId/images', async (req, res) => {
    const { projectId } = req.params;
    const paths = await PathService.ensureProjectDirs(projectId, projectsDir);

    fs.readdir(paths.uploads, (err, files) => {
      if (err) return res.status(500).json({ error: 'Unable to scan directory' });

      const imageFiles = files
        .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      const imageList = imageFiles.map(file => {
        const annotationPath = path.join(paths.annotations, `${file}.json`);
        let hasAnnotation = false;
        let keypointCount = 0;
        let bboxCount = 0;
        if (fs.existsSync(annotationPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(annotationPath));
            const arr = Array.isArray(data) ? data : [];
            keypointCount = arr.filter(a => a && a.type === 'keypoint').length;
            bboxCount = arr.filter(a => a && a.type === 'bbox').length;
            hasAnnotation = arr.some(a => a && (a.type === 'bbox' || a.type === 'keypoint'));
          } catch (e) { }
        }

        let size = 0;
        try {
          const stats = fs.statSync(path.join(paths.uploads, file));
          size = stats.size;
        } catch (e) { }

        return { name: file, hasAnnotation, keypointCount, bboxCount, size };
      });

      res.json(imageList);
    });
  });

  router.get('/:projectId/annotations/:imageId', (req, res) => {
    const { projectId, imageId } = req.params;
    const paths = PathService.getProjectPaths(projectId, projectsDir);
    const annotationPath = path.join(paths.annotations, `${imageId}.json`);
    res.setHeader('Cache-Control', 'no-store');

    if (fs.existsSync(annotationPath)) {
      const stat = fs.statSync(annotationPath);
      res.setHeader('ETag', `W/"${stat.mtimeMs}"`);
      const data = fs.readFileSync(annotationPath);
      res.json(JSON.parse(data));
    } else {
      res.setHeader('ETag', 'W/"0"');
      res.json([]);
    }
  });

  router.post('/:projectId/annotations/:imageId', async (req, res) => {
    const { projectId, imageId } = req.params;
    await PathService.ensureProjectDirs(projectId, projectsDir);
    const paths = PathService.getProjectPaths(projectId, projectsDir);
    const annotations = req.body;
    const annotationPath = path.join(paths.annotations, `${imageId}.json`);

    try {
      let currentEtag = 'W/"0"';
      if (fs.existsSync(annotationPath)) {
        const stat = await fs.promises.stat(annotationPath);
        currentEtag = `W/"${stat.mtimeMs}"`;
      }

      const ifMatch = req.headers['if-match'];
      if (ifMatch && ifMatch !== currentEtag) {
        res.setHeader('ETag', currentEtag);
        return res.status(409).json({ error: 'Conflict', etag: currentEtag });
      }

      await SafeFileOp.writeJsonAtomic(annotationPath, annotations);
      const newStat = await fs.promises.stat(annotationPath).catch(() => null);
      if (newStat) {
        res.setHeader('ETag', `W/"${newStat.mtimeMs}"`);
      } else {
        res.setHeader('ETag', currentEtag);
      }
      res.json({ message: 'Annotations saved successfully' });
    } catch (err) {
      logger.error(`Failed to save annotations for ${imageId}:`, err);
      res.status(500).json({ error: 'Failed to save annotations' });
    }
  });

  router.delete('/:projectId/images/:imageId', async (req, res) => {
    const { projectId, imageId } = req.params;
    logger.info(`[DeleteImage] Attempting to delete image: ${imageId} from project: ${projectId}`);
    
    const paths = PathService.getProjectPaths(projectId, projectsDir);
    const imagePath = path.join(paths.uploads, imageId);
    const annotationPath = path.join(paths.annotations, `${imageId}.json`);
    const thumbnailPath = path.join(paths.thumbnails, imageId);

    try {
      let deleted = false;
      
      if (fs.existsSync(imagePath)) {
        await fs.promises.unlink(imagePath);
        logger.info(`[DeleteImage] Deleted image file: ${imagePath}`);
        deleted = true;
      } else {
        logger.warn(`[DeleteImage] Image file not found: ${imagePath}`);
      }

      if (fs.existsSync(annotationPath)) {
        await fs.promises.unlink(annotationPath);
        logger.info(`[DeleteImage] Deleted annotation file: ${annotationPath}`);
      }

      if (fs.existsSync(thumbnailPath)) {
        await fs.promises.unlink(thumbnailPath);
        logger.info(`[DeleteImage] Deleted thumbnail file: ${thumbnailPath}`);
      }

      if (!deleted) {
        return res.status(404).json({ error: 'Image not found' });
      }

      const remainingFiles = fs.existsSync(paths.uploads) 
        ? fs.readdirSync(paths.uploads).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
        : [];
      
      logger.info(`[DeleteImage] Image deleted. Remaining images: ${remainingFiles.length}`);
      
      res.json({ 
        message: '图片已删除',
        remainingCount: remainingFiles.length
      });
    } catch (err) {
      logger.error(`[DeleteImage] Failed to delete image ${imageId}:`, err);
      res.status(500).json({ error: '删除图片失败', details: err.message });
    }
  });

  router.get('/:projectId/dataset/stats', (req, res) => {
    const { projectId } = req.params;
    const paths = PathService.getProjectPaths(projectId, projectsDir);

    if (!fs.existsSync(paths.uploads)) {
      return res.json({ total: 0, annotated: 0, unannotated: 0, totalSize: 0, samples: [], bboxes: 0, keypoints: 0 });
    }

    fs.readdir(paths.uploads, (err, files) => {
      if (err) return res.status(500).json({ error: 'Failed to scan dataset' });

      const images = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
      let annotatedCount = 0;
      let totalSize = 0;
      let samples = [];
      let totalBboxes = 0;
      let totalKeypoints = 0;

      images.forEach(imageFile => {
        const imagePath = path.join(paths.root, 'uploads', imageFile);
        const annotationFile = path.join(paths.annotations, `${imageFile}.json`);
        let isAnnotated = false;

        try {
          const stats = fs.statSync(imagePath);
          totalSize += stats.size;
        } catch (e) { }

        if (fs.existsSync(annotationFile)) {
          try {
            const data = JSON.parse(fs.readFileSync(annotationFile));
            const annotations = Array.isArray(data) ? data : (Array.isArray(data?.annotations) ? data.annotations : []);
            const bboxes = annotations.filter(a => a?.type === 'bbox').length;
            const keypoints = annotations.filter(a => a?.type === 'keypoint').length;
            totalBboxes += bboxes;
            totalKeypoints += keypoints;
            if (bboxes > 0 || keypoints > 0) isAnnotated = true;
          } catch (e) { }
        }

        if (isAnnotated) {
          annotatedCount++;
          if (samples.length < 5) {
            samples.push(imageFile);
          }
        }
      });

      res.json({
        total: images.length,
        annotated: annotatedCount,
        unannotated: images.length - annotatedCount,
        totalSize: totalSize,
        samples: samples,
        bboxes: totalBboxes,
        keypoints: totalKeypoints
      });
    });
  });

  router.post('/:projectId/import-images', async (req, res) => {
    const { projectId } = req.params;
    const { images, mode = 'copy' } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: '请提供要导入的图片列表' });
    }

    const paths = PathService.getProjectPaths(projectId, projectsDir);
    await SafeFileOp.ensureDir(paths.uploads);
    const existingFiles = new Set(fs.readdirSync(paths.uploads));

    const results = { success: [], failed: [], skipped: [], duplicates: [] };
    const importRecord = {
      timestamp: new Date().toISOString(),
      sourcePath: images.length > 0 ? path.dirname(images[0].path) : '',
      mode,
      totalRequested: images.length,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      details: []
    };

    let nextIdx = PathService.getNextFileIndex(paths.uploads);

    for (const imageInfo of images) {
      const { path: sourcePath, name: originalName } = imageInfo;

      if (!fs.existsSync(sourcePath)) {
        results.failed.push({ path: sourcePath, error: '源文件不存在' });
        importRecord.details.push({ originalName, error: '源文件不存在', status: 'failed' });
        continue;
      }

      const ext = path.extname(originalName) || '.jpg';
      const targetName = String(nextIdx).padStart(6, '0') + ext;
      nextIdx++;

      const targetPath = path.join(paths.uploads, targetName);

      try {
        if (mode === 'copy') {
          await fs.promises.copyFile(sourcePath, targetPath);
        } else {
          await fs.promises.rename(sourcePath, targetPath);
        }

        existingFiles.add(targetName);
        results.success.push({ originalName, targetName });
        importRecord.details.push({ originalName, targetName, status: 'success' });
      } catch (err) {
        results.failed.push({ path: sourcePath, error: err.message });
        importRecord.details.push({ originalName, error: err.message, status: 'failed' });
      }
    }

    importRecord.successCount = results.success.length;
    importRecord.failedCount = results.failed.length;

    const historyPath = PathService.getImportHistoryPath(projectId, projectsDir);
    let history = [];
    if (fs.existsSync(historyPath)) {
      try {
        history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      } catch (e) {
        history = [];
      }
    }
    history.unshift(importRecord);
    if (history.length > 50) {
      history = history.slice(0, 50);
    }
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

    res.json({
      success: true,
      message: `成功导入 ${results.success.length}/${images.length} 张图片`,
      results,
      importRecord
    });
  });

  router.get('/:projectId/import-history', (req, res) => {
    const { projectId } = req.params;
    const historyPath = PathService.getImportHistoryPath(projectId, projectsDir);

    if (!fs.existsSync(historyPath)) {
      return res.json({ history: [] });
    }

    try {
      const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      res.json({ history });
    } catch (e) {
      res.json({ history: [] });
    }
  });

  router.post('/:projectId/renumber-all', async (req, res) => {
    const { projectId } = req.params;

    try {
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID required' });
      }

      const paths = PathService.getProjectPaths(projectId, projectsDir);
      if (!fs.existsSync(paths.root)) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const result = await RenumberService.renumberProject(projectId, projectsDir);

      res.json({
        message: `Renumbered ${result.count} files successfully`,
        count: result.count,
        totalImages: result.totalImages,
        filesRenamed: result.filesRenamed
      });
    } catch (err) {
      logger.error('Renumbering failed:', err);
      res.status(500).json({ error: 'Failed to renumber files', details: err.message });
    }
  });

  const createCollaborationArchive = (projectId, outputStream) => {
    return new Promise((resolve, reject) => {
      const paths = PathService.getProjectPaths(projectId, projectsDir);
      if (!fs.existsSync(paths.root)) {
        return reject(new Error('Project not found'));
      }

      const archive = archiver('zip', {
        zlib: { level: 0 }
      });

      outputStream.on('close', () => resolve(archive.pointer()));
      archive.on('error', (err) => reject(err));
      archive.pipe(outputStream);

      const safeDirs = ['uploads', 'annotations'];
      const safeFiles = ['config.json', 'import-history.json', 'project.json', 'index.json'];

      safeDirs.forEach(dir => {
        const dirPath = path.join(paths.root, dir);
        if (fs.existsSync(dirPath)) archive.directory(dirPath, dir);
      });

      safeFiles.forEach(file => {
        const filePath = path.join(paths.root, file);
        if (fs.existsSync(filePath)) archive.file(filePath, { name: file });
      });

      archive.finalize();
    });
  };

  router.get('/:projectId/collaboration/export', async (req, res) => {
    const { projectId } = req.params;
    try {
      res.set('Content-Type', 'application/zip');
      const safeFilename = encodeURIComponent(`${projectId}_collaboration.zip`);
      res.set('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);

      const bytes = await createCollaborationArchive(projectId, res);
      logger.info(`Collaboration ZIP exported for ${projectId}: ${bytes} bytes`);
    } catch (err) {
      logger.error('Failed to export collaboration ZIP:', err);
      if (!res.headersSent) {
        res.status(err.message === 'Project not found' ? 404 : 500).json({ error: err.message });
      }
    }
  });

  router.post('/:projectId/collaboration/export-to-path', async (req, res) => {
    const { projectId } = req.params;
    const { savePath } = req.body;

    if (!savePath) {
      return res.status(400).json({ error: 'Save path is required' });
    }

    try {
      const outputStream = fs.createWriteStream(savePath);
      const bytes = await createCollaborationArchive(projectId, outputStream);
      logger.info(`Collaboration ZIP saved to ${savePath} for ${projectId}: ${bytes} bytes`);
      res.json({ success: true, path: savePath, bytes });
    } catch (err) {
      logger.error('Failed to export collaboration ZIP to path:', err);
      res.status(500).json({ error: 'Failed to save collaboration package', details: err.message });
    }
  });

  router.post('/collaboration/import', upload.single('file'), async (req, res) => {
    const filePath = req.body.path || (req.file ? req.file.path : null);
    const customPath = req.body.customPath || null;

    logger.info(`Collaboration import request received. FilePath: ${filePath}, CustomPath: ${customPath}`);

    if (!filePath) {
      return res.status(400).json({ error: 'No file provided for import' });
    }

    if (!fs.existsSync(filePath)) {
      logger.error(`Import file not found: ${filePath}`);
      return res.status(400).json({ error: `Selected file does not exist: ${filePath}` });
    }

    let targetDir = projectsDir;
    if (customPath) {
      targetDir = PathService.resolveCustomProjectPath(customPath, projectsDir);
      try {
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
      } catch (e) {
        return res.status(400).json({ error: `无法创建目录: ${e.message}` });
      }
    }

    try {
      const zip = new AdmZip(filePath);
      let projectName = req.body.name || path.basename(filePath, path.extname(filePath)).replace('_collaboration', '');

      projectName = PathService.sanitizeProjectName(projectName);

      let finalProjectName = projectName;
      let counter = 1;
      const allPaths = PathService.getAllProjectPaths(projectsDir);
      const projectExists = (name) => {
        for (const dir of allPaths) {
          if (fs.existsSync(path.join(dir, name))) {
            return true;
          }
        }
        return false;
      };
      while (projectExists(finalProjectName)) {
        finalProjectName = `${projectName}_${counter++}`;
      }

      logger.info(`Extracting project to: ${finalProjectName} at ${targetDir}`);
      
      const projectRoot = path.join(targetDir, finalProjectName);
      await PathService.ensureProjectDirs(finalProjectName, projectsDir, targetDir);

      await extractZipAsync(filePath, projectRoot, true);

      projectRegistry.registerProject(finalProjectName, projectRoot);

      if (customPath && customPath !== projectsDir) {
        PathService.addToAdditionalPaths(customPath);
      }

      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          logger.warn(`Failed to delete temp upload file: ${req.file.path}`);
        }
      }

      logger.info(`Project imported successfully: ${finalProjectName}`);
      res.json({ message: 'Project imported successfully', id: finalProjectName });
    } catch (err) {
      logger.error('Failed to import collaboration ZIP:', err);
      logger.error(err.stack);
      res.status(500).json({
        error: 'Failed to import collaboration package',
        details: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  });

  router.post('/:projectId/predict', async (req, res) => {
    const { projectId } = req.params;
    const { modelPath, images, confidenceThreshold, mode, device, imgsz } = req.body;

    try {
      const result = await PredictionService.runPredictionOnImages(projectId, {
        modelPath,
        images,
        confidenceThreshold: confidenceThreshold || 0.25,
        mode: mode || 'all',
        device,
        imgsz,
        projectsDir
      });

      res.json({
        success: true,
        message: '预标注任务已启动',
        taskId: `${projectId}-${Date.now()}`
      });
    } catch (err) {
      logger.error(`Prediction failed for ${projectId}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:projectId/predict/status', (req, res) => {
    const { projectId } = req.params;
    const status = PredictionService.getStatus(projectId);

    res.json({
      isRunning: status.status === 'running',
      progress: status.progress ? parseFloat(status.progress.percentage) : 0,
      activeProgress: status.progress ? parseFloat(status.progress.activePercentage || status.progress.percentage) : 0,
      current: status.progress ? status.progress.processed : 0,
      active: status.progress ? status.progress.active : 0,
      total: status.progress ? status.progress.total : 0,
      message: status.progress ? status.progress.currentImage : '',
      successCount: status.progress ? status.progress.successCount : 0,
      failedCount: status.progress ? status.progress.failedCount : 0,
      results: status.metrics || [],
      logs: status.logs || [],
      status: status.status
    });
  });

  router.post('/:projectId/predict/cancel', async (req, res) => {
    const { projectId } = req.params;

    try {
      await PredictionService.cancelPrediction(projectId);
      res.json({ success: true, message: '预标注任务已取消' });
    } catch (err) {
      logger.error(`Failed to cancel prediction for ${projectId}:`, err);
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/:projectId/predict/validate-model', async (req, res) => {
    const { projectId } = req.params;
    const { modelPath } = req.body;

    try {
      const result = await PredictionService.validateModel(modelPath);
      res.json({
        valid: result.valid,
        error: result.error || null,
        info: result.valid ? {
          path: result.path,
          size: result.size,
          format: result.format
        } : null
      });
    } catch (err) {
      logger.error(`Model validation failed for ${projectId}:`, err);
      res.status(500).json({ valid: false, error: err.message });
    }
  });

  router.post('/:projectId/predict/single', async (req, res) => {
    const { projectId } = req.params;
    const { imageName, modelPath, confidenceThreshold = 0.25 } = req.body;

    if (!imageName) {
      return res.status(400).json({ error: '缺少图片名称' });
    }

    if (!modelPath) {
      return res.status(400).json({ error: '缺少模型路径' });
    }

    try {
      const result = await PredictionService.runPredictionOnImages(projectId, {
        modelPath,
        images: [imageName],
        confidenceThreshold,
        mode: 'all',
        projectsDir
      });

      const paths = PathService.getProjectPaths(projectId, projectsDir);
      const annotationPath = path.join(paths.annotations, `${imageName}.json`);

      let predictions = [];
      if (fs.existsSync(annotationPath)) {
        predictions = JSON.parse(fs.readFileSync(annotationPath, 'utf8'));
      }

      res.json({
        success: true,
        predictions,
        message: `预标注完成: ${imageName}`
      });
    } catch (err) {
      logger.error(`Single prediction failed for ${projectId}/${imageName}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:projectId/prediction-settings', async (req, res) => {
    const { projectId } = req.params;
    const { modelPath, confidenceThreshold } = req.body;

    try {
      await PathService.ensureProjectDirs(projectId, projectsDir);
      const settingsPath = PathService.getConfigPath(projectId, projectsDir).replace('config.json', 'prediction-settings.json');

      const existingSettings = fs.existsSync(settingsPath)
        ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
        : {};

      const newSettings = {
        ...existingSettings,
        modelPath,
        confidenceThreshold,
        lastUpdated: new Date().toISOString()
      };

      fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2));
      res.json({ success: true });
    } catch (err) {
      logger.error(`Failed to save prediction settings for ${projectId}:`, err);
      res.status(500).json({ error: '保存预标注设置失败' });
    }
  });

  router.get('/:projectId/prediction-settings', (req, res) => {
    const { projectId } = req.params;

    try {
      const settingsPath = PathService.getConfigPath(projectId, projectsDir).replace('config.json', 'prediction-settings.json');

      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        res.json({
          modelPath: settings.modelPath || '',
          confidenceThreshold: settings.confidenceThreshold || 0.25,
          lastPredictionTime: settings.lastUpdated || null
        });
      } else {
        res.json({
          modelPath: '',
          confidenceThreshold: 0.25,
          lastPredictionTime: null
        });
      }
    } catch (err) {
      logger.error(`Failed to get prediction settings for ${projectId}:`, err);
      res.status(500).json({ error: '获取预标注设置失败' });
    }
  });

  return router;
}

module.exports = createProjectRouter;
