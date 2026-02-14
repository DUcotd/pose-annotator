const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { imageSize } = require('image-size');
const logger = require('../utils/logger');
const SafeFileOp = require('../services/FileService');
const settings = require('../config/settings');

function createProjectRouter(projectsDir) {
  const router = express.Router();

  const getProjectPaths = (projectId) => {
    const root = path.join(projectsDir, projectId);
    return {
      root,
      uploads: path.join(root, 'uploads'),
      annotations: path.join(root, 'annotations'),
      thumbnails: path.join(root, 'thumbnails'),
      dataset: path.join(root, 'dataset')
    };
  };

  const ensureProjectDirs = (projectId) => {
    const paths = getProjectPaths(projectId);
    SafeFileOp.ensureDir(paths.root);
    SafeFileOp.ensureDir(paths.uploads);
    SafeFileOp.ensureDir(paths.annotations);
    SafeFileOp.ensureDir(paths.thumbnails);
    return paths;
  };

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const projectId = req.params.projectId;
      if (!projectId) return cb(new Error('Project ID required'));
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
      const projects = fs.readdirSync(projectsDir).filter(file => {
        if (file.startsWith('.') || file.startsWith('_to_delete_')) return false;
        try {
          return fs.statSync(path.join(projectsDir, file)).isDirectory();
        } catch (e) { return false; }
      });

      const projectList = projects.map(p => {
        const paths = getProjectPaths(p);
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
        return { id: p, name: p, imageCount, annotatedCount };
      });

      res.json(projectList);
    } catch (err) {
      logger.error('Failed to list projects:', err);
      res.status(500).json({ error: 'Failed to list projects' });
    }
  });

  router.post('/', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name required' });

    const safeName = name.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    const paths = ensureProjectDirs(safeName);

    logger.info(`Project created: ${safeName}`);
    res.json({ message: 'Project created', id: safeName });
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

  router.delete('/:projectId', (req, res) => {
    const { projectId } = req.params;
    const paths = getProjectPaths(projectId);

    if (fs.existsSync(paths.root)) {
      try {
        SafeFileOp.removeDirRename(paths.root).then(() => {
          logger.info(`Project deleted: ${projectId}`);
          res.json({ message: 'Project deleted' });
        }).catch(err => {
          logger.error(`Failed to delete project ${projectId}:`, err);
          res.status(500).json({ error: 'Failed to delete project', details: err.message });
        });
      } catch (err) {
        res.status(500).json({ error: 'Failed to delete project', details: err.message });
      }
    } else {
      res.status(404).json({ error: 'Project not found' });
    }
  });

  router.get('/:projectId/uploads/:filename', (req, res) => {
    const { projectId, filename } = req.params;
    const projectPath = path.join(projectsDir, projectId, 'uploads', filename);
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

  router.post('/:projectId/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ message: 'File uploaded successfully', filename: req.file.filename });
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
      let samples = [];

      images.forEach(imageFile => {
        const annotationFile = path.join(paths.annotations, `${imageFile}.json`);
        let isAnnotated = false;

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
        samples: samples
      });
    });
  });

  return router;
}

module.exports = createProjectRouter;
