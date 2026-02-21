/** @type {import('./canvasMath').EditorMode} */
const DEFAULT_MODE = 'bbox';

export const initialEditorUiState = {
  mode: DEFAULT_MODE,
  selectedId: null,
  showGrid: false,
  showConnections: true,
  showHelpPanel: false,
  isSpacePressed: false,
  viewTransform: {
    zoom: 1,
    panX: 0,
    panY: 0
  }
};

export function editorReducer(state, action) {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    case 'SET_SELECTED_ID':
      return { ...state, selectedId: action.payload ?? null };
    case 'TOGGLE_GRID':
      return { ...state, showGrid: typeof action.payload === 'boolean' ? action.payload : !state.showGrid };
    case 'TOGGLE_CONNECTIONS':
      return { ...state, showConnections: typeof action.payload === 'boolean' ? action.payload : !state.showConnections };
    case 'TOGGLE_HELP':
      return { ...state, showHelpPanel: typeof action.payload === 'boolean' ? action.payload : !state.showHelpPanel };
    case 'SET_SPACE_PRESSED':
      return { ...state, isSpacePressed: !!action.payload };
    case 'SET_VIEW_TRANSFORM':
      return { ...state, viewTransform: { ...state.viewTransform, ...action.payload } };
    case 'RESET_VIEW':
      return {
        ...state,
        mode: DEFAULT_MODE,
        selectedId: null,
        viewTransform: { zoom: 1, panX: 0, panY: 0 }
      };
    default:
      return state;
  }
}
