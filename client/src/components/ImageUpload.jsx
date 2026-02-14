
import React, { useState, useRef } from 'react';
import { UploadCloud, Check } from 'lucide-react';

const CONCURRENT_UPLOADS = 4;

export const ImageUpload = ({ projectId, onUploadComplete, compact = false, variant = 'default' }) => {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [message, setMessage] = useState('');
    const abortRef = useRef(false);

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        setUploading(true);
        setMessage('');
        setProgress({ done: 0, total: files.length });
        abortRef.current = false;

        let count = 0;
        let idx = 0;

        const uploadNext = async () => {
            while (idx < files.length && !abortRef.current) {
                const fileIdx = idx++;
                const formData = new FormData();
                formData.append('image', files[fileIdx]);

                try {
                    await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/upload`, {
                        method: 'POST',
                        body: formData
                    });
                    count++;
                } catch (error) {
                    console.error('Upload failed:', files[fileIdx].name, error);
                }
                setProgress(p => ({ ...p, done: p.done + 1 }));
            }
        };

        const workers = [];
        for (let w = 0; w < Math.min(CONCURRENT_UPLOADS, files.length); w++) {
            workers.push(uploadNext());
        }
        await Promise.all(workers);

        setUploading(false);
        setMessage(`成功上传 ${count}/${files.length} 张图片。`);
        if (onUploadComplete) onUploadComplete();

        e.target.value = '';
        setTimeout(() => setMessage(''), 4000);
    };

    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

    if (variant === 'card') {
        return (
            <>
                <label
                    className="glass-card"
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: uploading ? 'wait' : 'pointer',
                        borderStyle: 'dashed',
                        borderWidth: '2px',
                        borderColor: uploading ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)',
                        width: '100%',
                        aspectRatio: '4/3',
                        padding: '20px',
                        background: uploading ? 'rgba(88, 166, 255, 0.05)' : 'rgba(255, 255, 255, 0.015)',
                        animationDelay: '0.1s',
                        position: 'relative',
                        borderRadius: '14px',
                        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                    }}
                    onMouseEnter={(e) => {
                        if (!uploading) {
                            e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                            e.currentTarget.style.borderColor = 'rgba(77, 161, 255, 0.35)';
                            e.currentTarget.style.boxShadow = '0 16px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(77, 161, 255, 0.15)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!uploading) {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                        }
                    }}
                >
                    <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        disabled={uploading}
                    />

                    {uploading ? (
                        <div style={{ width: '100%', padding: '0 1rem', textAlign: 'center' }}>
                            <div style={{
                                width: '100%',
                                height: '6px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '3px',
                                overflow: 'hidden',
                                marginBottom: '10px'
                            }}>
                                <div style={{
                                    width: `${pct}%`,
                                    height: '100%',
                                    background: 'var(--accent-primary)',
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                            <span style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                上传中 {progress.done}/{progress.total}
                            </span>
                        </div>
                    ) : (
                        <>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '16px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '16px',
                                color: 'var(--text-tertiary)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                transition: 'all 0.3s ease'
                            }} className="create-card-icon">
                                <UploadCloud size={24} strokeWidth={1.5} />
                            </div>
                            <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>添加图片</h3>
                            <p style={{ margin: '6px 0 0 0', color: 'var(--text-tertiary)', fontSize: '0.8rem', fontWeight: 500 }}>支持 JPG, PNG, WEBP</p>
                        </>
                    )}
                </label>
                {message && (
                    <div style={{
                        position: 'fixed',
                        bottom: '30px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 2000,
                        background: 'rgba(35, 134, 54, 0.9)',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '30px',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.9rem',
                        fontWeight: 600
                    }} className="">
                        <Check size={16} />
                        {message}
                    </div>
                )}
            </>
        )
    }

    return (
        <div style={{ textAlign: 'center' }}>
            <label className={`upload-zone ${compact ? 'compact' : ''}`} style={{
                background: uploading ? 'rgba(88, 166, 255, 0.05)' : 'rgba(255, 255, 255, 0.03)',
                borderColor: uploading ? 'rgba(88, 166, 255, 0.3)' : 'rgba(255, 255, 255, 0.12)',
                pointerEvents: uploading ? 'none' : 'auto',
                minHeight: compact ? '120px' : '220px',
                borderRadius: compact ? '20px' : '24px'
            }}>
                <div style={{
                    width: compact ? '48px' : '64px',
                    height: compact ? '48px' : '64px',
                    borderRadius: compact ? '14px' : '20px',
                    background: 'rgba(77, 161, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: compact ? '0' : '1.5rem',
                    color: '#4da1ff',
                    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(77, 161, 255, 0.1)',
                    flexShrink: 0
                }} className="upload-icon-container">
                    <UploadCloud size={compact ? 24 : 30} strokeWidth={2} />
                </div>

                <div style={{ textAlign: compact ? 'left' : 'center' }}>
                    <span className="upload-zone-title" style={{
                        fontSize: compact ? '1.1rem' : '1.3rem',
                        fontWeight: 800,
                        marginBottom: compact ? '2px' : '0.6rem',
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.3px',
                        display: 'block'
                    }}>
                        {compact ? '点击或拖拽添加更多图片' : '点击或拖拽上传图片'}
                    </span>
                    <span className="upload-zone-subtitle" style={{
                        fontSize: compact ? '0.85rem' : '0.95rem',
                        color: 'var(--text-tertiary)',
                        fontWeight: 500,
                        opacity: 0.6,
                        display: 'block'
                    }}>
                        {uploading ? '正在上传中...' : '支持 JPG, PNG, WEBP 格式 · 智能识别缩略图'}
                    </span>
                </div>

                <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    disabled={uploading}
                />

                {uploading && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(13, 17, 23, 0.6)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        flexDirection: compact ? 'row' : 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: compact ? '1.5rem' : '0',
                        zIndex: 10,
                        borderRadius: compact ? '20px' : '24px'
                    }} className="">
                        <div style={{
                            width: compact ? '120px' : '200px',
                            height: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.5)',
                            marginBottom: compact ? '0' : '1rem'
                        }}>
                            <div style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #2188ff, #4da1ff)',
                                borderRadius: '4px',
                                transition: 'width 0.3s ease',
                                boxShadow: '0 0 12px rgba(77, 161, 255, 0.5)'
                            }} />
                        </div>
                        <span style={{ color: '#4da1ff', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.5px' }}>
                            {progress.done} / {progress.total}
                        </span>
                    </div>
                )}
            </label>

            {message && !compact && (
                <div className="" style={{
                    marginTop: '1.5rem',
                    color: 'var(--success)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    padding: '12px 24px',
                    background: 'rgba(52, 211, 153, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(52, 211, 153, 0.1)',
                    width: 'fit-content',
                    margin: '1.5rem auto 0 auto'
                }}>
                    <Check size={18} strokeWidth={3} />
                    <span style={{ fontWeight: 600 }}>{message}</span>
                </div>
            )}
        </div>
    );
};
