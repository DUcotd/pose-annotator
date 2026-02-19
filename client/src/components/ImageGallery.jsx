import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, CheckCircle, RefreshCw, FolderOpen, Clock, Trash2, X, AlertTriangle, Settings, Wand2, Play, Pause, Check, AlertCircle, Filter } from 'lucide-react';
import { ImageUpload } from './ImageUpload';
import { ImageDiscovery } from './ImageDiscovery';
import { ImportHistory } from './ImportHistory';
import { useProject } from '../context/ProjectContext';
import { createPortal } from 'react-dom';
import { filterImagesAdvanced } from '../utils/galleryFilters';

const PAGE_SIZE = 60;

const ThumbnailCard = ({ imageObj, projectId, index, onSelectImage, isSelected, onDelete }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [errorCount, setErrorCount] = useState(0);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const img = typeof imageObj === 'string' ? imageObj : imageObj.name;
    const hasAnnotation = typeof imageObj === 'string' ? false : imageObj.hasAnnotation;
    const imageSize = typeof imageObj === 'string' ? null : imageObj.size;

    const thumbnailUrl = `http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/thumbnails/${encodeURIComponent(img)}`;
    const fallbackUrl = `http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/uploads/${encodeURIComponent(img)}`;

    const currentSrc = errorCount > 0 ? fallbackUrl : thumbnailUrl;

    const formatSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleDelete = async (e) => {
        e.stopPropagation();
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        await onDelete(img);
        setIsDeleting(false);
        setShowDeleteConfirm(false);
    };

    return (
        <>
            <div
                className="image-card"
                style={{
                    transitionDelay: `${(index % 8) * 0.05}s`,
                    position: 'relative',
                    ...(isSelected ? {
                        borderColor: 'rgba(77, 161, 255, 0.6)',
                        boxShadow: '0 0 0 2px rgba(77, 161, 255, 0.3), 0 12px 25px rgba(0, 0, 0, 0.4)'
                    } : {})
                }}
                onClick={() => onSelectImage(img)}
            >
                <div className="image-card-container">
                    {!isLoaded && <div className="skeleton" style={{ position: 'absolute', inset: 0, zIndex: 1 }} />}

                    <img
                        src={currentSrc}
                        alt={img}
                        loading="lazy"
                        decoding="async"
                        className={`fade-in-image ${isLoaded ? 'loaded' : ''}`}
                        style={{ zIndex: 2 }}
                        onLoad={() => setIsLoaded(true)}
                        onError={() => {
                            if (errorCount === 0) {
                                setErrorCount(1);
                            }
                        }}
                    />

                    {hasAnnotation && (
                        <div style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            zIndex: 10,
                            background: 'rgba(16, 185, 129, 0.9)',
                            color: 'white',
                            padding: '4px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            backdropFilter: 'blur(4px)',
                            border: '1px solid rgba(255,255,255,0.2)'
                        }} title="已标注">
                            <CheckCircle size={14} fill="currentColor" />
                        </div>
                    )}

                    {imageSize && (
                        <div style={{
                            position: 'absolute',
                            bottom: '32px',
                            left: '8px',
                            zIndex: 10,
                            background: 'rgba(0, 0, 0, 0.7)',
                            color: 'rgba(255, 255, 255, 0.8)',
                            padding: '2px 6px',
                            borderRadius: '6px',
                            fontSize: '10px',
                            fontWeight: 600,
                            backdropFilter: 'blur(4px)',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            {formatSize(imageSize)}
                        </div>
                    )}

                    <button
                        onClick={handleDelete}
                        title="删除图片"
                        style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            zIndex: 10,
                            background: 'rgba(239, 68, 68, 0.9)',
                            color: 'white',
                            padding: '6px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            transition: 'opacity 0.2s, transform 0.2s',
                            transform: 'scale(0.9)'
                        }}
                        className="delete-btn"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
                <div className="image-card-label" style={{ opacity: 1, transform: 'translateY(0)' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{img}</span>
                </div>
            </div>

            <style>{`
                .image-card:hover .delete-btn {
                    opacity: 1 !important;
                    transform: scale(1) !important;
                }
                .delete-btn:hover {
                    background: rgba(220, 38, 38, 1) !important;
                }
            `}</style>

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
                    onClick={() => !isDeleting && setShowDeleteConfirm(false)}
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
                                    确认删除
                                </h3>
                                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                    此操作不可撤销
                                </p>
                            </div>
                        </div>

                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '14px', lineHeight: 1.6 }}>
                            确定要删除图片 <strong style={{ color: 'var(--text-primary)' }}>{img}</strong> 吗？
                            {hasAnnotation && (
                                <span style={{ color: '#fbbf24', display: 'block', marginTop: '8px' }}>
                                    ⚠️ 该图片已有标注数据，删除后将一并移除。
                                </span>
                            )}
                        </p>

                        <p style={{ color: '#60a5fa', fontSize: '13px', marginBottom: '1.5rem' }}>
                            删除后，剩余图片将自动重新编号以保持连续。
                        </p>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                                    opacity: isDeleting ? 0.5 : 1
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                {isDeleting ? (
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
        </>
    );
};

