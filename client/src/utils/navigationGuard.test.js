import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Sidebar navigation uses navigateTo (prevents editor data loss)', () => {
  const mainLayoutPath = path.join(__dirname, '..', 'components', 'MainLayout.jsx');
  const src = fs.readFileSync(mainLayoutPath, 'utf8');

  assert.match(src, /\bnavigateTo\('export'\)/);
  assert.doesNotMatch(src, /\bsetView\('export'\)/);
});

