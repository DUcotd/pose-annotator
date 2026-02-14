const { Worker } = require('worker_threads');
const path = require('path');
const logger = require('./logger');

/**
 * Extracts a zip file asynchronously using a worker thread.
 * @param {string} filePath Path to the zip file.
 * @param {string} targetPath Path to extract to.
 * @param {boolean} overwrite Whether to overwrite existing files.
 * @returns {Promise<void>}
 */
function extractZipAsync(filePath, targetPath, overwrite = true) {
    return new Promise((resolve, reject) => {
        // Resolve the path to zipWorker.js relative to this file
        const workerPath = path.resolve(__dirname, 'zipWorker.js');

        const worker = new Worker(workerPath, {
            workerData: { filePath, targetPath, overwrite }
        });

        worker.on('message', (message) => {
            if (message.success) {
                resolve();
            } else {
                reject(new Error(message.error || 'Unknown error during extraction'));
            }
        });

        worker.on('error', (err) => {
            logger.error('Zip Worker Error:', err);
            reject(err);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}

module.exports = {
    extractZipAsync
};
