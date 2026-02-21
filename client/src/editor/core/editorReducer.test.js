import test from 'node:test';
import assert from 'node:assert/strict';
import { editorReducer, initialEditorUiState } from './editorReducer.js';

test('editorReducer toggles grid and connections', () => {
  const withGrid = editorReducer(initialEditorUiState, { type: 'TOGGLE_GRID' });
  assert.equal(withGrid.showGrid, true);

  const withConnections = editorReducer(withGrid, { type: 'TOGGLE_CONNECTIONS' });
  assert.equal(withConnections.showConnections, false);
});

test('editorReducer supports explicit boolean payloads', () => {
  const next = editorReducer(initialEditorUiState, { type: 'TOGGLE_HELP', payload: true });
  assert.equal(next.showHelpPanel, true);
});

test('editorReducer resets view state', () => {
  const dirty = {
    ...initialEditorUiState,
    mode: 'select',
    selectedId: 123,
    viewTransform: { zoom: 2, panX: 10, panY: 20 }
  };
  const reset = editorReducer(dirty, { type: 'RESET_VIEW' });
  assert.equal(reset.mode, 'bbox');
  assert.equal(reset.selectedId, null);
  assert.deepEqual(reset.viewTransform, { zoom: 1, panX: 0, panY: 0 });
});

