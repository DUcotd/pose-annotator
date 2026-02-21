import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from '../api.js';

export function deriveSessionPhase({
    conflictInfo,
    isLoaded,
    lastLoadError,
    saveStatus,
    hasUnsavedChanges
}) {
    if (conflictInfo) return 'conflict';
    if (!isLoaded) return 'loading';
    if (lastLoadError) return 'error';
    if (saveStatus === 'saving') return 'saving';
    if (hasUnsavedChanges) return 'dirty';
    return 'ready';
}

const SAVE_IDLE_TIMEOUT_MS = 8000;
const SAVE_IDLE_POLL_MS = 40;

export const useAnnotationSession = ({ projectId, imageId }) => {
    const [annotations, setAnnotations] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [saveStatus, setSaveStatus] = useState('saved');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [lastLoadError, setLastLoadError] = useState(null);
    const [lastSaveError, setLastSaveError] = useState(null);
    const [lastLoadTime, setLastLoadTime] = useState(null);
    const [lastSaveTime, setLastSaveTime] = useState(null);
    const [annotationEtag, setAnnotationEtag] = useState(null);
    const [conflictInfo, setConflictInfo] = useState(null);
    const [blockedNavigation, setBlockedNavigation] = useState(null);

    const loadSeqRef = useRef(0);
    const sessionEpochRef = useRef(0);
    const abortRef = useRef(null);
    const saveInFlightRef = useRef(false);
    const queuedSaveRef = useRef(false);
    const autosaveTimerRef = useRef(null);

    // Keep the latest annotations snapshot/version for queued saves.
    const annotationsRef = useRef([]);
    const annotationVersionRef = useRef(0);

    // Mirror key state in refs to avoid stale closures in async paths.
    const isLoadedRef = useRef(false);
    const hasUnsavedChangesRef = useRef(false);
    const lastLoadErrorRef = useRef(null);
    const annotationEtagRef = useRef(null);
    const conflictInfoRef = useRef(null);
    const saveStatusRef = useRef('saved');

    const phase = useMemo(() => deriveSessionPhase({
        conflictInfo,
        isLoaded,
        lastLoadError,
        saveStatus,
        hasUnsavedChanges
    }), [conflictInfo, hasUnsavedChanges, isLoaded, lastLoadError, saveStatus]);

    useEffect(() => { annotationsRef.current = annotations; }, [annotations]);
    useEffect(() => { isLoadedRef.current = isLoaded; }, [isLoaded]);
    useEffect(() => { hasUnsavedChangesRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);
    useEffect(() => { lastLoadErrorRef.current = lastLoadError; }, [lastLoadError]);
    useEffect(() => { annotationEtagRef.current = annotationEtag; }, [annotationEtag]);
    useEffect(() => { conflictInfoRef.current = conflictInfo; }, [conflictInfo]);
    useEffect(() => { saveStatusRef.current = saveStatus; }, [saveStatus]);

    const clearAutosaveTimer = useCallback(() => {
        if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
        }
    }, []);

    const hardReset = useCallback(() => {
        clearAutosaveTimer();
        queuedSaveRef.current = false;
        annotationVersionRef.current = 0;
        annotationsRef.current = [];

        setAnnotations([]);
        setIsLoaded(false);
        setSaveStatus('saved');
        setHasUnsavedChanges(false);
        setLastLoadError(null);
        setLastSaveError(null);
        setLastLoadTime(null);
        setLastSaveTime(null);
        setAnnotationEtag(null);
        setConflictInfo(null);
        setBlockedNavigation(null);
    }, [clearAutosaveTimer]);

    const load = useCallback(() => {
        if (!projectId || !imageId) {
            hardReset();
            return;
        }

        const seq = ++loadSeqRef.current;
        const epoch = ++sessionEpochRef.current;
        if (abortRef.current) abortRef.current.abort();

        const controller = new AbortController();
        abortRef.current = controller;

        clearAutosaveTimer();
        queuedSaveRef.current = false;
        annotationVersionRef.current = 0;
        annotationsRef.current = [];

        setIsLoaded(false);
        setLastLoadError(null);
        setLastSaveError(null);
        setConflictInfo(null);
        setBlockedNavigation(null);
        setSaveStatus('saved');
        setHasUnsavedChanges(false);
        setAnnotations([]);
        setAnnotationEtag(null);

        fetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}/annotations/${encodeURIComponent(imageId)}`), { signal: controller.signal })
            .then(async res => {
                if (!res.ok) {
                    const t = await res.text().catch(() => '');
                    throw new Error(t ? `HTTP ${res.status}: ${t}` : `HTTP ${res.status}`);
                }
                const etag = res.headers.get('etag');
                const data = await res.json();
                return { data, etag };
            })
            .then(({ data, etag }) => {
                if (seq !== loadSeqRef.current) return;
                if (epoch !== sessionEpochRef.current) return;

                const normalized = Array.isArray(data) ? data : [];
                annotationVersionRef.current = 0;
                annotationsRef.current = normalized;

                setAnnotationEtag(etag || null);
                setAnnotations(normalized);
                setIsLoaded(true);
                setLastLoadTime(Date.now());
            })
            .catch(err => {
                if (controller.signal.aborted) return;
                if (seq !== loadSeqRef.current) return;
                if (epoch !== sessionEpochRef.current) return;
                setLastLoadError(err?.message ? String(err.message) : String(err));
                setIsLoaded(true);
            });
    }, [clearAutosaveTimer, hardReset, imageId, projectId]);

    useEffect(() => {
        load();
        return () => {
            if (abortRef.current) abortRef.current.abort();
            clearAutosaveTimer();
        };
    }, [clearAutosaveTimer, load]);

    const applyUserAnnotations = useCallback((nextOrUpdater) => {
        setAnnotations(prev => {
            const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater;
            const normalized = Array.isArray(next) ? next : [];
            annotationsRef.current = normalized;
            annotationVersionRef.current += 1;
            return normalized;
        });
        setHasUnsavedChanges(true);

        // User edits after a save error should allow normal autosave retry path.
        if (saveStatusRef.current === 'error') {
            setSaveStatus('saved');
            setLastSaveError(null);
        }
    }, []);

    const saveOnce = useCallback(async ({ force = false, epoch }) => {
        const requestVersion = annotationVersionRef.current;
        const snapshot = annotationsRef.current;

        const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}/annotations/${encodeURIComponent(imageId)}`), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(!force && annotationEtagRef.current ? { 'If-Match': annotationEtagRef.current } : {})
            },
            body: JSON.stringify(snapshot)
        });

        if (epoch !== sessionEpochRef.current) {
            return { ok: false, stale: true };
        }

        if (response.ok) {
            const newEtag = response.headers.get('etag');
            if (newEtag) {
                annotationEtagRef.current = newEtag;
                setAnnotationEtag(newEtag);
            }

            setSaveStatus('saved');
            setLastSaveError(null);
            setLastSaveTime(Date.now());

            if (requestVersion === annotationVersionRef.current) {
                setHasUnsavedChanges(false);
            } else {
                // New edits happened while this save was in flight.
                queuedSaveRef.current = true;
                setHasUnsavedChanges(true);
            }

            return { ok: true };
        }

        if (response.status === 409) {
            const body = await response.json().catch(() => null);
            const serverEtag = response.headers.get('etag') || body?.etag || null;
            setSaveStatus('error');
            setLastSaveError('保存冲突：标注已被其他进程更新');
            setConflictInfo({ serverEtag });
            return { ok: false, conflict: true };
        }

        const t = await response.text().catch(() => '');
        setSaveStatus('error');
        setLastSaveError(t ? `HTTP ${response.status}: ${t}` : `HTTP ${response.status}`);
        return { ok: false };
    }, [imageId, projectId]);

    const save = useCallback(async (options = {}) => {
        if (!projectId || !imageId) return { ok: false };

        if (!options.force) {
            if (!hasUnsavedChangesRef.current) return { ok: true, skipped: true };
            if (!isLoadedRef.current || lastLoadErrorRef.current) return { ok: false };
            if (conflictInfoRef.current) return { ok: false, conflict: true };
        }

        if (saveInFlightRef.current) {
            queuedSaveRef.current = true;
            return { ok: false, queued: true };
        }

        saveInFlightRef.current = true;
        const epoch = sessionEpochRef.current;

        setSaveStatus('saving');
        setLastSaveError(null);

        let force = !!options.force;
        let result = { ok: false };

        try {
            do {
                queuedSaveRef.current = false;

                try {
                    result = await saveOnce({ force, epoch });
                } catch (e) {
                    if (epoch !== sessionEpochRef.current) {
                        result = { ok: false, stale: true };
                        break;
                    }
                    setSaveStatus('error');
                    setLastSaveError(e?.message ? String(e.message) : String(e));
                    result = { ok: false };
                }

                force = false;
            } while (
                result.ok &&
                queuedSaveRef.current &&
                hasUnsavedChangesRef.current &&
                !conflictInfoRef.current &&
                isLoadedRef.current &&
                !lastLoadErrorRef.current
            );
        } finally {
            saveInFlightRef.current = false;
        }

        return result;
    }, [imageId, projectId, saveOnce]);

    useEffect(() => {
        clearAutosaveTimer();
        if (phase !== 'dirty') return;
        autosaveTimerRef.current = setTimeout(() => save(), 3000);
        return clearAutosaveTimer;
    }, [clearAutosaveTimer, phase, save]);

    const waitForSaveIdle = useCallback(async (timeoutMs = SAVE_IDLE_TIMEOUT_MS) => {
        const start = Date.now();
        while (saveInFlightRef.current) {
            if (Date.now() - start > timeoutMs) return false;
            await new Promise(resolve => setTimeout(resolve, SAVE_IDLE_POLL_MS));
        }
        return true;
    }, []);

    const attemptNavigation = useCallback(async (nav, runNavigation) => {
        if (!runNavigation) return false;

        if (phase === 'loading') {
            setLastSaveError('加载中或保存中，无法切换');
            setBlockedNavigation(nav);
            return false;
        }

        if (saveInFlightRef.current || phase === 'saving') {
            const settled = await waitForSaveIdle();
            if (!settled) {
                setLastSaveError('保存尚未完成，请稍后重试');
                setBlockedNavigation(nav);
                return false;
            }
        }

        if (phase === 'error' || lastLoadErrorRef.current) {
            setLastSaveError(lastLoadErrorRef.current ? `加载失败，无法保存：${lastLoadErrorRef.current}` : '加载失败，无法保存');
            setBlockedNavigation(nav);
            return false;
        }

        if (phase === 'conflict' || conflictInfoRef.current) return false;

        if (!hasUnsavedChangesRef.current) {
            await runNavigation(nav);
            return true;
        }

        const result = await save();
        if (result.ok) {
            await runNavigation(nav);
            return true;
        }

        if (result.queued) {
            const settled = await waitForSaveIdle();
            if (settled && !hasUnsavedChangesRef.current && !conflictInfoRef.current) {
                await runNavigation(nav);
                return true;
            }
        }

        if (result.conflict) return false;

        setBlockedNavigation(nav);
        return false;
    }, [phase, save, waitForSaveIdle]);

    const retryBlockedNavigation = useCallback(async (runNavigation) => {
        if (!blockedNavigation || !runNavigation) return;
        const nav = blockedNavigation;
        const result = await save();
        if (result.ok) {
            setBlockedNavigation(null);
            await runNavigation(nav);
        } else if (result.conflict) {
            setBlockedNavigation(null);
        }
    }, [blockedNavigation, save]);

    const retryLoad = useCallback(() => load(), [load]);

    const closeBlockedNavigation = useCallback(() => setBlockedNavigation(null), []);

    const closeConflict = useCallback(() => setConflictInfo(null), []);

    const reloadAfterConflict = useCallback(() => {
        setConflictInfo(null);
        load();
    }, [load]);

    const forceOverwriteAfterConflict = useCallback(async () => {
        const result = await save({ force: true });
        if (result.ok) {
            setConflictInfo(null);
        }
    }, [save]);

    return {
        annotations,
        setAnnotations: applyUserAnnotations,
        isLoaded,
        phase,
        saveStatus,
        hasUnsavedChanges,
        lastLoadError,
        lastSaveError,
        lastLoadTime,
        lastSaveTime,
        annotationEtag,
        conflictInfo,
        blockedNavigation,
        save,
        retryLoad,
        attemptNavigation,
        retryBlockedNavigation,
        closeBlockedNavigation,
        closeConflict,
        reloadAfterConflict,
        forceOverwriteAfterConflict
    };
};
