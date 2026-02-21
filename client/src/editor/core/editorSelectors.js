export function selectViewTransform(uiState) {
  return uiState?.viewTransform || { zoom: 1, panX: 0, panY: 0 };
}

export function selectCanUndo(historyIndex) {
  return Number.isFinite(historyIndex) && historyIndex > 0;
}

export function selectCanRedo(historyIndex, historyLength) {
  return Number.isFinite(historyIndex) && Number.isFinite(historyLength) && historyIndex < historyLength - 1;
}

