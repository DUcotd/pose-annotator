import React, { useMemo, useRef, useState, useEffect } from 'react';

const TAB_OPTIONS = [
    { id: 'diagnosis', label: '诊断' },
    { id: 'critical', label: '关键事件' },
    { id: 'all', label: '完整事件流' },
    { id: 'stderr', label: '原始 stderr' }
];

const LEVEL_OPTIONS = ['all', 'debug', 'info', 'warn', 'error', 'fatal'];

const CONTROL_STYLE = {
    height: '38px',
    borderRadius: '10px',
    border: '1px solid rgba(148,163,184,0.28)',
    background: 'rgba(15,23,42,0.72)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    padding: '0 10px',
    outline: 'none',
    width: '100%',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
};

const getLevelTheme = (level) => {
    switch (level) {
        case 'fatal':
            return { text: '#f43f5e', border: 'rgba(244,63,94,0.35)', bg: 'rgba(244,63,94,0.16)' };
        case 'error':
            return { text: '#f87171', border: 'rgba(248,113,113,0.35)', bg: 'rgba(248,113,113,0.16)' };
        case 'warn':
            return { text: '#fbbf24', border: 'rgba(251,191,36,0.35)', bg: 'rgba(251,191,36,0.15)' };
        case 'debug':
            return { text: '#8b9bb6', border: 'rgba(139,155,182,0.35)', bg: 'rgba(139,155,182,0.14)' };
        case 'info':
            return { text: '#60a5fa', border: 'rgba(96,165,250,0.35)', bg: 'rgba(96,165,250,0.14)' };
        default:
            return { text: '#94a3b8', border: 'rgba(148,163,184,0.32)', bg: 'rgba(148,163,184,0.12)' };
    }
};

const getConnectionMeta = (state) => {
    const normalized = String(state || '').toLowerCase();
    if (normalized === 'connected') {
        return { label: 'SSE 已连接', color: '#22c55e', bg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.35)' };
    }
    if (normalized === 'polling') {
        return { label: '轮询兜底中', color: '#f59e0b', bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.35)' };
    }
    if (normalized === 'reconnecting') {
        return { label: '重连中', color: '#f59e0b', bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.35)' };
    }
    if (normalized === 'connecting') {
        return { label: '连接中', color: '#60a5fa', bg: 'rgba(96,165,250,0.2)', border: 'rgba(96,165,250,0.35)' };
    }
    if (normalized === 'disconnected') {
        return { label: '已断开', color: '#94a3b8', bg: 'rgba(148,163,184,0.16)', border: 'rgba(148,163,184,0.3)' };
    }
    return { label: `连接: ${state || 'unknown'}`, color: '#94a3b8', bg: 'rgba(148,163,184,0.16)', border: 'rgba(148,163,184,0.3)' };
};

const formatTs = (ts) => {
    if (!ts) return '--';
    const time = new Date(ts);
    if (Number.isNaN(time.getTime())) return '--';
    return time.toLocaleTimeString();
};

