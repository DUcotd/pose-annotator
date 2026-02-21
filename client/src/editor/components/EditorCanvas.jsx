import React from 'react';

export function EditorCanvas({
  containerRef,
  className,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onWheel,
  onContextMenu,
  panOffset,
  zoomLevel,
  imageRef,
  imageSrc,
  imageKey,
  onImageLoad,
  onImageError,
  showGrid,
  isImageLoaded,
  imageDims,
  gridStep,
  showConnections,
  connectionSegments,
  showGuides,
  mode,
  cursorPos,
  renderedAnnotations,
  selectedId,
  isLoaded,
  displayScale,
  projectConfig,
  currentBox
}) {
  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onWheel={onWheel}
      onContextMenu={onContextMenu}
      className={className}
    >
      <div
        className="editor-image-viewport"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`
        }}
      >
        <div className="editor-image-wrapper">
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Target"
            key={imageKey}
            onLoad={onImageLoad}
            onError={onImageError}
          />

          {showGrid && isImageLoaded && (
            <div
              className="editor-grid-overlay"
              style={{
                width: imageDims.width,
                height: imageDims.height,
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.22) 1px, transparent 1px)',
                backgroundSize: `${gridStep}px ${gridStep}px`,
                opacity: 0.35
              }}
            />
          )}

          {showConnections && connectionSegments.length > 0 && (
            <svg
              className="editor-connection-overlay"
              width={imageDims.width}
              height={imageDims.height}
              viewBox={`0 0 ${imageDims.width} ${imageDims.height}`}
            >
              {connectionSegments.map((line, idx) => (
                <line
                  key={`conn-${idx}`}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="rgba(255, 189, 46, 0.72)"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
              ))}
            </svg>
          )}

          {showGuides && (mode === 'bbox' || mode === 'keypoint') && (
            <>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: cursorPos.x,
                  width: '1px',
                  pointerEvents: 'none',
                  zIndex: 50,
                  borderLeft: '1px dashed rgba(255, 255, 255, 1)',
                  boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.7), 0 0 4px rgba(0,0,0,0.5)'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: cursorPos.y,
                  height: '1px',
                  pointerEvents: 'none',
                  zIndex: 50,
                  borderTop: '1px dashed rgba(255, 255, 255, 1)',
                  boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.7), 0 0 4px rgba(0,0,0,0.5)'
                }}
              />
            </>
          )}

          <div style={{ pointerEvents: 'none', visibility: (isImageLoaded && isLoaded) ? 'visible' : 'hidden' }}>
            {isImageLoaded && isLoaded && renderedAnnotations.map(ann => {
              const isSelected = selectedId === ann.id;
              const ds = displayScale;

              if (ann.type === 'bbox') {
                const bboxColor = isSelected ? '#58a6ff' : '#00FF00';
                return (
                  <div key={ann.id} style={{
                    position: 'absolute',
                    left: ann.x * ds.sx,
                    top: ann.y * ds.sy,
                    width: ann.width * ds.sx,
                    height: ann.height * ds.sy,
                    border: `2.5px solid ${bboxColor}`,
                    background: `rgba(88, 166, 255, ${isSelected ? 0.2 : 0.05})`,
                    boxShadow: isSelected
                      ? `0 0 0 1px black, 0 0 12px ${bboxColor}cc`
                      : '0 0 0 1px black',
                    pointerEvents: 'none',
                    zIndex: isSelected ? 40 : 10,
                    borderRadius: '2px'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: -24,
                      left: -2.5,
                      background: bboxColor,
                      color: 'black',
                      padding: '2px 8px',
                      borderRadius: '4px 4px 0 0',
                      fontSize: '12px',
                      fontWeight: '800',
                      boxShadow: '0 -2px 10px rgba(0,0,0,0.3)',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: '1px solid black',
                      borderBottom: 'none'
                    }}>
                      {projectConfig.classMapping[ann.classIndex] || `Class ${ann.classIndex ?? 0}`}
                    </div>
                    {isSelected && mode === 'select' && (
                      <>
                        {['tl', 'tr', 'bl', 'br'].map(h => (
                          <div key={h} style={{
                            position: 'absolute',
                            width: 12,
                            height: 12,
                            background: '#fff',
                            border: '2.5px solid #58a6ff',
                            borderRadius: '50%',
                            top: h.includes('t') ? -7 : 'auto',
                            bottom: h.includes('b') ? -7 : 'auto',
                            left: h.includes('l') ? -7 : 'auto',
                            right: h.includes('r') ? -7 : 'auto',
                            pointerEvents: 'none',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                          }} />
                        ))}
                      </>
                    )}
                  </div>
                );
              }

              const isChildOfSelected = ann.parentId === selectedId;
              const kpColor = isChildOfSelected || isSelected ? '#ffbd2e' : '#00FF00';
              return (
                <div key={ann.id} style={{
                  position: 'absolute',
                  left: ann.x * ds.sx - 6,
                  top: ann.y * ds.sy - 6,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: kpColor,
                  border: '2px solid black',
                  boxShadow: isSelected ? `0 0 0 2px white, 0 0 10px ${kpColor}` : '0 0 0 2px white',
                  pointerEvents: 'none',
                  zIndex: isSelected ? 50 : 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{
                    position: 'absolute',
                    top: -18,
                    left: 6,
                    transform: 'translateX(-50%)',
                    fontSize: '11px',
                    color: 'white',
                    fontWeight: '900',
                    textShadow: '0 0 2px black, 0 0 2px black, 0 0 2px black, 0 0 2px black',
                    whiteSpace: 'nowrap'
                  }}>
                    {ann.keypointIndex ?? 0}
                  </span>
                </div>
              );
            })}
          </div>

          {currentBox && (
            <>
              <div style={{
                position: 'absolute',
                left: currentBox.x * displayScale.sx,
                top: currentBox.y * displayScale.sy,
                width: currentBox.width * displayScale.sx,
                height: currentBox.height * displayScale.sy,
                border: '2px dashed #58a6ff',
                background: 'rgba(88, 166, 255, 0.15)',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 0 20px rgba(88,166,255,0.1)',
                pointerEvents: 'none',
                zIndex: 100
              }} />
              {currentBox.width > 10 && currentBox.height > 10 && (
                <div
                  className="bbox-size-hint"
                  style={{
                    left: currentBox.x * displayScale.sx,
                    top: Math.max(0, currentBox.y * displayScale.sy - 26)
                  }}
                >
                  {Math.round(currentBox.width)} x {Math.round(currentBox.height)} px
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
