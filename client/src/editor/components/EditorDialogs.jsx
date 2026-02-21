import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle, Play, RefreshCw, Save, Trash2, X } from 'lucide-react';

export function EditorDialogs({
  showHelpPanel,
  toggleHelpPanel,
  showCompletionDialog,
  handleContinueAnnotation,
  image,
  annotationStats,
  annotatedCount,
  images,
  exportStatus,
  handleGoToGallery,
  handleGoToTraining,
  isExporting,
  conflictInfo,
  saveStatus,
  closeConflict,
  reloadAfterConflict,
  forceOverwriteAfterConflict,
  blockedNavigation,
  closeBlockedNavigation,
  lastSaveError,
  retryBlockedNavigation,
  showDeleteConfirm,
  isDeletingImage,
  setShowDeleteConfirm,
  handleDeleteCurrentImage,
  showClearConfirm,
  setShowClearConfirm,
  annotations,
  applyAnnotationEdit,
  setSelectedId,
  showPredictionError,
  setShowPredictionError,
  predictionError
}) {
  return (
    <>
            {/* Help Panel */}
            {showHelpPanel && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    padding: '20px'
                }}>
                    <div style={{
                        background: 'linear-gradient(145deg, rgba(22, 27, 34, 0.98), rgba(13, 17, 23, 0.99))',
                        borderRadius: '20px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '28px',
                        maxWidth: '500px',
                        width: '100%',
                        maxHeight: '80vh',
                        overflow: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                ⌨️ 快捷键帮助
                            </h3>
                            <button
                                onClick={() => toggleHelpPanel(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '16px' }}>
                            <div>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                    工具切换
                                </h4>
                                <div style={{ display: 'grid', gap: '6px' }}>
                                    {[
                                        ['V', '选择工具'],
                                        ['B', '画框工具'],
                                        ['K', '关键点工具']
                                    ].map(([key, desc]) => (
                                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <kbd style={{
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                fontFamily: 'monospace',
                                                color: 'var(--text-primary)',
                                                minWidth: '32px',
                                                textAlign: 'center'
                                            }}>{key}</kbd>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                    导航操作
                                </h4>
                                <div style={{ display: 'grid', gap: '6px' }}>
                                    {[
                                        ['A / ←', '上一张图片'],
                                        ['D / →', '下一张图片'],
                                        ['Ctrl/Cmd+Z', '撤销'],
                                        ['Ctrl/Cmd+Shift+Z', '重做'],
                                        ['Ctrl/Cmd+Y', '重做'],
                                        ['Delete / Backspace', '删除选中']
                                    ].map(([key, desc]) => (
                                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <kbd style={{
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                fontFamily: 'monospace',
                                                color: 'var(--text-primary)',
                                                minWidth: '140px',
                                                textAlign: 'center'
                                            }}>{key}</kbd>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                    视图控制
                                </h4>
                                <div style={{ display: 'grid', gap: '6px' }}>
                                    {[
                                        ['G', '切换网格'],
                                        ['H', '切换连接线'],
                                        ['Esc', '取消选择'],
                                        ['?', '显示/隐藏帮助']
                                    ].map(([key, desc]) => (
                                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <kbd style={{
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                fontFamily: 'monospace',
                                                color: 'var(--text-primary)',
                                                minWidth: '32px',
                                                textAlign: 'center'
                                            }}>{key}</kbd>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div style={{
                            marginTop: '20px',
                            padding: '12px',
                            background: 'rgba(88, 166, 255, 0.1)',
                            borderRadius: '10px',
                            fontSize: '12px',
                            color: 'var(--text-tertiary)'
                        }}>
                            💡 提示：右键点击可取消当前操作或切换到选择模式
                        </div>
                    </div>
                </div>
            )}
            {/* Completion Dialog */}
            {showCompletionDialog && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    padding: '20px'
                }}>
                    <div style={{
                        background: 'linear-gradient(145deg, rgba(22, 27, 34, 0.98), rgba(13, 17, 23, 0.99))',
                        borderRadius: '24px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '32px',
                        maxWidth: '480px',
                        width: '100%',
                        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '14px',
                                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(74, 222, 128, 0.1))',
                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <CheckCircle size={24} color="#4ade80" />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    标注完成确认
                                </h3>
                            </div>
                            <button
                                onClick={handleContinueAnnotation}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '10px',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '16px',
                            padding: '20px',
                            marginBottom: '24px',
                            border: '1px solid rgba(255, 255, 255, 0.06)'
                        }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                                当前图片
                            </div>
                            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>
                                {image}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                <div style={{
                                    textAlign: 'center',
                                    padding: '14px',
                                    background: 'rgba(88, 166, 255, 0.08)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(88, 166, 255, 0.15)'
                                }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                                        {annotationStats.bboxes}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>标注框</div>
                                </div>
                                <div style={{
                                    textAlign: 'center',
                                    padding: '14px',
                                    background: 'rgba(251, 191, 36, 0.08)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(251, 191, 36, 0.15)'
                                }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24' }}>
                                        {annotationStats.keypoints}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>关键点</div>
                                </div>
                                <div style={{
                                    textAlign: 'center',
                                    padding: '14px',
                                    background: 'rgba(34, 197, 94, 0.08)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(34, 197, 94, 0.15)'
                                }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4ade80' }}>
                                        {annotatedCount} / {images.length}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>已标注图片</div>
                                </div>
                            </div>
                        </div>

                        {exportStatus && !exportStatus.success && (
                            <div style={{
                                marginBottom: '16px',
                                padding: '12px 16px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '12px',
                                color: '#f87171',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}>
                                <AlertTriangle size={16} />
                                {exportStatus.message || '导出失败'}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button
                                onClick={handleContinueAnnotation}
                                style={{
                                    flex: 1,
                                    padding: '14px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                继续标注
                            </button>
                            <button
                                onClick={handleGoToGallery}
                                style={{
                                    flex: 1,
                                    padding: '14px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    borderRadius: '12px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                返回图库
                            </button>
                            <button
                                onClick={() => handleGoToTraining(true)}
                                disabled={isExporting}
                                style={{
                                    flex: 1.2,
                                    padding: '14px',
                                    background: isExporting
                                        ? 'rgba(34, 197, 94, 0.5)'
                                        : 'linear-gradient(135deg, #22c55e, #4ade80)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    cursor: isExporting ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {isExporting ? (
                                    <>
                                        <div style={{
                                            width: '16px',
                                            height: '16px',
                                            border: '2px solid rgba(255,255,255,0.3)',
                                            borderTopColor: 'white',
                                            borderRadius: '50%',
                                            animation: 'spin 1s linear infinite'
                                        }} />
                                        导出中...
                                    </>
                                ) : (
                                    <>
                                        <Play size={16} fill="currentColor" />
                                        前往训练
                                    </>
                                )}
                            </button>
                        </div>

                        <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            background: 'rgba(88, 166, 255, 0.08)',
                            borderRadius: '10px',
                            fontSize: '12px',
                            color: 'var(--text-tertiary)',
                            textAlign: 'center',
                            border: '1px solid rgba(88, 166, 255, 0.1)'
                        }}>
                            💡 点击"前往训练"将自动导出数据集并跳转到训练配置页面
                        </div>
                    </div>
                </div>
            )}

            {conflictInfo && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000
                }}
                    onClick={() => saveStatus !== 'saving' && closeConflict()}
                >
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(22, 27, 34, 0.98), rgba(13, 17, 23, 0.98))',
                        borderRadius: '20px',
                        padding: '2rem',
                        maxWidth: '520px',
                        width: '90%',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.25rem' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '14px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ef4444'
                            }}>
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    保存冲突
                                </h3>
                                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
                                    该图片的标注已被其他进程更新（例如 AI 预标注或另一个页面）。请选择处理方式。
                                </p>
                            </div>
                        </div>

                        {conflictInfo.serverEtag && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.12)',
                                borderRadius: '10px',
                                padding: '12px',
                                marginBottom: '1.25rem',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#fecaca',
                                fontSize: '13px',
                                lineHeight: 1.5,
                                wordBreak: 'break-word'
                            }}>
                                服务器版本：{conflictInfo.serverEtag}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button
                                onClick={closeConflict}
                                disabled={saveStatus === 'saving'}
                                style={{
                                    flex: '1 1 120px',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                                    opacity: saveStatus === 'saving' ? 0.5 : 1
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={reloadAfterConflict}
                                disabled={saveStatus === 'saving'}
                                style={{
                                    flex: '1 1 160px',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: 'rgba(59, 130, 246, 0.15)',
                                    border: '1px solid rgba(59, 130, 246, 0.35)',
                                    color: '#93c5fd',
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                                    opacity: saveStatus === 'saving' ? 0.7 : 1
                                }}
                            >
                                重新加载服务器版本
                            </button>
                            <button
                                onClick={forceOverwriteAfterConflict}
                                disabled={saveStatus === 'saving'}
                                style={{
                                    flex: '1 1 160px',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                                    opacity: saveStatus === 'saving' ? 0.7 : 1
                                }}
                            >
                                强制覆盖保存
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {blockedNavigation && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000
                }}
                    onClick={() => saveStatus !== 'saving' && closeBlockedNavigation()}
                >
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(22, 27, 34, 0.98), rgba(13, 17, 23, 0.98))',
                        borderRadius: '20px',
                        padding: '2rem',
                        maxWidth: '440px',
                        width: '90%',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.25rem' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '14px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ef4444'
                            }}>
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    无法继续
                                </h3>
                                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
                                    请先处理当前状态后再继续。
                                </p>
                            </div>
                        </div>

                        {lastSaveError && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.12)',
                                borderRadius: '10px',
                                padding: '12px',
                                marginBottom: '1.25rem',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#fecaca',
                                fontSize: '13px',
                                lineHeight: 1.5,
                                wordBreak: 'break-word'
                            }}>
                                {lastSaveError}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => closeBlockedNavigation()}
                                disabled={saveStatus === 'saving'}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                                    opacity: saveStatus === 'saving' ? 0.5 : 1
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={retryBlockedNavigation}
                                disabled={saveStatus === 'saving'}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    opacity: saveStatus === 'saving' ? 0.7 : 1
                                }}
                            >
                                {saveStatus === 'saving' ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" />
                                        保存中...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        重试保存并继续
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete Image Confirmation Dialog */}
            {showDeleteConfirm && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000
                }}
                    onClick={() => !isDeletingImage && setShowDeleteConfirm(false)}
                >
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(22, 27, 34, 0.98), rgba(13, 17, 23, 0.98))',
                        borderRadius: '20px',
                        padding: '2rem',
                        maxWidth: '400px',
                        width: '90%',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '14px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ef4444'
                            }}>
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    删除图片
                                </h3>
                                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                    此操作不可撤销
                                </p>
                            </div>
                        </div>

                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '14px', lineHeight: 1.6 }}>
                            确定要删除当前图片 <strong style={{ color: 'var(--text-primary)' }}>{image}</strong> 吗？
                        </p>

                        {annotationStats.bboxes > 0 && (
                            <div style={{
                                background: 'rgba(251, 191, 36, 0.1)',
                                borderRadius: '10px',
                                padding: '12px',
                                marginBottom: '1rem',
                                border: '1px solid rgba(251, 191, 36, 0.2)'
                            }}>
                                <p style={{ margin: 0, color: '#fbbf24', fontSize: '13px' }}>
                                    ⚠️ 该图片已有 {annotationStats.bboxes} 个标注框和 {annotationStats.keypoints} 个关键点，删除后将一并移除。
                                </p>
                            </div>
                        )}

                        <p style={{ color: '#60a5fa', fontSize: '13px', marginBottom: '1.5rem' }}>
                            删除后，剩余图片将自动重新编号以保持连续。
                        </p>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeletingImage}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: isDeletingImage ? 'not-allowed' : 'pointer',
                                    opacity: isDeletingImage ? 0.5 : 1
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleDeleteCurrentImage}
                                disabled={isDeletingImage}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: isDeletingImage ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                {isDeletingImage ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" />
                                        删除中...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={16} />
                                        确认删除
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Clear Annotations Confirmation Dialog */}
            {showClearConfirm && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000
                }}
                    onClick={() => setShowClearConfirm(false)}
                >
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(22, 27, 34, 0.98), rgba(13, 17, 23, 0.98))',
                        borderRadius: '20px',
                        padding: '2rem',
                        maxWidth: '400px',
                        width: '90%',
                        border: '1px solid rgba(88, 166, 255, 0.3)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '14px',
                                background: 'rgba(88, 166, 255, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#4da1ff'
                            }}>
                                <RefreshCw size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    清空标注
                                </h3>
                                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                    重置当前图片标注
                                </p>
                            </div>
                        </div>

                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '14px', lineHeight: 1.6 }}>
                            确认要清空当前图片的所有 <strong style={{ color: 'var(--text-primary)' }}>{annotations.length}</strong> 个标注吗？此操作可以使用 <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px', fontSize: '11px' }}>Ctrl+Z</kbd> 撤销。
                        </p>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowClearConfirm(false)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={() => {
                                    applyAnnotationEdit(() => []);
                                    setSelectedId(null);
                                    setShowClearConfirm(false);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #4f46e5, #3b82f6)',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Trash2 size={16} />
                                确认清空
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {showPredictionError && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000
                }}
                    onClick={() => setShowPredictionError(false)}
                >
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(22, 27, 34, 0.98), rgba(13, 17, 23, 0.98))',
                        borderRadius: '20px',
                        padding: '2rem',
                        maxWidth: '400px',
                        width: '90%',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '14px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ef4444'
                            }}>
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    操作失败
                                </h3>
                            </div>
                        </div>

                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '14px', lineHeight: 1.6 }}>
                            {predictionError}
                        </p>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowPredictionError(false)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
    </>
  );
}
