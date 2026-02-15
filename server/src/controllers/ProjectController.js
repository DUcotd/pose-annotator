const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const { imageSize } = require('image-size');
const logger = require('../utils/logger');
const SafeFileOp = require('../services/FileService');
const settings = require('../config/settings');
const projectRegistry = require('../services/ProjectRegistryService');
const { extractZipAsync } = require('../utils/zipUtils');

function createProjectRouter(projectsDir) {
  const router = express.Router();

  projectRegistry.init(projectsDir);

  const getAllProjectPaths = () => {
    const config = settings.load();
    const paths = [projectsDir];
    if (config.additionalProjectPaths && Array.isArray(config.additionalProjectPaths)) {
      config.additionalProjectPaths.forEach(p => {
        if (p && fs.existsSync(p) && !paths.includes(p)) {
          paths.push(p);
        }
      });
    }
    return paths;
  };

  const findProjectRoot = (projectId) => {
    const allPaths = getAllProjectPaths();
    for (const dir of allPaths) {
      const root = path.join(dir, projectId);
      if (fs.existsSync(root)) {
        return root;
      }
    }
    return path.join(projectsDir, projectId);
  };

  const getProjectPaths = (projectId) => {
    const root = findProjectRoot(projectId);
    return {
      root,
      uploads: path.join(root, 'uploads'),
      annotations: path.join(root, 'annotations'),
      thumbnails: path.join(root, 'thumbnails'),
      dataset: path.join(root, 'dataset')
    };
  };

  const ensureProjectDirs = (projectId, targetDir = null) => {
    const root = targetDir ? path.join(targetDir, projectId) : path.join(projectsDir, projectId);
    const paths = {
      root,
      uploads: path.join(root, 'uploads'),
      annotations: path.join(root, 'annotations'),
      thumbnails: path.join(root, 'thumbnails'),
      dataset: path.join(root, 'dataset')
    };
    SafeFileOp.ensureDir(paths.root);
    SafeFileOp.ensureDir(paths.uploads);
    SafeFileOp.ensureDir(paths.annotations);
    SafeFileOp.ensureDir(paths.thumbnails);
    return paths;
  };

  const getNextFileIndex = (uploadsDir) => {
    if (!fs.existsSync(uploadsDir)) return 0;
    try {
      const files = fs.readdirSync(uploadsDir);
      let maxIndex = -1;
      files.forEach(f => {
        const match = f.match(/^(\d{6})\./);
        if (match) {
          const idx = parseInt(match[1], 10);
          if (idx > maxIndex) maxIndex = idx;
        }
      });
      return maxIndex + 1;
    } catch (e) {
      logger.error('Failed to get next file index:', e);
      return 0;
    }
  };

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const projectId = req.params.projectId;
      if (!projectId) {
        const tempDir = path.join(projectsDir, '.temp_uploads');
        SafeFileOp.ensureDir(tempDir);
        return cb(null, tempDir);
      }
      const paths = ensureProjectDirs(projectId);
      cb(null, paths.uploads);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });

  const upload = multer({ storage });

  router.get('/', (req, res) => {
    try {
      const allPaths = getAllProjectPaths();
      const projectMap = new Map();

      allPaths.forEach(dir => {
        if (!fs.existsSync(dir)) return;
        try {
          const projects = fs.readdirSync(dir).filter(file => {
            if (file.startsWith('.') || file.startsWith('_to_delete_')) return false;
            try {
              return fs.statSync(path.join(dir, file)).isDirectory();
            } catch (e) { return false; }
          });

          projects.forEach(p => {
            if (!projectMap.has(p)) {
              projectMap.set(p, path.join(dir, p));
            }
          });
        } catch (e) {
          logger.error(`Failed to scan directory ${dir}:`, e);
        }
      });

      const projectList = Array.from(projectMap.entries()).map(([p, root]) => {
        const paths = {
          root,
          uploads: path.join(root, 'uploads'),
          annotations: path.join(root, 'annotations')
        };
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

  router.post('/', (req, res) => {
    const { name, customPath } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name required' });

    const safeName = name.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    
    let targetDir = projectsDir;
    if (customPath) {
      try {
        if (!fs.existsSync(customPath)) {
          fs.mkdirSync(customPath, { recursive: true });
        }
        targetDir = customPath;
      } catch (e) {
        return res.status(400).json({ error: `无法创建目录: ${e.message}` });
      }
    }

    const projectRoot = path.join(targetDir, safeName);
    if (fs.existsSync(projectRoot)) {
      return res.status(400).json({ error: '该项目名称已存在' });
    }

    const paths = {
      root: projectRoot,
      uploads: path.join(projectRoot, 'uploads'),
      annotations: path.join(projectRoot, 'annotations'),
      thumbnails: path.join(projectRoot, 'thumbnails'),
      dataset: path.join(projectRoot, 'dataset')
    };

    SafeFileOp.ensureDir(paths.root);
    SafeFileOp.ensureDir(paths.uploads);
    SafeFileOp.ensureDir(paths.annotations);
    SafeFileOp.ensureDir(paths.thumbnails);

    projectRegistry.registerProject(safeName, projectRoot, { name });

    if (customPath && customPath !== projectsDir) {
      const config = settings.load();
      const additionalPaths = config.additionalProjectPaths || [];
      if (!additionalPaths.includes(customPath)) {
        additionalPaths.push(customPath);
        settings.save({ additionalProjectPaths: additionalPaths });
      }
    }

    logger.info(`Project created: ${safeName} at ${targetDir}`);
    res.json({ message: 'Project created', id: safeName, path: projectRoot });
  });

  router.get('/:projectId/config', (req, res) => {
    const { projectId } = req.params;
    const paths = getProjectPaths(projectId);
    const configPath = path.join(paths.root, 'config.json');

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

  router.post('/:projectId/config', (req, res) => {
    const { projectId } = req.params;
    const config = req.body;
    const paths = ensureProjectDirs(projectId);
    const configPath = path.join(paths.root, 'config.json');

    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      res.json({ message: 'Project config saved' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to save project config' });
    }
  });

  router.delete('/:projectId', async (req, res) => {
    const { projectId } = req.params;
    const paths = getProjectPaths(projectId);

    if (!fs.existsSync(paths.root)) {
      projectRegistry.unregisterProject(projectId);
      return res.json({ message: 'Project not found, removed from registry' });
    }

    try {
      projectRegistry.markProjectDeleted(projectId);
      
      const result = await SafeFileOp.removeDirRename(paths.root);
      
      if (result.success) {
        if (result.pendingCleanup) {
          logger.info(`Project deletion pending cleanup: ${projectId}`);
          res.json({ 
            message: '项目删除中（部分文件被占用，将在重启后清理）',
            pendingCleanup: true 
          });
        } else {
          projectRegistry.unregisterProject(projectId);
          logger.info(`Project deleted: ${projectId}`);
          res.json({ message: '项目已成功删除' });
        }
      } else {
        throw new Error('删除操作未完成');
      }
    } catch (err) {
      logger.error(`Failed to delete project ${projectId}:`, err);
      
      const registryProject = projectRegistry.getProject(projectId);
      if (registryProject && registryProject.status === 'deleted') {
        projectRegistry.updateProject(projectId, { status: 'active' });
      }
      
      res.status(500).json({ error: '删除项目失败', details: err.message });
    }
  });

  router.get('/:projectId/uploads/:filename', (req, res) => {
    const { projectId, filename } = req.params;
    const paths = getProjectPaths(projectId);
    const projectPath = path.join(paths.uploads, filename);
    if (fs.existsSync(projectPath)) {
      res.sendFile(projectPath);
    } else {
      res.status(404).send('File not found');
    }
  });

  router.get('/:projectId/thumbnails/:filename', async (req, res) => {
    const { projectId, filename } = req.params;
    const paths = ensureProjectDirs(projectId);
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
    const paths = getProjectPaths(projectId);

    try {
      const ext = path.extname(req.file.originalname) || '.jpg';
      const nextIdx = getNextFileIndex(paths.uploads);
      const newFilename = String(nextIdx).padStart(6, '0') + ext;
      const targetPath = path.join(paths.uploads, newFilename);

      await fs.promises.rename(req.file.path, targetPath);

      res.json({ message: 'File uploaded and encoded successfully', filename: newFilename });
    } catch (err) {
      logger.error('Failed to rename uploaded file:', err);
      res.status(500).json({ error: 'Failed to encode uploaded file', details: err.message });
    }
  });

  router.get('/:projectId/images', (req, res) => {
    const { projectId } = req.params;
    const paths = ensureProjectDirs(projectId);

    fs.readdir(paths.uploads, (err, files) => {
      if (err) return res.status(500).json({ error: 'Unable to scan directory' });

      const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
      const imageList = imageFiles.map(file => {
        const annotationPath = path.join(paths.annotations, `${file}.json`);
        let hasAnnotation = false;
        if (fs.existsSync(annotationPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(annotationPath));
            hasAnnotation = data.some(a => a.type === 'bbox' || a.type === 'keypoint');
          } catch (e) { }
        }

        let size = 0;
        try {
          const stats = fs.statSync(path.join(paths.uploads, file));
          size = stats.size;
        } catch (e) { }

        return { name: file, hasAnnotation, size };
      });

      res.json(imageList);
    });
  });

  router.get('/:projectId/annotations/:imageId', (req, res) => {
    const { projectId, imageId } = req.params;
    const paths = getProjectPaths(projectId);
    const annotationPath = path.join(paths.annotations, `${imageId}.json`);

    if (fs.existsSync(annotationPath)) {
      const data = fs.readFileSync(annotationPath);
      res.json(JSON.parse(data));
    } else {
      res.json([]);
    }
  });

  router.post('/:projectId/annotations/:imageId', (req, res) => {
    const { projectId, imageId } = req.params;
    const paths = ensureProjectDirs(projectId);
    const annotations = req.body;
    const annotationPath = path.join(paths.annotations, `${imageId}.json`);

    fs.writeFile(annotationPath, JSON.stringify(annotations, null, 2), (err) => {
      if (err) return res.status(500).json({ error: 'Failed to save annotations' });
      res.json({ message: 'Annotations saved successfully' });
    });
  });

  router.get('/:projectId/dataset/stats', (req, res) => {
    const { projectId } = req.params;
    const paths = getProjectPaths(projectId);

    if (!fs.existsSync(paths.uploads)) {
      return res.json({ total: 0, annotated: 0, unannotated: 0, samples: [] });
    }

    fs.readdir(paths.uploads, (err, files) => {
      if (err) return res.status(500).json({ error: 'Failed to scan dataset' });

      const images = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
      let annotatedCount = 0;
      let totalSize = 0;
      let samples = [];

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
            if (data.some(a => a.type === 'bbox' || a.type === 'keypoint')) {
              isAnnotated = true;
            }
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
        samples: samples
      });
    });
  });

  router.post('/:projectId/import-images', async (req, res) => {
    const { projectId } = req.params;
    const { images, mode = 'copy' } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: '请提供要导入的图片列表' });
    }

    const paths = getProjectPaths(projectId);
    SafeFileOp.ensureDir(paths.uploads);
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

    let nextIdx = getNextFileIndex(paths.uploads);

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

    const historyPath = path.join(paths.root, 'import-history.json');
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
    const paths = getProjectPaths(projectId);
    const historyPath = path.join(paths.root, 'import-history.json');

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

  const createCollaborationArchive = (projectId, outputStream) => {
    return new Promise((resolve, reject) => {
      const paths = getProjectPaths(projectId);
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
      try {
        if (!fs.existsSync(customPath)) {
          fs.mkdirSync(customPath, { recursive: true });
        }
        targetDir = customPath;
      } catch (e) {
        return res.status(400).json({ error: `无法创建目录: ${e.message}` });
      }
    }

    try {
      const zip = new AdmZip(filePath);
      let projectName = req.body.name || path.basename(filePath, path.extname(filePath)).replace('_collaboration', '');

      projectName = projectName.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

      let finalProjectName = projectName;
      let counter = 1;
      const allPaths = getAllProjectPaths();
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
      const paths = {
        root: projectRoot,
        uploads: path.join(projectRoot, 'uploads'),
        annotations: path.join(projectRoot, 'annotations'),
        thumbnails: path.join(projectRoot, 'thumbnails')
      };
      
      SafeFileOp.ensureDir(paths.root);
      SafeFileOp.ensureDir(paths.uploads);
      SafeFileOp.ensureDir(paths.annotations);
      SafeFileOp.ensureDir(paths.thumbnails);

      await extractZipAsync(filePath, paths.root, true);

      projectRegistry.registerProject(finalProjectName, projectRoot);

      if (customPath && customPath !== projectsDir) {
        const config = settings.load();
        const additionalPaths = config.additionalProjectPaths || [];
        if (!additionalPaths.includes(customPath)) {
          additionalPaths.push(customPath);
          settings.save({ additionalProjectPaths: additionalPaths });
        }
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

  return router;
}

module.exports = createProjectRouter;
