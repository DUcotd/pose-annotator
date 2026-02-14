const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class ProjectIndexService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000;
  }

  getIndexPath(projectId, projectsDir) {
    return path.join(projectsDir, projectId, 'index.json');
  }

  async getIndex(projectId, projectsDir) {
    const indexPath = this.getIndexPath(projectId, projectsDir);

    if (this.cache.has(projectId)) {
      const cached = this.cache.get(projectId);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
    }

    if (fs.existsSync(indexPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        this.cache.set(projectId, { data, timestamp: Date.now() });
        return data;
      } catch (e) {
        logger.warn(`Failed to read index for ${projectId}:`, e.message);
      }
    }

    return null;
  }

  async updateIndex(projectId, projectsDir, imageData) {
    const indexPath = this.getIndexPath(projectId, projectsDir);
    const dir = path.dirname(indexPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const index = {
      lastUpdated: new Date().toISOString(),
      images: imageData.images || {},
      stats: imageData.stats || { total: 0, annotated: 0, bboxes: 0, keypoints: 0 }
    };

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
    this.cache.set(projectId, { data: index, timestamp: Date.now() });

    logger.debug(`Index updated for project ${projectId}`);
    return index;
  }

  async buildIndex(projectId, projectsDir) {
    const root = path.join(projectsDir, projectId);
    const uploads = path.join(root, 'uploads');
    const annotations = path.join(root, 'annotations');

    const images = {};
    let total = 0;
    let annotated = 0;
    let bboxes = 0;
    let keypoints = 0;

    if (fs.existsSync(uploads)) {
      const files = fs.readdirSync(uploads).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));

      for (const file of files) {
        total++;
        const annotationPath = path.join(annotations, `${file}.json`);
        let isAnnotated = false;

        if (fs.existsSync(annotationPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(annotationPath));
            const bboxCount = data.filter(a => a.type === 'bbox').length;
            const kpCount = data.filter(a => a.type === 'keypoint').length;

            if (bboxCount > 0 || kpCount > 0) {
              isAnnotated = true;
              annotated++;
              bboxes += bboxCount;
              keypoints += kpCount;
            }
          } catch (e) { }
        }

        let size = 0;
        try {
          const stats = fs.statSync(path.join(uploads, file));
          size = stats.size;
        } catch (e) { }

        images[file] = {
          annotated: isAnnotated,
          size,
          modified: fs.existsSync(annotationPath)
            ? fs.statSync(annotationPath).mtime.toISOString()
            : null
        };
      }
    }

    const indexData = {
      images,
      stats: { total, annotated, bboxes, keypoints }
    };

    return await this.updateIndex(projectId, projectsDir, indexData);
  }

  invalidate(projectId) {
    this.cache.delete(projectId);
  }

  clear() {
    this.cache.clear();
  }
}

module.exports = new ProjectIndexService();
