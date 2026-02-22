import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export const StatBadge = ({ icon: Icon, label, value, color, gradient }) => (
    <div
        className="tw-card-soft tw-fade-in"
        style={{
            background: gradient || `linear-gradient(145deg, rgba(${color}, 0.14), rgba(15,23,42,0.36))`,
            border: `1px solid rgba(${color}, 0.28)`,
            padding: '0.82rem 0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            minHeight: '72px'
        }}
    >
        <div
            style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: `linear-gradient(140deg, rgba(${color},0.2), rgba(2,6,23,0.42))`,
                border: `1px solid rgba(${color}, 0.36)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: `rgb(${color})`
            }}
        >
            <Icon size={20} />
        </div>
        <div>
            <div style={{ fontSize: '10px', color: '#90a0bc', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.65px' }}>{label}</div>
            <div style={{ fontSize: '1.18rem', fontWeight: 800, color: '#e7edf8', marginTop: '2px' }}>{value}</div>
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
                stroke="rgba(148,163,184,0.28)"
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
                    <stop offset="0%" stopColor="#14b8a6" />
                    <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
            </defs>
        </svg>
    );
};

export const SectionCard = ({ icon: Icon, title, color, gradient, children, collapsible = false, defaultCollapsed = false, statusSummary = null }) => {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
    
    const handleToggle = () => {
        if (collapsible) {
            setIsCollapsed(!isCollapsed);
        }
    };
    
    return (
        <div className="tw-section-card tw-fade-in">
            <div
                className="tw-section-header"
                style={{
                    marginBottom: isCollapsed ? 0 : '0.95rem',
                    cursor: collapsible ? 'pointer' : 'default'
                }}
                onClick={handleToggle}
            >
                {collapsible && (
                    <div style={{ color: '#9aaccc', display: 'flex', alignItems: 'center', transition: 'transform 0.2s ease' }}>
                        {isCollapsed ? (
                            <ChevronRight size={16} />
                        ) : (
                            <ChevronDown size={16} />
                        )}
                    </div>
                )}
                <div
                    className="tw-section-icon"
                    style={{
                    background: gradient || `linear-gradient(145deg, rgba(${color},0.2), rgba(2,6,23,0.46))`,
                    color: `rgb(${color})`,
                    }}
                >
                    <Icon size={18} />
                </div>
                <h3 className="tw-section-title">{title}</h3>
                {isCollapsed && statusSummary && (
                    <span className="tw-section-summary">
                        {statusSummary}
                    </span>
                )}
            </div>
            <div
                style={{
                    maxHeight: isCollapsed ? 0 : '2200px',
                    overflow: 'hidden',
                    transition: 'max-height 0.25s ease, opacity 0.2s ease',
                    opacity: isCollapsed ? 0 : 1
                }}
            >
                {children}
            </div>
        </div>
    );
};

export const Toggle = ({ checked, onChange, label, desc, disabled = false }) => (
    <label
        className="tw-toggle"
        style={{
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1
        }}
    >
        <div>
            <div className="tw-toggle-title">{label}</div>
            {desc && <div className="tw-toggle-desc">{desc}</div>}
        </div>
        <div className={`tw-toggle-track ${checked ? 'checked' : ''}`}>
            <div className={`tw-toggle-dot ${checked ? 'checked' : ''}`} />
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                style={{ opacity: 0, width: 0, height: 0 }}
            />
        </div>
    </label>
);
