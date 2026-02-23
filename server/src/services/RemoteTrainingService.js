const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const archiver = require('archiver');
const logger = require('../utils/logger');
const ProcessManager = require('../managers/ProcessManager');
const TrainingLogV2Service = require('./TrainingLogV2Service');
const { validateRemoteTrainConfig } = require('../utils/ValidationUtils');

const trimString = (value) => (typeof value === 'string' ? value.trim() : '');
const MAX_AUTO_REPAIR_ATTEMPTS = 1;
const REMOTE_DATASET_MANIFEST_FILE = '.pose_annotator_dataset_manifest.json';
const REMOTE_UPLOAD_STALL_TIMEOUT_MS = 3 * 60 * 1000;
const REMOTE_UPLOAD_PROGRESS_INTERVAL_MS = 15 * 1000;
const REMOTE_UPLOAD_PROGRESS_PERCENT_STEP = 10;
const REMOTE_UPLOAD_FASTPUT_CONCURRENCY = 128;
const REMOTE_UPLOAD_FASTPUT_CHUNK_SIZE = 256 * 1024;
const REMOTE_UPLOAD_STREAM_CHUNK_SIZE = 512 * 1024;
const DATASET_ARCHIVE_ZLIB_LEVEL = 1;
const ARCHIVE_STORE_FILE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
  '.mp4',
  '.avi',
  '.mov',
  '.mkv',
  '.zip',
  '.7z',
  '.rar',
  '.gz'
]);

class RemoteTrainingService {
  constructor() {
    this.connections = new Map();
  }

  hasConnection(projectId) {
    return this.connections.has(projectId);
  }

  shellEscape(value) {
    const str = String(value ?? '');
    return `'${str.replace(/'/g, `'\"'\"'`)}'`;
  }

  formatBytes(bytes) {
    const numeric = Number(bytes);
    if (!Number.isFinite(numeric) || numeric <= 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = numeric;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }

    const fractionDigits = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
    return `${size.toFixed(fractionDigits)} ${units[unitIndex]}`;
  }

  shouldStoreArchiveEntry(filePath = '') {
    const ext = path.extname(String(filePath || '')).toLowerCase();
    return ARCHIVE_STORE_FILE_EXTENSIONS.has(ext);
  }

  sanitizeRemoteConfig(config = {}) {
    const remotePortNum = Number(config.remotePort);
    const remotePort = Number.isInteger(remotePortNum) ? remotePortNum : 22;

    return {
      ...config,
      remoteHost: trimString(config.remoteHost),
      remotePort,
      remoteUser: trimString(config.remoteUser),
      remotePassword: typeof config.remotePassword === 'string' ? config.remotePassword : '',
      remotePath: trimString(config.remotePath) || '/tmp/training',
      remotePython: trimString(config.remotePython) || 'python3'
    };
  }

  getRemoteDatasetManifestPath(remotePath) {
    return path.posix.join(remotePath, REMOTE_DATASET_MANIFEST_FILE);
  }

  async hashFileSha256(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  async collectDatasetFiles(datasetRoot, relativeDir = '', files = []) {
    const currentDir = relativeDir
      ? path.join(datasetRoot, relativeDir)
      : datasetRoot;
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const relPath = relativeDir
        ? path.posix.join(relativeDir, entry.name)
        : entry.name;

      if (entry.isDirectory()) {
        await this.collectDatasetFiles(datasetRoot, relPath, files);
        continue;
      }
      if (entry.isFile()) {
        files.push(relPath);
      }
    }

    return files;
  }

  async buildLocalDatasetManifest(projectRoot) {
    const datasetPath = path.join(projectRoot, 'dataset');
    if (!fs.existsSync(datasetPath)) {
      throw new Error(`本地数据集目录不存在: ${datasetPath}`);
    }
    const yamlPath = path.join(datasetPath, 'data.yaml');
    if (!fs.existsSync(yamlPath)) {
      throw new Error(`本地数据集缺少 data.yaml: ${yamlPath}`);
    }

    const relativeFiles = await this.collectDatasetFiles(datasetPath);
    relativeFiles.sort((a, b) => a.localeCompare(b));

    const rollupHash = crypto.createHash('sha256');
    let totalBytes = 0;

    for (const relativeFile of relativeFiles) {
      const absolutePath = path.join(datasetPath, relativeFile);
      const stat = await fs.promises.stat(absolutePath);
      if (!stat.isFile()) continue;

      const contentHash = await this.hashFileSha256(absolutePath);
      totalBytes += Number(stat.size || 0);

      rollupHash.update(relativeFile);
      rollupHash.update('\t');
      rollupHash.update(String(stat.size));
      rollupHash.update('\t');
      rollupHash.update(contentHash);
      rollupHash.update('\n');
    }

    return {
      schemaVersion: 1,
      algorithm: 'sha256(path,size,content)',
      fingerprint: rollupHash.digest('hex'),
      fileCount: relativeFiles.length,
      totalBytes,
      generatedAt: new Date().toISOString()
    };
  }

