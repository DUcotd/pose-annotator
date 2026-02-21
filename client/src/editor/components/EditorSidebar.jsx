import React from 'react';
import {
  Box,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Layers,
  MousePointer2,
  Tag,
  Trash2,
  X
} from 'lucide-react';

const CLASS_COLORS = ['#58a6ff', '#fbbf24', '#a855f7', '#34d399', '#f97316', '#f43f5e', '#06b6d4', '#84cc16'];

export function EditorSidebar({
  annotationStats,
  groups,
  selectedId,
  projectConfig,
  expandedGroups,
  onSelectGroup,
  onToggleGroup,
  onDeleteAnnotation,
  onUpdateGroupClassIndex,
  onSelectKeypoint,
  unassignedKeypoints,
  onClearUnassignedKeypoint,
  onClearSelection,
  hasAnnotations,
  onRequestClearAnnotations
}) {
  return (
    <aside className="editor-sidebar">
      <div className="editor-sidebar-header">
        <Layers size={18} color="var(--accent-primary)" />
        <h4>图层列表</h4>
      </div>

      <div className="editor-sidebar-stats">
        <div className="editor-sidebar-stat">
          <div className="editor-sidebar-stat-value stat-bboxes">{annotationStats.bboxes}</div>
          <div className="editor-sidebar-stat-label">标注框</div>
        </div>
        <div className="editor-sidebar-stat">
          <div className="editor-sidebar-stat-value stat-keypoints">{annotationStats.keypoints}</div>
          <div className="editor-sidebar-stat-label">关键点</div>
        </div>
        <div className="editor-sidebar-stat">
          <div className="editor-sidebar-stat-value stat-labeled">{annotationStats.labeled}</div>
          <div className="editor-sidebar-stat-label">已标类</div>
        </div>
      </div>

      <div className="editor-sidebar-body">
        {groups.length === 0 && (
          <div className="editor-layer-empty">
            <div className="editor-layer-empty-icon">
              <Box size={22} strokeWidth={1.5} />
            </div>
            <p className="editor-layer-empty-title">暂无标注</p>
            <p className="editor-layer-empty-desc">切换到「画框」模式，在图片上拖拽即可创建标注框</p>
          </div>
        )}
        {groups.map((group, idx) => {
          const classDisplayName = projectConfig.classMapping[group.classIndex] || `Class ${group.classIndex ?? 0}`;
          const chipColor = CLASS_COLORS[(group.classIndex ?? 0) % CLASS_COLORS.length];
          return (
            <div key={group.id} className={`layer-group ${selectedId === group.id ? 'selected' : ''}`}>
              <div
                onClick={() => {
                  onSelectGroup(group.id);
                  onToggleGroup(group.id);
                }}
                className={`layer-group-header ${selectedId === group.id ? 'selected' : ''}`}
              >
                <div className="layer-group-header-left">
                  <div className="layer-group-toggle">
                    {expandedGroups[group.id] ? <ChevronDown size={14} strokeWidth={3} /> : <ChevronRight size={14} strokeWidth={3} />}
                  </div>
                  <div
                    className="layer-class-chip"
                    style={{ '--chip-color': chipColor }}
                  />
                  <span className="layer-group-name layer-group-name-row">
                    {classDisplayName}
                    <span className="layer-group-index-badge">#{idx + 1}</span>
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteAnnotation(group.id); }}
                  className="icon-btn trash-btn layer-delete-btn"
                  title="删除"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {expandedGroups[group.id] && (
                <div className="layer-children">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    <div className="layer-child-meta">
                      <span style={{ minWidth: '50px' }}>ID:</span>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Tag size={10} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                        <input
                          type="number"
                          min="0"
                          value={group.classIndex ?? 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            onUpdateGroupClassIndex(group.id, val);
                          }}
                          className="input-inline"
                          style={{
                            paddingLeft: '24px',
                            width: '100%',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '8px',
                            height: '28px',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                    </div>
                    <div className="layer-child-meta">
                      <span style={{ minWidth: '50px' }}>类别:</span>
                      <span style={{
                        color: chipColor,
                        fontWeight: 700,
                        fontSize: '12px',
                        textShadow: `0 0 8px ${chipColor}40`
                      }}>{classDisplayName}</span>
                    </div>
                  </div>

                  {group.children.length > 0 ? (
                    <div style={{ padding: '4px 12px 4px 40px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {group.children.map((kp) => (
                        <div
                          key={kp.id}
                          className={`annotation-chip ${selectedId === kp.id ? 'selected' : ''}`}
                          style={{
                            background: selectedId === kp.id
                              ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.25), rgba(251, 191, 36, 0.15))'
                              : 'rgba(255, 255, 255, 0.04)',
                            border: selectedId === kp.id
                              ? '1px solid rgba(251, 191, 36, 0.4)'
                              : '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '8px',
                            padding: '4px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                          onClick={() => onSelectKeypoint(kp.id)}
                        >
                          <Crosshair size={11} style={{ color: selectedId === kp.id ? '#fbbf24' : 'var(--text-tertiary)' }} />
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: selectedId === kp.id ? 'var(--text-primary)' : 'var(--text-secondary)'
                          }}>点 {kp.keypointIndex}</span>
                          <button
                            className="annotation-chip-delete"
                            style={{
                              border: 'none',
                              background: 'none',
                              color: 'var(--text-tertiary)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              borderRadius: '4px',
                              transition: 'background 0.2s',
                              opacity: selectedId === kp.id ? 1 : 0.5
                            }}
                            onClick={(e) => { e.stopPropagation(); onDeleteAnnotation(kp.id); }}
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="layer-empty" style={{
                      padding: '8px 16px 8px 42px',
                      fontSize: '11px',
                      color: 'var(--text-tertiary)',
                      fontStyle: 'italic',
                      opacity: 0.6
                    }}>
                      暂无关键点
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {unassignedKeypoints.length > 0 && (
          <div className="unassigned-box">
            <div className="unassigned-title">未分配的关键点</div>
            {unassignedKeypoints.map(kp => (
              <div key={kp.id} className="unassigned-item">
                <span>点 {kp.keypointIndex}</span>
                <button onClick={() => onClearUnassignedKeypoint(kp.id)} className="btn-text-danger">删除</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="editor-sidebar-footer">
        <button
          className="editor-sidebar-footer-btn"
          onClick={onClearSelection}
          title="取消选择"
        >
          <MousePointer2 size={12} />
          取消选择
        </button>
        <button
          className="editor-sidebar-footer-btn danger"
          onClick={onRequestClearAnnotations}
          title="清空所有标注"
          disabled={!hasAnnotations}
        >
          <Trash2 size={12} />
          清空标注
        </button>
      </div>
    </aside>
  );
}
