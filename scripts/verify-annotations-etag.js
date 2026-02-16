const fs = require('fs');
const os = require('os');
const path = require('path');
const createApp = require('../server/src/app');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pose-annotator-etag-'));
  const projectsDir = path.join(tmpRoot, 'projects');
  const projectId = 'PTEST';
  const imageId = '000001.jpg';
  const annDir = path.join(projectsDir, projectId, 'annotations');
  fs.mkdirSync(annDir, { recursive: true });

  const initial = [{ id: 1, type: 'bbox', x: 1, y: 2, width: 3, height: 4 }];
  fs.writeFileSync(path.join(annDir, `${imageId}.json`), JSON.stringify(initial, null, 2));

  const app = createApp(projectsDir);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const base = `http://localhost:${port}/api/projects/${encodeURIComponent(projectId)}`;

  const g1 = await fetch(`${base}/annotations/${encodeURIComponent(imageId)}`);
  assert(g1.ok, `GET existing failed: ${g1.status}`);
  const etag1 = g1.headers.get('etag');
  assert(etag1, 'GET existing missing ETag');
  const body1 = await g1.json();
  assert(Array.isArray(body1) && body1.length === 1, 'GET existing body invalid');

  const updated = [{ id: 2, type: 'bbox', x: 10, y: 20, width: 30, height: 40 }];
  const p1 = await fetch(`${base}/annotations/${encodeURIComponent(imageId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'If-Match': etag1 },
    body: JSON.stringify(updated)
  });
  assert(p1.ok, `POST with If-Match failed: ${p1.status}`);
  const etag2 = p1.headers.get('etag');
  assert(etag2, 'POST missing ETag');

  const p2 = await fetch(`${base}/annotations/${encodeURIComponent(imageId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'If-Match': etag1 },
    body: JSON.stringify(updated)
  });
  assert(p2.status === 409, `POST stale If-Match should 409, got ${p2.status}`);
  const etagConflict = p2.headers.get('etag');
  assert(etagConflict === etag2, '409 response should return current ETag');

  const g2 = await fetch(`${base}/annotations/${encodeURIComponent('missing.jpg')}`);
  assert(g2.ok, `GET missing failed: ${g2.status}`);
  assert(g2.headers.get('etag') === 'W/"0"', 'GET missing ETag should be W/"0"');
  const body2 = await g2.json();
  assert(Array.isArray(body2) && body2.length === 0, 'GET missing should return []');

  await new Promise((resolve) => server.close(resolve));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

