const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const logger = require('../utils/logger');
const ProcessManager = require('../managers/ProcessManager');

class RemoteTrainingService {
    constructor() {
        this.connections = new Map();
    }

    async start(projectId, config) {
        const {
            remoteHost,
            remotePort = 22,
            remoteUser,
            remotePassword,
            remotePath,
            remotePython = 'python',
            projectRoot
        } = config;

        logger.info(`Starting remote training for project ${projectId} on ${remoteHost}`);

        try {
            // 1. 打包本地数据集
            const zipPath = await this.packageDataset(projectId, projectRoot);

            // 2. 建立 SSH 连接
            const conn = await this.connect({
                host: remoteHost,
                port: remotePort,
                username: remoteUser,
                password: remotePassword
            });
            this.connections.set(projectId, conn);

            // 3. 上传数据集并解压
            await this.uploadAndExtract(conn, zipPath, remotePath);

            // 4. 执行训练命令
            this.executeTraining(projectId, conn, config);

            return { success: true, message: '远程训练任务已启动' };
        } catch (err) {
            logger.error(`Failed to start remote training: ${err.message}`);
            throw err;
        }
    }

    async connect(options) {
        return new Promise((resolve, reject) => {
            const conn = new Client();
            conn.on('ready', () => resolve(conn))
                .on('error', reject)
                .connect(options);
        });
    }

    async packageDataset(projectId, projectRoot) {
        const datasetPath = path.join(projectRoot, 'dataset');
        const zipPath = path.join(projectRoot, `dataset_${projectId}.zip`);

        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => resolve(zipPath));
            archive.on('error', reject);

            archive.pipe(output);
            archive.directory(datasetPath, false);
            archive.finalize();
        });
    }

    async uploadAndExtract(conn, localZipPath, remotePath) {
        const remoteZipPath = path.posix.join(remotePath, path.basename(localZipPath));

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) return reject(err);

                // 确保远程目录存在
                conn.exec(`mkdir -p ${remotePath}`, (err) => {
                    if (err) return reject(err);

                    sftp.fastPut(localZipPath, remoteZipPath, (err) => {
                        if (err) return reject(err);

                        // 解压并删除 zip
                        conn.exec(`unzip -o ${remoteZipPath} -d ${remotePath} && rm ${remoteZipPath}`, (err) => {
                            if (err) return reject(err);
                            resolve();
                        });
                    });
                });
            });
        });
    }

    executeTraining(projectId, conn, config) {
        const { remotePath, remotePython, model, epochs, batch, imgsz, name } = config;

        // 构建远程 YOLO 训练命令 (假设远程已准备好环境或通过 python 直接执行)
        // 实际生产中可能需要先激活 conda 或 venv
        const cmd = `cd ${remotePath} && ${remotePython} -m ultralytics train model=${model} data=data.yaml epochs=${epochs} batch=${batch} imgsz=${imgsz} name=${name}`;

        conn.exec(cmd, (err, stream) => {
            if (err) {
                ProcessManager.addLog(projectId, { type: 'error', msg: `远程命令启动失败: ${err.message}`, time: Date.now() });
                return;
            }

            ProcessManager.setStatus(projectId, 'running');

            stream.on('data', (data) => {
                const line = data.toString().trim();
                if (line) {
                    ProcessManager.addLog(projectId, { type: 'stdout', msg: line, time: Date.now() });
                    // 这里可以添加更复杂的指标解析逻辑，类似于 TrainingService 中的解析机制
                }
            }).stderr.on('data', (data) => {
                const line = data.toString().trim();
                if (line) {
                    ProcessManager.addLog(projectId, { type: 'stderr', msg: line, time: Date.now() });
                }
            }).on('close', (code, signal) => {
                logger.info(`Remote training finished with code ${code}`);
                ProcessManager.setStatus(projectId, code === 0 ? 'completed' : 'failed');

                // 训练完成后下载权重文件 (简单示例)
                if (code === 0) {
                    this.downloadResults(projectId, conn, config);
                }

                conn.end();
                this.connections.delete(projectId);
            });
        });
    }

    async downloadResults(projectId, conn, config) {
        const { remotePath, projectRoot, name } = config;
        const remoteWeightsPath = path.posix.join(remotePath, 'runs', 'detect', name, 'weights', 'best.pt');
        const localWeightsDir = path.join(projectRoot, 'models', projectId);
        const localWeightsPath = path.join(localWeightsDir, 'best.pt');

        if (!fs.existsSync(localWeightsDir)) {
            fs.mkdirSync(localWeightsDir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) return reject(err);
                sftp.fastGet(remoteWeightsPath, localWeightsPath, (err) => {
                    if (err) {
                        logger.error(`Failed to download weights: ${err.message}`);
                        return reject(err);
                    }
                    logger.info(`Successfully downloaded best.pt for project ${projectId}`);
                    ProcessManager.addLog(projectId, { type: 'system', msg: '✅ 远程训练权重已同步至本地', time: Date.now() });
                    resolve();
                });
            });
        });
    }

    async stop(projectId) {
        const conn = this.connections.get(projectId);
        if (conn) {
            // 发送 Ctrl+C 或直接强制终止相关进程比较复杂，这里先简单关闭连接
            conn.end();
            this.connections.delete(projectId);
            ProcessManager.setStatus(projectId, 'idle');
        }
    }
}

module.exports = new RemoteTrainingService();
