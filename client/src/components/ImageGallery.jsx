import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, CheckCircle, RefreshCw, FolderOpen, Clock, Trash2, X, AlertTriangle } from 'lucide-react';
import { ImageUpload } from './ImageUpload';
import { ImageDiscovery } from './ImageDiscovery';
import { ImportHistory } from './ImportHistory';
import { useProject } from '../context/ProjectContext';
import { createPortal } from 'react-dom';

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
    const [search, setSearch] = useState('');
    const [showDiscovery, setShowDiscovery] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const { deleteImage } = useProject();

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

    // Filter images by search
    const filtered = useMemo(() => {
        if (!search.trim()) return images;
        const q = search.toLowerCase();
        return images.filter(img => {
            const name = typeof img === 'string' ? img : img.name;
            return name.toLowerCase().includes(q);
        });
    }, [images, search]);

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
    React.useEffect(() => { setPage(0); }, [images, search]);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }} className="custom-scrollbar">
            {/* Search & Info Bar */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '2rem', gap: '1.5rem', flexWrap: 'wrap', flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        background: 'rgba(77, 161, 255, 0.1)',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        color: '#4da1ff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        border: '1px solid rgba(77, 161, 255, 0.2)'
                    }}>
                        <ImageIcon size={16} />
                        <span style={{ fontWeight: 700 }}>{filtered.length}</span>
                    </div>
                    <button
                        onClick={() => {
                            setShowStats(true);
                            fetchStats();
                        }}
                        className="icon-btn hover-card"
                        title="查看项目详情"
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            padding: '8px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    </button>
                    <button
                        onClick={onUpload}
                        className="icon-btn hover-card"
                        title="刷新图库"
                        style={{
                            background: 'rgba(255,255,255,0.03)',
                            padding: '8px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}
                    >
                        <RefreshCw size={16} />
                    </button>
                    <button
                        onClick={() => setShowDiscovery(true)}
                        className="icon-btn hover-card"
                        title="从文件夹导入"
                        style={{
                            background: 'rgba(77, 161, 255, 0.1)',
                            padding: '8px',
                            borderRadius: '10px',
                            border: '1px solid rgba(77, 161, 255, 0.2)',
                            color: '#4da1ff'
                        }}
                    >
                        <FolderOpen size={16} />
                    </button>
                    <button
                        onClick={() => setShowHistory(true)}
                        className="icon-btn hover-card"
                        title="导入历史"
                        style={{
                            background: 'rgba(255,255,255,0.03)',
                            padding: '8px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}
                    >
                        <Clock size={16} />
                    </button>
                </div>
                <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
                    <input
                        type="text"
                        placeholder="搜索图片名称..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input-modern"
                        style={{
                            height: '46px',
                            paddingLeft: '44px',
                            fontSize: '0.95rem',
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderColor: 'var(--border-subtle)',
                            borderRadius: '12px'
                        }}
                    />
                    <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                </div>
            </div>

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
                            onSelectImage={onSelectImage}
                            isSelected={selectedImage === (typeof item === 'string' ? item : item.name)}
                            onDelete={handleDeleteImage}
                        />
                    );
                })}
            </div>

            {/* Pagination Floating Pill */}
            {totalPages > 1 && (
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
            )}

            {filtered.length === 0 && search && (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)', padding: '4rem' }}>
                    <p>没有找到匹配 "{search}" 的图片</p>
                </div>
            )}

            {showDiscovery && (
                <ImageDiscovery
                    projectId={projectId}
                    onClose={() => setShowDiscovery(false)}
                    onImportComplete={() => {
                        onUpload();
                        setShowDiscovery(false);
                    }}
                />
            )}

            {showHistory && (
                <ImportHistory
                    projectId={projectId}
                    onClose={() => setShowHistory(false)}
                />
            )}

            {showStats && (
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
                                    <div className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 600 }}>项目路径</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.9rem', wordBreak: 'break-all' }}>{stats.projectPath}</div>
                                    </div>
                                )}

                                {loadingStats ? (
                                    <div style={{ padding: '40px', textAlign: 'center' }}>
                                        <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-primary)', opacity: 0.5 }} />
                                    </div>
                                ) : stats ? (
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
                                            <div style={{ color: '#10b981', fontSize: '0.75rem', marginBottom: '4px' }}>已标注</div>
                                            <div style={{ color: '#10b981', fontWeight: 700, fontSize: '1.2rem' }}>{stats.annotated}</div>
                                        </div>
                                        <div className="glass-card" style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.1)' }}>
                                            <div style={{ color: '#f59e0b', fontSize: '0.75rem', marginBottom: '4px' }}>未标注</div>
                                            <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '1.2rem' }}>{stats.unannotated}</div>
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
            )}
        </div>
    );
};
