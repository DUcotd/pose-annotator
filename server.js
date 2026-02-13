const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { imageSize: sizeOf } = require('image-size');
const { spawn } = require('child_process');
const sharp = require('sharp');
const AdmZip = require('adm-zip');
const archiver = require('archiver');

const app = express();
const PORT = 5000;
const trainingProcesses = {}; // Store active training processes: projectId -> { process, logs: [], status: 'idle'|'running'|'completed'|'failed' }

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Global error handlers - prevent server crashes
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err.message);
    console.error(err.stack);
});
process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] Unhandled Rejection:', reason);
});

// --- DATA DIRECTORY LOGIC ---
let PROJECTS_DIR;
if (process.versions.electron) {
    // If running in Electron, use the user's data directory to ensure it's writable
    const { app } = require('electron');
    // Note: server.js is required by main process, so app is available
    PROJECTS_DIR = path.join(app.getPath('userData'), 'projects');
} else {
    PROJECTS_DIR = path.join(__dirname, 'projects');
}

if (!fs.existsSync(PROJECTS_DIR)) {
    try {
        fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    } catch (e) {
        console.error('Failed to create projects directory:', e.message);
    }
}

// --- MIGRATION LOGIC ---
const LEGACY_UPLOADS = path.join(__dirname, 'uploads');
const LEGACY_ANNOTATIONS = path.join(__dirname, 'annotations');

if (fs.existsSync(LEGACY_UPLOADS)) {
    console.log("Found legacy data. Migrating to 'Default_Project'...");
    const defaultProjPath = path.join(PROJECTS_DIR, 'Default_Project');

    if (!fs.existsSync(defaultProjPath)) {
        fs.mkdirSync(defaultProjPath);
        fs.renameSync(LEGACY_UPLOADS, path.join(defaultProjPath, 'uploads'));
        if (fs.existsSync(LEGACY_ANNOTATIONS)) {
            fs.renameSync(LEGACY_ANNOTATIONS, path.join(defaultProjPath, 'annotations'));
        }
    }
    console.log("Migration complete.");
}
// -----------------------

// Helper: Get Paths
const getProjectPaths = (projectId) => {
    const root = path.join(PROJECTS_DIR, projectId);
    return {
        root,
        uploads: path.join(root, 'uploads'),
        annotations: path.join(root, 'annotations'),
        thumbnails: path.join(root, 'thumbnails'),
        dataset: path.join(root, 'dataset'),
        imagesDir: path.join(root, 'dataset', 'images'),
        labelsDir: path.join(root, 'dataset', 'labels')
    };
};

// Helper: Ensure Project Dirs
const ensureProjectDirs = (projectId) => {
    const paths = getProjectPaths(projectId);
    if (!fs.existsSync(paths.root)) fs.mkdirSync(paths.root);
    if (!fs.existsSync(paths.uploads)) fs.mkdirSync(paths.uploads);
    if (!fs.existsSync(paths.annotations)) fs.mkdirSync(paths.annotations);
    if (!fs.existsSync(paths.thumbnails)) fs.mkdirSync(paths.thumbnails);
    return paths;
};

// Multer Storage (Dynamic Destination)
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


// --- API: PROJECTS ---

// List Projects
app.get('/api/projects', (req, res) => {
    try {
        const projects = fs.readdirSync(PROJECTS_DIR).filter(file => {
            try {
                // Filter out hidden folders and our Windows-specific temp deletion folders
                if (file.startsWith('.') || file.startsWith('_to_delete_')) return false;
                return fs.statSync(path.join(PROJECTS_DIR, file)).isDirectory();
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

                    // Count annotated images
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
            } catch (e) { /* ignore */ }
            return { id: p, name: p, imageCount, annotatedCount };
        });

        res.json(projectList);
    } catch (err) {
        console.error('Failed to list projects:', err.message);
        res.status(500).json({ error: 'Failed to list projects' });
    }
});

// Create Project
app.post('/api/projects', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name required' });

    // Allow all characters except reserved filesystem characters
    const safeName = name.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    const paths = ensureProjectDirs(safeName);

    res.json({ message: 'Project created', id: safeName });
});

