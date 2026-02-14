import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = '确定', cancelText = '取消', type = 'danger' }) => {
    if (!isOpen) return null;

    const isDanger = type === 'danger';

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                className="animate-scale-in modal-panel"
                style={{
                    maxWidth: '480px',
                    background: '#0d1117',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                    padding: 0,
                    position: 'relative',
                    borderRadius: '24px',
                    overflow: 'hidden'
                }}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        right: '20px',
                        top: '20px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '10px',
                        cursor: 'pointer',
                        color: 'var(--text-tertiary)',
                        transition: 'all 0.2s',
                        zIndex: 10
                    }}
                    className="hover-card"
                >
                    <X size={20} />
                </button>

                {/* Progress Bar (Danger themed if applicable) */}
                <div style={{
                    height: '6px',
                    background: isDanger ? 'linear-gradient(to right, #ef4444, #f87171)' : 'linear-gradient(to right, #4da1ff, #34d399)',
                    width: '100%',
                    opacity: 0.8
                }} />

                <div style={{ padding: '3.5rem 3rem 2rem 3rem' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: isDanger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(77, 161, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1.8rem',
                        border: `1px solid ${isDanger ? 'rgba(239, 68, 68, 0.2)' : 'rgba(77, 161, 255, 0.2)'}`,
                        color: isDanger ? '#ef4444' : '#4da1ff',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                    }}>
                        <AlertTriangle size={32} strokeWidth={2.5} />
                    </div>

                    <h3 style={{
                        margin: '0 0 1rem 0',
                        fontSize: '1.8rem',
                        fontWeight: 800,
                        letterSpacing: '-0.8px',
                        color: 'var(--text-primary)',
                        lineHeight: 1.1
                    }}>
                        {title}
                    </h3>
                    <p style={{
                        margin: 0,
                        color: 'var(--text-secondary)',
                        fontSize: '1.05rem',
                        lineHeight: 1.6,
                        fontWeight: 400,
                        opacity: 0.9
                    }}>
                        {message}
                    </p>
                </div>

                <div style={{
                    padding: '2rem 3rem',
                    background: 'rgba(0,0,0,0.25)',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '1.2rem'
                }}>
                    <button
                        type="button"
                        className="btn-modern-secondary"
                        onClick={onClose}
                        style={{ height: '52px', padding: '0 2rem' }}
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        className={isDanger ? "btn-modern-danger" : "btn-modern-primary"}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        style={{
                            height: '52px',
                            padding: '0 2.5rem',
                            minWidth: '140px',
                            borderRadius: '14px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            background: isDanger ? 'linear-gradient(135deg, #ef4444, #dc2626)' : undefined,
                            color: 'white',
                            border: 'none',
                            boxShadow: isDanger ? '0 4px 12px rgba(239, 68, 68, 0.3)' : undefined
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
