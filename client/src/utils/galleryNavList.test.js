import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('ImageGallery passes filtered navImages into onSelectImage', () => {
  const p = path.join(__dirname, '..', 'components', 'ImageGallery.jsx');
  const src = fs.readFileSync(p, 'utf8');
  assert.match(src, /\bonSelectImage=\{\(img\)\s*=>\s*onSelectImage\(img,\s*\{\s*navImages:\s*filtered\s*\}\)\s*\}/);
});

