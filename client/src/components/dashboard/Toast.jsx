import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export const Toast = ({ notification, onClose }) => {
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                onClose();
            }, notification.type === 'warning' ? 8000 : 5000);
            return () => clearTimeout(timer);
        }
    }, [notification, onClose]);

    if (!notification) return null;

    const getStyles = () => {
        switch (notification.type) {
            case 'success':
                return {
                    background: '#065f46',
                    border: '#10b981',
                    icon: <CheckCircle size={20} />
                };
            case 'warning':
                return {
                    background: '#78350f',
                    border: '#f59e0b',
                    icon: <AlertTriangle size={20} />
                };
            case 'info':
                return {
                    background: '#1e3a5f',
                    border: '#3b82f6',
                    icon: <Info size={20} />
                };
            case 'error':
            default:
                return {
                    background: '#991b1b',
                    border: '#ef4444',
                    icon: <AlertCircle size={20} />
                };
        }
    };

    const styles = getStyles();

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
                background: styles.background,
                border: `1px solid ${styles.border}`,
                borderRadius: '16px',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                maxWidth: '400px'
            }}>
                {styles.icon}
                <span style={{ fontWeight: 600 }}>{notification.message}</span>
            </div>
        </div>,
        document.body
    );
};
