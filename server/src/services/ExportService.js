const fs = require('fs');
const path = require('path');
const { imageSize: sizeOf } = require('image-size');
const logger = require('../utils/logger');
const SafeFileOp = require('./FileService');

class ExportService {
  constructor() {
    this.KEYPOINT_MARGIN_RATIO = 0.05;
    this.SUPPORTED_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp)$/i;
  }

  getProjectPaths(projectId, projectsDir) {
    const root = path.join(projectsDir, projectId);
    return {
      root,
      uploads: path.join(root, 'uploads'),
      annotations: path.join(root, 'annotations'),
      dataset: path.join(root, 'dataset'),
      imagesDir: path.join(root, 'dataset', 'images'),
      labelsDir: path.join(root, 'dataset', 'labels')
    };
  }

  async exportToYolo(projectId, projectsDir, options = {}) {
    const {
      includeVisibility = true,
      customPath = '',
      numKeypoints = 17,
      trainRatio = 0.8,
      valRatio = 0.2,
      testRatio = 0,
      shuffle = true,
      includeUnannotated = true
    } = options;

    const paths = this.getProjectPaths(projectId, projectsDir);
    const FIXED_NUM_KEYPOINTS = parseInt(numKeypoints) || 17;

    let FLIP_IDX;
    if (FIXED_NUM_KEYPOINTS === 17) {
      FLIP_IDX = [0, 1, 2, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15];
    } else {
      FLIP_IDX = Array.from({ length: FIXED_NUM_KEYPOINTS }, (_, i) => i);
    }

    let exportDir = paths.dataset;
    if (customPath && typeof customPath === 'string' && customPath.trim() !== '') {
      exportDir = path.join(path.resolve(customPath.trim()), 'dataset');
    }

    const datasetRootPath = exportDir.replace(/\\/g, '/');

    const splits = [];
    if (trainRatio > 0) splits.push({ name: 'train', ratio: trainRatio });
    if (valRatio > 0) splits.push({ name: 'val', ratio: valRatio });
    if (testRatio > 0) splits.push({ name: 'test', ratio: testRatio });

    await SafeFileOp.removeDir(exportDir);
    await SafeFileOp.ensureDir(exportDir);

    const imagesBaseDir = path.join(exportDir, 'images');
    const labelsBaseDir = path.join(exportDir, 'labels');
    await SafeFileOp.removeDir(imagesBaseDir);
    await SafeFileOp.removeDir(labelsBaseDir);

    for (const s of splits) {
      await SafeFileOp.ensureDir(path.join(imagesBaseDir, s.name));
      await SafeFileOp.ensureDir(path.join(labelsBaseDir, s.name));
    }

    const files = fs.readdirSync(paths.uploads).filter(f => this.SUPPORTED_EXTENSIONS.test(f));

    let maxClassIndex = -1;
    files.forEach(imageFile => {
      const annotationFile = path.join(paths.annotations, `${imageFile}.json`);
      if (fs.existsSync(annotationFile)) {
        try {
          const annotations = JSON.parse(fs.readFileSync(annotationFile));
          annotations.filter(a => a.type === 'bbox').forEach(bbox => {
            const idx = bbox.classIndex || 0;
            if (idx > maxClassIndex) maxClassIndex = idx;
          });
        } catch (e) { }
      }
    });

    const classNames = {};
    const configPath = path.join(paths.root, 'config.json');
    let projectConfig = { classMapping: {} };
    if (fs.existsSync(configPath)) {
      try {
        projectConfig = JSON.parse(fs.readFileSync(configPath));
      } catch (e) { }
    }

    for (let i = 0; i <= maxClassIndex; i++) {
      if (projectConfig.classMapping && projectConfig.classMapping[i]) {
        classNames[i] = projectConfig.classMapping[i].trim().replace(/\s+/g, '_') || `class_${i}`;
      } else {
        classNames[i] = `class_${i}`;
      }
    }

    let imagesToExport = files.filter(imageFile => {
      if (includeUnannotated) return true;
      const annotationFile = path.join(paths.annotations, `${imageFile}.json`);
      if (!fs.existsSync(annotationFile)) return false;
      try {
        const annotations = JSON.parse(fs.readFileSync(annotationFile));
        return annotations.some(a => a.type === 'bbox' || a.type === 'keypoint');
      } catch (e) { return false; }
    });

    if (shuffle) {
      for (let i = imagesToExport.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [imagesToExport[i], imagesToExport[j]] = [imagesToExport[j], imagesToExport[i]];
      }
    }

    const total = imagesToExport.length;
    const trainCount = Math.round(total * trainRatio);
    const valCount = Math.round(total * valRatio);

    const splitAssignments = [];
    for (let i = 0; i < total; i++) {
      if (i < trainCount) splitAssignments.push('train');
      else if (i < trainCount + valCount) splitAssignments.push('val');
      else splitAssignments.push('test');
    }

    const splitCounts = { train: 0, val: 0, test: 0 };
    let exportedImages = 0;
    let totalBBoxes = 0;
    let totalKeypoints = 0;

    imagesToExport.forEach((imageFile, idx) => {
      const splitName = splitAssignments[idx];
      const annotationFile = path.join(paths.annotations, `${imageFile}.json`);

      let annotations = [];
      if (fs.existsSync(annotationFile)) {
        try {
          annotations = JSON.parse(fs.readFileSync(annotationFile));
        } catch (e) { }
      }

      const bboxes = annotations.filter(a => a.type === 'bbox');
      const keypoints = annotations.filter(a => a.type === 'keypoint');

      const imagePath = path.join(paths.uploads, imageFile);
      let dimensions;
      try {
        const buffer = fs.readFileSync(imagePath);
        dimensions = sizeOf(buffer);
      } catch (e) { return; }
      const { width, height } = dimensions;

      const exportedName = String(idx).padStart(6, '0');
      const ext = path.extname(imageFile) || '.jpg';
      const newImageFile = exportedName + ext;
      const newLabelFile = exportedName + '.txt';

      const processedBBoxes = bboxes.map(bbox => ({
        ...bbox,
        cx: bbox.x + bbox.width / 2,
        cy: bbox.y + bbox.height / 2,
        marginW: bbox.width * this.KEYPOINT_MARGIN_RATIO,
        marginH: bbox.height * this.KEYPOINT_MARGIN_RATIO,
        assignedKeypoints: new Array(FIXED_NUM_KEYPOINTS).fill(null)
      }));

      const assignedDistances = processedBBoxes.map(() => new Array(FIXED_NUM_KEYPOINTS).fill(Infinity));

      keypoints.forEach(kp => {
        const kidx = kp.keypointIndex || 0;
        if (kidx >= FIXED_NUM_KEYPOINTS) return;
        totalKeypoints++;

        if (kp.parentId) {
          const parentIdx = processedBBoxes.findIndex(b => b.id === kp.parentId);
          if (parentIdx !== -1) {
            const parent = processedBBoxes[parentIdx];
            const dist = Math.sqrt(Math.pow(kp.x - parent.cx, 2) + Math.pow(kp.y - parent.cy, 2));
            if (dist < assignedDistances[parentIdx][kidx]) {
              parent.assignedKeypoints[kidx] = kp;
              assignedDistances[parentIdx][kidx] = dist;
            }
            return;
          }
        }

        processedBBoxes.forEach((bbox, bIdx) => {
          const inside =
            kp.x >= bbox.x - bbox.marginW &&
            kp.x <= bbox.x + bbox.width + bbox.marginW &&
            kp.y >= bbox.y - bbox.marginH &&
            kp.y <= bbox.y + bbox.height + bbox.marginH;

          if (inside) {
            const dist = Math.sqrt(Math.pow(kp.x - bbox.cx, 2) + Math.pow(kp.y - bbox.cy, 2));
            if (dist < assignedDistances[bIdx][kidx]) {
              assignedDistances[bIdx][kidx] = dist;
              bbox.assignedKeypoints[kidx] = kp;
            }
          }
        });
      });

      const lines = [];
      processedBBoxes.forEach(bbox => {
        totalBBoxes++;
        let bx = Math.max(0, bbox.x);
        let by = Math.max(0, bbox.y);
        let bw = Math.min(width - bx, bbox.width);
        let bh = Math.min(height - by, bbox.height);

        let cx = (bx + bw / 2) / width;
        let cy = (by + bh / 2) / height;
        let w = bw / width;
        let h = bh / height;

        cx = Math.max(0, Math.min(1, cx));
        cy = Math.max(0, Math.min(1, cy));
        w = Math.max(0, Math.min(1, w));
        h = Math.max(0, Math.min(1, h));

        const classIdx = bbox.classIndex || 0;
        const kptLine = [];

        for (let i = 0; i < FIXED_NUM_KEYPOINTS; i++) {
          const kp = bbox.assignedKeypoints[i];
          if (kp) {
            const nkx = kp.x / width;
            const nky = kp.y / height;
            if (includeVisibility) {
              kptLine.push(`${nkx.toFixed(6)} ${nky.toFixed(6)} 2`);
            } else {
              kptLine.push(`${nkx.toFixed(6)} ${nky.toFixed(6)}`);
            }
          } else {
            if (includeVisibility) {
              kptLine.push('0.000000 0.000000 0');
            } else {
              kptLine.push('0.000000 0.000000');
            }
          }
        }

        lines.push(`${classIdx} ${cx.toFixed(6)} ${cy.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)} ${kptLine.join(' ')}`);
      });

      const labelPath = path.join(labelsBaseDir, splitName, newLabelFile);
      fs.writeFileSync(labelPath, lines.join('\n'));
      fs.copyFileSync(imagePath, path.join(imagesBaseDir, splitName, newImageFile));
      exportedImages++;
      splitCounts[splitName]++;
    });

    let namesYaml = 'names:\n';
    for (let i = 0; i <= maxClassIndex; i++) {
      const name = classNames[i] || `class_${i}`;
      namesYaml += `  ${i}: ${name}\n`;
    }

    const kptShapeDim = includeVisibility ? 3 : 2;
    let splitPaths = '';
    if (splitCounts.train > 0) splitPaths += `train: images/train\n`;
    if (splitCounts.val > 0) splitPaths += `val: images/val\n`;
    if (splitCounts.test > 0) splitPaths += `test: images/test\n`;

    const yamlContent = `path: ${datasetRootPath}
${splitPaths}
kpt_shape: [${FIXED_NUM_KEYPOINTS}, ${kptShapeDim}]
flip_idx: [${FLIP_IDX.join(', ')}]

${namesYaml}`;

    fs.writeFileSync(path.join(exportDir, 'data.yaml'), yamlContent);

    logger.info(`Export complete: ${exportedImages}/${imagesToExport.length} images, ${totalBBoxes} objects, ${totalKeypoints} keypoints`);

    return {
      success: true,
      path: exportDir,
      stats: {
        images: exportedImages,
        totalImages: imagesToExport.length,
        train: splitCounts.train,
        val: splitCounts.val,
        test: splitCounts.test,
        objects: totalBBoxes,
        keypoints: totalKeypoints,
        kptShape: [FIXED_NUM_KEYPOINTS, kptShapeDim]
      }
    };
  }
}

module.exports = new ExportService();
