
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Save, ArrowLeft, Trash2, Crosshair, Box, MousePointer2, ChevronDown, ChevronRight, ChevronLeft, Layers, ZoomIn, ZoomOut, Maximize, Tag, HelpCircle, Undo2, Redo2, RotateCcw, Grid3X3, Link, CheckCircle, Play, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useProject } from '../context/ProjectContext';
import { ClassInputModal } from './ClassInputModal';
import { ClassManagerModal } from './ClassManagerModal';

export function AnnotationEditor({ image, projectId, onBack }) {
    const { images, openEditor, goToTraining, currentProject, exportProject, deleteImage } = useProject();
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
    const [projectConfig, setProjectConfig] = useState({ classMapping: {} });
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [editingLabelId, setEditingLabelId] = useState(null); // ID of bbox being renamed
    const [editLabelValue, setEditLabelValue] = useState("");

    // Enhanced Features State
    const [zoomLevel, setZoomLevel] = useState(1);
    const [showGrid, setShowGrid] = useState(false);
    const [showConnections, setShowConnections] = useState(true);
    const [showHelpPanel, setShowHelpPanel] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [annotationStats, setAnnotationStats] = useState({ bboxes: 0, keypoints: 0, labeled: 0 });

    // Completion Dialog State
    const [showCompletionDialog, setShowCompletionDialog] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState(null);

    // Delete Image State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeletingImage, setIsDeletingImage] = useState(false);

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

    // Annotation Statistics
    useEffect(() => {
        const bboxes = annotations.filter(a => a.type === 'bbox');
        const keypoints = annotations.filter(a => a.type === 'keypoint');
        const labeled = bboxes.filter(b => b.label || b.classIndex !== undefined).length;
        setAnnotationStats({ bboxes: bboxes.length, keypoints: keypoints.length, labeled });
    }, [annotations]);

    // Undo/Redo functionality
    const pushToHistory = useCallback((newAnnotations) => {
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(JSON.stringify(newAnnotations));
            return newHistory.slice(-50); // Keep last 50 states
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
    }, [historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setAnnotations(JSON.parse(history[newIndex]));
        }
    }, [history, historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setAnnotations(JSON.parse(history[newIndex]));
        }
    }, [history, historyIndex]);

    const resetView = useCallback(() => {
        setZoomLevel(1);
        setSelectedId(null);
        setMode('bbox');
    }, []);

    const handleImageLoad = useCallback(() => {
        if (imageRef.current) {
            const { width, height, naturalWidth, naturalHeight } = imageRef.current;
            setImageDims({ width, height, naturalWidth, naturalHeight });
            setIsImageLoaded(true);
        }
    }, []);

    // Load existing annotations
    useEffect(() => {
        let isCancelled = false;
        setIsLoaded(false);
        setIsImageLoaded(false);
        setImageDims({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
        setAnnotations([]); // Clear old annotations immediately
        setMode('bbox');
        setSelectedId(null); // Reset selection on image change

        // Check if image is already loaded (from cache)
        if (imageRef.current && imageRef.current.complete) {
            handleImageLoad();
        }

        fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/annotations/${encodeURIComponent(image)}`)
            .then(res => res.json())
            .then(data => {
                if (!isCancelled) {
                    setAnnotations(data || []);
                    setIsLoaded(true);
                }
            })
            .catch(err => {
                console.error('Error loading annotations:', err);
                if (!isCancelled) {
                    setIsLoaded(true);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [image, projectId, handleImageLoad]);

    // Load project config
    useEffect(() => {
        fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/config`)
            .then(res => res.json())
            .then(data => setProjectConfig(data || { classMapping: {} }))
            .catch(err => console.error('Error loading config:', err));
    }, [projectId]);

    const saveConfig = (newConfig) => {
        setProjectConfig(newConfig);
        fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newConfig)
        }).catch(err => console.error('Error saving config:', err));
    };


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

    // Completion Handlers
    const handleCompleteAnnotation = async () => {
        await saveAnnotations(annotations);
        setShowCompletionDialog(true);
    };

    const handleContinueAnnotation = () => {
        setShowCompletionDialog(false);
    };

    const handleGoToGallery = async () => {
        await saveAnnotations(annotations);
        setShowCompletionDialog(false);
        onBack();
    };

    const handleGoToTraining = async (exportFirst = false) => {
        await saveAnnotations(annotations);
        
        if (exportFirst) {
            setIsExporting(true);
            setExportStatus(null);
            try {
                const result = await exportProject(projectId, {
                    trainRatio: 0.7,
                    valRatio: 0.2,
                    testRatio: 0.1,
                    includeVisibility: true
                });
                setExportStatus(result);
                if (result.success) {
                    setTimeout(() => {
                        setShowCompletionDialog(false);
                        setIsExporting(false);
                        goToTraining(projectId);
                    }, 500);
                } else {
                    setIsExporting(false);
                }
            } catch (err) {
                setExportStatus({ success: false, message: err.message });
                setIsExporting(false);
            }
        } else {
            setShowCompletionDialog(false);
            goToTraining(projectId);
        }
    };

    // Get annotated images count
    const getAnnotatedImagesCount = useCallback(async () => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/dataset/stats`);
            const data = await res.json();
            return data.annotated || 0;
        } catch {
            return 0;
        }
    }, [projectId]);

    const [annotatedCount, setAnnotatedCount] = useState(0);

    useEffect(() => {
        if (showCompletionDialog) {
            getAnnotatedImagesCount().then(setAnnotatedCount);
        }
    }, [showCompletionDialog, getAnnotatedImagesCount]);


    // Navigation Logic
    const currentIndex = useMemo(() => images.findIndex(img => (typeof img === 'string' ? img === image : img.name === image)), [images, image]);

    const goToNext = useCallback(async () => {
        if (currentIndex < images.length - 1) {
            await saveAnnotations(annotations);
            const nextImg = images[currentIndex + 1];
            openEditor(typeof nextImg === 'string' ? nextImg : nextImg.name);
        }
    }, [currentIndex, images, annotations, openEditor, saveAnnotations]);

    const goToPrev = useCallback(async () => {
        if (currentIndex > 0) {
            await saveAnnotations(annotations);
            const prevImg = images[currentIndex - 1];
            openEditor(typeof prevImg === 'string' ? prevImg : prevImg.name);
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
            } else if (e.key === 'v') {
                setMode('select');
            } else if (e.key === 'b') {
                setMode('bbox');
            } else if (e.key === 'k') {
                setMode('keypoint');
            } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                redo();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedId) {
                    handleDelete(selectedId);
                }
            } else if (e.key === 'g') {
                setShowGrid(prev => !prev);
            } else if (e.key === 'h') {
                setShowConnections(prev => !prev);
            } else if (e.key === '?') {
                setShowHelpPanel(prev => !prev);
            } else if (e.key === 'Escape') {
                setShowHelpPanel(false);
                setSelectedId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToNext, goToPrev, isClassModalOpen, undo, redo, selectedId]);


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
                label: '' // Clear default 'Object' to allow mapped name or custom name to take precedence
            };
            setPendingBBox(newBBox);
            setIsClassModalOpen(true);
        }
        setIsDrawing(false); setCurrentBox(null); setStartPos(null);
    };

    const confirmClassIndex = (index) => {
        if (pendingBBox) {
            const mappedName = projectConfig.classMapping[index];
            const finalizedBBox = {
                ...pendingBBox,
                classIndex: index,
                label: pendingBBox.label || mappedName || ''
            };
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

    const handleDeleteCurrentImage = async () => {
        setIsDeletingImage(true);
        const result = await deleteImage(projectId, image, true, currentIndex);
        setIsDeletingImage(false);
        
        if (result.success) {
            setShowDeleteConfirm(false);
        }
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
                    <button
                        onClick={handleCompleteAnnotation}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            background: 'linear-gradient(135deg, #22c55e, #4ade80)',
                            border: 'none',
                            borderRadius: '10px',
                            color: 'white',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <CheckCircle size={16} />
                        完成标注
                    </button>
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
                    <button 
                        onClick={undo} 
                        disabled={historyIndex <= 0}
                        title="撤销 (Ctrl+Z)" 
                        className="tool-btn"
                        style={{ opacity: historyIndex <= 0 ? 0.4 : 1 }}
                    >
                        <Undo2 size={20} />
                    </button>
                    <button 
                        onClick={redo} 
                        disabled={historyIndex >= history.length - 1}
                        title="重做 (Ctrl+Y)" 
                        className="tool-btn"
                        style={{ opacity: historyIndex >= history.length - 1 ? 0.4 : 1 }}
                    >
                        <Redo2 size={20} />
                    </button>
                    <div className="toolbar-divider"></div>
                    <button 
                        onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))} 
                        title="放大" 
                        className="tool-btn"
                    >
                        <ZoomIn size={20} />
                    </button>
                    <button 
                        onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))} 
                        title="缩小" 
                        className="tool-btn"
                    >
                        <ZoomOut size={20} />
                    </button>
                    <button 
                        onClick={resetView} 
                        title="复位视图" 
                        className="tool-btn"
                    >
                        <Maximize size={20} />
                    </button>
                    <div className="toolbar-divider"></div>
                    <button 
                        onClick={() => setShowGrid(prev => !prev)} 
                        title="切换网格 (G)" 
                        className={`tool-btn ${showGrid ? 'active' : ''}`}
                        style={{ opacity: showGrid ? 1 : 0.6 }}
                    >
                        <Grid3X3 size={20} />
                    </button>
                    <button 
                        onClick={() => setShowConnections(prev => !prev)} 
                        title="切换连接线 (H)" 
                        className={`tool-btn ${showConnections ? 'active' : ''}`}
                        style={{ opacity: showConnections ? 1 : 0.6 }}
                    >
                        <Link size={20} />
                    </button>
                    <div className="toolbar-divider"></div>
                    <button
                        onClick={() => setIsConfigModalOpen(true)}
                        title="类别管理器"
                        className="tool-btn"
                        style={{ color: 'var(--accent-primary)' }}
                    >
                        <Tag size={20} />
                    </button>
                    <button 
                        onClick={() => setShowDeleteConfirm(true)}
                        title="删除当前图片" 
                        className="tool-btn"
                        style={{ color: '#ef4444' }}
                    >
                        <Trash2 size={20} />
                    </button>
                    <button 
                        onClick={() => setShowHelpPanel(prev => !prev)} 
                        title="快捷键帮助 (?)" 
                        className="tool-btn"
                        style={{ color: showHelpPanel ? 'var(--accent-primary)' : 'inherit' }}
                    >
                        <HelpCircle size={20} />
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
                            src={`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/uploads/${encodeURIComponent(image)}?t=${Date.now()}`}
                            alt="Target"
                            key={image}
                            onLoad={handleImageLoad}
                            onError={() => {
                                console.error('Image failed to load');
                                setIsImageLoaded(true); // Allow UI to show (and fail gracefully)
                            }}
                        />

                        {/* Crosshair Guides */}
                        {showGuides && (mode === 'bbox' || mode === 'keypoint') && (
                            <>
                                {/* Vertical Guide with contrast shadow */}
                                <div style={{
                                    position: 'absolute', top: 0, bottom: 0, left: cursorPos.x,
                                    width: '1px', pointerEvents: 'none', zIndex: 50,
                                    borderLeft: '1px dashed rgba(255, 255, 255, 1)',
                                    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.7), 0 0 4px rgba(0,0,0,0.5)'
                                }} />
                                {/* Horizontal Guide with contrast shadow */}
                                <div style={{
                                    position: 'absolute', left: 0, right: 0, top: cursorPos.y,
                                    height: '1px', pointerEvents: 'none', zIndex: 50,
                                    borderTop: '1px dashed rgba(255, 255, 255, 1)',
                                    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.7), 0 0 4px rgba(0,0,0,0.5)'
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
                                                position: 'absolute', top: -24, left: -2.5,
                                                background: bboxColor,
                                                color: 'black', padding: '2px 8px', borderRadius: '4px 4px 0 0',
                                                fontSize: '12px', fontWeight: '800',
                                                boxShadow: '0 -2px 10px rgba(0,0,0,0.3)',
                                                whiteSpace: 'nowrap',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                border: '1px solid black',
                                                borderBottom: 'none'
                                            }}>
                                                {ann.label || projectConfig.classMapping[ann.classIndex] || `Class ${ann.classIndex ?? 0}`}
                                            </div>
                                            {isSelected && mode === 'select' && (
                                                <>
                                                    {['tl', 'tr', 'bl', 'br'].map(h => (
                                                        <div key={h} style={{
                                                            position: 'absolute', width: 12, height: 12, background: '#fff', border: '2.5px solid #58a6ff', borderRadius: '50%',
                                                            top: h.includes('t') ? -7 : 'auto', bottom: h.includes('b') ? -7 : 'auto',
                                                            left: h.includes('l') ? -7 : 'auto', right: h.includes('r') ? -7 : 'auto',
                                                            pointerEvents: 'none',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                                                        }} />
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    );
                                } else {
                                    const kpColor = isChildOfSelected || isSelected ? '#ffbd2e' : '#00FF00';
                                    return (
                                        <div key={ann.id} style={{
                                            position: 'absolute',
                                            left: ann.x * ds.sx - 6,
                                            top: ann.y * ds.sy - 6,
                                            width: 12, height: 12, borderRadius: '50%',
                                            background: kpColor,
                                            border: '2px solid black',
                                            boxShadow: isSelected
                                                ? `0 0 0 2px white, 0 0 10px ${kpColor}`
                                                : '0 0 0 2px white',
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
                                }
                            })}
                        </div>

                        {currentBox && (
                            <div style={{
                                position: 'absolute',
                                left: currentBox.x * getDisplayScale().sx,
                                top: currentBox.y * getDisplayScale().sy,
                                width: currentBox.width * getDisplayScale().sx,
                                height: currentBox.height * getDisplayScale().sy,
                                border: '2.5px dashed #58a6ff',
                                background: 'rgba(88, 166, 255, 0.2)',
                                boxShadow: '0 0 0 1px black',
                                pointerEvents: 'none',
                                zIndex: 100
                            }} />
                        )}
                    </div>
                </div>

                {/* Right Sidebar - Object List */}
                <aside className="editor-sidebar">
                    <div className="editor-sidebar-header">
                        <Layers size={18} color="var(--accent-primary)" />
                        <h4>图层列表</h4>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', fontSize: '11px' }}>
                            <span style={{ 
                                background: 'rgba(88, 166, 255, 0.15)', 
                                padding: '2px 8px', 
                                borderRadius: '6px',
                                color: 'var(--accent-primary)'
                            }}>
                                {annotationStats.bboxes} 框
                            </span>
                            <span style={{ 
                                background: 'rgba(255, 189, 46, 0.15)', 
                                padding: '2px 8px', 
                                borderRadius: '6px',
                                color: '#ffbd2e'
                            }}>
                                {annotationStats.keypoints} 点
                            </span>
                        </div>
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
                                        {editingLabelId === group.id ? (
                                            <input
                                                autoFocus
                                                className="input-inline"
                                                style={{ fontSize: '13px', fontWeight: 600, width: '120px' }}
                                                value={editLabelValue}
                                                onChange={e => setEditLabelValue(e.target.value)}
                                                onBlur={() => {
                                                    setAnnotations(prev => prev.map(a => a.id === group.id ? { ...a, label: editLabelValue } : a));
                                                    setEditingLabelId(null);
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        setAnnotations(prev => prev.map(a => a.id === group.id ? { ...a, label: editLabelValue } : a));
                                                        setEditingLabelId(null);
                                                    }
                                                }}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span
                                                className="layer-group-name"
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingLabelId(group.id);
                                                    setEditLabelValue(group.label || projectConfig.classMapping[group.classIndex] || `对象 ${idx + 1}`);
                                                }}
                                                title="双击重命名"
                                            >
                                                {group.label || projectConfig.classMapping[group.classIndex] || `对象 ${idx + 1}`}
                                            </span>
                                        )}
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(group.id); }} className="icon-btn trash-btn" title="删除">
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
                                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(kp.id); }} className="icon-btn trash-btn" style={{ padding: '2px' }}>
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

            <ClassManagerModal
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                config={projectConfig}
                onSave={saveConfig}
            />

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
                                onClick={() => setShowHelpPanel(false)}
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
                                        ['Ctrl+Z', '撤销'],
                                        ['Ctrl+Y', '重做'],
                                        ['Delete', '删除选中']
                                    ].map(([key, desc]) => (
                                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <kbd style={{
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                fontFamily: 'monospace',
                                                color: 'var(--text-primary)',
                                                minWidth: '60px',
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
        </div >
    );
}
