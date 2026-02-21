import React from 'react';
import {
  ArrowLeft,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Play,
  RotateCcw,
  Save
} from 'lucide-react';

export function EditorHeader({
  navLocked,
  onBackClick,
  goToPrev,
  goToPrevUnannotated,
  copyPrevToCurrent,
  image,
  currentIndex,
  imagesLength,
  datasetStats,
  copyCurrentToNext,
  goToNextUnannotated,
  goToNext,
  saveStatus,
  lastSaveError,
  onRetrySave,
  showStatusPanel,
  onToggleStatusPanel,
  onCompleteAnnotation
}) {
  return (
    <header className="editor-header">
      <div className="editor-header-left">
        <button onClick={onBackClick} disabled={navLocked} className="editor-back-btn">
          <ArrowLeft size={15} strokeWidth={2.5} /> 返回
        </button>
        <div className="divider"></div>

        <div className="editor-nav">
          <button
            onClick={goToPrev}
            disabled={navLocked || currentIndex <= 0}
            className="icon-btn"
            title="上一张 (A 或 左箭头)"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goToPrevUnannotated}
            disabled={navLocked || currentIndex <= 0}
            className="icon-btn"
            title="上一张未标注"
          >
            <Play size={18} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button
            onClick={copyPrevToCurrent}
            disabled={navLocked || currentIndex <= 0}
            className="icon-btn"
            title="复制上一张标注到当前"
          >
            <RotateCcw size={18} />
          </button>

          <div className="editor-nav-info">
            <h3>{image}</h3>
            <div className="editor-nav-counter">
              {currentIndex + 1} / {imagesLength}
              {datasetStats && Number.isFinite(datasetStats.unannotated) ? ` · 未标注 ${datasetStats.unannotated}` : ''}
            </div>
            <div className="editor-nav-progress">
              <div
                className="editor-nav-progress-fill"
                style={{ width: `${imagesLength > 0 ? ((currentIndex + 1) / imagesLength) * 100 : 0}%` }}
              />
            </div>
          </div>

          <button
            onClick={copyCurrentToNext}
            disabled={navLocked || currentIndex >= imagesLength - 1}
            className="icon-btn"
            title="复制当前标注到下一张"
          >
            <RotateCcw size={18} style={{ transform: 'scaleX(-1)' }} />
          </button>
          <button
            onClick={goToNextUnannotated}
            disabled={navLocked || currentIndex >= imagesLength - 1}
            className="icon-btn"
            title="下一张未标注"
          >
            <Play size={18} />
          </button>
          <button
            onClick={goToNext}
            disabled={navLocked || currentIndex >= imagesLength - 1}
            className="icon-btn"
            title="下一张 (D 或 右箭头)"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="editor-header-right">
        <div className={`save-status ${saveStatus}`}>
          {saveStatus === 'saving' && '保存中...'}
          {saveStatus === 'error' && (
            <>
              保存失败!{lastSaveError ? ` ${lastSaveError}` : ''}
              <button
                onClick={onRetrySave}
                style={{
                  marginLeft: '8px',
                  padding: '2px 8px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '4px',
                  color: '#f87171',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                重试
              </button>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Save size={14} /> 已保存
            </>
          )}
        </div>
        <button
          onClick={onToggleStatusPanel}
          className={`icon-btn editor-status-toggle ${showStatusPanel ? 'active' : ''}`}
          title="状态/错误面板"
        >
          <Layers size={18} />
        </button>
        <button
          onClick={onCompleteAnnotation}
          disabled={navLocked}
          className="complete-btn-pulse editor-complete-btn"
        >
          <CheckCircle size={16} strokeWidth={2.5} />
          完成标注
        </button>
      </div>
    </header>
  );
}