// Get Project Config
app.get('/api/projects/:projectId/config', (req, res) => {
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

// Save Project Config
app.post('/api/projects/:projectId/config', (req, res) => {
    const { projectId } = req.params;
    const config = req.body;
    const paths = getProjectPaths(projectId);
    const configPath = path.join(paths.root, 'config.json');

    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        res.json({ message: 'Project config saved' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save project config' });
    }
});

// Delete Project
app.delete('/api/projects/:projectId', (req, res) => {
    const { projectId } = req.params;
    const paths = getProjectPaths(projectId);

    // Check if project has active training
    if (trainingProcesses[projectId] && trainingProcesses[projectId].status === 'running') {
        return res.status(400).json({ error: 'Cannot delete project while training is in progress.' });
    }

    if (fs.existsSync(paths.root)) {
        try {
            // Windows fix: Try renaming first to break accidental handles, then delete
            const tempDeletePath = path.join(PROJECTS_DIR, `_to_delete_${Date.now()}_${projectId}`);
            fs.renameSync(paths.root, tempDeletePath);

            // Asynchronous removal is safer for the main event loop
            fs.rm(tempDeletePath, { recursive: true, force: true }, (err) => {
                if (err) console.error(`Background cleanup failed for "${projectId}":`, err.message);
                else console.log(`Project "${projectId}" directory removed successfully.`);
            });

            res.json({ message: 'Project deleted' });
        } catch (err) {
            console.error(`Failed to delete project "${projectId}":`, err.message);
            // If renameSync failed, it's likely a file lock.
            res.status(500).json({
                error: 'Failed to delete project. Make sure no files are open in another program.',
                details: err.message
            });
        }
    } else {
        res.status(404).json({ error: 'Project not found' });
    }
});


// --- API: IMAGES & ANNOTATIONS (Scoped by Project) ---

// Serve Uploaded Images
app.get('/api/projects/:projectId/uploads/:filename', (req, res) => {
    const { projectId, filename } = req.params;
    const projectPath = path.join(PROJECTS_DIR, projectId, 'uploads', filename);
    if (fs.existsSync(projectPath)) {
        res.sendFile(projectPath);
    } else {
        res.status(404).send('File not found');
    }
});

// Serve / Generate Thumbnails
app.get('/api/projects/:projectId/thumbnails/:filename', async (req, res) => {
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
        console.error('Thumbnail generation failed:', err.message);
        // Fallback to original image if thumbnail fails
        res.sendFile(originalPath);
    }
});

// Upload Image
app.post('/api/projects/:projectId/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ message: 'File uploaded successfully', filename: req.file.filename });
});

// List Images
app.get('/api/projects/:projectId/images', (req, res) => {
    const { projectId } = req.params;
    const paths = ensureProjectDirs(projectId);

    fs.readdir(paths.uploads, (err, files) => {
        if (err) return res.status(500).json({ error: 'Unable to scan directory' });

        const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));

        // Map each image to an object containing its name and annotation status
        const imageList = imageFiles.map(file => {
            const annotationPath = path.join(paths.annotations, `${file}.json`);
            let hasAnnotation = false;
            if (fs.existsSync(annotationPath)) {
                try {
                    const data = JSON.parse(fs.readFileSync(annotationPath));
                    // Check if it contains actual bounding boxes or keypoints
                    hasAnnotation = data.some(a => a.type === 'bbox' || a.type === 'keypoint');
                } catch (e) {
                    console.error(`Error parsing annotation for ${file}:`, e.message);
                }
            }
            return {
                name: file,
                hasAnnotation: hasAnnotation
            };
        });

        res.json(imageList);
    });
});

