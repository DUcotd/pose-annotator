
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Save, ArrowLeft, Trash2, Crosshair, Box, MousePointer2, ChevronDown, ChevronRight, ChevronLeft, Layers, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { ClassInputModal } from './ClassInputModal';

export function AnnotationEditor({ image, projectId, onBack }) {
    const { images, openEditor } = useProject();
    const [annotations, setAnnotations] = useState([]);
    const [mode, setMode] = useState('bbox'); // 'bbox' | 'keypoint' | 'select'
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState(null);
    const [currentBox, setCurrentBox] = useState(null);
    const [scale, setScale] = useState(1);
    const [selectedId, setSelectedId] = useState(null);
    const [dragState, setDragState] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState({}); // { bboxId: boolean }

    // New Workflow State
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [pendingBBox, setPendingBBox] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isImageLoaded, setIsImageLoaded] = useState(false);
    const [imageDims, setImageDims] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
    const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error'
    const [showGuides, setShowGuides] = useState(false);

    const imageRef = useRef(null);
    const containerRef = useRef(null);

    // Derived State: Group Keypoints by BBox
    const { groups, unassignedKeypoints } = useMemo(() => {
        const bboxes = annotations.filter(a => a.type === 'bbox');
        const keypoints = annotations.filter(a => a.type === 'keypoint');
        const usedKeypoints = new Set();

        const groups = bboxes.map(bbox => {
            const children = keypoints.filter(kp => {
                if (kp.parentId === bbox.id) {
                    usedKeypoints.add(kp.id);
                    return true;
                }
                if (kp.parentId) return false;
                const inside = kp.x >= bbox.x && kp.x <= bbox.x + bbox.width &&
                    kp.y >= bbox.y && kp.y <= bbox.y + bbox.height;
                if (inside) usedKeypoints.add(kp.id);
                return inside;
            });
            return { ...bbox, children };
        });

        const unassigned = keypoints.filter(kp => !usedKeypoints.has(kp.id));
        return { groups, unassignedKeypoints: unassigned };
    }, [annotations]);

    // Load existing annotations
    useEffect(() => {
        setIsLoaded(false);
        setIsImageLoaded(false);
        setImageDims({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
        setAnnotations([]); // Clear old annotations immediately
        setMode('bbox');
        fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/annotations/${encodeURIComponent(image)}`)
            .then(res => res.json())
            .then(data => {
                setAnnotations(data || []);
                setIsLoaded(true);
            })
            .catch(err => {
                console.error('Error loading annotations:', err);
                setIsLoaded(true);
            });
    }, [image, projectId]);


    // Save Helper
    const saveAnnotations = useCallback(async (currentAnnotations) => {
        try {
            setSaveStatus('saving');
            const response = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/annotations/${encodeURIComponent(image)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentAnnotations)
            });
            if (response.ok) setSaveStatus('saved');
            else setSaveStatus('error');
        } catch (error) {
            setSaveStatus('error');
        }
    }, [image, projectId]);

    // Auto-save logic
    useEffect(() => {
        if (!isLoaded) return;
        const timer = setTimeout(() => saveAnnotations(annotations), 1000);
        return () => clearTimeout(timer);
    }, [annotations, isLoaded, saveAnnotations]);


    // Navigation Logic
    const currentIndex = useMemo(() => images.indexOf(image), [images, image]);

    const goToNext = useCallback(async () => {
        if (currentIndex < images.length - 1) {
            await saveAnnotations(annotations);
            openEditor(images[currentIndex + 1]);
        }
    }, [currentIndex, images, annotations, openEditor, saveAnnotations]);

    const goToPrev = useCallback(async () => {
        if (currentIndex > 0) {
            await saveAnnotations(annotations);
            openEditor(images[currentIndex - 1]);
        }
    }, [currentIndex, images, annotations, openEditor, saveAnnotations]);

    // Keyboard Shortcuts for Navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isClassModalOpen) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'd' || e.key === 'ArrowRight') {
                goToNext();
            } else if (e.key === 'a' || e.key === 'ArrowLeft') {
                goToPrev();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToNext, goToPrev, isClassModalOpen]);


    // Auto-expand group when selecting a bbox
    useEffect(() => {
        if (selectedId) {
            const ann = annotations.find(a => a.id === selectedId);
            if (ann && ann.type === 'bbox') {
                setExpandedGroups(prev => ({ ...prev, [selectedId]: true }));
            }
        }
    }, [selectedId, annotations]);

    // Handle Window Resize
    useEffect(() => {
        if (!imageRef.current) return;

        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === imageRef.current) {
                    const { width, height } = entry.contentRect;
                    setImageDims(prev => ({
                        ...prev,
                        width,
                        height,
                        naturalWidth: imageRef.current.naturalWidth,
                        naturalHeight: imageRef.current.naturalHeight
                    }));
                }
            }
        });

        observer.observe(imageRef.current);
        return () => observer.disconnect();
    }, [isImageLoaded]);

    // Returns coordinates in the image's NATURAL pixel space (not display space)
    // This ensures annotations are stored at original resolution for correcet export
    const getRelativePos = (e) => {
        if (!imageRef.current) return { x: 0, y: 0 };
        const rect = imageRef.current.getBoundingClientRect();
        const scaleX = imageRef.current.naturalWidth / rect.width;
        const scaleY = imageRef.current.naturalHeight / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    // Returns coordinates in DISPLAY pixel space (for CSS positioning like crosshairs)
    const getDisplayPos = (e) => {
        if (!imageRef.current) return { x: 0, y: 0 };
        const rect = imageRef.current.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    // Scale factor: multiply natural coords by this to get display coords
    const getDisplayScale = useCallback(() => {
        if (!isImageLoaded || !imageDims.naturalWidth) return { sx: 1, sy: 1 };
        return {
            sx: imageDims.width / imageDims.naturalWidth,
            sy: imageDims.height / imageDims.naturalHeight
        };
    }, [isImageLoaded, imageDims]);

    const handleImageLoad = () => {
        if (imageRef.current) {
            const { width, height, naturalWidth, naturalHeight } = imageRef.current;
            setImageDims({ width, height, naturalWidth, naturalHeight });
            setIsImageLoaded(true);
        }
    };

    const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

    // Helper: Get next available keypoint index for the selected bbox
    const getNextKeypointIndex = () => {
        if (!selectedId) return 0;
        const selectedAnn = annotations.find(a => a.id === selectedId);
        if (!selectedAnn || selectedAnn.type !== 'bbox') return 0;

        const linkedKps = annotations.filter(a =>
            a.type === 'keypoint' && (
                a.parentId === selectedId ||
                (!a.parentId && a.x >= selectedAnn.x && a.x <= selectedAnn.x + selectedAnn.width &&
                    a.y >= selectedAnn.y && a.y <= selectedAnn.y + selectedAnn.height)
            )
        );

        if (linkedKps.length === 0) return 0;
        const maxIndex = Math.max(...linkedKps.map(k => k.keypointIndex || 0));
        return maxIndex + 1;
    };

    const nextIndex = useMemo(() => getNextKeypointIndex(), [annotations, selectedId]);

    const handlePointerDown = (e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        if (!imageRef.current) return;
        const imageWidth = imageRef.current.naturalWidth;
        const imageHeight = imageRef.current.naturalHeight;
        const pos = getRelativePos(e);

        pos.x = clamp(pos.x, 0, imageWidth);
        pos.y = clamp(pos.y, 0, imageHeight);

        if (mode === 'select') {
            if (selectedId) {
                const ann = annotations.find(a => a.id === selectedId);
                if (ann && ann.type === 'bbox') {
                    const handle = getResizeHandle(pos, ann);
                    if (handle) {
                        setDragState({ type: 'resize', handle, startX: pos.x, startY: pos.y, initialAnn: { ...ann } });
                        return;
                    }
                }
            }

            const clickedAnn = annotations.slice().reverse().find(ann => isPointInAnnotation(pos, ann));

            if (clickedAnn) {
                setSelectedId(clickedAnn.id);
                setDragState({ type: 'move', startX: pos.x, startY: pos.y, initialAnn: { ...clickedAnn } });
            } else {
                setSelectedId(null);
            }
            return;
        }

        if (mode === 'keypoint') {
            const newAnnotation = {
                id: Date.now(),
                type: 'keypoint',
                x: pos.x,
                y: pos.y,
                label: 'Keypoint',
                keypointIndex: nextIndex,
                parentId: selectedId
            };
            setAnnotations([...annotations, newAnnotation]);
            return;
        }

        if (mode === 'bbox') {
            setIsDrawing(true);
            setStartPos(pos);
            setSelectedId(null);
        }
    };

    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

    const handlePointerMove = (e) => {
        if (!imageRef.current) return;
        setShowGuides(true);
        const imageWidth = imageRef.current.naturalWidth;
        const imageHeight = imageRef.current.naturalHeight;
        const rawPos = getRelativePos(e);
        const pos = { x: clamp(rawPos.x, 0, imageWidth), y: clamp(rawPos.y, 0, imageHeight) };

        // Crosshair guides need display coordinates for CSS positioning
        const displayPos = getDisplayPos(e);
        setCursorPos({
            x: clamp(displayPos.x, 0, imageRef.current.width),
            y: clamp(displayPos.y, 0, imageRef.current.height)
        });

        if (dragState && selectedId) {
            const dx = pos.x - dragState.startX;
            const dy = pos.y - dragState.startY;

            setAnnotations(annotations.map(ann => {
                if (ann.id !== selectedId) return ann;

                if (dragState.type === 'move') {
                    let newX = dragState.initialAnn.x + dx;
                    let newY = dragState.initialAnn.y + dy;

                    if (ann.type === 'bbox') {
                        newX = clamp(newX, 0, imageWidth - ann.width);
                        newY = clamp(newY, 0, imageHeight - ann.height);
                    } else {
                        newX = clamp(newX, 0, imageWidth);
                        newY = clamp(newY, 0, imageHeight);
                    }
                    return { ...ann, x: newX, y: newY };
                } else if (dragState.type === 'resize') {
                    const ia = dragState.initialAnn;
                    let newBox = { ...ia };

                    switch (dragState.handle) {
                        case 'tl': newBox.x += dx; newBox.y += dy; newBox.width -= dx; newBox.height -= dy; break;
                        case 'tr': newBox.y += dy; newBox.width += dx; newBox.height -= dy; break;
                        case 'bl': newBox.x += dx; newBox.width -= dx; newBox.height += dy; break;
                        case 'br': newBox.width += dx; newBox.height += dy; break;
                    }

                    if (newBox.width < 0) { newBox.x += newBox.width; newBox.width = Math.abs(newBox.width); }
                    if (newBox.height < 0) { newBox.y += newBox.height; newBox.height = Math.abs(newBox.height); }

                    if (newBox.x < 0) { newBox.width += newBox.x; newBox.x = 0; }
                    if (newBox.y < 0) { newBox.height += newBox.y; newBox.y = 0; }
                    if (newBox.x + newBox.width > imageWidth) newBox.width = imageWidth - newBox.x;
                    if (newBox.y + newBox.height > imageHeight) newBox.height = imageHeight - newBox.y;

                    return newBox;
                }
                return ann;
            }));
            return;
        }

        if (isDrawing && mode === 'bbox') {
            setCurrentBox({
                x: Math.min(startPos.x, pos.x),
                y: Math.min(startPos.y, pos.y),
                width: Math.abs(pos.x - startPos.x),
                height: Math.abs(pos.y - startPos.y)
            });
        }
    };

    const handlePointerUp = (e) => {
        if (e.button !== 0) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (dragState) { setDragState(null); return; }
        if (!isDrawing) return;

        // Minimum box size threshold in natural pixels (scale 5 display pixels to natural)
        const natScale = imageRef.current ? imageRef.current.naturalWidth / imageRef.current.width : 1;
        const minBoxSize = 5 * natScale;
        if (currentBox && currentBox.width > minBoxSize && currentBox.height > minBoxSize) {
            const newBBox = {
                id: Date.now(),
                type: 'bbox',
                ...currentBox,
                label: 'Object'
            };
            setPendingBBox(newBBox);
            setIsClassModalOpen(true);
        }
        setIsDrawing(false); setCurrentBox(null); setStartPos(null);
    };

    const confirmClassIndex = (index) => {
        if (pendingBBox) {
            const finalizedBBox = { ...pendingBBox, classIndex: index };
            setAnnotations([...annotations, finalizedBBox]);

            setSelectedId(finalizedBBox.id);
            setMode('keypoint');
            setPendingBBox(null);
        }
    };

    const isPointInAnnotation = (p, ann) => {
        if (ann.type === 'bbox') {
            return p.x >= ann.x && p.x <= ann.x + ann.width && p.y >= ann.y && p.y <= ann.y + ann.height;
        } else {
            // Scale hit-test radius to natural coordinate space
            const hitScale = imageRef.current ? imageRef.current.naturalWidth / imageRef.current.width : 1;
            return Math.sqrt((p.x - ann.x) ** 2 + (p.y - ann.y) ** 2) <= 8 * hitScale;
        }
    };

    const getResizeHandle = (p, box) => {
        // Scale threshold to natural coordinate space so handles feel the same size on screen
        const handleScale = imageRef.current ? imageRef.current.naturalWidth / imageRef.current.width : 1;
        const threshold = 10 * handleScale;
        const handles = {
            tl: { x: box.x, y: box.y },
            tr: { x: box.x + box.width, y: box.y },
            bl: { x: box.x, y: box.y + box.height },
            br: { x: box.x + box.width, y: box.y + box.height }
        };
        for (const [key, h] of Object.entries(handles)) {
            if (Math.abs(p.x - h.x) <= threshold && Math.abs(p.y - h.y) <= threshold) return key;
        }
        return null;
    };

    const handleDelete = (id) => {
        const ann = annotations.find(a => a.id === id);
        if (ann && ann.type === 'bbox') {
            // Cascade-delete child keypoints linked to this bbox
            const childIds = new Set(
                annotations
                    .filter(a => a.type === 'keypoint' && a.parentId === id)
                    .map(a => a.id)
            );
            setAnnotations(annotations.filter(a => a.id !== id && !childIds.has(a.id)));
        } else {
            setAnnotations(annotations.filter(a => a.id !== id));
        }
        if (selectedId === id) setSelectedId(null);
    };

    const toggleGroup = (id) => {
        setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        if (isDrawing) {
            setIsDrawing(false);
            setCurrentBox(null);
            setStartPos(null);
        } else {
            if (mode !== 'select') {
                setMode('select');
            } else {
                setSelectedId(null);
            }
            setPendingBBox(null);
            setIsClassModalOpen(false);
        }
    };

    return (
        <div className="editor-container">
            {/* Top Toolbar */}
            <header className="editor-header">
                <div className="editor-header-left">
                    <button onClick={onBack} className="btn-secondary" style={{ padding: '8px 12px' }}>
                        <ArrowLeft size={16} /> 返回
                    </button>
                    <div className="divider"></div>

                    {/* Navigation Controls */}
                    <div className="editor-nav">
                        <button
                            onClick={goToPrev}
                            disabled={currentIndex <= 0}
                            className="icon-btn"
                            title="上一张 (A 或 左箭头)"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <div className="editor-nav-info">
                            <h3>{image}</h3>
                            <div className="editor-nav-counter">
                                {currentIndex + 1} / {images.length}
                            </div>
                        </div>

                        <button
                            onClick={goToNext}
                            disabled={currentIndex >= images.length - 1}
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
                        {saveStatus === 'error' && '保存失败!'}
                        {saveStatus === 'saved' && (
                            <>
                                <Save size={14} /> 已保存
                            </>
                        )}
                    </div>
                </div>
            </header>

            <div className="editor-body">

                {/* Floating Toolbar */}
                <div className="editor-toolbar">
                    {[
                        { id: 'select', icon: MousePointer2, label: '选择 (V)' },
                        { id: 'bbox', icon: Box, label: '画框 (B)' },
                        { id: 'keypoint', icon: Crosshair, label: '关键点 (K)' }
                    ].map(tool => (
                        <button
                            key={tool.id}
                            onClick={() => setMode(tool.id)}
                            title={tool.label}
                            className={`tool-btn ${mode === tool.id ? 'active' : ''}`}
                        >
                            <tool.icon size={20} />
                        </button>
                    ))}
                    <div className="toolbar-divider"></div>
                    <button title="复位视图" className="tool-btn">
                        <Maximize size={20} />
                    </button>
                </div>

                {/* Canvas Area */}
                <div
                    ref={containerRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={() => { setShowGuides(false); }}
                    onContextMenu={handleContextMenu}
                    className={`editor-canvas-area ${mode === 'select' ? 'mode-select' : 'mode-draw'}`}
                >
                    <div className="editor-image-wrapper">
                        <img
                            ref={imageRef}
                            src={`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/uploads/${encodeURIComponent(image)}`}
                            alt="Target"
                            onLoad={handleImageLoad}
                        />

                        {/* Crosshair Guides */}
                        {showGuides && (mode === 'bbox' || mode === 'keypoint') && (
                            <>
                                <div style={{
                                    position: 'absolute', top: 0, bottom: 0, left: cursorPos.x,
                                    width: '1px', pointerEvents: 'none', zIndex: 50,
                                    borderLeft: '1px dashed rgba(255, 255, 255, 0.6)',
                                    boxShadow: '0 0 2px rgba(0,0,0,0.5)'
                                }} />
                                <div style={{
                                    position: 'absolute', left: 0, right: 0, top: cursorPos.y,
                                    height: '1px', pointerEvents: 'none', zIndex: 50,
                                    borderTop: '1px dashed rgba(255, 255, 255, 0.6)',
                                    boxShadow: '0 0 2px rgba(0,0,0,0.5)'
                                }} />
                            </>
                        )}

                        {/* Annotations */}
                        <div style={{ pointerEvents: 'none', visibility: (isImageLoaded && isLoaded) ? 'visible' : 'hidden' }}>
                            {annotations.map(ann => {
                                const isSelected = selectedId === ann.id;
                                const parentBBox = groups.find(g => g.id === selectedId);
                                const isChildOfSelected = parentBBox && parentBBox.children.find(c => c.id === ann.id);
                                const ds = getDisplayScale();

                                if (ann.type === 'bbox') {
                                    return (
                                        <div key={ann.id} style={{
                                            position: 'absolute', left: ann.x * ds.sx, top: ann.y * ds.sy, width: ann.width * ds.sx, height: ann.height * ds.sy,
                                            border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--success)'}`,
                                            background: `rgba(88, 166, 255, ${isSelected ? 0.15 : 0.05})`,
                                            pointerEvents: 'none'
                                        }}>
                                            <div style={{
                                                position: 'absolute', top: -22, left: -2,
                                                background: isSelected ? 'var(--accent-primary)' : 'var(--success)',
                                                color: 'white', padding: '2px 6px', borderRadius: '4px',
                                                fontSize: '11px', fontWeight: '600',
                                                boxShadow: 'var(--shadow-sm)'
                                            }}>
                                                Class {ann.classIndex ?? 0}
                                            </div>
                                            {isSelected && mode === 'select' && (
                                                <>
                                                    {['tl', 'tr', 'bl', 'br'].map(h => (
                                                        <div key={h} style={{
                                                            position: 'absolute', width: 10, height: 10, background: '#fff', border: '2px solid var(--accent-primary)', borderRadius: '50%',
                                                            top: h.includes('t') ? -6 : 'auto', bottom: h.includes('b') ? -6 : 'auto',
                                                            left: h.includes('l') ? -6 : 'auto', right: h.includes('r') ? -6 : 'auto',
                                                            pointerEvents: 'none'
                                                        }} />
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div key={ann.id} style={{
                                            position: 'absolute', left: ann.x * ds.sx - 5, top: ann.y * ds.sy - 5, width: 10, height: 10, borderRadius: '50%',
                                            background: isChildOfSelected || isSelected ? 'var(--warning)' : 'var(--success)',
                                            border: '2px solid var(--bg-primary)',
                                            boxShadow: isSelected ? '0 0 0 2px var(--warning)' : 'none',
                                            pointerEvents: 'none',
                                            transition: 'all 0.2s ease'
                                        }}>
                                            <span style={{ position: 'absolute', top: -16, left: 0, fontSize: '10px', color: 'var(--text-primary)', fontWeight: 'bold', textShadow: '0 1px 2px black' }}>
                                                {ann.keypointIndex ?? 0}
                                            </span>
                                        </div>
                                    );
                                }
                            })}
                        </div>

                        {currentBox && (
                            <div style={{
                                position: 'absolute', left: currentBox.x * getDisplayScale().sx, top: currentBox.y * getDisplayScale().sy, width: currentBox.width * getDisplayScale().sx, height: currentBox.height * getDisplayScale().sy,
                                border: '2px dashed var(--accent-primary)', background: 'var(--accent-dim)', pointerEvents: 'none'
                            }} />
                        )}
                    </div>
                </div>

                {/* Right Sidebar - Object List */}
                <aside className="editor-sidebar">
                    <div className="editor-sidebar-header">
                        <Layers size={18} color="var(--accent-primary)" />
                        <h4>图层列表</h4>
                    </div>

                    <div className="editor-sidebar-body">
                        {groups.map((group, idx) => (
                            <div key={group.id} className={`layer-group ${selectedId === group.id ? 'selected' : ''}`}>
                                <div
                                    onClick={() => { setSelectedId(group.id); setMode('select'); }}
                                    className={`layer-group-header ${selectedId === group.id ? 'selected' : ''}`}
                                >
                                    <div className="layer-group-header-left">
                                        <div onClick={(e) => { e.stopPropagation(); toggleGroup(group.id); }} className="layer-group-toggle">
                                            {expandedGroups[group.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </div>
                                        <Box size={14} color="var(--accent-primary)" />
                                        <span className="layer-group-name">对象 {idx + 1}</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(group.id); }} className="icon-btn" title="删除">
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                {expandedGroups[group.id] && (
                                    <div className="layer-children">
                                        <div className="layer-child-meta">
                                            <span>类别 ID:</span>
                                            <input
                                                type="number" min="0"
                                                value={group.classIndex ?? 0}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setAnnotations(prev => prev.map(a => a.id === group.id ? { ...a, classIndex: val } : a));
                                                }}
                                                className="input-inline"
                                            />
                                        </div>

                                        {group.children.length > 0 ? (
                                            <div>
                                                {group.children.map((kp) => (
                                                    <div
                                                        key={kp.id}
                                                        onClick={() => { setSelectedId(kp.id); setMode('select'); }}
                                                        className={`layer-child ${selectedId === kp.id ? 'selected' : ''}`}
                                                    >
                                                        <div className="layer-child-left">
                                                            <Crosshair size={12} color="var(--warning)" />
                                                            <span>点 {kp.keypointIndex}</span>
                                                        </div>
                                                        <div className="layer-child-right">
                                                            <input
                                                                type="number" min="0"
                                                                value={kp.keypointIndex ?? 0}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => {
                                                                    const val = parseInt(e.target.value) || 0;
                                                                    setAnnotations(prev => prev.map(a => a.id === kp.id ? { ...a, keypointIndex: val } : a));
                                                                }}
                                                                className="input-inline-xs"
                                                            />
                                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(kp.id); }} className="icon-btn" style={{ padding: '2px' }}>
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="layer-empty">
                                                暂无关键点
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}

                        {unassignedKeypoints.length > 0 && (
                            <div className="unassigned-box">
                                <div className="unassigned-title">未分配的关键点</div>
                                {unassignedKeypoints.map(kp => (
                                    <div key={kp.id} className="unassigned-item">
                                        <span>点 {kp.keypointIndex}</span>
                                        <button onClick={() => handleDelete(kp.id)} className="btn-text-danger">删除</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>
            </div>

            <ClassInputModal
                isOpen={isClassModalOpen}
                onClose={() => { setIsClassModalOpen(false); setPendingBBox(null); }}
                onSubmit={confirmClassIndex}
            />
        </div >
    );
}
