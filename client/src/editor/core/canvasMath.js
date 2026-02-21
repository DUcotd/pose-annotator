/**
 * @typedef {'bbox' | 'keypoint' | 'select'} EditorMode
 */

/**
 * @typedef {Object} EditorViewTransform
 * @property {number} zoom
 * @property {number} panX
 * @property {number} panY
 */

/**
 * @typedef {Object} EditorAction
 * @property {string} type
 * @property {any} [payload]
 */

/**
 * @typedef {Object} EditorDerivedState
 * @property {{ sx: number, sy: number }} displayScale
 * @property {number} annotationCount
 */

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function clampPoint(point, maxWidth, maxHeight) {
  return {
    x: clamp(point.x, 0, maxWidth),
    y: clamp(point.y, 0, maxHeight)
  };
}

export function getDisplayScale(imageDims) {
  if (!imageDims?.naturalWidth || !imageDims?.naturalHeight) {
    return { sx: 1, sy: 1 };
  }
  return {
    sx: imageDims.width / imageDims.naturalWidth,
    sy: imageDims.height / imageDims.naturalHeight
  };
}

export function eventToNaturalPoint(clientX, clientY, imageRect, naturalWidth, naturalHeight) {
  if (!imageRect || !naturalWidth || !naturalHeight) {
    return { x: 0, y: 0 };
  }
  const scaleX = naturalWidth / imageRect.width;
  const scaleY = naturalHeight / imageRect.height;
  return {
    x: (clientX - imageRect.left) * scaleX,
    y: (clientY - imageRect.top) * scaleY
  };
}

export function eventToDisplayPoint(clientX, clientY, imageRect) {
  if (!imageRect) {
    return { x: 0, y: 0 };
  }
  return {
    x: clientX - imageRect.left,
    y: clientY - imageRect.top
  };
}

export function naturalToDisplayPoint(x, y, displayScale) {
  return {
    x: x * displayScale.sx,
    y: y * displayScale.sy
  };
}

export function getAdaptiveGridStep(zoom) {
  if (zoom < 0.75) return 120;
  if (zoom < 1.1) return 80;
  if (zoom < 1.8) return 50;
  return 30;
}

export function zoomAroundPoint(transform, anchor, nextZoom) {
  const zoom = clamp(nextZoom, 0.5, 3);
  const worldX = (anchor.x - transform.panX) / transform.zoom;
  const worldY = (anchor.y - transform.panY) / transform.zoom;
  return {
    zoom,
    panX: anchor.x - worldX * zoom,
    panY: anchor.y - worldY * zoom
  };
}

