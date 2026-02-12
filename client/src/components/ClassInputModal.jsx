import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, Tag, X, Hash } from 'lucide-react';

export const ClassInputModal = ({ isOpen, onClose, onSubmit, initialValue }) => {
    const [value, setValue] = useState(initialValue || 0);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue || 0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, initialValue]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(parseInt(value) || 0);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="modal-overlay modal-overlay-high" onClick={onClose}>
            <div
                className="animate-scale-in modal-panel modal-panel-sm"
                onClick={e => e.stopPropagation()}
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