export const ImageGallery = ({ images = [], projectId, onSelectImage, onUpload, selectedImage }) => {
    const [page, setPage] = useState(0);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const filterButtonRef = useRef(null);
    const [filterPanelPos, setFilterPanelPos] = useState(null);
    const [showDiscovery, setShowDiscovery] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const { deleteImage, galleryFilters, setGalleryFilters } = useProject();
    const search = galleryFilters?.search ?? '';
    const annotatedFilter = galleryFilters?.annotated ?? 'all';
    const keypointsMin = galleryFilters?.keypointsMin ?? '';
    const keypointsMax = galleryFilters?.keypointsMax ?? '';
    const bboxesMin = galleryFilters?.bboxesMin ?? '';
    const bboxesMax = galleryFilters?.bboxesMax ?? '';

    const updateGalleryFilters = (patch) => {
        setGalleryFilters(prev => ({ ...(prev || {}), ...patch }));
    };

    const [showModelSettings, setShowModelSettings] = useState(false);
    const [showPreannotateDialog, setShowPreannotateDialog] = useState(false);
    const [modelPath, setModelPath] = useState('');
    const [preannotateRange, setPreannotateRange] = useState('unannotated');
    const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
    const [preannotating, setPreannotating] = useState(false);
    const [preannotateProgress, setPreannotateProgress] = useState({ current: 0, total: 0, currentImage: '' });
    const [preannotateResult, setPreannotateResult] = useState(null);
    const [showPreannotateProgress, setShowPreannotateProgress] = useState(false);
    const [showPreannotateResult, setShowPreannotateResult] = useState(false);
    const cancelPreannotateRef = useRef(false);
    const pollIntervalRef = useRef(null);
    const checkCancelIntervalRef = useRef(null);
    const timeoutRef = useRef(null);
    const [showModelToast, setShowModelToast] = useState(false);

    useEffect(() => {
        fetchModelConfig();
    }, [projectId]);

    const fetchModelConfig = async () => {
        try {
            const resp = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/prediction-settings`);
            if (resp.ok) {
                const data = await resp.json();
                setModelPath(data.modelPath || '');
            }
        } catch (e) {
            console.error('Failed to fetch model config:', e);
        }
    };

    const handleSelectModel = async () => {
        try {
            const resp = await fetch('http://localhost:5000/api/utils/select-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filters: [{ name: 'PyTorch Model', extensions: ['pt'] }]
                })
            });
            const data = await resp.json();
            if (data.path) {
                const saveResp = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/prediction-settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ modelPath: data.path })
                });
                if (saveResp.ok) {
                    setModelPath(data.path);
                    setShowModelToast(true);
                    setTimeout(() => setShowModelToast(false), 3000);
                    setShowModelSettings(false); // 自动关闭对话框
                }
            }
        } catch (e) {
            console.error('Failed to select model:', e);
        }
    };

    const handleStartPreannotate = async () => {
        if (!modelPath) return;

        let targetImages = [];
        if (preannotateRange === 'all') {
            targetImages = images.map(img => typeof img === 'string' ? img : img.name);
        } else if (preannotateRange === 'unannotated') {
            targetImages = images.filter(img => typeof img === 'string' ? true : !img.hasAnnotation)
                .map(img => typeof img === 'string' ? img : img.name);
        } else if (preannotateRange === 'selected') {
            if (selectedImage) {
                targetImages = [selectedImage];
            }
        }

        if (targetImages.length === 0) {
            return;
        }

        setPreannotating(true);
        setPreannotateProgress({ current: 0, total: targetImages.length, currentImage: '正在启动预标注任务...' });
        setShowPreannotateDialog(false);
        setShowPreannotateProgress(true);
        cancelPreannotateRef.current = false;

        // 启动预标注任务
        try {
            const resp = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelPath: modelPath,
                    images: targetImages,
                    confidenceThreshold: confidenceThreshold,
                    mode: preannotateRange
                })
            });

            if (!resp.ok) {
                throw new Error('预标注任务启动失败');
            }

            if (targetImages.length > 0) {
                setPreannotateProgress({
                    current: 1,
                    total: targetImages.length,
                    currentImage: `正在处理: ${targetImages[0]}`
                });
            }

            // 清理之前的轮询（如果有）
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (checkCancelIntervalRef.current) clearInterval(checkCancelIntervalRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            // 立即执行一次状态查询，然后开始轮询
            const checkStatus = async () => {
                try {
                    const statusResp = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/predict/status`);
                    if (statusResp.ok) {
                        const status = await statusResp.json();

                        // 更新进度 - 确保total不为0
                        const total = status.total || targetImages.length;
                        const completed = status.current || 0;
                        const active = status.active || completed;
                        const displayCurrent = status.status === 'running' ? active : completed;

                        setPreannotateProgress({
                            current: displayCurrent,
                            total: total,
                            currentImage: status.message || '正在处理...'
                        });

                        // 检查任务是否完成
                        if (status.status === 'completed' || status.status === 'failed' || status.status === 'stopped') {
                            // 清理所有定时器
                            if (pollIntervalRef.current) {
                                clearInterval(pollIntervalRef.current);
                                pollIntervalRef.current = null;
                            }
                            if (checkCancelIntervalRef.current) {
                                clearInterval(checkCancelIntervalRef.current);
                                checkCancelIntervalRef.current = null;
                            }
                            if (timeoutRef.current) {
                                clearTimeout(timeoutRef.current);
                                timeoutRef.current = null;
                            }

                            setPreannotating(false);
                            setShowPreannotateProgress(false);

                            // 使用后端返回的统计信息
                            let successCount = status.successCount || 0;
                            let failedCount = status.failedCount || 0;

                            // 如果任务已完成，确保统计信息正确
                            if (status.status === 'completed') {
                                // 如果后端返回的successCount为0但实际有处理图片，使用current作为成功数
                                if (successCount === 0 && completed > 0) {
                                    successCount = completed;
                                    failedCount = Math.max(0, total - successCount);
                                }
                                // 确保成功数不超过总数
                                if (successCount > total) {
                                    successCount = total;
                                    failedCount = 0;
                                }
                                // 如果成功数 + 失败数不等于总数，重新计算失败数
                                if (successCount + failedCount !== total && successCount > 0) {
                                    failedCount = Math.max(0, total - successCount);
                                }
                            }

                            setPreannotateResult({
                                successCount,
                                failedCount,
                                cancelled: status.status === 'stopped' || cancelPreannotateRef.current
                            });
                            setShowPreannotateResult(true);
                            onUpload();
                            return true; // 任务已完成，停止轮询
                        }
                    }
                } catch (e) {
                    console.error('Failed to poll prediction status:', e);
                }
                return false; // 任务未完成，继续轮询
            };

            // 立即执行一次
            checkStatus();

            // 开始轮询进度
            pollIntervalRef.current = setInterval(async () => {
                const completed = await checkStatus();
                if (completed) {
                    if (pollIntervalRef.current) {
                        clearInterval(pollIntervalRef.current);
                        pollIntervalRef.current = null;
                    }
                }
            }, 300); // 每300ms轮询一次，更频繁的更新

            // 设置超时，防止无限轮询（最多5分钟）
            timeoutRef.current = setTimeout(() => {
                // 清理所有定时器
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
                if (checkCancelIntervalRef.current) {
                    clearInterval(checkCancelIntervalRef.current);
                    checkCancelIntervalRef.current = null;
                }
                setPreannotating(false);
                setShowPreannotateProgress(false);
                setPreannotateResult({
                    successCount: 0,
                    failedCount: targetImages.length,
                    cancelled: false
                });
                setShowPreannotateResult(true);
            }, 5 * 60 * 1000);

        } catch (e) {
            console.error('Failed to start prediction:', e);
            setPreannotating(false);
            setShowPreannotateProgress(false);
            setPreannotateResult({
                successCount: 0,
                failedCount: targetImages.length,
                cancelled: false
            });
            setShowPreannotateResult(true);
        }
    };

    const handleCancelPreannotate = () => {
        if (cancelPreannotateRef.current) return;
        cancelPreannotateRef.current = true;
        setPreannotateProgress(prev => ({
            ...(prev || { current: 0, total: 0, currentImage: '' }),
            currentImage: '正在取消预标注任务...'
        }));
        fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/predict/cancel`, {
            method: 'POST'
        }).catch(e => console.error('Failed to cancel prediction:', e));
    };

    // 组件卸载时清理定时器
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (checkCancelIntervalRef.current) clearInterval(checkCancelIntervalRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleDeleteImage = async (imageId) => {
        const result = await deleteImage(projectId, imageId);
        if (result.success) {
            onUpload();
        }
    };

    const fetchStats = async () => {
        setLoadingStats(true);
        try {
            const resp = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/dataset/stats`);
            const data = await resp.json();
            setStats(data);
        } catch (e) {
            console.error('Failed to fetch stats:', e);
        } finally {
            setLoadingStats(false);
        }
    };

    const formatBytes = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const hasKeypointCount = useMemo(() => {
        return images.some(img => typeof img !== 'string' && Number.isFinite(img?.keypointCount));
    }, [images]);

    const hasBboxCount = useMemo(() => {
        return images.some(img => typeof img !== 'string' && Number.isFinite(img?.bboxCount));
    }, [images]);

    const wantsKeypointFilter = useMemo(() => {
        return String(keypointsMin).trim() !== '' || String(keypointsMax).trim() !== '';
    }, [keypointsMax, keypointsMin]);

    const wantsBboxFilter = useMemo(() => {
        return String(bboxesMin).trim() !== '' || String(bboxesMax).trim() !== '';
    }, [bboxesMax, bboxesMin]);

    const computeFilterPanelPos = () => {
        const el = filterButtonRef.current;
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const width = 340;
        const margin = 12;
        const estimatedHeight = 360;
        const preferTop = rect.bottom + 8;
        const top = (window.innerHeight - preferTop < estimatedHeight)
            ? Math.max(margin, rect.top - 8 - estimatedHeight)
            : preferTop;
        const left = Math.max(
            margin,
            Math.min(rect.right - width, window.innerWidth - width - margin)
        );
        return { top, left, width };
    };

    useEffect(() => {
        if (!filtersOpen) return;

        const update = () => {
            const pos = computeFilterPanelPos();
            if (pos) setFilterPanelPos(pos);
        };

        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [filtersOpen]);

    const activeFiltersCount = useMemo(() => {
        let n = 0;
        if (annotatedFilter !== 'all') n += 1;
        if (wantsKeypointFilter) n += 1;
        if (wantsBboxFilter) n += 1;
        return n;
    }, [annotatedFilter, wantsBboxFilter, wantsKeypointFilter]);

    // Filter images by search
    const filtered = useMemo(() => {
        return filterImagesAdvanced(images, { search, annotated: annotatedFilter, keypointsMin, keypointsMax, bboxesMin, bboxesMax });
    }, [annotatedFilter, bboxesMax, bboxesMin, images, keypointsMax, keypointsMin, search]);

    const displayList = useMemo(() => {
        const list = [...filtered];
        if (!search.trim()) {
            list.unshift('__UPLOAD__');
        }
        return list;
    }, [filtered, search]);

    const totalPages = Math.ceil(displayList.length / PAGE_SIZE);
    const pageItems = displayList.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    // Reset page when images or search changes
    React.useEffect(() => { setPage(0); }, [annotatedFilter, bboxesMax, bboxesMin, images, keypointsMax, keypointsMin, search]);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }} className="custom-scrollbar">
            {/* Search & Info Bar */}
            <div style={{ marginBottom: '1.75rem' }}>
                <div
                    className="glass-panel"
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                        flexWrap: 'wrap',
                        flexShrink: 0,
                        padding: '0.75rem 1rem',
                        borderRadius: '18px',
                        borderColor: 'rgba(255,255,255,0.1)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        background: 'rgba(23, 23, 23, 0.4)'
                    }}
                >
                    {/* Left Group: Status & Project Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(77, 161, 255, 0.15), rgba(77, 161, 255, 0.05))',
                            padding: '6px 14px',
                            borderRadius: '10px',
                            color: '#4da1ff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            border: '1px solid rgba(77, 161, 255, 0.25)',
                            fontSize: '13.5px',
                            fontWeight: 600,
                            boxShadow: '0 2px 10px rgba(77, 161, 255, 0.1)'
                        }}>
                            <ImageIcon size={16} />
                            <span>{filtered.length} 资源</span>
                        </div>

                        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                                onClick={() => {
                                    setShowStats(true);
                                    fetchStats();
                                }}
                                className="icon-btn hover-card"
                                title="项目详情"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    padding: '9px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                <AlertCircle size={17} />
                            </button>
                            <button
                                onClick={onUpload}
                                className="icon-btn hover-card"
                                title="刷新图库"
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    padding: '9px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255,255,255,0.08)'
                                }}
                            >
                                <RefreshCw size={17} />
                            </button>
                            <button
                                onClick={() => setShowDiscovery(true)}
                                className="icon-btn hover-card"
                                title="从文件夹导入"
                                style={{
                                    background: 'rgba(77, 161, 255, 0.08)',
                                    padding: '9px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(77, 161, 255, 0.2)',
                                    color: '#4da1ff'
                                }}
                            >
                                <FolderOpen size={17} />
                            </button>
                            <button
                                onClick={() => setShowHistory(true)}
                                className="icon-btn hover-card"
                                title="导入历史"
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    padding: '9px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255,255,255,0.08)'
                                }}
                            >
                                <Clock size={17} />
                            </button>
                        </div>
                    </div>

                    {/* Middle Group: AI Tools */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <button
                                onClick={() => setShowModelSettings(true)}
                                className="icon-btn hover-card"
                                title="模型设置"
                                style={{
                                    background: modelPath ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                    padding: '8px',
                                    borderRadius: '8px',
                                    border: modelPath ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid transparent',
                                    color: modelPath ? '#10b981' : 'var(--text-tertiary)'
                                }}
                            >
                                <Settings size={17} />
                            </button>
                            <button
                                onClick={() => setShowPreannotateDialog(true)}
                                disabled={!modelPath}
                                className="icon-btn hover-card"
                                title={!modelPath ? '请先配置模型' : '一键预标注'}
                                style={{
                                    background: modelPath ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    border: modelPath ? '1px solid rgba(139, 92, 246, 0.25)' : '1px solid transparent',
                                    color: modelPath ? '#a78bfa' : 'var(--text-tertiary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: modelPath ? 'pointer' : 'not-allowed',
                                    opacity: modelPath ? 1 : 0.4
                                }}
                            >
                                <Wand2 size={16} />
                                <span style={{ fontSize: '13px', fontWeight: 600 }}>智能预标注</span>
                            </button>
                        </div>
                    </div>

                    {/* Right Group: Search & Global Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '420px', justifyContent: 'flex-end' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <input
                                type="text"
                                placeholder="搜索图片..."
                                value={search}
                                onChange={(e) => updateGalleryFilters({ search: e.target.value })}
                                className="input-modern"
                                style={{
                                    height: '40px',
                                    paddingLeft: '38px',
                                    paddingRight: '12px',
                                    fontSize: '0.88rem',
                                    borderRadius: '10px',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    width: '100%'
                                }}
                            />
                            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                if (filtersOpen) {
                                    setFiltersOpen(false);
                                    setFilterPanelPos(null);
                                    return;
                                }
                                const pos = computeFilterPanelPos();
                                if (pos) setFilterPanelPos(pos);
                                setFiltersOpen(true);
                            }}
                            ref={filterButtonRef}
                            className="icon-btn hover-card"
                            title="高级筛选"
                            style={{
                                background: activeFiltersCount > 0 ? 'rgba(77, 161, 255, 0.15)' : 'rgba(255,255,255,0.04)',
                                padding: '0 14px',
                                height: '40px',
                                borderRadius: '10px',
                                border: activeFiltersCount > 0 ? '1px solid rgba(77, 161, 255, 0.3)' : '1px solid rgba(255,255,255,0.1)',
                                color: activeFiltersCount > 0 ? '#4da1ff' : 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: 600,
                                fontSize: '13px'
                            }}
                        >
                            <Filter size={16} />
                            <span>筛选</span>
                            {activeFiltersCount > 0 && (
                                <span style={{
                                    background: '#4da1ff',
                                    color: 'white',
                                    minWidth: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}>
                                    {activeFiltersCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {filtersOpen && filterPanelPos && createPortal(
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 10000 }}
                    onMouseDown={() => { setFiltersOpen(false); setFilterPanelPos(null); }}
                >
                    <div style={{ position: 'absolute', inset: 0 }} />
                    <div
                        className="glass-panel"
                        style={{
                            position: 'fixed',
                            top: filterPanelPos.top,
                            left: filterPanelPos.left,
                            width: `${filterPanelPos.width}px`,
                            maxWidth: 'calc(100vw - 24px)',
                            padding: '12px',
                            borderRadius: '14px',
                            background: 'rgba(22, 27, 34, 0.92)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            boxShadow: '0 18px 40px rgba(0,0,0,0.55)',
                            backdropFilter: 'blur(12px)'
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: '13px', letterSpacing: '0.02em' }}>筛选条件</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    className="icon-btn hover-card"
                                    onClick={() => {
                                        updateGalleryFilters({
                                            annotated: 'all',
                                            keypointsMin: '',
                                            keypointsMax: '',
                                            bboxesMin: '',
                                            bboxesMax: ''
                                        });
                                    }}
                                    title="清空筛选"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px' }}
                                >
                                    <RefreshCw size={16} />
                                </button>
                                <button
                                    className="icon-btn hover-card"
                                    onClick={() => setFiltersOpen(false)}
                                    title="关闭"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px' }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 800 }}>是否标注</div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                        onClick={() => updateGalleryFilters({ annotated: 'all' })}
                                        className={`icon-btn ${annotatedFilter === 'all' ? 'active' : ''}`}
                                        style={{ padding: '8px 10px', borderRadius: '10px' }}
                                    >
                                        <span style={{ fontSize: '12px', fontWeight: 800 }}>全部</span>
                                    </button>
                                    <button
                                        onClick={() => updateGalleryFilters({ annotated: 'annotated' })}
                                        className={`icon-btn ${annotatedFilter === 'annotated' ? 'active' : ''}`}
                                        style={{ padding: '8px 10px', borderRadius: '10px' }}
                                    >
                                        <span style={{ fontSize: '12px', fontWeight: 800 }}>已标注</span>
                                    </button>
                                    <button
                                        onClick={() => updateGalleryFilters({ annotated: 'unannotated' })}
                                        className={`icon-btn ${annotatedFilter === 'unannotated' ? 'active' : ''}`}
                                        style={{ padding: '8px 10px', borderRadius: '10px' }}
                                    >
                                        <span style={{ fontSize: '12px', fontWeight: 800 }}>未标注</span>
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 800 }}>关键点数量</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="最少"
                                        value={keypointsMin}
                                        onChange={(e) => updateGalleryFilters({ keypointsMin: e.target.value })}
                                        className="input-modern"
                                        style={{ height: '40px', width: '90px', borderRadius: '12px', padding: '0 10px', fontSize: '0.9rem' }}
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="最多"
                                        value={keypointsMax}
                                        onChange={(e) => updateGalleryFilters({ keypointsMax: e.target.value })}
                                        className="input-modern"
                                        style={{ height: '40px', width: '90px', borderRadius: '12px', padding: '0 10px', fontSize: '0.9rem' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 800 }}>BBox 数量</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="最少"
                                        value={bboxesMin}
                                        onChange={(e) => updateGalleryFilters({ bboxesMin: e.target.value })}
                                        className="input-modern"
                                        style={{ height: '40px', width: '90px', borderRadius: '12px', padding: '0 10px', fontSize: '0.9rem' }}
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="最多"
                                        value={bboxesMax}
                                        onChange={(e) => updateGalleryFilters({ bboxesMax: e.target.value })}
                                        className="input-modern"
                                        style={{ height: '40px', width: '90px', borderRadius: '12px', padding: '0 10px', fontSize: '0.9rem' }}
                                    />
                                </div>
                            </div>

                            {(wantsKeypointFilter && !hasKeypointCount) && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 10px',
                                    borderRadius: '12px',
                                    background: 'rgba(245, 158, 11, 0.12)',
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    color: '#f59e0b',
                                    fontSize: '12px',
                                    fontWeight: 800
                                }}>
                                    <AlertTriangle size={14} />
                                    <span>后端未返回 keypointCount</span>
                                </div>
                            )}

                            {(wantsBboxFilter && !hasBboxCount) && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 10px',
                                    borderRadius: '12px',
                                    background: 'rgba(245, 158, 11, 0.12)',
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    color: '#f59e0b',
                                    fontSize: '12px',
                                    fontWeight: 800
                                }}>
                                    <AlertTriangle size={14} />
                                    <span>后端未返回 bboxCount</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Image Grid */}
            <div className="image-grid" style={{ paddingBottom: '2rem' }}>
                {pageItems.map((item, index) => {
                    if (item === '__UPLOAD__') {
                        return (
                            <div key="__UPLOAD__" style={{ height: '100%' }}>
                                <ImageUpload
                                    projectId={projectId}
                                    onUploadComplete={onUpload}
                                    variant="card"
                                />
                            </div>
                        );
                    }

                    return (
                        <ThumbnailCard
                            key={typeof item === 'string' ? item : item.name}
                            imageObj={item}
                            projectId={projectId}
                            index={index}
                            onSelectImage={(img) => onSelectImage(img, { navImages: filtered })}
                            isSelected={selectedImage === (typeof item === 'string' ? item : item.name)}
                            onDelete={handleDeleteImage}
                        />
                    );
                })}
            </div>

            {/* Pagination Floating Pill */}
            {
                totalPages > 1 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        padding: '1rem 0 1rem 0'
                    }}>
                        <div className="glass-panel" style={{
                            pointerEvents: 'auto',
                            padding: '8px 12px',
                            borderRadius: '20px',
                            background: 'rgba(22, 27, 34, 0.85)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            zIndex: 10
                        }}>
                            <button
                                className="icon-btn"
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                style={{
                                    borderRadius: '12px', width: '36px', height: '36px',
                                    background: page === 0 ? 'transparent' : 'rgba(255,255,255,0.05)',
                                    color: page === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)'
                                }}
                            >
                                <ChevronLeft size={18} />
                            </button>

                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {Array.from({ length: totalPages }, (_, i) => {
                                    if (totalPages <= 7 || i === 0 || i === totalPages - 1 ||
                                        Math.abs(i - page) <= 1) {
                                        const isActive = i === page;
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => setPage(i)}
                                                style={{
                                                    width: '32px', height: '32px', borderRadius: '10px',
                                                    border: isActive ? '1px solid rgba(77, 161, 255, 0.3)' : 'none',
                                                    background: isActive ? 'rgba(77, 161, 255, 0.15)' : 'transparent',
                                                    color: isActive ? '#4da1ff' : 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    fontSize: '13px',
                                                    fontWeight: isActive ? '700' : '500',
                                                    transition: 'all 0.2s'
                                                }}
                                                className={!isActive ? "hover-text-primary" : ""}
                                            >
                                                {i + 1}
                                            </button>
                                        );
                                    } else if (i === 1 || i === totalPages - 2) {
                                        return <span key={i} style={{ color: 'var(--text-tertiary)', padding: '0 2px', fontSize: '12px' }}>•••</span>;
                                    }
                                    return null;
                                })}
                            </div>

                            <button
                                className="icon-btn"
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page === totalPages - 1}
                                style={{
                                    borderRadius: '12px', width: '36px', height: '36px',
                                    background: page === totalPages - 1 ? 'transparent' : 'rgba(255,255,255,0.05)',
                                    color: page === totalPages - 1 ? 'var(--text-tertiary)' : 'var(--text-primary)'
                                }}
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )
            }

            {
                filtered.length === 0 && search && (
                    <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)', padding: '4rem' }}>
                        <p>没有找到匹配 "{search}" 的图片</p>
                    </div>
                )
            }

            {
                showDiscovery && (
                    <ImageDiscovery
                        projectId={projectId}
                        onClose={() => setShowDiscovery(false)}
                        onImportComplete={() => {
                            onUpload();
                            setShowDiscovery(false);
                        }}
                    />
                )
            }

            {
                showHistory && (
                    <ImportHistory
                        projectId={projectId}
                        onClose={() => setShowHistory(false)}
                    />
                )
            }

            {
                showStats && (
                    <div className="modal-overlay" onClick={() => setShowStats(false)}>
                        <div className="modal-panel animate-scale-in" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                            <div style={{ padding: '24px' }}>
                                <div className="modal-header-between" style={{ marginBottom: '24px' }}>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            background: 'rgba(77, 161, 255, 0.1)',
                                            padding: '8px',
                                            borderRadius: '10px',
                                            color: '#4da1ff'
                                        }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                        </div>
                                        项目详细信息
                                    </h3>
                                    <button className="icon-btn" onClick={() => setShowStats(false)}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 600 }}>项目 ID</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>{projectId}</div>
                                    </div>

                                    {stats?.projectPath && (
                                        <div className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', position: 'relative' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 600 }}>项目路径</div>
                                                    <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.9rem', wordBreak: 'break-all', paddingRight: '40px' }}>{stats.projectPath}</div>
                                                </div>
                                                <button
                                                    className="icon-btn hover-card"
                                                    title="在资源管理器中打开"
                                                    onClick={async () => {
                                                        try {
                                                            await fetch('http://localhost:5000/api/utils/open-folder', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ path: stats.projectPath })
                                                            });
                                                        } catch (e) {
                                                            console.error('Failed to open folder:', e);
                                                        }
                                                    }}
                                                    style={{
                                                        background: 'rgba(77, 161, 255, 0.1)',
                                                        padding: '8px',
                                                        borderRadius: '8px',
                                                        color: '#4da1ff',
                                                        border: '1px solid rgba(77, 161, 255, 0.2)',
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    <FolderOpen size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {loadingStats ? (
                                        <div style={{ padding: '40px', textAlign: 'center' }}>
                                            <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-primary)', opacity: 0.5 }} />
                                        </div>
                                    ) : stats ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <div className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                                                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginBottom: '4px' }}>图片总数</div>
                                                    <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.2rem' }}>{stats.total}</div>
                                                </div>
                                                <div className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                                                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginBottom: '4px' }}>存储占用</div>
                                                    <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.2rem' }}>{formatBytes(stats.totalSize || 0)}</div>
                                                </div>
                                                <div className="glass-card" style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.1)' }}>
                                                    <div style={{ color: '#10b981', fontSize: '0.75rem', marginBottom: '4px' }}>已标注图片</div>
                                                    <div style={{ color: '#10b981', fontWeight: 700, fontSize: '1.2rem' }}>{stats.annotated}</div>
                                                </div>
                                                <div className="glass-card" style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.1)' }}>
                                                    <div style={{ color: '#f59e0b', fontSize: '0.75rem', marginBottom: '4px' }}>未标注图片</div>
                                                    <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '1.2rem' }}>{stats.unannotated}</div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <div className="glass-card" style={{ padding: '16px', background: 'rgba(77, 161, 255, 0.05)', border: '1px solid rgba(77, 161, 255, 0.1)' }}>
                                                    <div style={{ color: '#4da1ff', fontSize: '0.75rem', marginBottom: '4px' }}>总标注框 (BBox)</div>
                                                    <div style={{ color: '#4da1ff', fontWeight: 700, fontSize: '1.2rem' }}>{stats.bboxes || 0}</div>
                                                </div>
                                                <div className="glass-card" style={{ padding: '16px', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                                                    <div style={{ color: '#8b5cf6', fontSize: '0.75rem', marginBottom: '4px' }}>总关键点 (Keypoints)</div>
                                                    <div style={{ color: '#8b5cf6', fontWeight: 700, fontSize: '1.2rem' }}>{stats.keypoints || 0}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>无法获取统计信息</div>
                                    )}
                                </div>

                                <div style={{ marginTop: '32px' }}>
                                    <button
                                        className="btn-modern-primary"
                                        style={{ width: '100%' }}
                                        onClick={() => setShowStats(false)}
                                    >
                                        关闭
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showModelSettings && createPortal(
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
                        onClick={() => setShowModelSettings(false)}
                    >
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(22, 27, 34, 0.98), rgba(13, 17, 23, 0.98))',
                            borderRadius: '20px',
                            padding: '2rem',
                            maxWidth: '500px',
                            width: '90%',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                        }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '14px',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#10b981'
                                }}>
                                    <Settings size={24} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                        预标注模型设置
                                    </h3>
                                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                        选择 YOLO 姿态估计模型文件 (.pt)
                                    </p>
                                </div>
                            </div>

                            <div style={{
                                padding: '16px',
                                background: 'rgba(255, 255, 255, 0.02)',
                                borderRadius: '12px',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                marginBottom: '1.5rem'
                            }}>
                                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginBottom: '8px', fontWeight: 600 }}>
                                    当前模型路径
                                </div>
                                {modelPath ? (
                                    <div style={{
                                        color: 'var(--text-primary)',
                                        fontWeight: 500,
                                        fontSize: '0.9rem',
                                        wordBreak: 'break-all',
                                        padding: '10px 12px',
                                        background: 'rgba(16, 185, 129, 0.1)',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(16, 185, 129, 0.2)'
                                    }}>
                                        {modelPath}
                                    </div>
                                ) : (
                                    <div style={{
                                        color: 'var(--text-tertiary)',
                                        fontSize: '0.9rem',
                                        padding: '10px 12px',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        borderRadius: '8px',
                                        border: '1px dashed rgba(255, 255, 255, 0.1)'
                                    }}>
                                        未配置模型
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => setShowModelSettings(false)}
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
                                    关闭
                                </button>
                                <button
                                    onClick={handleSelectModel}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '12px',
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
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
                                    <FolderOpen size={16} />
                                    选择模型文件
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            {
                showPreannotateDialog && createPortal(
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
                        onClick={() => setShowPreannotateDialog(false)}
                    >
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(22, 27, 34, 0.98), rgba(13, 17, 23, 0.98))',
                            borderRadius: '20px',
                            padding: '2rem',
                            maxWidth: '450px',
                            width: '90%',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                        }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '14px',
                                    background: 'rgba(139, 92, 246, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#8b5cf6'
                                }}>
                                    <Wand2 size={24} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                        模型预标注
                                    </h3>
                                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                        选择预标注范围和参数
                                    </p>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginBottom: '10px', fontWeight: 600 }}>
                                    预标注范围
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 14px',
                                        background: preannotateRange === 'all' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                                        border: preannotateRange === 'all' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}>
                                        <input
                                            type="radio"
                                            name="preannotateRange"
                                            value="all"
                                            checked={preannotateRange === 'all'}
                                            onChange={() => setPreannotateRange('all')}
                                            style={{ accentColor: '#8b5cf6' }}
                                        />
                                        <span style={{ color: preannotateRange === 'all' ? '#8b5cf6' : 'var(--text-primary)', fontWeight: 500 }}>
                                            全部图片 ({filtered.length} 张)
                                        </span>
                                    </label>
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 14px',
                                        background: preannotateRange === 'unannotated' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                                        border: preannotateRange === 'unannotated' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}>
                                        <input
                                            type="radio"
                                            name="preannotateRange"
                                            value="unannotated"
                                            checked={preannotateRange === 'unannotated'}
                                            onChange={() => setPreannotateRange('unannotated')}
                                            style={{ accentColor: '#8b5cf6' }}
                                        />
                                        <span style={{ color: preannotateRange === 'unannotated' ? '#8b5cf6' : 'var(--text-primary)', fontWeight: 500 }}>
                                            仅未标注图片 ({filtered.filter(img => typeof img === 'string' ? true : !img.hasAnnotation).length} 张)
                                        </span>
                                    </label>
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 14px',
                                        background: preannotateRange === 'selected' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                                        border: preannotateRange === 'selected' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '10px',
                                        cursor: selectedImage ? 'pointer' : 'not-allowed',
                                        transition: 'all 0.2s',
                                        opacity: selectedImage ? 1 : 0.5
                                    }}>
                                        <input
                                            type="radio"
                                            name="preannotateRange"
                                            value="selected"
                                            checked={preannotateRange === 'selected'}
                                            onChange={() => selectedImage && setPreannotateRange('selected')}
                                            disabled={!selectedImage}
                                            style={{ accentColor: '#8b5cf6' }}
                                        />
                                        <span style={{ color: preannotateRange === 'selected' ? '#8b5cf6' : 'var(--text-primary)', fontWeight: 500 }}>
                                            当前选中图片 {selectedImage ? `(1 张)` : '(未选中)'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', fontWeight: 600 }}>
                                        置信度阈值
                                    </span>
                                    <span style={{ color: '#8b5cf6', fontSize: '0.9rem', fontWeight: 600 }}>
                                        {confidenceThreshold.toFixed(2)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="0.9"
                                    step="0.05"
                                    value={confidenceThreshold}
                                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                                    style={{
                                        width: '100%',
                                        height: '6px',
                                        borderRadius: '3px',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        outline: 'none',
                                        accentColor: '#8b5cf6'
                                    }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>0.1 (宽松)</span>
                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>0.9 (严格)</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => setShowPreannotateDialog(false)}
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
                                    onClick={handleStartPreannotate}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '12px',
                                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
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
                                    <Play size={16} />
                                    开始预标注
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            {
                showPreannotateProgress && createPortal(
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.8)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000
                    }}>
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(22, 27, 34, 0.98), rgba(13, 17, 23, 0.98))',
                            borderRadius: '20px',
                            padding: '2rem',
                            maxWidth: '450px',
                            width: '90%',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '14px',
                                    background: 'rgba(139, 92, 246, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#8b5cf6'
                                }}>
                                    <RefreshCw size={24} className="animate-spin" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                        正在预标注
                                    </h3>
                                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                        请稍候，正在处理图片...
                                    </p>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{
                                    width: '100%',
                                    height: '8px',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    borderRadius: '4px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        width: `${preannotateProgress.total > 0 ? (preannotateProgress.current / preannotateProgress.total) * 100 : 0}%`,
                                        height: '100%',
                                        background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
                                        transition: 'width 0.3s ease'
                                    }} />
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '1rem'
                            }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    进度: {preannotateProgress.current} / {preannotateProgress.total}
                                </span>
                                <span style={{ color: '#8b5cf6', fontSize: '0.9rem', fontWeight: 600 }}>
                                    {preannotateProgress.total > 0 ? Math.round((preannotateProgress.current / preannotateProgress.total) * 100) : 0}%
                                </span>
                            </div>

                            {preannotateProgress.currentImage && (
                                <div style={{
                                    padding: '12px 14px',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    marginBottom: '1.5rem'
                                }}>
                                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginBottom: '4px' }}>
                                        当前处理
                                    </div>
                                    <div style={{
                                        color: 'var(--text-primary)',
                                        fontSize: '0.9rem',
                                        fontWeight: 500,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {preannotateProgress.currentImage}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleCancelPreannotate}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#ef4444',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                <X size={16} />
                                取消预标注
                            </button>
                        </div>
                    </div>,
                    document.body
                )
            }

            {
                showPreannotateResult && preannotateResult && createPortal(
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
                        onClick={() => setShowPreannotateResult(false)}
                    >
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(22, 27, 34, 0.98), rgba(13, 17, 23, 0.98))',
                            borderRadius: '20px',
                            padding: '2rem',
                            maxWidth: '400px',
                            width: '90%',
                            border: preannotateResult.cancelled
                                ? '1px solid rgba(245, 158, 11, 0.3)'
                                : preannotateResult.failedCount > 0
                                    ? '1px solid rgba(245, 158, 11, 0.3)'
                                    : '1px solid rgba(16, 185, 129, 0.3)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                        }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    background: preannotateResult.cancelled
                                        ? 'rgba(245, 158, 11, 0.15)'
                                        : preannotateResult.failedCount > 0
                                            ? 'rgba(245, 158, 11, 0.15)'
                                            : 'rgba(16, 185, 129, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 16px auto'
                                }}>
                                    {preannotateResult.cancelled ? (
                                        <Pause size={28} color="#f59e0b" />
                                    ) : preannotateResult.failedCount > 0 ? (
                                        <AlertCircle size={28} color="#f59e0b" />
                                    ) : (
                                        <CheckCircle size={28} color="#10b981" />
                                    )}
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    {preannotateResult.cancelled
                                        ? '预标注已取消'
                                        : preannotateResult.failedCount > 0
                                            ? '预标注完成（部分失败）'
                                            : '预标注完成'}
                                </h3>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: preannotateResult.failedCount > 0 ? '1fr 1fr' : '1fr',
                                gap: '12px',
                                marginBottom: '1.5rem'
                            }}>
                                <div style={{
                                    padding: '16px',
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ color: '#10b981', fontSize: '1.5rem', fontWeight: 700 }}>
                                        {preannotateResult.successCount}
                                    </div>
                                    <div style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 500 }}>
                                        成功
                                    </div>
                                </div>
                                {preannotateResult.failedCount > 0 && (
                                    <div style={{
                                        padding: '16px',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 700 }}>
                                            {preannotateResult.failedCount}
                                        </div>
                                        <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 500 }}>
                                            失败
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => setShowPreannotateResult(false)}
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
                                    关闭
                                </button>
                                <button
                                    onClick={() => {
                                        setShowPreannotateResult(false);
                                        onUpload();
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '12px',
                                        background: 'linear-gradient(135deg, #4da1ff, #2188ff)',
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
                                    <RefreshCw size={16} />
                                    刷新图库
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            {
                showModelToast && createPortal(
                    <div style={{
                        position: 'fixed',
                        bottom: '24px',
                        right: '24px',
                        zIndex: 10001,
                        animation: 'slideInRight 0.3s ease-out'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '14px 20px',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))',
                            borderRadius: '14px',
                            boxShadow: '0 10px 40px rgba(16, 185, 129, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                            color: 'white'
                        }}>
                            <CheckCircle size={20} />
                            <span style={{ fontWeight: 600, fontSize: '14px' }}>模型已选择成功</span>
                        </div>
                        <style>{`
                        @keyframes slideInRight {
                            from {
                                opacity: 0;
                                transform: translateX(100px);
                            }
                            to {
                                opacity: 1;
                                transform: translateX(0);
                            }
                        }
                    `}</style>
                    </div>,
                    document.body
                )
            }
        </div >
    );
};
