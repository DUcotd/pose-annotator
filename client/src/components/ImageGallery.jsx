import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, CheckCircle, RefreshCw, FolderOpen, Clock } from 'lucide-react';
import { ImageUpload } from './ImageUpload';
import { ImageDiscovery } from './ImageDiscovery';
import { ImportHistory } from './ImportHistory';

const PAGE_SIZE = 60;

const ThumbnailCard = ({ imageObj, projectId, index, onSelectImage, isSelected }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [errorCount, setErrorCount] = useState(0);

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

    return (
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
                {/* Skeleton Loader */}
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

                {/* Status Badge */}
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

                {/* Image Size Badge */}
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
            </div>
            <div className="image-card-label" style={{ opacity: 1, transform: 'translateY(0)' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{img}</span>
            </div>
        </div>
    );
};

export const ImageGallery = ({ images = [], projectId, onSelectImage, onUpload, selectedImage }) => {
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const [showDiscovery, setShowDiscovery] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

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
        </div>
    );
};
