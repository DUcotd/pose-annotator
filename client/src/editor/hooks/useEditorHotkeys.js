import { useEffect } from 'react';

export function useEditorHotkeys(options) {
  const {
    disabled,
    isClassModalOpen,
    navLocked,
    goToNext,
    goToPrev,
    onSetMode,
    onUndo,
    onRedo,
    selectedId,
    onDelete,
    onToggleGrid,
    onToggleConnections,
    onToggleHelpPanel,
    onClearSelection,
    onSpacePressChange
  } = options;

  useEffect(() => {
    if (disabled) return undefined;

    const isTyping = (target) => {
      if (!target) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    };

    const handleKeyDown = (e) => {
      if (isClassModalOpen) return;
      if (isTyping(e.target)) return;

      if (e.code === 'Space') {
        onSpacePressChange?.(true);
      }

      if (e.key === 'd' || e.key === 'ArrowRight') {
        if (navLocked) return;
        goToNext?.();
      } else if (e.key === 'a' || e.key === 'ArrowLeft') {
        if (navLocked) return;
        goToPrev?.();
      } else if (e.key === 'v') {
        onSetMode?.('select');
      } else if (e.key === 'b') {
        onSetMode?.('bbox');
      } else if (e.key === 'k') {
        onSetMode?.('keypoint');
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) onRedo?.();
        else onUndo?.();
      } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onRedo?.();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) onDelete?.(selectedId);
      } else if (e.key === 'g') {
        onToggleGrid?.();
      } else if (e.key === 'h') {
        onToggleConnections?.();
      } else if (e.key === '?') {
        onToggleHelpPanel?.();
      } else if (e.key === 'Escape') {
        onToggleHelpPanel?.(false);
        onClearSelection?.();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        onSpacePressChange?.(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    disabled,
    isClassModalOpen,
    navLocked,
    goToNext,
    goToPrev,
    onSetMode,
    onUndo,
    onRedo,
    selectedId,
    onDelete,
    onToggleGrid,
    onToggleConnections,
    onToggleHelpPanel,
    onClearSelection,
    onSpacePressChange
  ]);
}

