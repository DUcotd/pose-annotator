import React, { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditorCanvas } from '../editor/components/EditorCanvas';
import { EditorToolbar } from '../editor/components/EditorToolbar';

describe('AnnotationEditor interactions (vitest)', () => {
  it('toolbar buttons trigger expected callbacks', () => {
    const onSetMode = vi.fn();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const onToggleGrid = vi.fn();
    const onToggleConnections = vi.fn();
    const onToggleHelpPanel = vi.fn();

    const { getByTitle } = render(
      <EditorToolbar
        mode="select"
        onSetMode={onSetMode}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={true}
        canRedo={true}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onResetView={() => {}}
        showGrid={false}
        onToggleGrid={onToggleGrid}
        showConnections={true}
        onToggleConnections={onToggleConnections}
        onOpenConfig={() => {}}
        isPredicting={false}
        hasPredictionModel={true}
        onPredictSingleImage={() => {}}
        onDeleteCurrentImage={() => {}}
        showHelpPanel={false}
        onToggleHelpPanel={onToggleHelpPanel}
      />
    );

    fireEvent.click(getByTitle('画框 (B)'));
    fireEvent.click(getByTitle('撤销 (Ctrl/Cmd+Z)'));
    fireEvent.click(getByTitle('重做 (Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y)'));
    fireEvent.click(getByTitle('切换网格 (G)'));
    fireEvent.click(getByTitle('切换连接线 (H)'));
    fireEvent.click(getByTitle('快捷键帮助 (?)'));

    expect(onSetMode).toHaveBeenCalledWith('bbox');
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRedo).toHaveBeenCalledTimes(1);
    expect(onToggleGrid).toHaveBeenCalledTimes(1);
    expect(onToggleConnections).toHaveBeenCalledTimes(1);
    expect(onToggleHelpPanel).toHaveBeenCalledTimes(1);
  });

  it('canvas renders grid and connection layers when enabled', () => {
    const { container, rerender } = render(
      <EditorCanvas
        containerRef={createRef()}
        className="editor-canvas-area"
        onPointerDown={() => {}}
        onPointerMove={() => {}}
        onPointerUp={() => {}}
        onPointerLeave={() => {}}
        onWheel={() => {}}
        onContextMenu={() => {}}
        panOffset={{ x: 0, y: 0 }}
        zoomLevel={1}
        imageRef={createRef()}
        imageSrc="/test.jpg"
        imageKey="test.jpg"
        onImageLoad={() => {}}
        onImageError={() => {}}
        showGrid={true}
        isImageLoaded={true}
        imageDims={{ width: 400, height: 300 }}
        gridStep={40}
        showConnections={true}
        connectionSegments={[{ x1: 1, y1: 2, x2: 3, y2: 4 }]}
        showGuides={false}
        mode="bbox"
        cursorPos={{ x: 0, y: 0 }}
        renderedAnnotations={[]}
        selectedId={null}
        isLoaded={true}
        displayScale={{ sx: 1, sy: 1 }}
        projectConfig={{ classMapping: {} }}
        currentBox={null}
      />
    );

    expect(container.querySelector('.editor-grid-overlay')).not.toBeNull();
    expect(container.querySelector('.editor-connection-overlay')).not.toBeNull();

    rerender(
      <EditorCanvas
        containerRef={createRef()}
        className="editor-canvas-area"
        onPointerDown={() => {}}
        onPointerMove={() => {}}
        onPointerUp={() => {}}
        onPointerLeave={() => {}}
        onWheel={() => {}}
        onContextMenu={() => {}}
        panOffset={{ x: 0, y: 0 }}
        zoomLevel={1}
        imageRef={createRef()}
        imageSrc="/test.jpg"
        imageKey="test.jpg"
        onImageLoad={() => {}}
        onImageError={() => {}}
        showGrid={false}
        isImageLoaded={true}
        imageDims={{ width: 400, height: 300 }}
        gridStep={40}
        showConnections={false}
        connectionSegments={[{ x1: 1, y1: 2, x2: 3, y2: 4 }]}
        showGuides={false}
        mode="bbox"
        cursorPos={{ x: 0, y: 0 }}
        renderedAnnotations={[]}
        selectedId={null}
        isLoaded={true}
        displayScale={{ sx: 1, sy: 1 }}
        projectConfig={{ classMapping: {} }}
        currentBox={null}
      />
    );

    expect(container.querySelector('.editor-grid-overlay')).toBeNull();
    expect(container.querySelector('.editor-connection-overlay')).toBeNull();
  });
});
