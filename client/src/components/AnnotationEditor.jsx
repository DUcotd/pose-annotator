
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Save, ArrowLeft, Trash2, Crosshair, Box, MousePointer2, ChevronDown, ChevronRight, ChevronLeft, Layers, ZoomIn, ZoomOut, Maximize, Tag, HelpCircle, Undo2, Redo2, RotateCcw, Grid3X3, Link, CheckCircle, Play, X, AlertTriangle, RefreshCw, Wand2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useProject } from '../context/ProjectContext';
import { useAnnotationSession } from '../hooks/useAnnotationSession';
import { ClassInputModal } from './ClassInputModal';
import { ClassManagerModal } from './ClassManagerModal';

export function AnnotationEditor({ image, projectId, onBack }) {
    const { images, editorNavImages, editorReloadToken, openEditor, goToTraining, currentProject, exportProject, deleteImage, predictSingleImage, getPredictionSettings, registerEditorAttemptNavigation } = useProject();
    const session = useAnnotationSession({ projectId, imageId: image });
    const annotations = session.annotations;
    const setAnnotations = session.setAnnotations;
    const isLoaded = session.isLoaded;
    const saveStatus = session.saveStatus;
    const hasUnsavedChanges = session.hasUnsavedChanges;
    const lastLoadError = session.lastLoadError;
    const lastSaveError = session.lastSaveError;
    const lastLoadTime = session.lastLoadTime;
    const lastSaveTime = session.lastSaveTime;
    const annotationEtag = session.annotationEtag;
    const conflictInfo = session.conflictInfo;
    const blockedNavigation = session.blockedNavigation;
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
    const [isImageLoaded, setIsImageLoaded] = useState(false);
    const [imageDims, setImageDims] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
    const [showGuides, setShowGuides] = useState(false);
    const [projectConfig, setProjectConfig] = useState({ classMapping: {} });
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

    // Enhanced Features State
    const [zoomLevel, setZoomLevel] = useState(1);
    const [showGrid, setShowGrid] = useState(false);
    const [showConnections, setShowConnections] = useState(true);
    const [showHelpPanel, setShowHelpPanel] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [annotationStats, setAnnotationStats] = useState({ bboxes: 0, keypoints: 0, labeled: 0 });
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);
    const dragStartSnapshotRef = useRef(null);
    const pendingPasteRef = useRef(null);

    // Completion Dialog State
    const [showCompletionDialog, setShowCompletionDialog] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState(null);

    // Delete Image State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeletingImage, setIsDeletingImage] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Single Prediction State
    const [isPredicting, setIsPredicting] = useState(false);
    const [predictionModelPath, setPredictionModelPath] = useState('');
    const [showPredictionError, setShowPredictionError] = useState(false);
    const [predictionError, setPredictionError] = useState('');

    const imageRef = useRef(null);
    const containerRef = useRef(null);
    const [showStatusPanel, setShowStatusPanel] = useState(false);
    const formatTime = useCallback((t) => t ? new Date(t).toLocaleString() : '-', []);
    const navLocked = session.phase !== 'ready' && session.phase !== 'dirty';

    useEffect(() => {
        if (!registerEditorAttemptNavigation) return;
        return registerEditorAttemptNavigation(session.attemptNavigation);
    }, [registerEditorAttemptNavigation, session.attemptNavigation]);

    // Derived State: Group Keypoints by BBox
    const { groups, unassignedKeypoints } = useMemo(() => {
        // Only compute if annotations have changed
        if (!annotations.length) {
            return { groups: [], unassignedKeypoints: [] };
        }

        const bboxes = annotations.filter(a => a.type === 'bbox');
        const keypoints = annotations.filter(a => a.type === 'keypoint');
        const usedKeypoints = new Set();

        const groups = bboxes.map(bbox => {
            const children = [];
            for (const kp of keypoints) {
                if (kp.parentId === bbox.id) {
                    usedKeypoints.add(kp.id);
                    children.push(kp);
                } else if (!kp.parentId) {
                    const inside = kp.x >= bbox.x && kp.x <= bbox.x + bbox.width &&
                        kp.y >= bbox.y && kp.y <= bbox.y + bbox.height;
                    if (inside) {
                        usedKeypoints.add(kp.id);
                        children.push(kp);
                    }
                }
            }
            return { ...bbox, children };
        });

        const unassigned = [];
        for (const kp of keypoints) {
            if (!usedKeypoints.has(kp.id)) {
                unassigned.push(kp);
            }
        }

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
    const syncHistoryState = useCallback((nextHistory, nextIndex) => {
        historyRef.current = nextHistory;
        historyIndexRef.current = nextIndex;
        setHistory(nextHistory);
        setHistoryIndex(nextIndex);
    }, []);

    const resetHistory = useCallback((initialAnnotations = []) => {
        const snap = JSON.stringify(initialAnnotations || []);
        syncHistoryState([snap], 0);
    }, [syncHistoryState]);

    const pushToHistory = useCallback((newAnnotations) => {
        const snap = JSON.stringify(newAnnotations || []);
        const h = historyRef.current || [];
        const i = historyIndexRef.current ?? -1;

        if (h.length === 0 || i < 0) {
            syncHistoryState([snap], 0);
            return;
        }

        if (h[i] === snap) return;

        let nextHistory = h.slice(0, i + 1);
        nextHistory.push(snap);

        if (nextHistory.length > 50) {
            const overflow = nextHistory.length - 50;
            nextHistory = nextHistory.slice(overflow);
        }

        const nextIndex = nextHistory.length - 1;
        syncHistoryState(nextHistory, nextIndex);
    }, [syncHistoryState]);

    const undo = useCallback(() => {
        const h = historyRef.current || [];
        const i = historyIndexRef.current ?? -1;
        if (i > 0) {
            const nextIndex = i - 1;
            syncHistoryState(h, nextIndex);
            setAnnotations(JSON.parse(h[nextIndex]));
        }
    }, [setAnnotations, syncHistoryState]);

    const redo = useCallback(() => {
        const h = historyRef.current || [];
        const i = historyIndexRef.current ?? -1;
        if (i >= 0 && i < h.length - 1) {
            const nextIndex = i + 1;
            syncHistoryState(h, nextIndex);
            setAnnotations(JSON.parse(h[nextIndex]));
        }
    }, [setAnnotations, syncHistoryState]);

    const applyAnnotationEdit = useCallback((updater) => {
        setAnnotations(prev => {
            if ((historyRef.current?.length ?? 0) === 0 || (historyIndexRef.current ?? -1) < 0) {
                syncHistoryState([JSON.stringify(prev || [])], 0);
            }
            const next = (typeof updater === 'function') ? updater(prev) : updater;
            pushToHistory(next);
            return next;
        });
    }, [pushToHistory, setAnnotations, syncHistoryState]);

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

    useEffect(() => {
        setIsImageLoaded(false);
        setImageDims({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
        setMode('bbox');
        setSelectedId(null); // Reset selection on image change
        setShowDeleteConfirm(false); // Ensure delete dialog is closed when image changes
        syncHistoryState([], -1);
        dragStartSnapshotRef.current = null;

        // Check if image is already loaded (from cache)
        if (imageRef.current && imageRef.current.complete) {
            handleImageLoad();
        }
    }, [image, handleImageLoad]);

    useEffect(() => {
        if (!isLoaded) return;
        if (!lastLoadTime) return;
        resetHistory(annotations);
    }, [image, isLoaded, lastLoadTime, resetHistory]);

    useEffect(() => {
        const pending = pendingPasteRef.current;
        if (!pending) return;
        if (pending.targetImage !== image) return;
        if (!isLoaded || !lastLoadTime) return;
        pendingPasteRef.current = null;
        try {
            const parsed = JSON.parse(pending.snapshot);
            applyAnnotationEdit(Array.isArray(parsed) ? parsed : []);
        } catch {
            applyAnnotationEdit([]);
        }
    }, [applyAnnotationEdit, image, isLoaded, lastLoadTime]);

    const retryLoad = session.retryLoad;

    // Load project config
    useEffect(() => {
        fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/config`)
            .then(res => res.json())
            .then(data => setProjectConfig(data || { classMapping: {} }))
            .catch(err => console.error('Error loading config:', err));
    }, [projectId]);

    // Load prediction model path
    useEffect(() => {
        const loadModelPath = async () => {
            const settings = await getPredictionSettings(projectId);
            if (settings.modelPath) {
                setPredictionModelPath(settings.modelPath);
            }
        };
        loadModelPath();
    }, [projectId, getPredictionSettings]);

    // Handle single image prediction
    const handleSinglePrediction = async () => {
        if (!predictionModelPath) {
            setPredictionError('请先在图库页面配置预标注模型');
            setShowPredictionError(true);
            return;
        }

        setIsPredicting(true);
        try {
            const result = await predictSingleImage(projectId, image, predictionModelPath, 0.25);
            if (result.success && result.predictions) {
                applyAnnotationEdit(result.predictions);
            } else {
                setPredictionError(result.error || '预标注失败');
                setShowPredictionError(true);
            }
        } catch (err) {
            setPredictionError('预标注失败：' + err.message);
            setShowPredictionError(true);
        }
        setIsPredicting(false);
    };

    const saveConfig = (newConfig) => {
        console.log('[AnnotationEditor] saveConfig called with:', newConfig);
        setProjectConfig(newConfig);
        fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newConfig)
        })
            .then(res => res.json())
            .then(data => console.log('[AnnotationEditor] Config saved:', data))
            .catch(err => console.error('[AnnotationEditor] Error saving config:', err));
    };

    const retrySave = useCallback(() => session.save(), [session]);

    const runNavigation = useCallback(async (nav) => {
        if (!nav) return;
        if (nav.type === 'back') {
            onBack();
            return;
        }
        if (nav.type === 'copyPrevToCurrent') {
            try {
                const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/annotations/${encodeURIComponent(nav.sourceImage)}`);
                if (!res.ok) {
                    const t = await res.text().catch(() => '');
                    throw new Error(t ? `HTTP ${res.status}: ${t}` : `HTTP ${res.status}`);
                }
                const data = await res.json();
                applyAnnotationEdit(Array.isArray(data) ? data : []);
                setSelectedId(null);
            } catch (err) {
                setPredictionError(err?.message ? `复制标注失败：${String(err.message)}` : `复制标注失败：${String(err)}`);
                setShowPredictionError(true);
            }
            return;
        }
        if (nav.type === 'copyCurrentToNext') {
            pendingPasteRef.current = { targetImage: nav.targetImage, snapshot: nav.snapshot };
            openEditor(nav.targetImage);
            return;
        }
        if (nav.type === 'openEditor') {
            openEditor(nav.image);
            return;
        }
        if (nav.type === 'openCompletionDialog') {
            setShowCompletionDialog(true);
            return;
        }
        if (nav.type === 'goToGallery') {
            setShowCompletionDialog(false);
            onBack();
            return;
        }
        if (nav.type === 'goToTraining') {
            if (nav.exportFirst) {
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
                return;
            }
            setShowCompletionDialog(false);
            goToTraining(projectId);
        }
    }, [applyAnnotationEdit, exportProject, goToTraining, onBack, openEditor, projectId]);

    const attemptNavigation = useCallback(async (nav) => session.attemptNavigation(nav, runNavigation), [runNavigation, session]);

    const retryBlockedNavigation = useCallback(async () => session.retryBlockedNavigation(runNavigation), [runNavigation, session]);

    const closeConflict = session.closeConflict;
    const reloadAfterConflict = session.reloadAfterConflict;
    const forceOverwriteAfterConflict = session.forceOverwriteAfterConflict;

    // Page close/refresh protection
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '您有未保存的标注修改，确定要离开吗？';
                return e.returnValue;
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    // Completion Handlers
    const handleCompleteAnnotation = async () => {
        await attemptNavigation({ type: 'openCompletionDialog' });
    };

    const handleContinueAnnotation = () => {
        setShowCompletionDialog(false);
    };

    const handleGoToGallery = async () => {
        await attemptNavigation({ type: 'goToGallery' });
    };

    const handleGoToTraining = async (exportFirst = false) => {
        await attemptNavigation({ type: 'goToTraining', exportFirst });
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
    const [datasetStats, setDatasetStats] = useState(null);

    useEffect(() => {
        if (showCompletionDialog) {
            getAnnotatedImagesCount().then(setAnnotatedCount);
        }
    }, [showCompletionDialog, getAnnotatedImagesCount]);

    const refreshDatasetStats = useCallback(async () => {
        try {
            const res = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/dataset/stats`);
            const data = await res.json();
            setDatasetStats(data || null);
        } catch {
            setDatasetStats(null);
        }
    }, [projectId]);

    useEffect(() => {
        refreshDatasetStats();
    }, [lastLoadTime, lastSaveTime, refreshDatasetStats]);


    // Navigation Logic
    const navImages = useMemo(() => {
        if (!Array.isArray(editorNavImages) || editorNavImages.length === 0) return images;
        const idx = editorNavImages.findIndex(img => (typeof img === 'string' ? img === image : img.name === image));
        return idx >= 0 ? editorNavImages : images;
    }, [editorNavImages, images, image]);

    const currentIndex = useMemo(() => navImages.findIndex(img => (typeof img === 'string' ? img === image : img.name === image)), [navImages, image]);

    const goToNext = useCallback(async () => {
        if (currentIndex < navImages.length - 1) {
            const nextImg = navImages[currentIndex + 1];
            await attemptNavigation({ type: 'openEditor', image: typeof nextImg === 'string' ? nextImg : nextImg.name });
        }
    }, [currentIndex, navImages, attemptNavigation]);

    const goToPrev = useCallback(async () => {
        if (currentIndex > 0) {
            const prevImg = navImages[currentIndex - 1];
            await attemptNavigation({ type: 'openEditor', image: typeof prevImg === 'string' ? prevImg : prevImg.name });
        }
    }, [currentIndex, navImages, attemptNavigation]);

    const copyPrevToCurrent = useCallback(async () => {
        if (currentIndex <= 0) return;
        const prevImg = navImages[currentIndex - 1];
        const prevName = typeof prevImg === 'string' ? prevImg : prevImg.name;
        await attemptNavigation({ type: 'copyPrevToCurrent', sourceImage: prevName });
    }, [attemptNavigation, currentIndex, navImages]);

    const copyCurrentToNext = useCallback(async () => {
        if (currentIndex >= navImages.length - 1) return;
        const nextImg = navImages[currentIndex + 1];
        const nextName = typeof nextImg === 'string' ? nextImg : nextImg.name;
        const snapshot = JSON.stringify(annotations || []);
        await attemptNavigation({ type: 'copyCurrentToNext', targetImage: nextName, snapshot });
    }, [annotations, attemptNavigation, currentIndex, navImages]);

    const goToNextUnannotated = useCallback(async () => {
        for (let i = currentIndex + 1; i < navImages.length; i++) {
            const img = navImages[i];
            const isUnannotated = typeof img === 'string' ? true : !img.hasAnnotation;
            if (isUnannotated) {
                await attemptNavigation({ type: 'openEditor', image: typeof img === 'string' ? img : img.name });
                return;
            }
        }
        setPredictionError('已全部标注');
        setShowPredictionError(true);
    }, [attemptNavigation, currentIndex, navImages]);

    const goToPrevUnannotated = useCallback(async () => {
        for (let i = currentIndex - 1; i >= 0; i--) {
            const img = navImages[i];
            const isUnannotated = typeof img === 'string' ? true : !img.hasAnnotation;
            if (isUnannotated) {
                await attemptNavigation({ type: 'openEditor', image: typeof img === 'string' ? img : img.name });
                return;
            }
        }
        setPredictionError('已全部标注');
        setShowPredictionError(true);
    }, [attemptNavigation, currentIndex, navImages]);

    // Keyboard Shortcuts for Navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isClassModalOpen) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'd' || e.key === 'ArrowRight') {
                if (navLocked) return;
                goToNext();
            } else if (e.key === 'a' || e.key === 'ArrowLeft') {
                if (navLocked) return;
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
    const displayScale = useMemo(() => {
        if (!isImageLoaded || !imageDims.naturalWidth) return { sx: 1, sy: 1 };
        return {
            sx: imageDims.width / imageDims.naturalWidth,
            sy: imageDims.height / imageDims.naturalHeight
        };
    }, [isImageLoaded, imageDims]);

    const getDisplayScale = useCallback(() => displayScale, [displayScale]);


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
                        dragStartSnapshotRef.current = JSON.stringify(annotations || []);
                        setDragState({ type: 'resize', handle, startX: pos.x, startY: pos.y, initialAnn: { ...ann } });
                        return;
                    }
                }
            }

            const clickedAnn = annotations.slice().reverse().find(ann => isPointInAnnotation(pos, ann));

            if (clickedAnn) {
                setSelectedId(clickedAnn.id);
                dragStartSnapshotRef.current = JSON.stringify(annotations || []);
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
            applyAnnotationEdit(prev => [...prev, newAnnotation]);
            return;
        }

        if (mode === 'bbox') {
            setIsDrawing(true);
            setStartPos(pos);
            setSelectedId(null);
        }
    };

    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

    // Use ref for RAF-based updates - smoother than throttle
    const rafRef = useRef(null);
    const pendingUpdateRef = useRef(null);

    // Cleanup RAF on unmount
    useEffect(() => {
        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, []);

    const handlePointerMove = (e) => {
        if (!imageRef.current) return;
        setShowGuides(true);
        const imageWidth = imageRef.current.naturalWidth;
        const imageHeight = imageRef.current.naturalHeight;
        const rawPos = getRelativePos(e);
        const pos = { x: clamp(rawPos.x, 0, imageWidth), y: clamp(rawPos.y, 0, imageHeight) };

        // Crosshair guides need display coordinates for CSS positioning
        const displayPos = getDisplayPos(e);

        // Store pending update and use RAF for smooth rendering
        pendingUpdateRef.current = {
            cursorX: clamp(displayPos.x, 0, imageRef.current.width),
            cursorY: clamp(displayPos.y, 0, imageRef.current.height),
            pos,
            imageWidth,
            imageHeight
        };

        if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                if (pendingUpdateRef.current) {
                    const { cursorX, cursorY } = pendingUpdateRef.current;
                    setCursorPos({ x: cursorX, y: cursorY });
                }
            });
        }

        if (dragState && selectedId) {
            const dx = pos.x - dragState.startX;
            const dy = pos.y - dragState.startY;

            // Only update if there's actual movement to reduce re-renders
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

            setAnnotations(prev => prev.map(ann => {
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
        if (dragState) {
            setDragState(null);
            const startSnap = dragStartSnapshotRef.current;
            dragStartSnapshotRef.current = null;
            if (startSnap != null) {
                const endSnap = JSON.stringify(annotations || []);
                if (endSnap !== startSnap) {
                    pushToHistory(annotations || []);
                }
            }
            return;
        }
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
            applyAnnotationEdit(prev => [...prev, finalizedBBox]);

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
            applyAnnotationEdit(prev => prev.filter(a => a.id !== id && !childIds.has(a.id)));
        } else {
            applyAnnotationEdit(prev => prev.filter(a => a.id !== id));
        }
        if (selectedId === id) setSelectedId(null);
    };

    const toggleGroup = (id) => {
        setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleDeleteCurrentImage = async () => {
        setIsDeletingImage(true);
        console.log('Deleting image:', image, 'at index:', currentIndex);

        // First save current annotations before deleting
        try {
            await session.save();
        } catch (err) {
            console.warn('Failed to save annotations before delete:', err);
        }

        try {
            const result = await deleteImage(projectId, image, { navigateToNext: true, currentIndex, renumberAfterDelete: true });
            console.log('Delete result:', result);

            if (result.success) {
                setShowDeleteConfirm(false);
                if (result.renumber && result.renumber.error) {
                    setPredictionError(result.renumber.error);
                    setShowPredictionError(true);
                }
            } else {
                console.error('Delete failed:', result.message);
            }
        } catch (err) {
            console.error('Delete error:', err);
        } finally {
            setIsDeletingImage(false);
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

    const handleBackClick = async () => {
        await attemptNavigation({ type: 'back' });
    };

    return (
        <div className="editor-container">
            {/* Top Toolbar */}
            <header className="editor-header">
                <div className="editor-header-left">
                    <button onClick={handleBackClick} disabled={navLocked} className="editor-back-btn">
                        <ArrowLeft size={15} strokeWidth={2.5} /> 返回
                    </button>
                    <div className="divider"></div>

                    {/* Navigation Controls */}
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
                                {currentIndex + 1} / {images.length}
                                {datasetStats && Number.isFinite(datasetStats.unannotated) ? ` · 未标注 ${datasetStats.unannotated}` : ''}
                            </div>
                            <div className="editor-nav-progress">
                                <div className="editor-nav-progress-fill" style={{ width: `${images.length > 0 ? ((currentIndex + 1) / images.length) * 100 : 0}%` }} />
                            </div>
                        </div>

                        <button
                            onClick={copyCurrentToNext}
                            disabled={navLocked || currentIndex >= images.length - 1}
                            className="icon-btn"
                            title="复制当前标注到下一张"
                        >
                            <RotateCcw size={18} style={{ transform: 'scaleX(-1)' }} />
                        </button>
                        <button
                            onClick={goToNextUnannotated}
                            disabled={navLocked || currentIndex >= images.length - 1}
                            className="icon-btn"
                            title="下一张未标注"
                        >
                            <Play size={18} />
                        </button>
                        <button
                            onClick={goToNext}
                            disabled={navLocked || currentIndex >= images.length - 1}
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
                                    onClick={retrySave}
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
                        onClick={() => setShowStatusPanel(v => !v)}
                        className="icon-btn"
                        title="状态/错误面板"
                        style={{
                            marginRight: '10px',
                            border: showStatusPanel ? '1px solid rgba(99,102,241,0.6)' : undefined
                        }}
                    >
                        <Layers size={18} />
                    </button>
                    <button
                        onClick={handleCompleteAnnotation}
                        disabled={navLocked}
                        className={`complete-btn-pulse`}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 18px',
                            background: 'linear-gradient(135deg, #22c55e, #4ade80)',
                            border: 'none',
                            borderRadius: '10px',
                            color: 'white',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            cursor: navLocked ? 'not-allowed' : 'pointer',
                            opacity: navLocked ? 0.6 : 1,
                            transition: 'all 0.2s ease',
                            letterSpacing: '0.2px'
                        }}
                    >
                        <CheckCircle size={16} strokeWidth={2.5} />
                        完成标注
                    </button>
                </div>
            </header>

            <div className="editor-body">
                {showStatusPanel && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 70,
                            right: 16,
                            width: 360,
                            maxWidth: 'calc(100vw - 32px)',
                            zIndex: 50,
                            background: 'rgba(15, 23, 42, 0.92)',
                            border: '1px solid rgba(148, 163, 184, 0.25)',
                            borderRadius: 12,
                            padding: 12,
                            backdropFilter: 'blur(10px)',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.95 }}>状态/错误</div>
                            <button
                                onClick={() => setShowStatusPanel(false)}
                                className="icon-btn"
                                title="关闭"
                                style={{ width: 30, height: 30 }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 6, columnGap: 10, fontSize: 12 }}>
                            <div style={{ color: 'var(--text-secondary)' }}>imageId</div>
                            <div style={{ wordBreak: 'break-all' }}>{image}</div>

                            <div style={{ color: 'var(--text-secondary)' }}>isLoaded</div>
                            <div>{String(isLoaded)}</div>

                            <div style={{ color: 'var(--text-secondary)' }}>saveStatus</div>
                            <div>{saveStatus}</div>

                            <div style={{ color: 'var(--text-secondary)' }}>hasUnsavedChanges</div>
                            <div>{String(hasUnsavedChanges)}</div>

                            <div style={{ color: 'var(--text-secondary)' }}>annotationEtag</div>
                            <div style={{ wordBreak: 'break-all' }}>{annotationEtag || '-'}</div>

                            <div style={{ color: 'var(--text-secondary)' }}>conflictEtag</div>
                            <div style={{ wordBreak: 'break-all', color: conflictInfo?.serverEtag ? '#fca5a5' : 'var(--text-secondary)' }}>
                                {conflictInfo?.serverEtag || '-'}
                            </div>

                            <div style={{ color: 'var(--text-secondary)' }}>最近加载时间</div>
                            <div>{formatTime(lastLoadTime)}</div>

                            <div style={{ color: 'var(--text-secondary)' }}>最近保存时间</div>
                            <div>{formatTime(lastSaveTime)}</div>

                            <div style={{ color: 'var(--text-secondary)' }}>最近加载错误</div>
                            <div style={{ color: lastLoadError ? '#fca5a5' : 'var(--text-secondary)', wordBreak: 'break-word' }}>
                                {lastLoadError || '-'}
                            </div>

                            <div style={{ color: 'var(--text-secondary)' }}>最近保存错误</div>
                            <div style={{ color: lastSaveError ? '#fca5a5' : 'var(--text-secondary)', wordBreak: 'break-word' }}>
                                {lastSaveError || '-'}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button
                                onClick={retryLoad}
                                style={{
                                    flex: 1,
                                    padding: '8px 10px',
                                    borderRadius: 10,
                                    border: '1px solid rgba(148, 163, 184, 0.25)',
                                    background: 'rgba(255,255,255,0.06)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 600
                                }}
                            >
                                重试加载
                            </button>
                            <button
                                onClick={retrySave}
                                style={{
                                    flex: 1,
                                    padding: '8px 10px',
                                    borderRadius: 10,
                                    border: '1px solid rgba(148, 163, 184, 0.25)',
                                    background: 'rgba(255,255,255,0.06)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 600
                                }}
                            >
                                重试保存
                            </button>
                        </div>
                    </div>
                )}

                {lastLoadError && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 70,
                            left: 16,
                            right: showStatusPanel ? 392 : 16,
                            zIndex: 40,
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            borderRadius: 12,
                            padding: '10px 12px',
                            color: '#fecaca',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <AlertTriangle size={18} />
                            <div style={{ fontSize: 12, fontWeight: 600, wordBreak: 'break-word' }}>
                                加载失败：{lastLoadError}
                            </div>
                        </div>
                        <button
                            onClick={retryLoad}
                            style={{
                                padding: '6px 10px',
                                borderRadius: 10,
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                background: 'rgba(239, 68, 68, 0.18)',
                                color: '#fecaca',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 700,
                                whiteSpace: 'nowrap'
                            }}
                        >
                            重试加载
                        </button>
                    </div>
                )}

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
                        title="撤销 (Ctrl/Cmd+Z)"
                        className="tool-btn"
                        style={{ opacity: historyIndex <= 0 ? 0.4 : 1 }}
                    >
                        <Undo2 size={20} />
                    </button>
                    <button
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        title="重做 (Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y)"
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
                    <div className="toolbar-divider"></div>
                    <button
                        onClick={handleSinglePrediction}
                        disabled={isPredicting || !predictionModelPath}
                        title={predictionModelPath ? "模型预标注当前图片" : "请先在图库配置预标注模型"}
                        className={`tool-btn tool-btn-ai`}
                        style={{ opacity: predictionModelPath ? 1 : 0.35 }}
                    >
                        {isPredicting ? <RefreshCw size={20} className="spin" /> : <Wand2 size={20} />}
                    </button>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        title="删除当前图片"
                        className="tool-btn tool-btn-danger"
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
                            src={`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/uploads/${encodeURIComponent(image)}?v=${encodeURIComponent(editorReloadToken || 0)}`}
                            alt="Target"
                            key={image}
                            onLoad={handleImageLoad}
                            onError={() => {
                                console.error('Image failed to load');
                                setIsImageLoaded(true);
                            }}
                        />

                        {/* Crosshair Guides */}
                        {showGuides && (mode === 'bbox' || mode === 'keypoint') && (
                            <>
                                {/* Vertical Guide */}
                                <div style={{
                                    position: 'absolute', top: 0, bottom: 0,
                                    left: cursorPos.x, width: '1px',
                                    pointerEvents: 'none', zIndex: 50,
                                    borderLeft: '1px dashed rgba(255, 255, 255, 1)',
                                    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.7), 0 0 4px rgba(0,0,0,0.5)'
                                }} />
                                {/* Horizontal Guide */}
                                <div style={{
                                    position: 'absolute', left: 0, right: 0,
                                    top: cursorPos.y, height: '1px',
                                    pointerEvents: 'none', zIndex: 50,
                                    borderTop: '1px dashed rgba(255, 255, 255, 1)',
                                    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.7), 0 0 4px rgba(0,0,0,0.5)'
                                }} />
                            </>
                        )}

                        {/* Annotations */}
                        <div style={{ pointerEvents: 'none', visibility: (isImageLoaded && isLoaded) ? 'visible' : 'hidden' }}>
                            {isImageLoaded && isLoaded && annotations.map(ann => {
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
                                                {projectConfig.classMapping[ann.classIndex] || `Class ${ann.classIndex ?? 0}`}
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
                                    // Pre-calculate if this keypoint is a child of the selected bbox
                                    const isChildOfSelected = ann.parentId === selectedId;
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
                                        {Math.round(currentBox.width)} × {Math.round(currentBox.height)} px
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Right Sidebar - Object List */}
                <aside className="editor-sidebar">
                    <div className="editor-sidebar-header">
                        <Layers size={18} color="var(--accent-primary)" />
                        <h4>图层列表</h4>
                    </div>

                    {/* Stats mini-bar */}
                    <div className="editor-sidebar-stats">
                        <div className="editor-sidebar-stat">
                            <div className="editor-sidebar-stat-value" style={{ color: 'var(--accent-primary)' }}>{annotationStats.bboxes}</div>
                            <div className="editor-sidebar-stat-label">标注框</div>
                        </div>
                        <div className="editor-sidebar-stat">
                            <div className="editor-sidebar-stat-value" style={{ color: '#ffbd2e' }}>{annotationStats.keypoints}</div>
                            <div className="editor-sidebar-stat-label">关键点</div>
                        </div>
                        <div className="editor-sidebar-stat">
                            <div className="editor-sidebar-stat-value" style={{ color: '#34d399' }}>{annotationStats.labeled}</div>
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
                            const classColors = ['#58a6ff', '#fbbf24', '#a855f7', '#34d399', '#f97316', '#f43f5e', '#06b6d4', '#84cc16'];
                            const chipColor = classColors[(group.classIndex ?? 0) % classColors.length];

                            return (
                                <div key={group.id} className={`layer-group ${selectedId === group.id ? 'selected' : ''}`}>
                                    <div
                                        onClick={() => {
                                            setSelectedId(group.id);
                                            setMode('select');
                                            toggleGroup(group.id);
                                        }}
                                        className={`layer-group-header ${selectedId === group.id ? 'selected' : ''}`}
                                    >
                                        <div className="layer-group-header-left">
                                            <div className="layer-group-toggle">
                                                {expandedGroups[group.id] ? <ChevronDown size={14} strokeWidth={3} /> : <ChevronRight size={14} strokeWidth={3} />}
                                            </div>
                                            <div
                                                className="layer-class-chip"
                                                style={{
                                                    background: `linear-gradient(135deg, ${chipColor}, ${chipColor}dd)`,
                                                    boxShadow: `0 0 12px ${chipColor}40`,
                                                    width: '10px',
                                                    height: '10px',
                                                    borderRadius: '3px'
                                                }}
                                            />
                                            <span className="layer-group-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {classDisplayName}
                                                <span style={{
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    color: 'var(--text-tertiary)',
                                                    fontWeight: 500,
                                                    fontSize: '10px'
                                                }}>#{idx + 1}</span>
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(group.id); }}
                                            className="icon-btn trash-btn"
                                            style={{ opacity: 0.6, transition: 'all 0.2s' }}
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
                                                            type="number" min="0"
                                                            value={group.classIndex ?? 0}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 0;
                                                                applyAnnotationEdit(prev => prev.map(a => a.id === group.id ? { ...a, classIndex: val } : a));
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
                                                            onClick={() => { setSelectedId(kp.id); setMode('select'); }}
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
                                                                onClick={(e) => { e.stopPropagation(); handleDelete(kp.id); }}
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
                                        <button onClick={() => handleDelete(kp.id)} className="btn-text-danger">删除</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar footer quick actions */}
                    <div className="editor-sidebar-footer">
                        <button
                            className="editor-sidebar-footer-btn"
                            onClick={() => { setSelectedId(null); setMode('bbox'); }}
                            title="取消选择"
                        >
                            <MousePointer2 size={12} />
                            取消选择
                        </button>
                        <button
                            className="editor-sidebar-footer-btn danger"
                            onClick={() => {
                                if (annotations.length > 0) {
                                    setShowClearConfirm(true);
                                }
                            }}
                            title="清空所有标注"
                        >
                            <Trash2 size={12} />
                            清空标注
                        </button>
                    </div>
                </aside>
            </div>

            <ClassInputModal
                isOpen={isClassModalOpen}
                onClose={() => { setIsClassModalOpen(false); setPendingBBox(null); }}
                onSubmit={confirmClassIndex}
                initialValue={pendingBBox?.classIndex ?? 0}
                classMapping={projectConfig.classMapping}
                projectId={projectId}
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
                    onClick={() => saveStatus !== 'saving' && session.closeBlockedNavigation()}
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
                                onClick={() => session.closeBlockedNavigation()}
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
        </div >
    );
}
