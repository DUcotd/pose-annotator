import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, Tag, X, Hash } from 'lucide-react';

export const ClassInputModal = ({ isOpen, onClose, onSubmit, initialValue, classMapping = {}, projectId }) => {
    const [value, setValue] = useState(initialValue || 0);
    const inputRef = useRef(null);
    const [recent, setRecent] = useState([]);
    const [activeIdx, setActiveIdx] = useState(0);

    const classOptions = useMemo(() => {
        const entries = Object.entries(classMapping || {});
        return entries
            .map(([k, v]) => ({ index: parseInt(k, 10), name: String(v ?? '') }))
            .filter(x => Number.isFinite(x.index))
            .sort((a, b) => a.index - b.index);
    }, [classMapping]);

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue || 0);
            setActiveIdx(0);
            if (projectId) {
                try {
                    const raw = localStorage.getItem(`pose-annotator:recent-classes:${projectId}`);
                    const parsed = raw ? JSON.parse(raw) : [];
                    setRecent(Array.isArray(parsed) ? parsed.filter(n => Number.isFinite(n)).slice(0, 8) : []);
                } catch {
                    setRecent([]);
                }
            } else {
                setRecent([]);
            }
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, initialValue]);

    useEffect(() => {
        if (!isOpen) return;
        if (!classOptions.length) return;
        const idx = classOptions.findIndex(o => o.index === (parseInt(initialValue, 10) || 0));
        setActiveIdx(idx >= 0 ? idx : 0);
    }, [classOptions, initialValue, isOpen]);

    const persistRecent = (picked) => {
        if (!projectId) return;
        const next = [picked, ...recent.filter(x => x !== picked)].slice(0, 8);
        setRecent(next);
        try {
            localStorage.setItem(`pose-annotator:recent-classes:${projectId}`, JSON.stringify(next));
        } catch {
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const picked = parseInt(value, 10) || 0;
        persistRecent(picked);
        onSubmit(picked);
        onClose();
    };

    const quickPick = (picked) => {
        persistRecent(picked);
        onSubmit(picked);
        onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
            return;
        }
        if (!classOptions.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = (activeIdx + 1) % classOptions.length;
            setActiveIdx(next);
            setValue(classOptions[next].index);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const next = (activeIdx - 1 + classOptions.length) % classOptions.length;
            setActiveIdx(next);
            setValue(classOptions[next].index);
            return;
        }
        if (e.key === 'Enter') {
            return;
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="modal-overlay modal-overlay-high" onClick={onClose}>
            <div
                className="animate-scale-in modal-panel modal-panel-sm"
                onClick={e => e.stopPropagation()}
                onKeyDown={handleKeyDown}
                tabIndex={-1}
                style={{
                    overflow: 'visible',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                }}
            >
                {/* Top Accent Gradient Bar */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, var(--accent-primary) 0%, #2f81f7 100%)',
                    zIndex: 10
                }} />

                <div className="modal-header-between" style={{ padding: '1.5rem 1.5rem 0 1.5rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="modal-icon modal-icon-accent" style={{ background: 'rgba(88, 166, 255, 0.15)', padding: '10px' }}>
                            <Tag size={20} color="var(--accent-primary)" />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>输入类别 ID</h3>
                    </div>
                    <button onClick={onClose} className="icon-btn hover-card" style={{ padding: '8px', color: 'var(--text-tertiary)' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
                        <div style={{ marginBottom: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label className="form-label" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Class Index
                            </label>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>整数 / 必填</span>
                        </div>

                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                left: '14px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-tertiary)',
                                pointerEvents: 'none'
                            }}>
                                <Hash size={18} />
                            </div>
                            <input
                                ref={inputRef}
                                type="number"
                                min="0"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                className="input-modern"
                                style={{
                                    paddingLeft: '42px',
                                    height: '50px',
                                    fontSize: '1.1rem',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid rgba(255,255,255,0.08)'
                                }}
                            />
                        </div>

                        {recent.length > 0 && (
                            <div style={{ marginTop: '14px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                                    最近使用
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {recent.map((idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => quickPick(idx)}
                                            className="btn-modern-secondary"
                                            style={{ padding: '0 10px', height: '34px', fontSize: '0.85rem' }}
                                        >
                                            {idx}{classMapping && classMapping[idx] ? ` · ${classMapping[idx]}` : ''}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {classOptions.length > 0 && (
                            <div style={{ marginTop: '14px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>类别列表</span>
                                    <span>↑↓ 选择 / Enter 确认</span>
                                </div>
                                <div style={{
                                    maxHeight: '240px',
                                    overflow: 'auto',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'rgba(0,0,0,0.12)'
                                }}>
                                    {classOptions.map((opt, i) => {
                                        const isActive = i === activeIdx;
                                        return (
                                            <button
                                                key={opt.index}
                                                type="button"
                                                onClick={() => quickPick(opt.index)}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    padding: '10px 12px',
                                                    border: 'none',
                                                    background: isActive ? 'rgba(88, 166, 255, 0.15)' : 'transparent',
                                                    color: 'var(--text-primary)',
                                                    display: 'flex',
                                                    gap: '10px',
                                                    alignItems: 'center',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <span style={{
                                                    minWidth: '44px',
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.85rem',
                                                    color: isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)'
                                                }}>
                                                    {opt.index}
                                                </span>
                                                <span style={{ fontSize: '0.9rem', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                                    {opt.name || `Class ${opt.index}`}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="modal-footer" style={{
                        marginTop: 0,
                        padding: '1rem 1.5rem',
                        background: 'rgba(0,0,0,0.15)',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '0.8rem'
                    }}>
                        <button
                            type="button"
                            className="btn-modern-secondary"
                            onClick={onClose}
                            style={{ padding: '0 1.2rem', height: '42px', fontSize: '0.9rem' }}
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="btn-modern-primary"
                            style={{ padding: '0 1.5rem', height: '42px', fontSize: '0.9rem' }}
                        >
                            <Check size={18} /> 确认
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
