import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertCircle } from 'lucide-react';

export const Toast = ({ notification, onClose }) => {
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                onClose();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [notification, onClose]);

    if (!notification) return null;

    return createPortal(
        <div style={{
            position: 'fixed',
            bottom: '40px',
            right: '40px',
            zIndex: 9999,
            animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
            <div style={{
                padding: '16px 24px',
                background: notification.type === 'success' ? '#065f46' : '#991b1b',
                border: `1px solid ${notification.type === 'success' ? '#10b981' : '#ef4444'}`,
                borderRadius: '16px',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
            }}>
                {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                <span style={{ fontWeight: 600 }}>{notification.message}</span>
            </div>
        </div>,
        document.body
    );
};
