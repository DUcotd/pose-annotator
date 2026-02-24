const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const archiver = require('archiver');
const { ERROR_CODES } = require('../http/errorCodes');

function safeReadText(filePath, maxBytes = 200 * 1024) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    const size = stat.size;
    const start = Math.max(0, size - maxBytes);
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

function createSystemRouter(options = {}) {
  const router = express.Router();
  const getRouteManifest = options.getRouteManifest || (() => ({ routes: [], signature: '' }));
  const getRecentErrors = options.getRecentErrors || (() => []);
  const getStartupState = options.getStartupState || (() => ({}));
  const getLoggerInfo = options.getLoggerInfo || (() => ({}));

  const pkg = require(path.join(__dirname, '..', '..', '..', 'package.json'));

  const buildHealth = () => {
    const manifest = getRouteManifest();
    const signatureText = manifest.signature || '';
    const signature = crypto.createHash('sha256').update(signatureText).digest('hex');
    const startup = getStartupState();
    const routeList = Array.isArray(manifest.routes) ? manifest.routes : [];
    const hasRouteLike = (part) => routeList.some((r) => r.includes(part));

    return {
      backendVersion: pkg.version,
      apiVersion: 1,
      responseEnvelope: true,
      startupMode: startup.mode || 'strict',
      startupReady: startup.ready !== false,
      startupError: startup.error || null,
      capabilities: {
        diagnosticsExport: true,
        responseEnvelope: true,
        desktopDialogs: !!process.versions?.electron,
        projects: hasRouteLike('/api/projects'),
        gallery: hasRouteLike('/dataset/stats') || hasRouteLike('/images'),
        annotation: hasRouteLike('/annotations/'),
        export: hasRouteLike('/export/yolo'),
        training: hasRouteLike('/train'),
        trainingV2: hasRouteLike('/train/v2'),
        prediction: hasRouteLike('/predict'),
        settings: hasRouteLike('/api/settings')
      },
      routeSignature: {
        hash: signature,
        routeCount: routeList.length
      },
      frontendVersionExpected: pkg.version,
      node: process.version,
      platform: `${process.platform}-${process.arch}`
    };
  };

  router.get('/health', (req, res) => {
    res.sendOk(buildHealth());
  });

  router.post('/diagnostics/export', async (req, res) => {
    const now = new Date();
    const filename = `pose-annotator-diagnostics-${now.toISOString().replace(/[:.]/g, '-')}.zip`;

    try {
      const loggerInfo = getLoggerInfo();
      const recentErrors = getRecentErrors();
      const startup = getStartupState();
      const health = buildHealth();

      const diagnostics = {
        generatedAt: now.toISOString(),
        health,
        startup,
        recentErrors,
        env: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          cpus: os.cpus()?.length || null,
          totalMem: os.totalmem(),
          freeMem: os.freemem(),
          cwd: process.cwd(),
          versions: process.versions
        }
      };

      const combinedLogText = safeReadText(loggerInfo.combinedLogPath);
      const errorLogText = safeReadText(loggerInfo.errorLogPath);
      const appLogText = safeReadText(startup.appLogPath);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      const archivePromise = new Promise((resolve, reject) => {
        archive.on('error', reject);
        archive.on('end', resolve);
        archive.on('warning', (warning) => {
          if (warning?.code !== 'ENOENT') {
            reject(warning);
          }
        });
      });
      archive.pipe(res);

      archive.append(JSON.stringify(diagnostics, null, 2), { name: 'diagnostics.json' });
      if (combinedLogText) archive.append(combinedLogText, { name: 'logs/combined.log.tail.txt' });
      if (errorLogText) archive.append(errorLogText, { name: 'logs/error.log.tail.txt' });
      if (appLogText) archive.append(appLogText, { name: 'logs/electron-app.log.tail.txt' });

      await archive.finalize();
      await archivePromise;
    } catch (err) {
      if (!res.headersSent) {
        return res.sendError({
          code: ERROR_CODES.DIAGNOSTICS_EXPORT_FAILED,
          error: '导出诊断包失败',
          details: err.message
        }, 500);
      }
    }
  });

  return router;
}

module.exports = createSystemRouter;
