import { useCallback, useMemo, useState } from 'react';
import { clamp, zoomAroundPoint } from '../core/canvasMath';

export function useCanvasInteraction({ containerRef, minZoom = 0.5, maxZoom = 3 }) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [panDragState, setPanDragState] = useState(null);

  const setZoomWithAnchor = useCallback((nextZoom, anchor) => {
    const boundedZoom = clamp(nextZoom, minZoom, maxZoom);
    setZoomLevel((prevZoom) => {
      if (!anchor) return boundedZoom;
      setPanOffset((prevPan) => {
        const next = zoomAroundPoint(
          { zoom: prevZoom, panX: prevPan.x, panY: prevPan.y },
          anchor,
          boundedZoom
        );
        return { x: next.panX, y: next.panY };
      });
      return boundedZoom;
    });
  }, [maxZoom, minZoom]);

  const zoomIn = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    const anchor = rect ? { x: rect.width / 2, y: rect.height / 2 } : null;
    setZoomWithAnchor(zoomLevel + 0.25, anchor);
  }, [containerRef, setZoomWithAnchor, zoomLevel]);

  const zoomOut = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    const anchor = rect ? { x: rect.width / 2, y: rect.height / 2 } : null;
    setZoomWithAnchor(zoomLevel - 0.25, anchor);
  }, [containerRef, setZoomWithAnchor, zoomLevel]);

  const resetView = useCallback(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (!containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const anchor = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    const direction = e.deltaY < 0 ? 1 : -1;
    const delta = direction > 0 ? 0.12 : -0.12;
    setZoomWithAnchor(zoomLevel + delta, anchor);
  }, [containerRef, setZoomWithAnchor, zoomLevel]);

  const beginPan = useCallback((e) => {
    if (!isSpacePressed || e.button !== 0) return false;
    setPanDragState({
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: panOffset.x,
      originY: panOffset.y
    });
    return true;
  }, [isSpacePressed, panOffset.x, panOffset.y]);

  const movePan = useCallback((e) => {
    if (!panDragState) return false;
    const dx = e.clientX - panDragState.startClientX;
    const dy = e.clientY - panDragState.startClientY;
    setPanOffset({
      x: panDragState.originX + dx,
      y: panDragState.originY + dy
    });
    return true;
  }, [panDragState]);

  const endPan = useCallback(() => {
    if (!panDragState) return false;
    setPanDragState(null);
    return true;
  }, [panDragState]);

  const canvasClassName = useMemo(() => {
    if (panDragState) return 'mode-pan-active';
    if (isSpacePressed) return 'mode-pan';
    return '';
  }, [isSpacePressed, panDragState]);

  return {
    zoomLevel,
    setZoomLevel,
    zoomIn,
    zoomOut,
    panOffset,
    isSpacePressed,
    setIsSpacePressed,
    isPanning: !!panDragState,
    beginPan,
    movePan,
    endPan,
    handleWheel,
    resetView,
    canvasClassName
  };
}