  normalizeFingerprint(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  isValidFingerprint(value) {
    return /^[a-f0-9]{64}$/.test(this.normalizeFingerprint(value));
  }

  extractManifestFingerprint(manifest) {
    if (!manifest || typeof manifest !== 'object') return null;
    const fingerprint = this.normalizeFingerprint(manifest.fingerprint);
    if (!this.isValidFingerprint(fingerprint)) return null;
    return fingerprint;
  }

  planDatasetSync(localManifest, remoteManifest, hasRemoteDataYaml) {
    const localFingerprint = this.extractManifestFingerprint(localManifest);
    if (!localFingerprint) {
      return { shouldUpload: true, reason: 'local_manifest_invalid' };
    }

    if (!hasRemoteDataYaml) {
      return { shouldUpload: true, reason: 'remote_dataset_missing' };
    }

    const remoteFingerprint = this.extractManifestFingerprint(remoteManifest);
    if (!remoteFingerprint) {
      return { shouldUpload: true, reason: 'remote_manifest_missing' };
    }

    if (remoteFingerprint !== localFingerprint) {
      return { shouldUpload: true, reason: 'dataset_fingerprint_changed' };
    }

    return { shouldUpload: false, reason: 'dataset_fingerprint_match' };
  }

  describeDatasetSyncReason(reason) {
    const mapping = {
      local_manifest_invalid: '本地数据集指纹无效，需重新上传',
      remote_dataset_missing: '远程数据目录缺少 data.yaml',
      remote_manifest_missing: '远程不存在可用的数据集指纹清单',
      dataset_fingerprint_changed: '本地数据集与远程指纹不一致',
      dataset_fingerprint_match: '远程数据集指纹与本地一致'
    };
    return mapping[reason] || reason;
  }

  appendV2Event(projectId, eventInput = {}) {
    try {
      TrainingLogV2Service.appendEvent(projectId, eventInput);
    } catch (err) {
      logger.debug(`Failed to append remote v2 event for ${projectId}: ${err.message}`);
    }
  }

  updateV2Diagnosis(projectId, patch = {}) {
    try {
      TrainingLogV2Service.updateDiagnosis(projectId, patch);
    } catch (err) {
      logger.debug(`Failed to update remote v2 diagnosis for ${projectId}: ${err.message}`);
    }
  }

  setV2Status(projectId, status) {
    try {
      TrainingLogV2Service.setStatus(projectId, status);
    } catch (err) {
      logger.debug(`Failed to set remote v2 status for ${projectId}: ${err.message}`);
    }
  }

  async start(projectId, config) {
    const normalizedConfig = this.sanitizeRemoteConfig(config);
    const projectRoot = normalizedConfig.projectRoot;

    if (!projectRoot) {
      throw new Error('远程训练缺少 projectRoot，无法打包数据集');
    }

    const remoteValidation = validateRemoteTrainConfig({
      ...normalizedConfig,
      remoteEnabled: true
    });
    if (!remoteValidation.valid) {
      const detail = (remoteValidation.errors || [])
        .map((item) => `${item.field}: ${item.error}`)
        .join('；');
      throw new Error(`远程配置无效：${detail}`);
    }

    ProcessManager.create(projectId, projectRoot);
    ProcessManager.setStatus(projectId, 'starting');
    ProcessManager.addLog(projectId, {
      type: 'system',
      msg: `🌐 开始远程训练: ${normalizedConfig.remoteHost}:${normalizedConfig.remotePort}`,
      time: Date.now()
    });
    this.appendV2Event(projectId, {
      source: 'system',
      level: 'info',
      stage: 'bootstrap',
      kind: 'status',
      code: 'REMOTE_TRAINING_STARTING',
      message: '远程训练任务启动中',
      details: {
        remoteHost: normalizedConfig.remoteHost,
        remotePort: normalizedConfig.remotePort,
        remotePath: normalizedConfig.remotePath
      }
    });

    let conn = null;
    let zipPath = null;

    try {
      const localManifest = await this.buildLocalDatasetManifest(projectRoot);
      const localFingerprintShort = String(localManifest.fingerprint || '').slice(0, 12);
      ProcessManager.addLog(projectId, {
        type: 'system',
        msg: `🧾 本地数据集指纹: ${localFingerprintShort}... (files=${localManifest.fileCount}, bytes=${localManifest.totalBytes})`,
        time: Date.now()
      });
      this.appendV2Event(projectId, {
        source: 'system',
        level: 'info',
        stage: 'bootstrap',
        kind: 'metric',
        code: 'REMOTE_DATASET_FINGERPRINT_LOCAL',
        message: '已计算本地数据集指纹',
        details: {
          fingerprint: localManifest.fingerprint,
          fileCount: localManifest.fileCount,
          totalBytes: localManifest.totalBytes
        }
      });

      conn = await this.connect({
        host: normalizedConfig.remoteHost,
        port: normalizedConfig.remotePort,
        username: normalizedConfig.remoteUser,
        password: normalizedConfig.remotePassword
      });
      this.connections.set(projectId, { conn, stream: null });
      this.appendV2Event(projectId, {
        source: 'system',
        level: 'info',
        stage: 'bootstrap',
        kind: 'status',
        code: 'REMOTE_SSH_CONNECTED',
        message: '远程 SSH 连接成功'
      });

      const syncState = await this.evaluateDatasetSyncState(
        conn,
        normalizedConfig.remotePath,
        localManifest
      );
      const syncReasonText = this.describeDatasetSyncReason(syncState.reason);
      const remoteFingerprintShort = String(syncState.remoteManifest?.fingerprint || '').slice(0, 12);

      if (syncState.shouldUpload) {
        ProcessManager.addLog(projectId, {
          type: 'system',
          msg: `📦 远程数据集需要更新: ${syncReasonText}，开始上传...`,
          time: Date.now()
        });
        this.appendV2Event(projectId, {
          source: 'system',
          level: 'warn',
          stage: 'bootstrap',
          kind: 'status',
          code: 'REMOTE_DATASET_UPLOAD_REQUIRED',
          message: `远程数据集需上传: ${syncReasonText}`,
          details: {
            reason: syncState.reason,
            localFingerprint: localManifest.fingerprint,
            remoteFingerprint: syncState.remoteManifest?.fingerprint || null
          }
        });

        zipPath = await this.packageDataset(projectId, projectRoot);
        this.appendV2Event(projectId, {
          source: 'system',
          level: 'info',
          stage: 'bootstrap',
          kind: 'status',
          code: 'REMOTE_DATASET_PACKAGED',
          message: '本地数据集已打包',
          details: { zipPath: path.basename(zipPath) }
        });

        await this.uploadAndExtract(projectId, conn, zipPath, normalizedConfig.remotePath);
        this.appendV2Event(projectId, {
          source: 'system',
          level: 'info',
          stage: 'bootstrap',
          kind: 'status',
          code: 'REMOTE_DATASET_READY',
          message: '数据集已上传并解压到远程目录'
        });

        await this.cleanupLocalArchive(zipPath);
        zipPath = null;

        try {
          await this.writeRemoteDatasetManifest(conn, normalizedConfig.remotePath, {
            ...localManifest,
            projectId,
            remotePath: normalizedConfig.remotePath,
            syncedAt: new Date().toISOString()
          });
          this.appendV2Event(projectId, {
            source: 'system',
            level: 'info',
            stage: 'bootstrap',
            kind: 'status',
            code: 'REMOTE_DATASET_MANIFEST_UPDATED',
            message: '远程数据集指纹清单已更新',
            details: {
              fingerprint: localManifest.fingerprint,
              fileCount: localManifest.fileCount
            }
          });
        } catch (manifestErr) {
          ProcessManager.addLog(projectId, {
            type: 'error',
            msg: `写入远程数据集指纹清单失败: ${manifestErr.message}`,
            time: Date.now()
          });
          this.appendV2Event(projectId, {
            source: 'system',
            level: 'warn',
            stage: 'bootstrap',
            kind: 'diagnostic',
            code: 'REMOTE_DATASET_MANIFEST_WRITE_FAILED',
            message: `写入远程数据集指纹清单失败: ${manifestErr.message}`
          });
        }
      } else {
        ProcessManager.addLog(projectId, {
          type: 'system',
          msg: `♻️ 远程数据集复用命中，跳过上传 (fingerprint=${localFingerprintShort}..., remote=${remoteFingerprintShort || 'n/a'}...)`,
          time: Date.now()
        });
        this.appendV2Event(projectId, {
          source: 'system',
          level: 'info',
          stage: 'bootstrap',
          kind: 'status',
          code: 'REMOTE_DATASET_REUSED',
          message: `远程数据集一致，跳过上传: ${syncReasonText}`,
          details: {
            reason: syncState.reason,
            fingerprint: localManifest.fingerprint,
            remoteFingerprint: syncState.remoteManifest?.fingerprint || null
          }
        });
      }

      this.executeTraining(projectId, conn, normalizedConfig);
      return { success: true, message: '远程训练任务已启动' };
    } catch (err) {
      logger.error(`Failed to start remote training for ${projectId}: ${err.message}`);

      if (zipPath) {
        await this.cleanupLocalArchive(zipPath);
      }

      if (conn) {
        try {
          conn.end();
        } catch {
          // noop
        }
      }
      this.connections.delete(projectId);

      ProcessManager.setStatus(projectId, 'failed');
      ProcessManager.addLog(projectId, {
        type: 'error',
        msg: `远程训练启动失败: ${err.message}`,
        time: Date.now()
      });
      this.setV2Status(projectId, 'failed');
      this.appendV2Event(projectId, {
        source: 'system',
        level: 'error',
        stage: 'bootstrap',
        kind: 'diagnostic',
        code: 'REMOTE_TRAINING_START_FAILED',
        message: `远程训练启动失败: ${err.message}`
      });
      this.updateV2Diagnosis(projectId, {
        status: 'failed',
        stage: 'bootstrap',
        code: 'REMOTE_TRAINING_START_FAILED',
        rootCause: '远程训练初始化失败',
        evidence: [err.message],
        suggestions: [
          '检查远程主机地址、端口、用户名和密码',
          '确认远程目录有写权限并已安装 unzip',
          '确认远程 Python 环境可执行 `python -m ultralytics`'
        ],
        rawTail: TrainingLogV2Service.getRawTail(projectId)
      });

      throw err;
    }
  }

  async connect(options) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn
        .on('ready', () => resolve(conn))
        .on('error', reject)
        .connect(options);
    });
  }

  async openSftp(conn) {
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);
        resolve(sftp);
      });
    });
  }

  async fastPut(sftp, localPath, remotePath, options = {}) {
    const stallTimeoutMsRaw = Number(options.stallTimeoutMs);
    const stallTimeoutMs =
      Number.isFinite(stallTimeoutMsRaw) && stallTimeoutMsRaw > 0
        ? stallTimeoutMsRaw
        : REMOTE_UPLOAD_STALL_TIMEOUT_MS;
    const concurrencyRaw = Number(options.concurrency);
    const chunkSizeRaw = Number(options.chunkSize);
    const concurrency =
      Number.isInteger(concurrencyRaw) && concurrencyRaw > 0
        ? concurrencyRaw
        : REMOTE_UPLOAD_FASTPUT_CONCURRENCY;
    const chunkSize =
      Number.isInteger(chunkSizeRaw) && chunkSizeRaw >= 32 * 1024
        ? chunkSizeRaw
        : REMOTE_UPLOAD_FASTPUT_CHUNK_SIZE;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

    return new Promise((resolve, reject) => {
      let settled = false;
      let stallTimer = null;

      const clearStallTimer = () => {
        if (!stallTimer) return;
        clearTimeout(stallTimer);
        stallTimer = null;
      };
      const rejectOnce = (err) => {
        if (settled) return;
        settled = true;
        clearStallTimer();
        reject(err);
      };
      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        clearStallTimer();
        resolve();
      };
      const refreshStallTimer = () => {
        clearStallTimer();
        stallTimer = setTimeout(() => {
          rejectOnce(
            new Error(
              `SFTP 上传长时间无进度（>${Math.round(stallTimeoutMs / 1000)} 秒），传输可能已卡住`
            )
          );
        }, stallTimeoutMs);
        if (typeof stallTimer.unref === 'function') {
          stallTimer.unref();
        }
      };

      refreshStallTimer();

      sftp.fastPut(
        localPath,
        remotePath,
        {
          concurrency,
          chunkSize,
          step: (transferred, chunk, total) => {
            refreshStallTimer();
            if (onProgress) {
              onProgress({
                transferred: Number(transferred) || 0,
                chunkSize: Number(chunk) || 0,
                total: Number(total) || 0
              });
            }
          }
        },
        (err) => {
          if (err) {
            rejectOnce(err);
            return;
          }
          resolveOnce();
        }
      );
    });
  }

  async streamPut(sftp, localPath, remotePath, options = {}) {
    const localStat = await fs.promises.stat(localPath);
    const totalBytes = Number(localStat.size || 0);
    const stallTimeoutMsRaw = Number(options.stallTimeoutMs);
    const stallTimeoutMs =
      Number.isFinite(stallTimeoutMsRaw) && stallTimeoutMsRaw > 0
        ? stallTimeoutMsRaw
        : REMOTE_UPLOAD_STALL_TIMEOUT_MS;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(localPath, {
        highWaterMark: REMOTE_UPLOAD_STREAM_CHUNK_SIZE
      });
      const writeStream = sftp.createWriteStream(remotePath);
      let settled = false;
      let transferred = 0;
      let stallTimer = null;

      const clearStallTimer = () => {
        if (!stallTimer) return;
        clearTimeout(stallTimer);
        stallTimer = null;
      };
      const refreshStallTimer = () => {
        clearStallTimer();
        stallTimer = setTimeout(() => {
          rejectOnce(
            new Error(
              `SFTP 流式上传长时间无进度（>${Math.round(stallTimeoutMs / 1000)} 秒），传输可能已卡住`
            )
          );
        }, stallTimeoutMs);
        if (typeof stallTimer.unref === 'function') {
          stallTimer.unref();
        }
      };
      const rejectOnce = (err) => {
        if (settled) return;
        settled = true;
        clearStallTimer();
        try {
          readStream.destroy();
        } catch {
          // noop
        }
        try {
          writeStream.destroy();
        } catch {
          // noop
        }
        reject(err);
      };
      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        clearStallTimer();
        resolve();
      };

      refreshStallTimer();

      readStream.on('data', (chunk) => {
        transferred += Number(chunk?.length || 0);
        refreshStallTimer();
        if (onProgress) {
          onProgress({
            transferred,
            chunkSize: Number(chunk?.length || 0),
            total: totalBytes
          });
        }
      });

      readStream.on('error', rejectOnce);
      writeStream.on('error', rejectOnce);
      writeStream.on('close', () => {
        if (onProgress && totalBytes > 0) {
          onProgress({
            transferred: totalBytes,
            chunkSize: 0,
            total: totalBytes
          });
        }
        resolveOnce();
      });

      readStream.pipe(writeStream);
    });
  }

  async fastGet(sftp, remotePath, localPath) {
    return new Promise((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async statPath(sftp, remotePath) {
    return new Promise((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) return reject(err);
        resolve(stats);
      });
    });
  }

  async remoteFileExists(conn, remoteFilePath) {
    const sftp = await this.openSftp(conn);
    try {
      await this.statPath(sftp, remoteFilePath);
      return true;
    } catch {
      return false;
    } finally {
      try {
        sftp.end();
      } catch {
        // noop
      }
    }
  }

  async readRemoteDatasetManifest(conn, remotePath) {
    const remoteManifestPath = this.getRemoteDatasetManifestPath(remotePath);
    const safeManifestPath = this.shellEscape(remoteManifestPath);
    const { stdout } = await this.execCommand(
      conn,
      `if [ -f ${safeManifestPath} ]; then cat ${safeManifestPath}; fi`
    );
    const raw = String(stdout || '').trim();
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  async writeRemoteDatasetManifest(conn, remotePath, manifestPayload = {}) {
    const remoteManifestPath = this.getRemoteDatasetManifestPath(remotePath);
    const tempManifestPath = path.join(
      os.tmpdir(),
      `pose-annotator-remote-manifest-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );
    await fs.promises.writeFile(
      tempManifestPath,
      JSON.stringify(manifestPayload, null, 2),
      'utf8'
    );

    const sftp = await this.openSftp(conn);
    try {
      await this.fastPut(sftp, tempManifestPath, remoteManifestPath);
    } finally {
      try {
        sftp.end();
      } catch {
        // noop
      }
      try {
        await fs.promises.unlink(tempManifestPath);
      } catch {
        // noop
      }
    }
  }

  async evaluateDatasetSyncState(conn, remotePath, localManifest) {
    const remoteDataYamlPath = path.posix.join(remotePath, 'data.yaml');
    const hasRemoteDataYaml = await this.remoteFileExists(conn, remoteDataYamlPath);
    const remoteManifest = await this.readRemoteDatasetManifest(conn, remotePath);
    const decision = this.planDatasetSync(localManifest, remoteManifest, hasRemoteDataYaml);
    return {
      ...decision,
      hasRemoteDataYaml,
      remoteManifest
    };
  }

  async execCommand(conn, command) {
    return new Promise((resolve, reject) => {
      conn.exec(command, (err, stream) => {
        if (err) return reject(err);

        let stdout = '';
        let stderr = '';

        stream.on('data', (data) => {
          stdout += data.toString('utf8');
        });
        stream.stderr.on('data', (data) => {
          stderr += data.toString('utf8');
        });
        stream.on('close', (code) => {
          if (code === 0) {
            resolve({ code, stdout, stderr });
            return;
          }
          reject(new Error(`远程命令失败(code=${code}): ${stderr.trim() || stdout.trim() || command}`));
        });
      });
    });
  }

  async packageDataset(projectId, projectRoot) {
    const datasetPath = path.join(projectRoot, 'dataset');
    if (!fs.existsSync(datasetPath)) {
      throw new Error(`本地数据集目录不存在: ${datasetPath}`);
    }
    const yamlPath = path.join(datasetPath, 'data.yaml');
    if (!fs.existsSync(yamlPath)) {
      throw new Error(`本地数据集缺少 data.yaml: ${yamlPath}`);
    }

    const zipPath = path.join(projectRoot, `.remote_dataset_${projectId}_${Date.now()}.zip`);

    const relativeFiles = await this.collectDatasetFiles(datasetPath);
    relativeFiles.sort((a, b) => a.localeCompare(b));

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: DATASET_ARCHIVE_ZLIB_LEVEL } });

      output.on('close', () => resolve(zipPath));
      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);
      for (const relativeFile of relativeFiles) {
        const absolutePath = path.join(datasetPath, relativeFile);
        archive.file(absolutePath, {
          name: relativeFile,
          store: this.shouldStoreArchiveEntry(relativeFile)
        });
      }
      archive.finalize();
    });
  }

  async cleanupLocalArchive(archivePath) {
    if (!archivePath) return;
    try {
      await fs.promises.unlink(archivePath);
    } catch (err) {
      logger.debug(`Failed to cleanup local archive ${archivePath}: ${err.message}`);
    }
  }

  async uploadAndExtract(projectId, conn, localZipPath, remotePath) {
    const remoteZipPath = path.posix.join(remotePath, path.basename(localZipPath));
    const safeRemotePath = this.shellEscape(remotePath);
    const safeRemoteZipPath = this.shellEscape(remoteZipPath);
    const archiveStat = await fs.promises.stat(localZipPath);
    const archiveBytes = Number(archiveStat.size || 0);
    const archiveSizeText = this.formatBytes(archiveBytes);
    const stallTimeoutSeconds = Math.round(REMOTE_UPLOAD_STALL_TIMEOUT_MS / 1000);

    ProcessManager.addLog(projectId, {
      type: 'system',
      msg: `⬆️ 开始上传远程数据集压缩包 (${archiveSizeText})`,
      time: Date.now()
    });
    this.appendV2Event(projectId, {
      source: 'system',
      level: 'info',
      stage: 'bootstrap',
      kind: 'status',
      code: 'REMOTE_DATASET_UPLOAD_STARTED',
      message: '远程数据集上传开始',
      details: {
        archive: path.basename(localZipPath),
        bytes: archiveBytes
      }
    });

    await this.execCommand(conn, `mkdir -p ${safeRemotePath}`);

    let lastProgressTs = 0;
    let lastProgressPercent = -1;
    const reportProgress = ({ transferred, total }) => {
      const totalBytes = total > 0 ? total : archiveBytes;
      const transferredBytes = Math.max(0, Number(transferred) || 0);
      const progressPercent =
        totalBytes > 0 ? Math.min(100, Math.floor((transferredBytes / totalBytes) * 100)) : null;
      const now = Date.now();
      const reachedStep =
        progressPercent !== null &&
        (lastProgressPercent < 0 || progressPercent >= lastProgressPercent + REMOTE_UPLOAD_PROGRESS_PERCENT_STEP);
      const reachedInterval = now - lastProgressTs >= REMOTE_UPLOAD_PROGRESS_INTERVAL_MS;
      const completed = progressPercent === 100;

      if (!reachedStep && !reachedInterval && !completed) {
        return;
      }

      lastProgressTs = now;
      if (progressPercent !== null) {
        lastProgressPercent = progressPercent;
      }

      const transferredText = this.formatBytes(transferredBytes);
      const totalText = this.formatBytes(totalBytes);
      const percentText = progressPercent !== null ? `${progressPercent}%` : 'unknown';

      ProcessManager.addLog(projectId, {
        type: 'system',
        msg: `⬆️ 远程上传进度 ${percentText} (${transferredText}/${totalText})`,
        time: now
      });
      this.appendV2Event(projectId, {
        source: 'system',
        level: 'info',
        stage: 'bootstrap',
        kind: 'metric',
        code: 'REMOTE_DATASET_UPLOAD_PROGRESS',
        message: `远程上传进度 ${percentText}`,
        details: {
          transferredBytes,
          totalBytes,
          percent: progressPercent
        }
      });
    };

    let usedStreamFallback = false;
    let fastPutError = null;
    let sftp = await this.openSftp(conn);
    try {
      await this.fastPut(sftp, localZipPath, remoteZipPath, {
        stallTimeoutMs: REMOTE_UPLOAD_STALL_TIMEOUT_MS,
        onProgress: reportProgress
      });
    } catch (err) {
      fastPutError = err;
    } finally {
      try {
        sftp.end();
      } catch {
        // noop
      }
    }

    if (fastPutError) {
      const fallbackMessage = `SFTP fastPut 上传失败，回退到流式上传: ${fastPutError.message}`;
      ProcessManager.addLog(projectId, {
        type: 'warn',
        msg: `⚠️ ${fallbackMessage}`,
        time: Date.now()
      });
      this.appendV2Event(projectId, {
        source: 'system',
        level: 'warn',
        stage: 'bootstrap',
        kind: 'diagnostic',
        code: 'REMOTE_DATASET_UPLOAD_FALLBACK_STREAM',
        message: fallbackMessage,
        details: {
          stallTimeoutSeconds
        }
      });

      usedStreamFallback = true;
      sftp = await this.openSftp(conn);
      try {
        await this.streamPut(sftp, localZipPath, remoteZipPath, {
          stallTimeoutMs: REMOTE_UPLOAD_STALL_TIMEOUT_MS,
          onProgress: reportProgress
        });
      } finally {
        try {
          sftp.end();
        } catch {
          // noop
        }
      }
    }

    ProcessManager.addLog(projectId, {
      type: 'system',
      msg: `✅ 远程数据集上传完成 (${usedStreamFallback ? 'stream' : 'fastPut'})`,
      time: Date.now()
    });
    this.appendV2Event(projectId, {
      source: 'system',
      level: 'info',
      stage: 'bootstrap',
      kind: 'status',
      code: 'REMOTE_DATASET_UPLOAD_COMPLETED',
      message: '远程数据集上传完成',
      details: {
        transport: usedStreamFallback ? 'stream' : 'fastPut',
        bytes: archiveBytes
      }
    });

    ProcessManager.addLog(projectId, {
      type: 'system',
      msg: '🗜️ 正在解压远程数据集...',
      time: Date.now()
    });
    this.appendV2Event(projectId, {
      source: 'system',
      level: 'info',
      stage: 'bootstrap',
      kind: 'status',
      code: 'REMOTE_DATASET_EXTRACTING',
      message: '正在解压远程数据集'
    });

    await this.execCommand(
      conn,
      `unzip -o ${safeRemoteZipPath} -d ${safeRemotePath} && rm -f ${safeRemoteZipPath}`
    );

    this.appendV2Event(projectId, {
      source: 'system',
      level: 'info',
      stage: 'bootstrap',
      kind: 'status',
      code: 'REMOTE_DATASET_EXTRACTED',
      message: '远程数据集解压完成'
    });
  }

  buildRemoteTrainCommand(config) {
    const remotePath = this.shellEscape(config.remotePath);
    const remotePython = this.shellEscape(config.remotePython);
    const model = this.shellEscape(config.model);
    const data = this.shellEscape('data.yaml');
    const epochs = Number(config.epochs);
    const batch = Number(config.batch);
    const imgsz = Number(config.imgsz);
    const name = this.shellEscape(config.name || 'exp_auto');

    return `cd ${remotePath} && ${remotePython} -m ultralytics train model=${model} data=${data} epochs=${epochs} batch=${batch} imgsz=${imgsz} name=${name}`;
  }

  detectAutoRepairPlan(stderrLines = []) {
    const joined = stderrLines.join('\n').toLowerCase();

    if (/no module named\s+['"]?ultralytics['"]?/.test(joined)) {
      return {
        key: 'install_ultralytics',
        reason: '远程 Python 环境缺少 ultralytics'
      };
    }

    return null;
  }

  buildAutoRepairCommand(config, plan) {
    const remotePath = this.shellEscape(config.remotePath);
    const remotePython = this.shellEscape(config.remotePython);

    if (plan?.key === 'install_ultralytics') {
      return `cd ${remotePath} && (${remotePython} -m pip install -U ultralytics || ${remotePython} -m pip install --user -U ultralytics)`;
    }

    return null;
  }

  async applyAutoRepair(conn, config, plan) {
    const command = this.buildAutoRepairCommand(config, plan);
    if (!command) {
      throw new Error(`不支持的自动修复策略: ${plan?.key || 'unknown'}`);
    }
    return this.execCommand(conn, command);
  }

  executeTraining(projectId, conn, config, runContext = {}) {
    const context = {
      attempt: Number(runContext.attempt || 0),
      autoRepairCount: Number(runContext.autoRepairCount || 0)
    };
    const cmd = this.buildRemoteTrainCommand(config);

    conn.exec(cmd, (err, stream) => {
      if (err) {
        ProcessManager.setStatus(projectId, 'failed');
        ProcessManager.addLog(projectId, {
          type: 'error',
          msg: `远程命令启动失败: ${err.message}`,
          time: Date.now()
        });
        this.setV2Status(projectId, 'failed');
        this.appendV2Event(projectId, {
          source: 'system',
          level: 'error',
          stage: 'bootstrap',
          kind: 'diagnostic',
          code: 'REMOTE_COMMAND_START_FAILED',
          message: `远程命令启动失败: ${err.message}`
        });
        this.updateV2Diagnosis(projectId, {
          status: 'failed',
          stage: 'bootstrap',
          code: 'REMOTE_COMMAND_START_FAILED',
          rootCause: '远程训练命令无法启动',
          evidence: [err.message],
          suggestions: [
            '检查远程目录和 Python 路径是否正确',
            '确认远程主机已安装 ultralytics',
            '确认账户有执行权限'
          ],
          rawTail: TrainingLogV2Service.getRawTail(projectId)
        });
        return;
      }

      const connState = this.connections.get(projectId);
      if (connState) {
        connState.stream = stream;
        this.connections.set(projectId, connState);
      }

      ProcessManager.setStatus(projectId, 'running');
      ProcessManager.addLog(projectId, {
        type: 'system',
        msg: `🚀 远程训练命令已启动: ${config.remoteHost}:${config.remotePort}`,
        time: Date.now()
      });
      this.setV2Status(projectId, 'running');
      this.appendV2Event(projectId, {
        source: 'system',
        level: 'info',
        stage: 'train',
        kind: 'status',
        code: 'REMOTE_COMMAND_STARTED',
        message: '远程训练命令已启动',
        details: { attempt: context.attempt + 1 }
      });

      const stderrLines = [];

      stream.on('data', (data) => {
        const line = data.toString('utf8').trim();
        if (!line) return;
        ProcessManager.addLog(projectId, { type: 'stdout', msg: line, time: Date.now() });
        this.appendV2Event(projectId, {
          source: 'py_stdout',
          level: 'info',
          stage: 'train',
          kind: 'raw',
          code: 'REMOTE_STDOUT',
          message: line,
          raw: line
        });
      });

      stream.stderr.on('data', (data) => {
        const line = data.toString('utf8').trim();
        if (!line) return;
        stderrLines.push(line);
        if (stderrLines.length > 200) {
          stderrLines.shift();
        }
        ProcessManager.addLog(projectId, { type: 'stderr', msg: line, time: Date.now() });
        this.appendV2Event(projectId, {
          source: 'py_stderr',
          level: 'warn',
          stage: 'train',
          kind: 'raw',
          code: 'REMOTE_STDERR',
          message: line,
          raw: line
        });
      });

      stream.on('close', async (code) => {
        logger.info(`Remote training finished for ${projectId} with code ${code}`);

        const success = code === 0;

        if (!success) {
          const repairPlan = this.detectAutoRepairPlan(stderrLines);
          if (repairPlan && context.autoRepairCount < MAX_AUTO_REPAIR_ATTEMPTS) {
            ProcessManager.addLog(projectId, {
              type: 'system',
              msg: `🛠 检测到可修复错误（${repairPlan.reason}），正在自动修复并重试...`,
              time: Date.now()
            });
            this.appendV2Event(projectId, {
              source: 'system',
              level: 'warn',
              stage: 'train',
              kind: 'diagnostic',
              code: 'REMOTE_AUTO_REPAIR_START',
              message: `检测到可修复错误，开始自动修复: ${repairPlan.reason}`,
              details: { plan: repairPlan.key, attempt: context.autoRepairCount + 1 }
            });

            try {
              await this.applyAutoRepair(conn, config, repairPlan);
              this.appendV2Event(projectId, {
                source: 'system',
                level: 'info',
                stage: 'train',
                kind: 'status',
                code: 'REMOTE_AUTO_REPAIR_DONE',
                message: `自动修复完成，准备重试训练: ${repairPlan.reason}`,
                details: { plan: repairPlan.key }
              });
              ProcessManager.addLog(projectId, {
                type: 'system',
                msg: '✅ 自动修复成功，已重新启动远程训练命令',
                time: Date.now()
              });
              this.executeTraining(projectId, conn, config, {
                attempt: context.attempt + 1,
                autoRepairCount: context.autoRepairCount + 1
              });
              return;
            } catch (repairErr) {
              ProcessManager.addLog(projectId, {
                type: 'error',
                msg: `自动修复失败: ${repairErr.message}`,
                time: Date.now()
              });
              this.appendV2Event(projectId, {
                source: 'system',
                level: 'error',
                stage: 'train',
                kind: 'diagnostic',
                code: 'REMOTE_AUTO_REPAIR_FAILED',
                message: `自动修复失败: ${repairErr.message}`,
                details: { plan: repairPlan.key }
              });
            }
          }
        }

        ProcessManager.setStatus(projectId, success ? 'completed' : 'failed');
        this.setV2Status(projectId, success ? 'completed' : 'failed');

        this.appendV2Event(projectId, {
          source: 'system',
          level: success ? 'info' : 'error',
          stage: 'teardown',
          kind: 'status',
          code: success ? 'REMOTE_TRAINING_COMPLETED' : 'REMOTE_TRAINING_FAILED',
          message: success
            ? '远程训练已完成'
            : `远程训练失败，退出码 ${code}`,
          details: { exitCode: code }
        });

        if (success) {
          try {
            await this.downloadResults(projectId, conn, config);
          } catch (downloadErr) {
            ProcessManager.addLog(projectId, {
              type: 'error',
              msg: `远程权重同步失败: ${downloadErr.message}`,
              time: Date.now()
            });
            this.appendV2Event(projectId, {
              source: 'system',
              level: 'warn',
              stage: 'teardown',
              kind: 'diagnostic',
              code: 'REMOTE_DOWNLOAD_FAILED',
              message: `远程权重同步失败: ${downloadErr.message}`
            });
          }
        } else {
          const failureEvidence = [`exitCode=${code}`];
          if (stderrLines.length > 0) {
            failureEvidence.push(...stderrLines.slice(-5));
          }
          this.updateV2Diagnosis(projectId, {
            status: 'failed',
            stage: 'train',
            code: 'REMOTE_TRAINING_FAILED',
            rootCause: `远程训练进程异常退出 (exitCode=${code})`,
            evidence: failureEvidence,
            suggestions: [
              '若是依赖缺失，请确认远程 Python 可执行 pip 安装并有网络',
              '检查远程训练日志中的 traceback',
              '确认远程数据集路径和 data.yaml 正确',
              '确认远程环境中 torch/ultralytics 版本可用'
            ],
            rawTail: TrainingLogV2Service.getRawTail(projectId)
          });
        }

        try {
          conn.end();
        } catch {
          // noop
        }
        this.connections.delete(projectId);
      });
    });
  }

  async resolveRemoteBestWeightsPath(sftp, remotePath, runName) {
    const candidates = [
      path.posix.join(remotePath, 'runs', 'pose', runName, 'weights', 'best.pt'),
      path.posix.join(remotePath, 'runs', 'detect', runName, 'weights', 'best.pt')
    ];

    for (const candidate of candidates) {
      try {
        await this.statPath(sftp, candidate);
        return candidate;
      } catch {
        // continue
      }
    }

    return null;
  }

  async downloadResults(projectId, conn, config) {
    const projectRoot = config.projectRoot;
    const runName = config.name;
    const sftp = await this.openSftp(conn);

    try {
      const remoteWeightsPath = await this.resolveRemoteBestWeightsPath(sftp, config.remotePath, runName);
      if (!remoteWeightsPath) {
        throw new Error(`未找到远程 best.pt（run=${runName}）`);
      }

      const localWeightsDir = path.join(projectRoot, 'models', projectId);
      const localWeightsPath = path.join(localWeightsDir, 'best.pt');
      if (!fs.existsSync(localWeightsDir)) {
        fs.mkdirSync(localWeightsDir, { recursive: true });
      }

      await this.fastGet(sftp, remoteWeightsPath, localWeightsPath);
      ProcessManager.addLog(projectId, {
        type: 'system',
        msg: `✅ 远程训练权重已同步至本地: ${localWeightsPath}`,
        time: Date.now()
      });
      this.appendV2Event(projectId, {
        source: 'system',
        level: 'info',
        stage: 'teardown',
        kind: 'status',
        code: 'REMOTE_WEIGHTS_SYNCED',
        message: '远程 best.pt 已同步到本地',
        details: { localWeightsPath, remoteWeightsPath }
      });
    } finally {
      try {
        sftp.end();
      } catch {
        // noop
      }
    }
  }

  async stop(projectId) {
    const state = this.connections.get(projectId);
    if (!state) return;

    try {
      if (state.stream && typeof state.stream.close === 'function') {
        state.stream.close();
      }
    } catch (err) {
      logger.debug(`Failed to close remote stream for ${projectId}: ${err.message}`);
    }

    try {
      state.conn.end();
    } catch (err) {
      logger.debug(`Failed to close remote connection for ${projectId}: ${err.message}`);
    }
    this.connections.delete(projectId);

    ProcessManager.setStatus(projectId, 'stopped');
    ProcessManager.addLog(projectId, {
      type: 'system',
      msg: '用户手动停止远程训练',
      time: Date.now()
    });
    this.setV2Status(projectId, 'stopped');
    this.appendV2Event(projectId, {
      source: 'system',
      level: 'warn',
      stage: 'teardown',
      kind: 'status',
      code: 'REMOTE_TRAINING_STOPPED_BY_USER',
      message: '用户手动停止远程训练'
    });
  }
}

module.exports = new RemoteTrainingService();
