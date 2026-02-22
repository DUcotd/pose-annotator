import React, { useMemo, useRef, useState, useEffect } from 'react';

const TAB_OPTIONS = [
    { id: 'diagnosis', label: '诊断' },
    { id: 'critical', label: '关键事件' },
    { id: 'all', label: '完整事件流' },
    { id: 'stderr', label: '原始 stderr' }
];

const getLevelColor = (level) => {
    switch (level) {
        case 'fatal':
            return '#f43f5e';
        case 'error':
            return '#f87171';
        case 'warn':
            return '#fbbf24';
        case 'info':
            return '#60a5fa';
        default:
            return '#94a3b8';
    }
};

const formatTs = (ts) => {
    if (!ts) return '--';
    const time = new Date(ts);
    if (Number.isNaN(time.getTime())) return '--';
    return time.toLocaleTimeString();
};

const EventRow = ({ event, onClick }) => (
    <button
        type="button"
        onClick={() => onClick(event)}
        style={{
            width: '100%',
            textAlign: 'left',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '10px',
            background: 'rgba(0,0,0,0.18)',
            padding: '0.65rem 0.75rem',
            marginBottom: '0.5rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem'
        }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{formatTs(event.ts)}</span>
            <span style={{
                fontSize: '11px',
                color: getLevelColor(event.level),
                border: `1px solid ${getLevelColor(event.level)}40`,
                background: `${getLevelColor(event.level)}22`,
                borderRadius: '999px',
                padding: '1px 8px',
                fontWeight: 700
            }}>
                {(event.level || 'info').toUpperCase()}
            </span>
            <span style={{ fontSize: '11px', color: '#a78bfa' }}>{event.stage || 'unknown'}</span>
            <span style={{ fontSize: '11px', color: '#4ade80' }}>{event.kind || 'raw'}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>#{event.seq}</span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{event.message || '--'}</div>
        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{event.code || 'NO_CODE'}</div>
    </button>
);

export const LogWorkbench = ({ events = [], diagnosis = null, connectionState = 'unknown' }) => {
    const [activeTab, setActiveTab] = useState('diagnosis');
    const [levelFilter, setLevelFilter] = useState('all');
    const [stageFilter, setStageFilter] = useState('all');
    const [kindFilter, setKindFilter] = useState('all');
    const [codeFilter, setCodeFilter] = useState('');
    const [search, setSearch] = useState('');
    const [sortOrder, setSortOrder] = useState('desc');
    const [autoScroll, setAutoScroll] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState(null);
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
                event.source === 'py_stderr' || String(event.code || '').includes('STDERR') || String(event.code || '').includes('TRACEBACK')
            );
        }
        if (activeTab === 'all') {
            return baseFilteredEvents;
        }
        return baseFilteredEvents;
    }, [activeTab, baseFilteredEvents]);

    useEffect(() => {
        if (!autoScroll || !listRef.current) return;
        listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [displayedEvents, autoScroll]);

    return (
        <div style={{
            flex: 1,
            minHeight: '260px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            <div style={{
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                padding: '0.9rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.7rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {TAB_OPTIONS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    border: 'none',
                                    borderRadius: '999px',
                                    padding: '6px 12px',
                                    background: activeTab === tab.id ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.06)',
                                    color: activeTab === tab.id ? '#c7d2fe' : 'var(--text-secondary)',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        连接: {connectionState}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '8px' }}>
                    <select className="remote-input" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} style={{ fontSize: '12px' }}>
                        <option value="all">level: all</option>
                        <option value="debug">debug</option>
                        <option value="info">info</option>
                        <option value="warn">warn</option>
                        <option value="error">error</option>
                        <option value="fatal">fatal</option>
                    </select>

                    <select className="remote-input" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} style={{ fontSize: '12px' }}>
                        {stageOptions.map((stage) => (
                            <option key={stage} value={stage}>stage: {stage}</option>
                        ))}
                    </select>

                    <select className="remote-input" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} style={{ fontSize: '12px' }}>
                        {kindOptions.map((kind) => (
                            <option key={kind} value={kind}>kind: {kind}</option>
                        ))}
                    </select>

                    <input
                        className="remote-input"
                        type="text"
                        placeholder="code contains..."
                        value={codeFilter}
                        onChange={(e) => setCodeFilter(e.target.value)}
                        style={{ fontSize: '12px' }}
                    />

                    <input
                        className="remote-input"
                        type="text"
                        placeholder="全文搜索..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ fontSize: '12px' }}
                    />

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={() => setSortOrder((prev) => prev === 'asc' ? 'desc' : 'asc')}
                            style={{
                                flex: 1,
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px',
                                background: 'rgba(255,255,255,0.06)',
                                color: 'var(--text-secondary)',
                                fontSize: '12px',
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
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px',
                                background: autoScroll ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)',
                                color: autoScroll ? '#4ade80' : 'var(--text-secondary)',
                                fontSize: '12px',
                                cursor: 'pointer'
                            }}
                        >
                            自动滚动
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'diagnosis' && (
                <div style={{ padding: '0.9rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {!diagnosis ? (
                        <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>暂无诊断信息（训练成功或尚未触发错误）</div>
                    ) : (
                        <div style={{
                            border: '1px solid rgba(248,113,113,0.35)',
                            background: 'rgba(127,29,29,0.2)',
                            borderRadius: '12px',
                            padding: '0.85rem 0.95rem'
                        }}>
                            <div style={{ fontSize: '13px', color: '#fca5a5', fontWeight: 800, marginBottom: '6px' }}>
                                {diagnosis.code} · {diagnosis.stage}
                            </div>
                            <div style={{ color: '#fecaca', fontSize: '14px', fontWeight: 700 }}>{diagnosis.rootCause}</div>
                            <div style={{ marginTop: '6px', fontSize: '12px', color: '#fda4af' }}>
                                firstSeen: {formatTs(diagnosis.firstSeenAt)} · lastSeen: {formatTs(diagnosis.lastSeenAt)}
                            </div>
                            {Array.isArray(diagnosis.suggestions) && diagnosis.suggestions.length > 0 && (
                                <div style={{ marginTop: '10px', fontSize: '12px', color: '#fde68a', whiteSpace: 'pre-wrap' }}>
                                    {diagnosis.suggestions.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}
                                </div>
                            )}
                            {Array.isArray(diagnosis.evidence) && diagnosis.evidence.length > 0 && (
                                <div style={{
                                    marginTop: '10px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '10px',
                                    padding: '8px',
                                    background: 'rgba(0,0,0,0.25)',
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    color: '#fda4af',
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

            <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '0.9rem' }} className="custom-scrollbar">
                {displayedEvents.length === 0 ? (
                    <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '2rem' }}>
                        当前筛选条件下没有日志事件
                    </div>
                ) : (
                    displayedEvents.map((event) => (
                        <EventRow
                            key={`${event.runId || 'legacy'}:${event.seq || event.ts}`}
                            event={event}
                            onClick={setSelectedEvent}
                        />
                    ))
                )}
            </div>

            {selectedEvent && (
                <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    padding: '0.9rem 1rem',
                    background: 'rgba(2,6,23,0.5)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 700 }}>
                            事件详情 · {selectedEvent.code}
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedEvent(null)}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-tertiary)',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            关闭
                        </button>
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        [{formatTs(selectedEvent.ts)}] {selectedEvent.message}
                    </div>
                    {selectedEvent.details && (
                        <pre style={{
                            marginTop: '8px',
                            background: 'rgba(0,0,0,0.25)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '10px',
                            padding: '8px',
                            color: '#93c5fd',
                            fontSize: '12px',
                            overflowX: 'auto',
                            maxHeight: '140px'
                        }}>
                            {JSON.stringify(selectedEvent.details, null, 2)}
                        </pre>
                    )}
                    {selectedEvent.raw && (
                        <pre style={{
                            marginTop: '8px',
                            background: 'rgba(0,0,0,0.25)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '10px',
                            padding: '8px',
                            color: '#fca5a5',
                            fontSize: '12px',
                            overflowX: 'auto',
                            maxHeight: '100px'
                        }}>
                            {selectedEvent.raw}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
};

