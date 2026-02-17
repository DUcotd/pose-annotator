const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const RenumberService = require('../src/services/RenumberService');

const listFiles = async (dir) => {
  if (!fs.existsSync(dir)) return [];
  return (await fsp.readdir(dir)).sort();
};

test('RenumberService.renumberProject renames remaining files sequentially', async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'pose-annotator-'));
  const projectsDir = path.join(tmpRoot, 'projects');
  const projectId = 'p1';
  const projectRoot = path.join(projectsDir, projectId);
  const uploads = path.join(projectRoot, 'uploads');
  const annotations = path.join(projectRoot, 'annotations');
  const thumbnails = path.join(projectRoot, 'thumbnails');

  await fsp.mkdir(uploads, { recursive: true });
  await fsp.mkdir(annotations, { recursive: true });
  await fsp.mkdir(thumbnails, { recursive: true });

  await fsp.writeFile(path.join(uploads, '000001.jpg'), 'img1');
  await fsp.writeFile(path.join(uploads, '000003.jpg'), 'img3');
  await fsp.writeFile(path.join(uploads, '000004.png'), 'img4');

  await fsp.writeFile(path.join(annotations, '000001.jpg.json'), '[]');
  await fsp.writeFile(path.join(annotations, '000003.jpg.json'), '[]');
  await fsp.writeFile(path.join(annotations, '000004.png.json'), '[]');

  await fsp.writeFile(path.join(thumbnails, '000001.jpg'), 't1');
  await fsp.writeFile(path.join(thumbnails, '000003.jpg'), 't3');
  await fsp.writeFile(path.join(thumbnails, '000004.png'), 't4');

  const result = await RenumberService.renumberProject(projectId, projectsDir);
  assert.equal(result.success, true);

  assert.deepEqual(await listFiles(uploads), ['000001.jpg', '000002.jpg', '000003.png']);
  assert.deepEqual(await listFiles(annotations), ['000001.jpg.json', '000002.jpg.json', '000003.png.json']);
  assert.deepEqual(await listFiles(thumbnails), ['000001.jpg', '000002.jpg', '000003.png']);

  const rootEntries = await fsp.readdir(projectRoot);
  const backupDirs = rootEntries.filter(n => n.startsWith('.renumber_backup_'));
  assert.deepEqual(backupDirs, []);
});

