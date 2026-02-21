import { describe, expect, it } from 'vitest';
import { editorReducer, initialEditorUiState } from './editorReducer';

describe('editorReducer (vitest)', () => {
  it('toggles grid and connections', () => {
    const withGrid = editorReducer(initialEditorUiState, { type: 'TOGGLE_GRID' });
    expect(withGrid.showGrid).toBe(true);

    const withConnections = editorReducer(withGrid, { type: 'TOGGLE_CONNECTIONS' });
    expect(withConnections.showConnections).toBe(false);
  });

  it('accepts explicit toggle payloads', () => {
    const next = editorReducer(initialEditorUiState, { type: 'TOGGLE_HELP', payload: true });
    expect(next.showHelpPanel).toBe(true);
  });

  it('resets mode, selection and transform', () => {
    const dirty = {
      ...initialEditorUiState,
      mode: 'select',
      selectedId: 123,
      viewTransform: { zoom: 2, panX: 10, panY: 20 }
    };
    const reset = editorReducer(dirty, { type: 'RESET_VIEW' });
    expect(reset.mode).toBe('bbox');
    expect(reset.selectedId).toBeNull();
    expect(reset.viewTransform).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });
});
