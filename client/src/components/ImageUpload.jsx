
import React, { useState, useRef } from 'react';
import { UploadCloud, Check } from 'lucide-react';

const CONCURRENT_UPLOADS = 4;

export const ImageUpload = ({ projectId, onUploadComplete }) => {
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

        // Worker function - each worker pulls next file from queue
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

        // Start N concurrent workers
        const workers = [];
        for (let w = 0; w < Math.min(CONCURRENT_UPLOADS, files.length); w++) {
            workers.push(uploadNext());
        }
        await Promise.all(workers);

        setUploading(false);
        setMessage(`成功上传 ${count}/${files.length} 张图片。`);
        if (onUploadComplete) onUploadComplete();

        // Reset file input
        e.target.value = '';
        setTimeout(() => setMessage(''), 4000);
    };

    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

    return (
        <div style={{ textAlign: 'center' }}>
            <label className="upload-zone">
                <UploadCloud size={48} className="upload-zone-icon" />
                <span className="upload-zone-title">点击选择图片</span>
                <span className="upload-zone-subtitle">支持 JPG, PNG, WEBP 格式，可批量选择</span>

                <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    disabled={uploading}
                />
            </label>

            {uploading && (
                <div style={{ marginTop: '1rem' }}>
                    <div style={{
                        width: '100%', maxWidth: '300px', margin: '0 auto',
                        height: '6px', borderRadius: '3px', background: 'var(--bg-tertiary)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${pct}%`, height: '100%',
                            background: 'var(--accent-primary)',
                            borderRadius: '3px',
                            transition: 'width 0.2s ease'
                        }} />
                    </div>
                    <p style={{ marginTop: '8px', color: 'var(--accent-primary)', fontSize: '13px' }}>
                        上传中 {progress.done}/{progress.total} ({pct}%)
                    </p>
                </div>
            )}
            {message && (
                <p className="animate-fade-in" style={{ marginTop: '1rem', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Check size={16} /> {message}
                </p>
            )}
        </div>
    );
};
