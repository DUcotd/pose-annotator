import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('AnnotationEditor wires wheel zoom, pan interaction, grid and connection overlays', () => {
  const modernPath = path.join(__dirname, 'AnnotationEditorModern.jsx');
  const modernSrc = fs.readFileSync(modernPath, 'utf8');
  const canvasPath = path.join(__dirname, '../editor/components/EditorCanvas.jsx');
  const canvasSrc = fs.readFileSync(canvasPath, 'utf8');

  assert.match(modernSrc, /onWheel=\{canvasInteraction\.handleWheel\}/);
  assert.match(modernSrc, /canvasInteraction\.beginPan/);
  assert.match(canvasSrc, /className="editor-grid-overlay"/);
  assert.match(canvasSrc, /className="editor-connection-overlay"/);
  assert.doesNotMatch(modernSrc, /http:\/\/localhost:5000/);
});
