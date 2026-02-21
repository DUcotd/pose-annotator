import { useCallback, useMemo, useReducer } from 'react';
import { useAnnotationSession } from '../../hooks/useAnnotationSession';
import { editorReducer, initialEditorUiState } from '../core/editorReducer';
import { selectViewTransform } from '../core/editorSelectors';

export function useEditorState({ projectId, imageId }) {
  const session = useAnnotationSession({ projectId, imageId });
  const [uiState, dispatch] = useReducer(editorReducer, initialEditorUiState);

  const setMode = useCallback((mode) => dispatch({ type: 'SET_MODE', payload: mode }), []);
  const setSelectedId = useCallback((id) => dispatch({ type: 'SET_SELECTED_ID', payload: id }), []);
  const toggleGrid = useCallback((next) => dispatch({ type: 'TOGGLE_GRID', payload: next }), []);
  const toggleConnections = useCallback((next) => dispatch({ type: 'TOGGLE_CONNECTIONS', payload: next }), []);
  const toggleHelpPanel = useCallback((next) => dispatch({ type: 'TOGGLE_HELP', payload: next }), []);
  const setSpacePressed = useCallback((pressed) => dispatch({ type: 'SET_SPACE_PRESSED', payload: pressed }), []);
  const setViewTransform = useCallback((nextPartial) => dispatch({ type: 'SET_VIEW_TRANSFORM', payload: nextPartial }), []);
  const resetView = useCallback(() => dispatch({ type: 'RESET_VIEW' }), []);

  const viewTransform = useMemo(() => selectViewTransform(uiState), [uiState]);

  return {
    session,
    uiState,
    viewTransform,
    setMode,
    setSelectedId,
    toggleGrid,
    toggleConnections,
    toggleHelpPanel,
    setSpacePressed,
    setViewTransform,
    resetView
  };
}
