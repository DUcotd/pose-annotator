import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('TrainingConfig uses LogWorkbench and workbench exposes diagnosis/critical/all/stderr tabs', () => {
  const trainingConfigPath = path.join(__dirname, 'TrainingConfig.jsx');
  const trainingConfigSrc = fs.readFileSync(trainingConfigPath, 'utf8');
  assert.match(trainingConfigSrc, /LogWorkbench/);
  assert.match(trainingConfigSrc, /eventsV2/);
  assert.match(trainingConfigSrc, /diagnosisV2/);

  const workbenchPath = path.join(__dirname, 'training', 'LogWorkbench.jsx');
  const workbenchSrc = fs.readFileSync(workbenchPath, 'utf8');
  assert.match(workbenchSrc, /诊断/);
  assert.match(workbenchSrc, /关键事件/);
  assert.match(workbenchSrc, /完整事件流/);
  assert.match(workbenchSrc, /原始 stderr/);
  assert.match(workbenchSrc, /autoScroll/);
  assert.match(workbenchSrc, /details/);
});

