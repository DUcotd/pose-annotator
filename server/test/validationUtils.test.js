const test = require('node:test');
const assert = require('node:assert/strict');

const { validateTrainConfig, validateRemoteTrainConfig } = require('../src/utils/ValidationUtils');

const createBaseConfig = () => ({
  epochs: 20,
  batch: 8,
  imgsz: 640,
  model: 'yolov8n-pose.pt'
});

test('validateTrainConfig passes for local training config', () => {
  const result = validateTrainConfig({
    ...createBaseConfig(),
    remoteEnabled: false
  });

  assert.equal(result.valid, true);
});

test('validateTrainConfig rejects incomplete remote training config', () => {
  const result = validateTrainConfig({
    ...createBaseConfig(),
    remoteEnabled: true,
    remoteHost: '',
    remotePort: 22,
    remoteUser: '',
    remotePassword: '',
    remotePath: 'tmp/training',
    remotePython: ''
  });

  assert.equal(result.valid, false);
  assert.ok(Array.isArray(result.errors));
  assert.ok(result.errors.some((item) => item.field === 'remoteHost'));
  assert.ok(result.errors.some((item) => item.field === 'remoteUser'));
  assert.ok(result.errors.some((item) => item.field === 'remotePassword'));
  assert.ok(result.errors.some((item) => item.field === 'remotePath'));
  assert.ok(result.errors.some((item) => item.field === 'remotePython'));
});

test('validateRemoteTrainConfig rejects invalid remote port and host format', () => {
  const result = validateRemoteTrainConfig({
    remoteEnabled: true,
    remoteHost: 'bad host !!!',
    remotePort: 70000,
    remoteUser: 'ubuntu',
    remotePassword: 'secret',
    remotePath: '/tmp/training',
    remotePython: 'python3'
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.field === 'remoteHost'));
  assert.ok(result.errors.some((item) => item.field === 'remotePort'));
});

test('validateRemoteTrainConfig passes for complete remote config', () => {
  const result = validateRemoteTrainConfig({
    remoteEnabled: true,
    remoteHost: '192.168.1.100',
    remotePort: 22,
    remoteUser: 'ubuntu',
    remotePassword: 'secret',
    remotePath: '/tmp/training',
    remotePython: 'python3'
  });

  assert.equal(result.valid, true);
});
