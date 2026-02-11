
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

const PAGE_SIZE = 24;

export const ImageGallery = ({ images = [], projectId, onSelectImage }) => {
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');

    // Filter images by search
    const filtered = useMemo(() => {
        if (!search.trim()) return images;
        const q = search.toLowerCase();
        return images.filter(img => img.toLowerCase().includes(q));
    }, [images, search]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const pageImages = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    // Reset page when images or search changes
    React.useEffect(() => { setPage(0); }, [images, search]);

    if (!images.length) {
        return (
            <div className="gallery-empty">
                <p>该项目中暂无图片。</p>
            </div>
        );
    }

    return (
        <div>
            {/* Search & Info Bar */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '12px', gap: '12px', flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <ImageIcon size={16} />
                    <span>共 {filtered.length} 张图片</span>
                    {search && filtered.length !== images.length && (
                        <span style={{ color: 'var(--text-tertiary)' }}>（筛选自 {images.length} 张）</span>
                    )}
                </div>
                <input
                    type="text"
                    placeholder="搜索图片..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-sm"
                    style={{ maxWidth: '200px' }}
                />
            </div>

            {/* Image Grid */}
            <div className="image-grid">
                {pageImages.map((img, index) => (
                    <div
                        key={img}
                        className="image-card"
                        onClick={() => onSelectImage(img)}
                    >
                        <img
                            src={`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/thumbnails/${encodeURIComponent(img)}`}
                            alt={img}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                                // Fallback to full image if thumbnail fails
                                if (e.target.src !== `http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/uploads/${encodeURIComponent(img)}`) {
                                    e.target.src = `http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/uploads/${encodeURIComponent(img)}`;
                                }
                            }}
                        />
                        <div className="image-card-label">
                            {img}
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    gap: '12px', marginTop: '16px', padding: '8px 0'
                }}>
                    <button
                        className="icon-btn"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        style={{ opacity: page === 0 ? 0.3 : 1 }}
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {Array.from({ length: totalPages }, (_, i) => {
                            // Show max 7 page buttons with ellipsis
                            if (totalPages <= 7 || i === 0 || i === totalPages - 1 ||
                                Math.abs(i - page) <= 1) {
                                return (
                                    <button
                                        key={i}
                                        onClick={() => setPage(i)}
                                        style={{
                                            width: '32px', height: '32px', borderRadius: '6px', border: 'none',
                                            background: i === page ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                            color: i === page ? '#fff' : 'var(--text-secondary)',
                                            cursor: 'pointer', fontSize: '13px', fontWeight: i === page ? '600' : '400',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {i + 1}
                                    </button>
                                );
                            } else if (i === 1 || i === totalPages - 2) {
                                return <span key={i} style={{ color: 'var(--text-tertiary)', padding: '0 2px' }}>…</span>;
                            }
                            return null;
                        })}
                    </div>

                    <button
                        className="icon-btn"
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page === totalPages - 1}
                        style={{ opacity: page === totalPages - 1 ? 0.3 : 1 }}
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}
        </div>
    );
};
