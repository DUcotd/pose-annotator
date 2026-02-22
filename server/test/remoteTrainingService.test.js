const test = require('node:test');
const assert = require('node:assert/strict');

const RemoteTrainingService = require('../src/services/RemoteTrainingService');

test('RemoteTrainingService.shellEscape escapes single quotes safely', () => {
  const escaped = RemoteTrainingService.shellEscape(`ab'cd`);
  assert.equal(escaped, `'ab'"'"'cd'`);
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
