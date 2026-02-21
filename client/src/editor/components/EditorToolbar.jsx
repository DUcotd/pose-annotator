import React from 'react';
import {
  Box,
  Crosshair,
  Grid3X3,
  HelpCircle,
  Link,
  Maximize,
  MousePointer2,
  Redo2,
  RefreshCw,
  Tag,
  Trash2,
  Undo2,
  Wand2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

export function EditorToolbar({
  mode,
  onSetMode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onZoomIn,
  onZoomOut,
  onResetView,
  showGrid,
  onToggleGrid,
  showConnections,
  onToggleConnections,
  onOpenConfig,
  isPredicting,
  hasPredictionModel,
  onPredictSingleImage,
  onDeleteCurrentImage,
  showHelpPanel,
  onToggleHelpPanel
}) {
  return (
    <div className="editor-toolbar">
      {[
        { id: 'select', icon: MousePointer2, label: '选择 (V)' },
        { id: 'bbox', icon: Box, label: '画框 (B)' },
        { id: 'keypoint', icon: Crosshair, label: '关键点 (K)' }
      ].map(tool => (
        <button
          key={tool.id}
          onClick={() => onSetMode(tool.id)}
          title={tool.label}
          className={`tool-btn ${mode === tool.id ? 'active' : ''}`}
        >
          <tool.icon size={20} />
        </button>
      ))}
      <div className="toolbar-divider"></div>
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="撤销 (Ctrl/Cmd+Z)"
        className="tool-btn"
      >
        <Undo2 size={20} />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        title="重做 (Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y)"
        className="tool-btn"
      >
        <Redo2 size={20} />
      </button>
      <div className="toolbar-divider"></div>
      <button onClick={onZoomIn} title="放大" className="tool-btn">
        <ZoomIn size={20} />
      </button>
      <button onClick={onZoomOut} title="缩小" className="tool-btn">
        <ZoomOut size={20} />
      </button>
      <button onClick={onResetView} title="复位视图" className="tool-btn">
        <Maximize size={20} />
      </button>
      <div className="toolbar-divider"></div>
      <button
        onClick={onToggleGrid}
        title="切换网格 (G)"
        className={`tool-btn ${showGrid ? 'active' : ''}`}
      >
        <Grid3X3 size={20} />
      </button>
      <button
        onClick={onToggleConnections}
        title="切换连接线 (H)"
        className={`tool-btn ${showConnections ? 'active' : ''}`}
      >
        <Link size={20} />
      </button>
      <div className="toolbar-divider"></div>
      <button
        onClick={onOpenConfig}
        title="类别管理器"
        className="tool-btn tool-btn-accent"
      >
        <Tag size={20} />
      </button>
      <div className="toolbar-divider"></div>
      <button
        onClick={onPredictSingleImage}
        disabled={isPredicting || !hasPredictionModel}
        title={hasPredictionModel ? '模型预标注当前图片' : '请先在图库配置预标注模型'}
        className="tool-btn tool-btn-ai"
      >
        {isPredicting ? <RefreshCw size={20} className="spin" /> : <Wand2 size={20} />}
      </button>
      <button
        onClick={onDeleteCurrentImage}
        title="删除当前图片"
        className="tool-btn tool-btn-danger"
      >
        <Trash2 size={20} />
      </button>
      <button
        onClick={onToggleHelpPanel}
        title="快捷键帮助 (?)"
        className={`tool-btn tool-btn-help ${showHelpPanel ? 'active' : ''}`}
      >
        <HelpCircle size={20} />
      </button>
    </div>
  );
}
