
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useEditorState } from '../editor/hooks/useEditorState';
import { useEditorHotkeys } from '../editor/hooks/useEditorHotkeys';
import { useCanvasInteraction } from '../editor/hooks/useCanvasInteraction';
import { clamp, eventToDisplayPoint, eventToNaturalPoint, getAdaptiveGridStep } from '../editor/core/canvasMath';
import { clearDatasetStatsCache, getDatasetStats, getImageAnnotations, getProjectConfig, getUploadImageUrl, saveProjectConfig } from '../editor/api/editorApi';
import { EditorHeader } from '../editor/components/EditorHeader';
import { EditorToolbar } from '../editor/components/EditorToolbar';
import { EditorCanvas } from '../editor/components/EditorCanvas';
import { EditorSidebar } from '../editor/components/EditorSidebar';
import { EditorDialogs } from '../editor/components/EditorDialogs';
import { ClassInputModal } from './ClassInputModal';
import { ClassManagerModal } from './ClassManagerModal';
import '../styles/editor.css';

export function AnnotationEditor({ image, projectId, onBack }) {
    const { images, editorNavImages, editorReloadToken, openEditor, goToTraining, exportProject, deleteImage, predictSingleImage, getPredictionSettings, registerEditorAttemptNavigation } = useProject();
    const editorState = useEditorState({ projectId, imageId: image });
    const session = editorState.session;
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
    const mode = editorState.uiState.mode;
    const setMode = editorState.setMode;
    const selectedId = editorState.uiState.selectedId;
    const setSelectedId = editorState.setSelectedId;
    const showGrid = editorState.uiState.showGrid;
    const showConnections = editorState.uiState.showConnections;
    const showHelpPanel = editorState.uiState.showHelpPanel;
    const toggleGrid = editorState.toggleGrid;
    const toggleConnections = editorState.toggleConnections;
    const toggleHelpPanel = editorState.toggleHelpPanel;
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState(null);
    const [currentBox, setCurrentBox] = useState(null);
    const [dragState, setDragState] = useState(null);
    const [previewAnnotations, setPreviewAnnotations] = useState(null);
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
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [annotationStats, setAnnotationStats] = useState({ bboxes: 0, keypoints: 0, labeled: 0 });
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);
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
    const canvasInteraction = useCanvasInteraction({ containerRef });
    const zoomLevel = canvasInteraction.zoomLevel;
    const panOffset = canvasInteraction.panOffset;
    const [showStatusPanel, setShowStatusPanel] = useState(false);
    const formatTime = useCallback((t) => t ? new Date(t).toLocaleString() : '-', []);
    const navLocked = session.phase !== 'ready' && session.phase !== 'dirty';
    const renderedAnnotations = previewAnnotations || annotations;

    useEffect(() => {
        if (!registerEditorAttemptNavigation) return;
        return registerEditorAttemptNavigation(session.attemptNavigation);
    }, [registerEditorAttemptNavigation, session.attemptNavigation]);

    // Derived State: Group Keypoints by BBox
    const { groups, unassignedKeypoints } = useMemo(() => {
        // Only compute if annotations have changed
        if (!renderedAnnotations.length) {
            return { groups: [], unassignedKeypoints: [] };
        }

        const bboxes = renderedAnnotations.filter(a => a.type === 'bbox');
        const keypoints = renderedAnnotations.filter(a => a.type === 'keypoint');
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
    }, [renderedAnnotations]);

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
            setPreviewAnnotations(null);
            setAnnotations(JSON.parse(h[nextIndex]));
        }
    }, [setAnnotations, syncHistoryState]);

    const redo = useCallback(() => {
        const h = historyRef.current || [];
        const i = historyIndexRef.current ?? -1;
        if (i >= 0 && i < h.length - 1) {
            const nextIndex = i + 1;
            syncHistoryState(h, nextIndex);
            setPreviewAnnotations(null);
            setAnnotations(JSON.parse(h[nextIndex]));
        }
    }, [setAnnotations, syncHistoryState]);

    const applyAnnotationEdit = useCallback((updater) => {
        setPreviewAnnotations(null);
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
        canvasInteraction.resetView();
        setSelectedId(null);
        setMode('bbox');
    }, [canvasInteraction.resetView, setMode, setSelectedId]);

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
        resetView();
        setShowDeleteConfirm(false); // Ensure delete dialog is closed when image changes
        syncHistoryState([], -1);
        setPreviewAnnotations(null);
        clearDatasetStatsCache(projectId);

        // Check if image is already loaded (from cache)
        if (imageRef.current && imageRef.current.complete) {
            handleImageLoad();
        }
    }, [image, handleImageLoad, projectId, resetView, syncHistoryState]);

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
        getProjectConfig(projectId)
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
        saveProjectConfig(projectId, newConfig)
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
                const { data } = await getImageAnnotations(projectId, nav.sourceImage);
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
            const data = await getDatasetStats(projectId);
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
            const data = await getDatasetStats(projectId);
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
        return eventToNaturalPoint(
            e.clientX,
            e.clientY,
            rect,
            imageRef.current.naturalWidth,
            imageRef.current.naturalHeight
        );
    };

    // Returns coordinates in DISPLAY pixel space (for CSS positioning like crosshairs)
    const getDisplayPos = (e) => {
        if (!imageRef.current) return { x: 0, y: 0 };
        const rect = imageRef.current.getBoundingClientRect();
        return eventToDisplayPoint(e.clientX, e.clientY, rect);
    };

    // Scale factor: multiply natural coords by this to get display coords
    const displayScale = useMemo(() => {
        if (!isImageLoaded || !imageDims.naturalWidth) return { sx: 1, sy: 1 };
        return {
            sx: imageDims.width / imageDims.naturalWidth,
            sy: imageDims.height / imageDims.naturalHeight
        };
    }, [isImageLoaded, imageDims]);

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

    const gridStep = useMemo(() => getAdaptiveGridStep(zoomLevel), [zoomLevel]);

    const connectionSegments = useMemo(() => {
        if (!showConnections || !isImageLoaded || !isLoaded) return [];
        const source = renderedAnnotations || [];
        if (source.length === 0) return [];

        const bboxes = source.filter(a => a.type === 'bbox');
        const keypoints = source.filter(a => a.type === 'keypoint');
        if (bboxes.length === 0 || keypoints.length === 0) return [];

        const bboxById = new Map(bboxes.map(b => [b.id, b]));
        const findContainingBBox = (kp) => bboxes.find(b =>
            kp.x >= b.x &&
            kp.x <= b.x + b.width &&
            kp.y >= b.y &&
            kp.y <= b.y + b.height
        );

        return keypoints
            .map((kp) => {
                const parent = (kp.parentId && bboxById.get(kp.parentId)) || findContainingBBox(kp);
                if (!parent) return null;
                return {
                    x1: (parent.x + parent.width / 2) * displayScale.sx,
                    y1: (parent.y + parent.height / 2) * displayScale.sy,
                    x2: kp.x * displayScale.sx,
                    y2: kp.y * displayScale.sy
                };
            })
            .filter(Boolean);
    }, [displayScale.sx, displayScale.sy, isImageLoaded, isLoaded, renderedAnnotations, showConnections]);

    const handlePointerDown = (e) => {
        if (e.button !== 0) return;
        if (canvasInteraction.beginPan(e)) {
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
        }
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
                        setPreviewAnnotations(null);
                        setDragState({
                            type: 'resize',
                            handle,
                            startX: pos.x,
                            startY: pos.y,
                            initialAnn: { ...ann },
                            initialAnnotations: annotations || []
                        });
                        return;
                    }
                }
            }

            const clickedAnn = annotations.slice().reverse().find(ann => isPointInAnnotation(pos, ann));

            if (clickedAnn) {
                setSelectedId(clickedAnn.id);
                setPreviewAnnotations(null);
                setDragState({
                    type: 'move',
                    startX: pos.x,
                    startY: pos.y,
                    initialAnn: { ...clickedAnn },
                    initialAnnotations: annotations || []
                });
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
        if (canvasInteraction.movePan(e)) return;
        if (!imageRef.current) return;
        setShowGuides(true);
        const imageWidth = imageRef.current.naturalWidth;
        const imageHeight = imageRef.current.naturalHeight;
        const rawPos = getRelativePos(e);
        const pos = { x: clamp(rawPos.x, 0, imageWidth), y: clamp(rawPos.y, 0, imageHeight) };

        // Crosshair guides need display coordinates for CSS positioning
        const displayPos = getDisplayPos(e);
        const unscaledX = displayPos.x / Math.max(zoomLevel, 0.0001);
        const unscaledY = displayPos.y / Math.max(zoomLevel, 0.0001);

        // Store pending update and use RAF for smooth rendering
        pendingUpdateRef.current = {
            cursorX: clamp(unscaledX, 0, imageRef.current.width),
            cursorY: clamp(unscaledY, 0, imageRef.current.height),
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

            const sourceAnnotations = dragState.initialAnnotations || annotations || [];
            const nextPreview = sourceAnnotations.map(ann => {
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
            });
            setPreviewAnnotations(nextPreview);
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
        if (canvasInteraction.endPan()) {
            e.currentTarget.releasePointerCapture(e.pointerId);
            return;
        }
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (dragState) {
            const preview = previewAnnotations;
            setDragState(null);
            if (Array.isArray(preview)) {
                const hasChanges = JSON.stringify(preview) !== JSON.stringify(annotations || []);
                if (hasChanges) {
                    applyAnnotationEdit(() => preview);
                }
            }
            setPreviewAnnotations(null);
            return;
        }
        if (!isDrawing) return;

        // Minimum box size threshold in natural pixels (scale 5 display pixels to natural)
        const imageRect = imageRef.current?.getBoundingClientRect();
        const natScale = imageRef.current && imageRect ? imageRef.current.naturalWidth / imageRect.width : 1;
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
            const imageRect = imageRef.current?.getBoundingClientRect();
            const hitScale = imageRef.current && imageRect ? imageRef.current.naturalWidth / imageRect.width : 1;
            return Math.sqrt((p.x - ann.x) ** 2 + (p.y - ann.y) ** 2) <= 8 * hitScale;
        }
    };

    const getResizeHandle = (p, box) => {
        // Scale threshold to natural coordinate space so handles feel the same size on screen
        const imageRect = imageRef.current?.getBoundingClientRect();
        const handleScale = imageRef.current && imageRect ? imageRef.current.naturalWidth / imageRect.width : 1;
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

    useEditorHotkeys({
        disabled: false,
        isClassModalOpen,
        navLocked,
        goToNext,
        goToPrev,
        onSetMode: setMode,
        onUndo: undo,
        onRedo: redo,
        selectedId,
        onDelete: handleDelete,
        onToggleGrid: () => toggleGrid(),
        onToggleConnections: () => toggleConnections(),
        onToggleHelpPanel: (next) => toggleHelpPanel(next),
        onClearSelection: () => setSelectedId(null),
        onSpacePressChange: canvasInteraction.setIsSpacePressed
    });

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
            <EditorHeader
                navLocked={navLocked}
                onBackClick={handleBackClick}
                goToPrev={goToPrev}
                goToPrevUnannotated={goToPrevUnannotated}
                copyPrevToCurrent={copyPrevToCurrent}
                image={image}
                currentIndex={currentIndex}
                imagesLength={images.length}
                datasetStats={datasetStats}
                copyCurrentToNext={copyCurrentToNext}
                goToNextUnannotated={goToNextUnannotated}
                goToNext={goToNext}
                saveStatus={saveStatus}
                lastSaveError={lastSaveError}
                onRetrySave={retrySave}
                showStatusPanel={showStatusPanel}
                onToggleStatusPanel={() => setShowStatusPanel(v => !v)}
                onCompleteAnnotation={handleCompleteAnnotation}
            />

            <div className="editor-body">
                {showStatusPanel && (
                    <div
                        className="editor-status-panel"
                    >
                        <div className="editor-status-panel-header">
                            <div className="editor-status-panel-title">状态/错误</div>
                            <button
                                onClick={() => setShowStatusPanel(false)}
                                className="icon-btn editor-status-panel-close"
                                title="关闭"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="editor-status-grid">
                            <div className="editor-status-key">imageId</div>
                            <div style={{ wordBreak: 'break-all' }}>{image}</div>

                            <div className="editor-status-key">isLoaded</div>
                            <div>{String(isLoaded)}</div>

                            <div className="editor-status-key">saveStatus</div>
                            <div>{saveStatus}</div>

                            <div className="editor-status-key">hasUnsavedChanges</div>
                            <div>{String(hasUnsavedChanges)}</div>

                            <div className="editor-status-key">annotationEtag</div>
                            <div style={{ wordBreak: 'break-all' }}>{annotationEtag || '-'}</div>

                            <div className="editor-status-key">conflictEtag</div>
                            <div style={{ wordBreak: 'break-all', color: conflictInfo?.serverEtag ? '#fca5a5' : 'var(--text-secondary)' }}>
                                {conflictInfo?.serverEtag || '-'}
                            </div>

                            <div className="editor-status-key">最近加载时间</div>
                            <div>{formatTime(lastLoadTime)}</div>

                            <div className="editor-status-key">最近保存时间</div>
                            <div>{formatTime(lastSaveTime)}</div>

                            <div className="editor-status-key">最近加载错误</div>
                            <div style={{ color: lastLoadError ? '#fca5a5' : 'var(--text-secondary)', wordBreak: 'break-word' }}>
                                {lastLoadError || '-'}
                            </div>

                            <div className="editor-status-key">最近保存错误</div>
                            <div style={{ color: lastSaveError ? '#fca5a5' : 'var(--text-secondary)', wordBreak: 'break-word' }}>
                                {lastSaveError || '-'}
                            </div>
                        </div>

                        <div className="editor-status-actions">
                            <button
                                onClick={retryLoad}
                                className="editor-status-action-btn"
                            >
                                重试加载
                            </button>
                            <button
                                onClick={retrySave}
                                className="editor-status-action-btn"
                            >
                                重试保存
                            </button>
                        </div>
                    </div>
                )}

                {lastLoadError && (
                    <div
                        className="editor-load-error-banner"
                        style={{ right: showStatusPanel ? 392 : 16 }}
                    >
                        <div className="editor-load-error-content">
                            <AlertTriangle size={18} />
                            <div className="editor-load-error-text">
                                加载失败：{lastLoadError}
                            </div>
                        </div>
                        <button
                            onClick={retryLoad}
                            className="editor-load-error-retry-btn"
                        >
                            重试加载
                        </button>
                    </div>
                )}

                {/* Floating Toolbar */}
                <EditorToolbar
                    mode={mode}
                    onSetMode={setMode}
                    onUndo={undo}
                    onRedo={redo}
                    canUndo={historyIndex > 0}
                    canRedo={historyIndex < history.length - 1}
                    onZoomIn={canvasInteraction.zoomIn}
                    onZoomOut={canvasInteraction.zoomOut}
                    onResetView={resetView}
                    showGrid={showGrid}
                    onToggleGrid={() => toggleGrid()}
                    showConnections={showConnections}
                    onToggleConnections={() => toggleConnections()}
                    onOpenConfig={() => setIsConfigModalOpen(true)}
                    isPredicting={isPredicting}
                    hasPredictionModel={!!predictionModelPath}
                    onPredictSingleImage={handleSinglePrediction}
                    onDeleteCurrentImage={() => setShowDeleteConfirm(true)}
                    showHelpPanel={showHelpPanel}
                    onToggleHelpPanel={() => toggleHelpPanel()}
                />

                {/* Canvas Area */}
                <EditorCanvas
                    containerRef={containerRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={() => { setShowGuides(false); }}
                    onWheel={canvasInteraction.handleWheel}
                    onContextMenu={handleContextMenu}
                    className={`editor-canvas-area ${mode === 'select' ? 'mode-select' : 'mode-draw'} ${canvasInteraction.canvasClassName}`}
                    panOffset={panOffset}
                    zoomLevel={zoomLevel}
                    imageRef={imageRef}
                    imageSrc={getUploadImageUrl(projectId, image, editorReloadToken)}
                    imageKey={image}
                    onImageLoad={handleImageLoad}
                    onImageError={() => {
                        console.error('Image failed to load');
                        setIsImageLoaded(true);
                    }}
                    showGrid={showGrid}
                    isImageLoaded={isImageLoaded}
                    imageDims={imageDims}
                    gridStep={gridStep}
                    showConnections={showConnections}
                    connectionSegments={connectionSegments}
                    showGuides={showGuides}
                    mode={mode}
                    cursorPos={cursorPos}
                    renderedAnnotations={renderedAnnotations}
                    selectedId={selectedId}
                    isLoaded={isLoaded}
                    displayScale={displayScale}
                    projectConfig={projectConfig}
                    currentBox={currentBox}
                />

                {/* Right Sidebar - Object List */}
                <EditorSidebar
                    annotationStats={annotationStats}
                    groups={groups}
                    selectedId={selectedId}
                    projectConfig={projectConfig}
                    expandedGroups={expandedGroups}
                    onSelectGroup={(groupId) => {
                        setSelectedId(groupId);
                        setMode('select');
                    }}
                    onToggleGroup={toggleGroup}
                    onDeleteAnnotation={handleDelete}
                    onUpdateGroupClassIndex={(groupId, classIndex) => {
                        applyAnnotationEdit(prev => prev.map(a => a.id === groupId ? { ...a, classIndex } : a));
                    }}
                    onSelectKeypoint={(keypointId) => {
                        setSelectedId(keypointId);
                        setMode('select');
                    }}
                    unassignedKeypoints={unassignedKeypoints}
                    onClearUnassignedKeypoint={handleDelete}
                    onClearSelection={() => {
                        setSelectedId(null);
                        setMode('bbox');
                    }}
                    hasAnnotations={annotations.length > 0}
                    onRequestClearAnnotations={() => {
                        if (annotations.length > 0) {
                            setShowClearConfirm(true);
                        }
                    }}
                />
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

            <EditorDialogs
                showHelpPanel={showHelpPanel}
                toggleHelpPanel={toggleHelpPanel}
                showCompletionDialog={showCompletionDialog}
                handleContinueAnnotation={handleContinueAnnotation}
                image={image}
                annotationStats={annotationStats}
                annotatedCount={annotatedCount}
                images={images}
                exportStatus={exportStatus}
                handleGoToGallery={handleGoToGallery}
                handleGoToTraining={handleGoToTraining}
                isExporting={isExporting}
                conflictInfo={conflictInfo}
                saveStatus={saveStatus}
                closeConflict={closeConflict}
                reloadAfterConflict={reloadAfterConflict}
                forceOverwriteAfterConflict={forceOverwriteAfterConflict}
                blockedNavigation={blockedNavigation}
                closeBlockedNavigation={session.closeBlockedNavigation}
                lastSaveError={lastSaveError}
                retryBlockedNavigation={retryBlockedNavigation}
                showDeleteConfirm={showDeleteConfirm}
                isDeletingImage={isDeletingImage}
                setShowDeleteConfirm={setShowDeleteConfirm}
                handleDeleteCurrentImage={handleDeleteCurrentImage}
                showClearConfirm={showClearConfirm}
                setShowClearConfirm={setShowClearConfirm}
                annotations={annotations}
                applyAnnotationEdit={applyAnnotationEdit}
                setSelectedId={setSelectedId}
                showPredictionError={showPredictionError}
                setShowPredictionError={setShowPredictionError}
                predictionError={predictionError}
            />
        </div >
    );
}