// Get Annotations
app.get('/api/projects/:projectId/annotations/:imageId', (req, res) => {
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

// Save Annotations
app.post('/api/projects/:projectId/annotations/:imageId', (req, res) => {
    const { projectId, imageId } = req.params;
    const paths = ensureProjectDirs(projectId);
    const annotations = req.body;
    const annotationPath = path.join(paths.annotations, `${imageId}.json`);

    fs.writeFile(annotationPath, JSON.stringify(annotations, null, 2), (err) => {
        if (err) return res.status(500).json({ error: 'Failed to save annotations' });
        res.json({ message: 'Annotations saved successfully' });
    });
});


// --- API: UTILS ---

// Open Folder Selection Dialog (Electron only)
app.post('/api/utils/select-folder', async (req, res) => {
    let electron;
    try {
        electron = require('electron');
    } catch (e) { }

    if (electron && electron.dialog) {
        try {
            const { dialog, BrowserWindow } = electron;
            const win = BrowserWindow.getFocusedWindow();
            const result = await dialog.showOpenDialog(win, {
                properties: ['openDirectory']
            });
            if (!result.canceled && result.filePaths.length > 0) {
                res.json({ path: result.filePaths[0] });
            } else {
                res.json({ path: null });
            }
        } catch (err) {
            console.error('Failed to open folder dialog:', err);
            res.status(500).json({ error: 'Failed to open folder dialog' });
        }
    } else {
        res.status(400).json({ error: 'Folder picker is only available in Desktop version' });
    }
});

// Open File Selection Dialog (Electron only)
app.post('/api/utils/select-file', async (req, res) => {
    console.log('[API] Received request to select-file');

    // Check if we are in Electron or if we can require it
    let electron;
    try {
        electron = require('electron');
    } catch (e) {
        console.error('[API] Electron module not found:', e.message);
    }

    if (electron && electron.dialog) {
        try {
            const { dialog, BrowserWindow } = electron;
            console.log('[API] Opening file dialog...');

            // Try to get main window to make dialog modal/on-top
            const win = BrowserWindow.getFocusedWindow();

            const { filters } = req.body;
            const defaultFilters = [
                { name: 'ZIP Archive', extensions: ['zip'] },
                { name: 'YAML Configuration', extensions: ['yaml', 'yml'] },
                { name: 'All Files', extensions: ['*'] }
            ];

            const result = await dialog.showOpenDialog(win, {
                properties: ['openFile'],
                filters: filters || defaultFilters
            });

            if (!result.canceled && result.filePaths.length > 0) {
                console.log('[API] File selected:', result.filePaths[0]);
                res.json({ path: result.filePaths[0] });
            } else {
                console.log('[API] File selection canceled');
                res.json({ path: null });
            }
        } catch (err) {
            console.error('[API] Failed to open file dialog:', err);
            res.status(500).json({ error: 'Failed to open file dialog: ' + err.message });
        }
    } else {
        console.warn('[API] File picker called outside of Electron environment');
        res.status(400).json({
            error: 'File picker is only available in Desktop version.',
            details: {
                hasElectron: !!electron,
                hasDialog: electron ? !!electron.dialog : false,
                versions: process.versions
            }
        });
    }
});


// --- API: EXPORT ---

// Get Dataset Stats for Training Preview
app.get('/api/projects/:projectId/dataset/stats', (req, res) => {
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
                    // Check if there are any actual bounding boxes or keypoints
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

app.post('/api/projects/:projectId/export/yolo', (req, res) => {
    console.log('Export Request Body:', req.body);
    const { projectId } = req.params;
    const {
        includeVisibility = true,
        customPath = '',
        numKeypoints = 17,
        trainRatio = 0.8,
        valRatio = 0.2,
        testRatio = 0,
        shuffle = true,
        includeUnannotated = true
    } = req.body; // Default to 17 if not provided
    const paths = getProjectPaths(projectId);

    // Configuration
    const FIXED_NUM_KEYPOINTS = parseInt(numKeypoints) || 17;
    let FLIP_IDX = [];

    // Only use COCO flip indices if we are using the standard 17 keypoints
    if (FIXED_NUM_KEYPOINTS === 17) {
        FLIP_IDX = [0, 1, 2, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15];
    } else {
        // For custom keypoint counts, we default to no flipping (identity) or empty for now
        // Users would need to manually configure this in data.yaml if they want flip augmentation
        FLIP_IDX = Array.from({ length: FIXED_NUM_KEYPOINTS }, (_, i) => i);
    }

    const KEYPOINT_MARGIN_RATIO = 0.05; // 5% margin for loose containment

    // Determine Export Directory
    let exportDir = paths.dataset;
    // Use absolute path for dataset root to avoid YOLO path resolution issues
    // Normalize to forward slashes to ensure compatibility with Python/YAML
    let datasetRootPath = exportDir.replace(/\\/g, '/');

    if (customPath && typeof customPath === 'string' && customPath.trim() !== '') {
        const absolutePath = path.resolve(customPath.trim());
        exportDir = absolutePath;
        datasetRootPath = absolutePath.replace(/\\/g, '/');
    }

    // Determine which splits are active
    const splits = [];
    if (trainRatio > 0) splits.push({ name: 'train', ratio: trainRatio });
    if (valRatio > 0) splits.push({ name: 'val', ratio: valRatio });
    if (testRatio > 0) splits.push({ name: 'test', ratio: testRatio });

    // Clear/Create Dataset Dirs
    if (exportDir === paths.dataset) {
        if (fs.existsSync(exportDir)) fs.rmSync(exportDir, { recursive: true, force: true });
    }
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

    // Create split subdirectories: images/train, images/val, images/test, labels/train, labels/val, labels/test
    const imagesBaseDir = path.join(exportDir, 'images');
    const labelsBaseDir = path.join(exportDir, 'labels');
    if (fs.existsSync(imagesBaseDir)) fs.rmSync(imagesBaseDir, { recursive: true, force: true });
    if (fs.existsSync(labelsBaseDir)) fs.rmSync(labelsBaseDir, { recursive: true, force: true });

    splits.forEach(s => {
        fs.mkdirSync(path.join(imagesBaseDir, s.name), { recursive: true });
        fs.mkdirSync(path.join(labelsBaseDir, s.name), { recursive: true });
    });

    fs.readdir(paths.uploads, (err, files) => {
        if (err) return res.status(500).json({ error: 'Failed to read uploads' });

        try {
            const images = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));

            let maxClassIndex = -1;
            let totalKeypoints = 0;
            let totalBBoxes = 0;

            images.forEach(imageFile => {
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

            // Pass 2: Finalize Class Names
            const classNames = {};

            // Load project config if exists
            const configPath = path.join(paths.root, 'config.json');
            let projectConfig = { classMapping: {} };
            if (fs.existsSync(configPath)) {
                try {
                    projectConfig = JSON.parse(fs.readFileSync(configPath));
                } catch (e) { console.error('Failed to read config.json:', e); }
            }

            // Fill classNames: use mapping first, then dynamic from data, then default
            for (let i = 0; i <= maxClassIndex; i++) {
                if (projectConfig.classMapping && projectConfig.classMapping[i]) {
                    classNames[i] = projectConfig.classMapping[i].trim().replace(/\s+/g, '_') || `class_${i}`;
                } else {
                    classNames[i] = `class_${i}`;
                }
            }

            // Also check if some classes are used but not in mapping (though they'll get default class_i)

            // Filter images based on annotation status and user preference
            let imagesToExport = images.filter(imageFile => {
                if (includeUnannotated) return true; // Include all if requested

                const annotationFile = path.join(paths.annotations, `${imageFile}.json`);
                if (!fs.existsSync(annotationFile)) return false;
                try {
                    const annotations = JSON.parse(fs.readFileSync(annotationFile));
                    return annotations.some(a => a.type === 'bbox' || a.type === 'keypoint');
                } catch (e) { return false; }
            });

            if (imagesToExport.length === 0) {
                return res.json({
                    message: 'No annotated images to export',
                    path: exportDir,
                    stats: { images: 0, totalImages: images.length, train: 0, val: 0, test: 0, objects: 0, keypoints: 0 }
                });
            }

            // Shuffle if requested (Fisher-Yates)
            if (shuffle) {
                for (let i = imagesToExport.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [imagesToExport[i], imagesToExport[j]] = [imagesToExport[j], imagesToExport[i]];
                }
            }

            // Split into train/val/test sets
            const total = imagesToExport.length;
            const trainCount = Math.round(total * trainRatio);
            const valCount = Math.round(total * valRatio);
            // test gets the remainder to avoid rounding issues
            const splitAssignments = [];
            for (let i = 0; i < total; i++) {
                if (i < trainCount) splitAssignments.push('train');
                else if (i < trainCount + valCount) splitAssignments.push('val');
                else splitAssignments.push('test');
            }

            const splitCounts = { train: 0, val: 0, test: 0 };

            // Pass 2: Generate label files and copy images to split dirs
            let exportedImages = 0;
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
                // Even with no bboxes, we continue to create an empty label file if included

                const imagePath = path.join(paths.uploads, imageFile);
                let dimensions;
                try {
                    const buffer = fs.readFileSync(imagePath);
                    dimensions = sizeOf(buffer);
                } catch (e) { return; }
                const { width, height } = dimensions;

                const keypoints = annotations.filter(a => a.type === 'keypoint');
                let lines = [];

                const processedBBoxes = bboxes.map(bbox => ({
                    ...bbox,
                    cx: bbox.x + bbox.width / 2,
                    cy: bbox.y + bbox.height / 2,
                    marginW: bbox.width * KEYPOINT_MARGIN_RATIO,
                    marginH: bbox.height * KEYPOINT_MARGIN_RATIO,
                    assignedKeypoints: new Array(FIXED_NUM_KEYPOINTS).fill(null)
                }));

                const assignedDistances = processedBBoxes.map(() => new Array(FIXED_NUM_KEYPOINTS).fill(Infinity));

                keypoints.forEach(kp => {
                    const kidx = kp.keypointIndex || 0;
                    if (kidx >= FIXED_NUM_KEYPOINTS) return;
                    totalKeypoints++;

                    let bestBBox = null;
                    let bestBBoxIdx = -1;
                    let minDist = Infinity;

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
                            if (dist < minDist) {
                                minDist = dist;
                                bestBBox = bbox;
                                bestBBoxIdx = bIdx;
                            }
                        }
                    });

                    if (bestBBox && bestBBoxIdx !== -1) {
                        if (minDist < assignedDistances[bestBBoxIdx][kidx]) {
                            bestBBox.assignedKeypoints[kidx] = kp;
                            assignedDistances[bestBBoxIdx][kidx] = minDist;
                        }
                    }
                });

                processedBBoxes.forEach(bbox => {
                    totalBBoxes++;

                    // Clamp bbox to image dimensions to prevent out-of-bounds
                    let bx = Math.max(0, bbox.x);
                    let by = Math.max(0, bbox.y);
                    let bw = Math.min(width - bx, bbox.width);
                    let bh = Math.min(height - by, bbox.height);

                    // Calculate center and normalize
                    let cx = (bx + bw / 2) / width;
                    let cy = (by + bh / 2) / height;
                    let w = bw / width;
                    let h = bh / height;

                    // Final safety clamp to [0, 1]
                    cx = Math.max(0, Math.min(1, cx));
                    cy = Math.max(0, Math.min(1, cy));
                    w = Math.max(0, Math.min(1, w));
                    h = Math.max(0, Math.min(1, h));

                    const classIdx = bbox.classIndex || 0;

                    let kptLine = [];
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

                // Write to the correct split directory
                const labelPath = path.join(labelsBaseDir, splitName, imageFile.replace(/\.[^/.]+$/, "") + ".txt");
                fs.writeFileSync(labelPath, lines.join('\n'));
                fs.copyFileSync(imagePath, path.join(imagesBaseDir, splitName, imageFile));
                exportedImages++;
                splitCounts[splitName]++;
            });

            // Generate data.yaml with split paths
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
# Keypoints
kpt_shape: [${FIXED_NUM_KEYPOINTS}, ${kptShapeDim}]
flip_idx: [${FLIP_IDX.join(', ')}]

# Classes
${namesYaml}`;
            fs.writeFileSync(path.join(exportDir, 'data.yaml'), yamlContent);

            const splitInfo = splits.map(s => `${s.name}: ${splitCounts[s.name]}`).join(', ');
            console.log(`Export complete: ${exportedImages}/${images.length} images (${splitInfo}), ${totalBBoxes} objects, ${totalKeypoints} keypoints`);
            res.json({
                message: 'Export successful',
                path: exportDir,
                stats: {
                    images: exportedImages,
                    totalImages: images.length,
                    train: splitCounts.train,
                    val: splitCounts.val,
                    test: splitCounts.test,
                    objects: totalBBoxes,
                    keypoints: totalKeypoints,
                    kptShape: [FIXED_NUM_KEYPOINTS, kptShapeDim]
                }
            });

        } catch (error) {
            console.error('Export failed:', error);
            const logPath = path.join(__dirname, 'server_error_log.txt');
            const logEntry = `[${new Date().toISOString()}] Export Error:\n${error.stack}\n\n`;
            fs.appendFileSync(logPath, logEntry);
            res.status(500).json({ error: 'Export failed', details: error.message });
        }
    });
});


// --- API: TRAINING ---

const stripAnsi = (str) => {
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
};

app.post('/api/projects/:projectId/train', (req, res) => {
    const { projectId } = req.params;
    const {
        model = 'yolov8n.pt',
        data,
        epochs = 100,
        batch = 16,
        imgsz = 640,
        device = '0',
        project: customProject, // Override project directory
        name: customName       // Override run name
    } = req.body;

    if (trainingProcesses[projectId] && trainingProcesses[projectId].status === 'running') {
        return res.status(400).json({ error: 'Training is already in progress for this project.' });
    }

    const paths = getProjectPaths(projectId);
    const dataYamlPath = data && typeof data === 'string' && data.trim() !== ''
        ? (path.isAbsolute(data) ? data : path.join(paths.root, data))
        : path.join(paths.dataset, 'data.yaml');

    if (!fs.existsSync(dataYamlPath)) {
        return res.status(400).json({ error: `Dataset config not found at: ${dataYamlPath}. Please ensure the path is correct or export the dataset first.` });
    }

    const projectDir = customProject || paths.root; // Use custom or project folder
    const runName = customName || `train_${Date.now()}`;

    // Initialize process state
    trainingProcesses[projectId] = {
        status: 'running',
        logs: [],
        metrics: [], // Structured training metrics: { epoch, box_loss, cls_loss, kpt_loss, mAP50, gpu_mem }
        pid: null
    };

    const scriptPath = path.join(__dirname, 'scripts', 'train.py');
    const pythonArgs = [
        scriptPath,
        '--data', dataYamlPath,
        '--model', model,
        '--epochs', String(epochs),
        '--batch', String(batch),
        '--imgsz', String(imgsz),
        '--project', projectDir,
        '--name', runName,
        '--device', device
    ];

    // Use direct python path to avoid conda run encoding issues on Windows
    // Start with the specific path reported by the user
    const directPythonPath = 'D:\\miniconda3\\envs\\llm-gpu\\python.exe';

    let cmd = 'python';
    let args = [];

    if (fs.existsSync(directPythonPath)) {
        cmd = directPythonPath;
        args = [...pythonArgs];
    } else {
        // Fallback to conda run if direct path not found (though less likely to work if encoding is the issue)
        console.warn('Direct python path not found, falling back to conda run');
        cmd = 'conda';
        args = ['run', '-n', 'llm-gpu', 'python', ...pythonArgs];
    }

    try {
        console.log(`Starting training for ${projectId}: "${cmd}" ${args.map(a => `"${a}"`).join(' ')}`);

        // detached: true option might help with some console attachment issues, 
        // but let's stick to simple spawn first, maybe adding shell: true if needed.
        // For direct executable, shell:false is usually safer/better.
        const child = spawn(cmd, args, {
            windowsHide: true // Hide the terminal window if possible
        });

        trainingProcesses[projectId].pid = child.pid;

        child.stdout.on('data', (data) => {
            const rawOutput = data.toString();
            // ANSI escape code stripper
            const cleanOutput = rawOutput.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
            const lines = cleanOutput.split('\n');

            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed) {
                    console.log(`[Train ${projectId}] ${trimmed}`);
                    if (trainingProcesses[projectId]) {
                        trainingProcesses[projectId].logs.push({ type: 'stdout', msg: trimmed, time: Date.now() });

                        // Parse metrics from YOLO output (Simplified and more robust)
                        // This regex targets the "Epoch GPU_mem box_loss cls_loss dfl_loss" sequence
                        const metricMatch = trimmed.match(/^(\d+)\/(\d+)\s+([\d.]+G)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);

                        if (metricMatch) {
                            const [full, epoch, totalEpochs, gpuMem, boxLoss, clsLoss, dflLoss] = metricMatch;
                            const metricEntry = {
                                epoch: parseInt(epoch),
                                totalEpochs: parseInt(totalEpochs),
                                gpu_mem: gpuMem,
                                box_loss: parseFloat(boxLoss),
                                cls_loss: parseFloat(clsLoss),
                                dfl_loss: parseFloat(dflLoss),
                                time: Date.now()
                            };

                            const existingIdx = trainingProcesses[projectId].metrics.findIndex(m => m.epoch === metricEntry.epoch);
                            if (existingIdx !== -1) {
                                trainingProcesses[projectId].metrics[existingIdx] = {
                                    ...trainingProcesses[projectId].metrics[existingIdx],
                                    ...metricEntry
                                };
                            } else {
                                trainingProcesses[projectId].metrics.push(metricEntry);
                            }
                        }

                        // Validation row regex (for mAP)
                        // Expected: "all images instances P R mAP50 mAP50-95"
                        const mapMatch = trimmed.match(/^all\s+\d+\s+\d+\s+[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/);
                        if (mapMatch && trainingProcesses[projectId].metrics.length > 0) {
                            const map50 = parseFloat(mapMatch[1]);
                            const map50_95 = parseFloat(mapMatch[2]);

                            const lastIdx = trainingProcesses[projectId].metrics.length - 1;
                            trainingProcesses[projectId].metrics[lastIdx].mAP50 = map50;
                            trainingProcesses[projectId].metrics[lastIdx].mAP50_95 = map50_95;
                        }

                        if (trainingProcesses[projectId].logs.length > 1000) trainingProcesses[projectId].logs.shift();
                    }
                }
            });
        });

        child.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    console.error(`[Train ${projectId} ERR] ${line}`);
                    if (trainingProcesses[projectId]) {
                        trainingProcesses[projectId].logs.push({ type: 'stderr', msg: line, time: Date.now() });
                    }
                }
            });
        });

        child.on('close', (code) => {
            console.log(`Training process for ${projectId} exited with code ${code}`);
            if (trainingProcesses[projectId]) {
                trainingProcesses[projectId].status = code === 0 ? 'completed' : 'failed';
                trainingProcesses[projectId].logs.push({ type: 'system', msg: `Process exited with code ${code}`, time: Date.now() });
            }
        });

        child.on('error', (err) => {
            console.error(`Failed to start training process: ${err.message}`);
            if (trainingProcesses[projectId]) {
                trainingProcesses[projectId].status = 'failed';
                trainingProcesses[projectId].logs.push({ type: 'system', msg: `Failed to start: ${err.message}`, time: Date.now() });
            }
        });

        res.json({ message: 'Training started', runName });

    } catch (e) {
        console.error('Error spawning training process:', e);
        trainingProcesses[projectId] = { status: 'failed', logs: [{ type: 'system', msg: e.message }] };
        res.status(500).json({ error: 'Failed to start training' });
    }
});

app.get('/api/projects/:projectId/train/status', (req, res) => {
    const { projectId } = req.params;
    const processState = trainingProcesses[projectId];

    if (!processState) {
        return res.json({ status: 'idle', logs: [] });
    }

    res.json({
        status: processState.status,
        logs: processState.logs,
        metrics: processState.metrics || []
    });
});

app.post('/api/projects/:projectId/train/stop', (req, res) => {
    const { projectId } = req.params;
    const processState = trainingProcesses[projectId];

    if (processState && processState.status === 'running' && processState.pid) {
        // This might destroy the conda wrapper, not necessarily the python process if it spawned a child.
        // But for 'conda run', sending SIGTERM usually propagates or we might need tree-kill.
        // For simplicity, we try standard kill.
        try {
            process.kill(processState.pid);
            processState.status = 'stopped';
            processState.logs.push({ type: 'system', msg: 'Process stopped by user', time: Date.now() });
            res.json({ message: 'Training stopped' });
        } catch (e) {
            res.status(500).json({ error: 'Failed to stop process: ' + e.message });
        }
    } else {
        res.status(400).json({ error: 'No running training process found' });
    }
});

function str(v) { return String(v); }

// --- COLLABORATION: ZIP EXPORT/IMPORT ---

// Export project as ZIP for collaboration
app.get('/api/projects/:projectId/collaboration/export', (req, res) => {
    const { projectId } = req.params;
    const paths = getProjectPaths(projectId);

    if (!fs.existsSync(paths.root)) {
        return res.status(404).json({ error: 'Project not found' });
    }

    try {
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        // Set the headers
        res.set('Content-Type', 'application/zip');
        // Use encodeURIComponent to support non-ASCII characters in filename
        const safeFilename = encodeURIComponent(`${projectId}_collaboration.zip`);
        res.set('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);

        // Listen for all archive data to be written
        // 'close' event is fired only when a file descriptor is involved
        res.on('close', function () {
            console.log(archive.pointer() + ' total bytes');
            console.log('archiver has been finalized and the output file descriptor has closed.');
        });

        // Good practice to catch warnings (ie stat failures and other non-blocking errors)
        archive.on('warning', function (err) {
            if (err.code === 'ENOENT') {
                console.warn('Archiver warning:', err);
            } else {
                throw err;
            }
        });

        // Good practice to catch this error explicitly
        archive.on('error', function (err) {
            console.error('Archiver error:', err);
            res.status(500).send({ error: err.message });
        });

        // Pipe archive data to the response
        archive.pipe(res);

        // Add uploads folder
        if (fs.existsSync(paths.uploads)) {
            archive.directory(paths.uploads, 'uploads');
        }

        // Add annotations folder
        if (fs.existsSync(paths.annotations)) {
            archive.directory(paths.annotations, 'annotations');
        }

        // Add config.json if it exists
        const configPath = path.join(paths.root, 'config.json');
        if (fs.existsSync(configPath)) {
            archive.file(configPath, { name: 'config.json' });
        }

        // Finalize the archive (ie we are done appending files but streams have to finish yet)
        archive.finalize();

    } catch (err) {
        console.error('Failed to export collaboration ZIP:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to create collaboration package', details: err.message });
        }
    }
});

// Import project from ZIP for collaboration
app.post('/api/projects/collaboration/import', upload.single('file'), async (req, res) => {
    // Check for file path (from Electron) or uploaded file (Multer)
    const filePath = req.body.path || (req.file ? req.file.path : null);

    if (!filePath) {
        return res.status(400).json({ error: 'No file provided for import' });
    }

    try {
        const zip = new AdmZip(filePath);
        const zipEntries = zip.getEntries();

        // Determine project name from file name or generic
        let projectName = req.body.name || path.basename(filePath, path.extname(filePath)).replace('_collaboration', '');

        // Ensure project name is unique
        let finalProjectName = projectName;
        let counter = 1;
        while (fs.existsSync(path.join(PROJECTS_DIR, finalProjectName))) {
            finalProjectName = `${projectName}_${counter++}`;
        }

        const paths = ensureProjectDirs(finalProjectName);

        // Extract contents
        zip.extractAllTo(paths.root, true);

        // Clean up uploaded file if it was a temp upload
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }

        res.json({ message: 'Project imported successfully', id: finalProjectName });
    } catch (err) {
        console.error('Failed to import collaboration ZIP:', err);
        res.status(500).json({ error: 'Failed to import collaboration package', details: err.message });
    }
});

// Express 404 handler - handle routes that don't exist
app.use((req, res, next) => {
    console.warn('[Express 404]', req.method, req.path);
    res.status(404).json({ error: 'Route not found', method: req.method, path: req.path });
});

// Express error handler - catch any unhandled route errors
app.use((err, req, res, next) => {
    console.error('[Express Error]', req.method, req.path, err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

const startServer = (port = PORT) => {
    return app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
};

if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };
