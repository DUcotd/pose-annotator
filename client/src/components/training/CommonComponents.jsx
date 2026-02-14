import React from 'react';

export const StatBadge = ({ icon: Icon, label, value, color, gradient }) => (
    <div style={{
        background: gradient || `rgba(${color}, 0.1)`,
        border: `1px solid rgba(${color}, 0.2)`,
        borderRadius: '14px',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flex: 1
    }}>
        <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: `rgba(${color}, 0.15)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: `rgb(${color})`
        }}>
            <Icon size={20} />
        </div>
        <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{label}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
        </div>
    </div>
);

export const ProgressRing = ({ progress, size = 120, strokeWidth = 10 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={strokeWidth}
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="url(#progressGradient)"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
            <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#4ade80" />
                </linearGradient>
            </defs>
        </svg>
    );
};

export const SectionCard = ({ icon: Icon, title, color, gradient, children }) => (
    <div style={{
        background: 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '24px',
        padding: '1.75rem'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '1.5rem' }}>
            <div style={{
                background: gradient || `rgba(${color}, 0.12)`,
                color: `rgb(${color})`,
                padding: '12px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Icon size={22} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
        </div>
        {children}
    </div>
);

export const Toggle = ({ checked, onChange, label, desc }) => (
    <label style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.25rem',
        borderRadius: '14px',
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        transition: 'all 0.25s ease'
    }}>
        <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
            {desc && <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{desc}</div>}
        </div>
        <div style={{
            width: '44px',
            height: '24px',
            borderRadius: '12px',
            background: checked ? 'linear-gradient(135deg, #22c55e, #4ade80)' : 'rgba(255,255,255,0.1)',
            position: 'relative',
            transition: 'all 0.3s ease'
        }}>
            <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: '3px',
                left: checked ? '23px' : '3px',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }} />
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                style={{ opacity: 0, width: 0, height: 0 }}
            />
        </div>
    </label>
);