const EventRow = ({ event, onClick, selected }) => {
    const levelTheme = getLevelTheme(event.level);
    return (
        <button
            type="button"
            onClick={() => onClick(event)}
            className={`tw-log-row ${selected ? 'is-selected' : ''}`}
            style={{
                width: '100%',
                textAlign: 'left',
                border: selected ? `1px solid ${levelTheme.border}` : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                background: selected ? 'linear-gradient(160deg, rgba(10,28,35,0.9), rgba(8,22,33,0.84))' : 'rgba(5,10,18,0.55)',
                padding: '0.75rem 0.85rem',
                marginBottom: '0.55rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{formatTs(event.ts)}</span>
                <span style={{
                    fontSize: '11px',
                    color: levelTheme.text,
                    border: `1px solid ${levelTheme.border}`,
                    background: levelTheme.bg,
                    borderRadius: '999px',
                    padding: '2px 8px',
                    fontWeight: 800
                }}>
                    {(event.level || 'info').toUpperCase()}
                </span>
                <span style={{
                    fontSize: '11px',
                    color: '#93c5fd',
                    border: '1px solid rgba(96,165,250,0.25)',
                    background: 'rgba(96,165,250,0.12)',
                    borderRadius: '999px',
                    padding: '2px 8px'
                }}>
                    {event.stage || 'unknown'}
                </span>
                <span style={{
                    fontSize: '11px',
                    color: '#86efac',
                    border: '1px solid rgba(74,222,128,0.25)',
                    background: 'rgba(74,222,128,0.12)',
                    borderRadius: '999px',
                    padding: '2px 8px'
                }}>
                    {event.kind || 'raw'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>#{event.seq}</span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 700, lineHeight: 1.4 }}>
                {event.message || '--'}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.2px' }}>
                {event.code || 'NO_CODE'}
            </div>
        </button>
    );
};

export const LogWorkbench = ({ events = [], diagnosis = null, connectionState = 'unknown' }) => {
    const [activeTab, setActiveTab] = useState('diagnosis');
    const [levelFilter, setLevelFilter] = useState('all');
    const [stageFilter, setStageFilter] = useState('all');
    const [kindFilter, setKindFilter] = useState('all');
    const [codeFilter, setCodeFilter] = useState('');
    const [search, setSearch] = useState('');
    const [sortOrder, setSortOrder] = useState('desc');
    const [autoScroll, setAutoScroll] = useState(true);
    const [showControls, setShowControls] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const listRef = useRef(null);

    const stageOptions = useMemo(() => {
        const all = new Set(events.map((event) => event.stage).filter(Boolean));
        return ['all', ...Array.from(all)];
    }, [events]);

    const kindOptions = useMemo(() => {
        const all = new Set(events.map((event) => event.kind).filter(Boolean));
        return ['all', ...Array.from(all)];
    }, [events]);

    const baseFilteredEvents = useMemo(() => {
        let list = [...events];

        if (levelFilter !== 'all') {
            list = list.filter((event) => event.level === levelFilter);
        }
        if (stageFilter !== 'all') {
            list = list.filter((event) => event.stage === stageFilter);
        }
        if (kindFilter !== 'all') {
            list = list.filter((event) => event.kind === kindFilter);
        }
        if (codeFilter.trim()) {
            const codeQuery = codeFilter.trim().toLowerCase();
            list = list.filter((event) => String(event.code || '').toLowerCase().includes(codeQuery));
        }
        if (search.trim()) {
            const text = search.trim().toLowerCase();
            list = list.filter((event) => {
                const haystack = [
                    event.message,
                    event.code,
                    event.stage,
                    event.kind,
                    event.level,
                    event.raw,
                    event.details ? JSON.stringify(event.details) : ''
                ].filter(Boolean).join(' ').toLowerCase();
                return haystack.includes(text);
            });
        }

        list.sort((a, b) => {
            const diff = Number(a.seq || 0) - Number(b.seq || 0);
            return sortOrder === 'asc' ? diff : -diff;
        });

        return list;
    }, [events, levelFilter, stageFilter, kindFilter, codeFilter, search, sortOrder]);

    const displayedEvents = useMemo(() => {
        if (activeTab === 'critical') {
            return baseFilteredEvents.filter((event) =>
                event.level === 'error' ||
                event.level === 'fatal' ||
                event.level === 'warn' ||
                event.kind === 'diagnostic'
            );
        }

        if (activeTab === 'stderr') {
            return baseFilteredEvents.filter((event) =>
                event.source === 'py_stderr' ||
                String(event.code || '').includes('STDERR') ||
                String(event.code || '').includes('TRACEBACK')
            );
        }

        if (activeTab === 'diagnosis') {
            return baseFilteredEvents.filter((event) =>
                event.kind === 'diagnostic' ||
                event.level === 'error' ||
                event.level === 'fatal' ||
                event.level === 'warn'
            );
        }

        return baseFilteredEvents;
    }, [activeTab, baseFilteredEvents]);

    useEffect(() => {
        if (!autoScroll || !listRef.current) return;
        listRef.current.scrollTop = sortOrder === 'desc' ? 0 : listRef.current.scrollHeight;
    }, [displayedEvents, autoScroll, sortOrder]);

    useEffect(() => {
        if (!selectedEvent) return;
        const exists = displayedEvents.some(
            (event) => String(event.seq) === String(selectedEvent.seq) && event.runId === selectedEvent.runId
        );
        if (!exists) {
            setSelectedEvent(null);
        }
    }, [displayedEvents, selectedEvent]);

    const connectionMeta = getConnectionMeta(connectionState);

    const resetFilters = () => {
        setLevelFilter('all');
        setStageFilter('all');
        setKindFilter('all');
        setCodeFilter('');
        setSearch('');
    };

    const hasActiveFilter = levelFilter !== 'all' || stageFilter !== 'all' || kindFilter !== 'all' || codeFilter.trim() || search.trim();
    const activeFilterCount = [
        levelFilter !== 'all',
        stageFilter !== 'all',
        kindFilter !== 'all',
        Boolean(codeFilter.trim()),
        Boolean(search.trim())
    ].filter(Boolean).length;

    const diagnosisTone = diagnosis?.status === 'warning'
        ? {
            border: 'rgba(251,191,36,0.34)',
            bg: 'rgba(120,53,15,0.28)',
            title: '#fcd34d',
            text: '#fde68a'
        }
        : {
            border: 'rgba(248,113,113,0.34)',
            bg: 'rgba(127,29,29,0.28)',
            title: '#fca5a5',
            text: '#fecaca'
        };

    const handleSelectEvent = (event) => {
        setSelectedEvent(event);
        setDetailOpen(true);
    };

    return (
        <div style={{
            flex: 1,
            minHeight: '420px',
            background: 'linear-gradient(165deg, rgba(7,12,24,0.95), rgba(8,14,28,0.9))',
            borderRadius: '20px',
            border: '1px solid rgba(148,163,184,0.18)',
            boxShadow: '0 16px 36px rgba(2,6,23,0.45)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
        }}>
            <div style={{
                borderBottom: '1px solid rgba(148,163,184,0.18)',
                padding: '0.95rem 1rem 0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {TAB_OPTIONS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    border: activeTab === tab.id ? '1px solid rgba(20,184,166,0.5)' : '1px solid rgba(148,163,184,0.2)',
                                    borderRadius: '999px',
                                    padding: '6px 12px',
                                    background: activeTab === tab.id ? 'rgba(20,184,166,0.2)' : 'rgba(148,163,184,0.12)',
                                    color: activeTab === tab.id ? '#99f6e4' : '#cbd5e1',
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    letterSpacing: '0.2px'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => setShowControls((prev) => !prev)}
                            style={{
                                fontSize: '11px',
                                color: showControls ? '#99f6e4' : '#cbd5e1',
                                border: showControls ? '1px solid rgba(20,184,166,0.45)' : '1px solid rgba(148,163,184,0.25)',
                                background: showControls ? 'rgba(20,184,166,0.2)' : 'rgba(148,163,184,0.1)',
                                borderRadius: '999px',
                                padding: '4px 10px',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            {showControls ? '收起控制' : '筛选与排序'}
                        </button>
                        <span style={{
                            fontSize: '11px',
                            color: connectionMeta.color,
                            border: `1px solid ${connectionMeta.border}`,
                            background: connectionMeta.bg,
                            borderRadius: '999px',
                            padding: '4px 10px',
                            fontWeight: 800
                        }}>
                            {connectionMeta.label}
                        </span>
                        <span style={{
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            border: '1px solid rgba(148,163,184,0.25)',
                            background: 'rgba(148,163,184,0.1)',
                            borderRadius: '999px',
                            padding: '4px 10px',
                            fontWeight: 700
                        }}>
                            {displayedEvents.length} 条
                        </span>
                        {hasActiveFilter && (
                            <span style={{
                                fontSize: '11px',
                                color: '#fde68a',
                                border: '1px solid rgba(251,191,36,0.35)',
                                background: 'rgba(251,191,36,0.14)',
                                borderRadius: '999px',
                                padding: '4px 10px',
                                fontWeight: 700
                            }}>
                                已筛选 {activeFilterCount}
                            </span>
                        )}
                        {selectedEvent && (
                            <button
                                type="button"
                                onClick={() => setDetailOpen(true)}
                                style={{
                                    fontSize: '11px',
                                    color: '#99f6e4',
                                    border: '1px solid rgba(20,184,166,0.4)',
                                    background: 'rgba(20,184,166,0.2)',
                                    borderRadius: '999px',
                                    padding: '4px 10px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                查看事件详情
                            </button>
                        )}
                    </div>
                </div>

                {showControls && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                            <select
                                value={levelFilter}
                                onChange={(e) => setLevelFilter(e.target.value)}
                                style={{ ...CONTROL_STYLE, appearance: 'none' }}
                            >
                                {LEVEL_OPTIONS.map((level) => (
                                    <option key={level} value={level}>
                                        level: {level}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={stageFilter}
                                onChange={(e) => setStageFilter(e.target.value)}
                                style={{ ...CONTROL_STYLE, appearance: 'none' }}
                            >
                                {stageOptions.map((stage) => (
                                    <option key={stage} value={stage}>
                                        stage: {stage}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={kindFilter}
                                onChange={(e) => setKindFilter(e.target.value)}
                                style={{ ...CONTROL_STYLE, appearance: 'none' }}
                            >
                                {kindOptions.map((kind) => (
                                    <option key={kind} value={kind}>
                                        kind: {kind}
                                    </option>
                                ))}
                            </select>

                            <input
                                type="text"
                                placeholder="code 过滤..."
                                value={codeFilter}
                                onChange={(e) => setCodeFilter(e.target.value)}
                                style={CONTROL_STYLE}
                            />

                            <input
                                type="text"
                                placeholder="全文搜索..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={CONTROL_STYLE}
                            />

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setSortOrder((prev) => prev === 'asc' ? 'desc' : 'asc')}
                                    style={{
                                        flex: 1,
                                        height: '38px',
                                        border: '1px solid rgba(148,163,184,0.28)',
                                        borderRadius: '10px',
                                        background: 'rgba(148,163,184,0.12)',
                                        color: '#dbe4f2',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {sortOrder === 'asc' ? '时间升序' : '时间降序'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAutoScroll((prev) => !prev)}
                                    style={{
                                        flex: 1,
                                        height: '38px',
                                        border: `1px solid ${autoScroll ? 'rgba(34,197,94,0.36)' : 'rgba(148,163,184,0.28)'}`,
                                        borderRadius: '10px',
                                        background: autoScroll ? 'rgba(22,163,74,0.24)' : 'rgba(148,163,184,0.12)',
                                        color: autoScroll ? '#86efac' : '#dbe4f2',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    自动滚动
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                当前视图: {TAB_OPTIONS.find((item) => item.id === activeTab)?.label}
                            </div>
                            <button
                                type="button"
                                onClick={resetFilters}
                                disabled={!hasActiveFilter}
                                style={{
                                    border: '1px solid rgba(148,163,184,0.28)',
                                    borderRadius: '10px',
                                    background: hasActiveFilter ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.06)',
                                    color: hasActiveFilter ? '#dbe4f2' : 'var(--text-tertiary)',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    height: '32px',
                                    padding: '0 12px',
                                    cursor: hasActiveFilter ? 'pointer' : 'not-allowed'
                                }}
                            >
                                清空筛选
                            </button>
                        </div>
                    </>
                )}
            </div>

            {activeTab === 'diagnosis' && (
                <div style={{ padding: '0.95rem 1rem', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>
                    {!diagnosis ? (
                        <div style={{
                            border: '1px solid rgba(148,163,184,0.24)',
                            background: 'rgba(30,41,59,0.26)',
                            borderRadius: '12px',
                            padding: '0.9rem 1rem',
                            color: 'var(--text-secondary)',
                            fontSize: '13px'
                        }}>
                            当前没有可用诊断卡，训练成功或尚未触发关键错误。
                        </div>
                    ) : (
                        <div style={{
                            border: `1px solid ${diagnosisTone.border}`,
                            background: diagnosisTone.bg,
                            borderRadius: '12px',
                            padding: '0.9rem 1rem'
                        }}>
                            <div style={{ fontSize: '12px', color: diagnosisTone.title, fontWeight: 800, marginBottom: '6px' }}>
                                {diagnosis.code} · {diagnosis.stage}
                            </div>
                            <div style={{ color: diagnosisTone.text, fontSize: '14px', fontWeight: 800, lineHeight: 1.4 }}>
                                {diagnosis.rootCause}
                            </div>
                            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                firstSeen: {formatTs(diagnosis.firstSeenAt)} · lastSeen: {formatTs(diagnosis.lastSeenAt)}
                            </div>
                            {Array.isArray(diagnosis.suggestions) && diagnosis.suggestions.length > 0 && (
                                <div style={{
                                    marginTop: '10px',
                                    fontSize: '12px',
                                    color: '#fde68a',
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: 1.45
                                }}>
                                    {diagnosis.suggestions.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}
                                </div>
                            )}
                            {Array.isArray(diagnosis.evidence) && diagnosis.evidence.length > 0 && (
                                <div style={{
                                    marginTop: '10px',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '10px',
                                    padding: '8px',
                                    background: 'rgba(0,0,0,0.26)',
                                    fontFamily: 'Consolas, Monaco, monospace',
                                    fontSize: '12px',
                                    color: '#fecaca',
                                    maxHeight: '120px',
                                    overflowY: 'auto'
                                }}>
                                    {diagnosis.evidence.join('\n')}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div
                ref={listRef}
                style={{ flex: 1, minHeight: '240px', overflowY: 'auto', padding: '0.95rem' }}
                className="custom-scrollbar"
            >
                {displayedEvents.length === 0 ? (
                    <div style={{
                        color: 'var(--text-tertiary)',
                        textAlign: 'center',
                        marginTop: '2rem',
                        padding: '2rem 1rem',
                        borderRadius: '12px',
                        border: '1px dashed rgba(148,163,184,0.2)',
                        background: 'rgba(15,23,42,0.26)'
                    }}>
                        当前筛选条件下没有日志事件
                    </div>
                ) : (
                    displayedEvents.map((event) => (
                        <EventRow
                            key={`${event.runId || 'legacy'}:${event.seq || event.ts}`}
                            event={event}
                            selected={selectedEvent && String(selectedEvent.seq) === String(event.seq) && selectedEvent.runId === event.runId}
                            onClick={handleSelectEvent}
                        />
                    ))
                )}
            </div>

            {selectedEvent && detailOpen && (
                <div
                    role="presentation"
                    onClick={() => setDetailOpen(false)}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(2,6,23,0.66)',
                        backdropFilter: 'blur(2px)',
                        zIndex: 20
                    }}
                >
                    <div
                        role="dialog"
                        aria-label="事件详情"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'absolute',
                            right: '12px',
                            top: '12px',
                            bottom: '12px',
                            width: 'min(560px, calc(100% - 24px))',
                            border: '1px solid rgba(148,163,184,0.28)',
                            borderRadius: '14px',
                            background: 'linear-gradient(165deg, rgba(7,12,24,0.98), rgba(12,20,36,0.96))',
                            boxShadow: '0 20px 40px rgba(2,6,23,0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{
                            borderBottom: '1px solid rgba(148,163,184,0.22)',
                            padding: '0.9rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px'
                        }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 800 }}>
                                事件详情 · {selectedEvent.code}
                            </div>
                            <button
                                type="button"
                                onClick={() => setDetailOpen(false)}
                                style={{
                                    border: '1px solid rgba(148,163,184,0.25)',
                                    borderRadius: '8px',
                                    background: 'rgba(148,163,184,0.12)',
                                    color: '#dbe4f2',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    padding: '4px 10px'
                                }}
                            >
                                关闭
                            </button>
                        </div>

                        <div style={{ padding: '0.9rem 1rem', overflowY: 'auto', minHeight: 0 }} className="custom-scrollbar">
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                                [{formatTs(selectedEvent.ts)}] {selectedEvent.message}
                            </div>

                            {selectedEvent.details && (
                                <pre style={{
                                    marginTop: '10px',
                                    background: 'rgba(15,23,42,0.65)',
                                    border: '1px solid rgba(96,165,250,0.25)',
                                    borderRadius: '10px',
                                    padding: '10px',
                                    color: '#bfdbfe',
                                    fontSize: '12px',
                                    overflowX: 'auto',
                                    maxHeight: '280px'
                                }}>
                                    {JSON.stringify(selectedEvent.details, null, 2)}
                                </pre>
                            )}

                            {selectedEvent.raw && (
                                <pre style={{
                                    marginTop: '10px',
                                    background: 'rgba(15,23,42,0.65)',
                                    border: '1px solid rgba(248,113,113,0.25)',
                                    borderRadius: '10px',
                                    padding: '10px',
                                    color: '#fca5a5',
                                    fontSize: '12px',
                                    overflowX: 'auto',
                                    maxHeight: '280px'
                                }}>
                                    {selectedEvent.raw}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
