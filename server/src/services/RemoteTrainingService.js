const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const logger = require('../utils/logger');
const ProcessManager = require('../managers/ProcessManager');
const TrainingLogV2Service = require('./TrainingLogV2Service');
const { validateRemoteTrainConfig } = require('../utils/ValidationUtils');

const trimString = (value) => (typeof value === 'string' ? value.trim() : '');
const MAX_AUTO_REPAIR_ATTEMPTS = 1;

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

      await this.uploadAndExtract(conn, zipPath, normalizedConfig.remotePath);
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

  async fastPut(sftp, localPath, remotePath) {
    return new Promise((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, (err) => {
        if (err) return reject(err);
        resolve();
      });
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

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(zipPath));
      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(datasetPath, false);
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

  async uploadAndExtract(conn, localZipPath, remotePath) {
    const remoteZipPath = path.posix.join(remotePath, path.basename(localZipPath));
    const safeRemotePath = this.shellEscape(remotePath);
    const safeRemoteZipPath = this.shellEscape(remoteZipPath);

    await this.execCommand(conn, `mkdir -p ${safeRemotePath}`);

    const sftp = await this.openSftp(conn);
    try {
      await this.fastPut(sftp, localZipPath, remoteZipPath);
    } finally {
      try {
        sftp.end();
      } catch {
        // noop
      }
    }

    await this.execCommand(
      conn,
      `unzip -o ${safeRemoteZipPath} -d ${safeRemotePath} && rm -f ${safeRemoteZipPath}`
    );
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
