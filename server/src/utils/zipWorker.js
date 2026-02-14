const { parentPort, workerData } = require('worker_threads');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

/**
 * Worker thread for extracting zip files.
 * workerData: { filePath, targetPath, overwrite }
 */
try {
    const { filePath, targetPath, overwrite } = workerData;

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const zip = new AdmZip(filePath);
    zip.extractAllTo(targetPath, overwrite);

    parentPort.postMessage({ success: true });
} catch (error) {
    parentPort.postMessage({ success: false, error: error.message, stack: error.stack });
}
