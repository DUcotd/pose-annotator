const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RemoteTrainingService = require('../src/services/RemoteTrainingService');

test('RemoteTrainingService.shellEscape escapes single quotes safely', () => {
  const escaped = RemoteTrainingService.shellEscape(`ab'cd`);
  assert.equal(escaped, `'ab'"'"'cd'`);
});

test('RemoteTrainingService.shouldStoreArchiveEntry detects media and text files correctly', () => {
  assert.equal(RemoteTrainingService.shouldStoreArchiveEntry('images/a.jpg'), true);
  assert.equal(RemoteTrainingService.shouldStoreArchiveEntry('labels/a.txt'), false);
});

test('RemoteTrainingService.fastPut applies tuned defaults and forwards progress', async () => {
  let fastPutOptions = null;
  let progressPayload = null;

  const fakeSftp = {
    fastPut(localPath, remotePath, options, callback) {
      fastPutOptions = options;
      options.step(64, 64, 1024);
      callback(null);
    }
  };

  await RemoteTrainingService.fastPut(fakeSftp, 'local.zip', 'remote.zip', {
    onProgress: (payload) => {
      progressPayload = payload;
    }
  });

  assert.equal(fastPutOptions.concurrency, 128);
  assert.equal(fastPutOptions.chunkSize, 256 * 1024);
  assert.deepEqual(progressPayload, {
    transferred: 64,
    chunkSize: 64,
    total: 1024
  });
});

test('RemoteTrainingService.buildRemoteTrainCommand quotes remote args', () => {
  const command = RemoteTrainingService.buildRemoteTrainCommand({
    remotePath: '/tmp/my path',
    remotePython: '/usr/bin/python3',
    model: 'yolov8n-pose.pt',
    epochs: 10,
    batch: 4,
    imgsz: 640,
    name: "exp'01"
  });

  assert.match(command, /cd '\/tmp\/my path'/);
  assert.match(command, /'\/usr\/bin\/python3' -m ultralytics train/);
  assert.match(command, /model='yolov8n-pose.pt'/);
  assert.match(command, /name='exp'"'"'01'/);
});

test('RemoteTrainingService.detectAutoRepairPlan detects missing ultralytics', () => {
  const plan = RemoteTrainingService.detectAutoRepairPlan([
    "/usr/local/bin/python: No module named ultralytics"
  ]);

  assert.deepEqual(plan, {
    key: 'install_ultralytics',
    reason: '远程 Python 环境缺少 ultralytics'
  });
});

test('RemoteTrainingService.buildAutoRepairCommand builds pip install with fallback', () => {
  const command = RemoteTrainingService.buildAutoRepairCommand(
    {
      remotePath: '/tmp/train workdir',
      remotePython: '/usr/local/bin/python'
    },
    { key: 'install_ultralytics' }
  );

  assert.match(command, /cd '\/tmp\/train workdir'/);
  assert.match(command, /'\/usr\/local\/bin\/python' -m pip install -U ultralytics/);
  assert.match(command, /\|\| '\/usr\/local\/bin\/python' -m pip install --user -U ultralytics/);
});

test('RemoteTrainingService.planDatasetSync requests upload when remote dataset is missing', () => {
  const decision = RemoteTrainingService.planDatasetSync(
    { fingerprint: 'a'.repeat(64) },
    null,
    false
  );

  assert.deepEqual(decision, {
    shouldUpload: true,
    reason: 'remote_dataset_missing'
  });
});

test('RemoteTrainingService.planDatasetSync requests upload when remote manifest is missing', () => {
  const decision = RemoteTrainingService.planDatasetSync(
    { fingerprint: 'a'.repeat(64) },
    null,
    true
  );

  assert.deepEqual(decision, {
    shouldUpload: true,
    reason: 'remote_manifest_missing'
  });
});

test('RemoteTrainingService.planDatasetSync requests upload when fingerprint changed', () => {
  const decision = RemoteTrainingService.planDatasetSync(
    { fingerprint: 'a'.repeat(64) },
    { fingerprint: 'b'.repeat(64) },
    true
  );

  assert.deepEqual(decision, {
    shouldUpload: true,
    reason: 'dataset_fingerprint_changed'
  });
});

test('RemoteTrainingService.planDatasetSync skips upload when fingerprint matches', () => {
  const decision = RemoteTrainingService.planDatasetSync(
    { fingerprint: 'A'.repeat(64) },
    { fingerprint: 'a'.repeat(64) },
    true
  );

  assert.deepEqual(decision, {
    shouldUpload: false,
    reason: 'dataset_fingerprint_match'
  });
});

test('RemoteTrainingService.planDatasetSync treats invalid remote manifest as missing', () => {
  const decision = RemoteTrainingService.planDatasetSync(
    { fingerprint: 'a'.repeat(64) },
    { fingerprint: 'bad-fingerprint' },
    true
  );

  assert.deepEqual(decision, {
    shouldUpload: true,
    reason: 'remote_manifest_missing'
  });
});

test('RemoteTrainingService.buildLocalDatasetManifest stays stable and changes after file mutation', async () => {
  const projectRoot = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'pose-annotator-remote-training-test-')
  );
  const datasetRoot = path.join(projectRoot, 'dataset');

  try {
    await fs.promises.mkdir(path.join(datasetRoot, 'images'), { recursive: true });
    await fs.promises.mkdir(path.join(datasetRoot, 'labels'), { recursive: true });
    await fs.promises.writeFile(path.join(datasetRoot, 'data.yaml'), 'path: ./\ntrain: images\n', 'utf8');
    await fs.promises.writeFile(path.join(datasetRoot, 'images', 'a.jpg'), 'image-a', 'utf8');
    await fs.promises.writeFile(path.join(datasetRoot, 'labels', 'a.txt'), '0 0.5 0.5 1 1', 'utf8');

    const manifestA = await RemoteTrainingService.buildLocalDatasetManifest(projectRoot);
    const manifestB = await RemoteTrainingService.buildLocalDatasetManifest(projectRoot);

    assert.equal(manifestA.fingerprint, manifestB.fingerprint);
    assert.equal(manifestA.fileCount, manifestB.fileCount);
    assert.equal(manifestA.totalBytes, manifestB.totalBytes);

    await fs.promises.writeFile(path.join(datasetRoot, 'labels', 'a.txt'), '0 0.2 0.2 1 1', 'utf8');

    const manifestC = await RemoteTrainingService.buildLocalDatasetManifest(projectRoot);
    assert.notEqual(manifestC.fingerprint, manifestA.fingerprint);
  } finally {
    await fs.promises.rm(projectRoot, { recursive: true, force: true });
  }
});
