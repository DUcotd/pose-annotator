import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
    const abortRef = useRef(null);
    const saveInFlightRef = useRef(false);
    const autosaveTimerRef = useRef(null);

    const phase = useMemo(() => {
        if (conflictInfo) return 'conflict';
        if (!isLoaded) return 'loading';
        if (lastLoadError) return 'error';
        if (saveStatus === 'saving') return 'saving';
        if (hasUnsavedChanges) return 'dirty';
        return 'ready';
    }, [conflictInfo, hasUnsavedChanges, isLoaded, lastLoadError, saveStatus]);

    const load = useCallback(() => {
        if (!projectId || !imageId) return;

        const seq = ++loadSeqRef.current;
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setIsLoaded(false);
        setLastLoadError(null);
        setLastSaveError(null);
        setConflictInfo(null);
        setBlockedNavigation(null);
        setSaveStatus('saved');
        setHasUnsavedChanges(false);
        setAnnotations([]);

        fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/annotations/${encodeURIComponent(imageId)}`, { signal: controller.signal })
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
                setAnnotationEtag(etag || null);
                setAnnotations(Array.isArray(data) ? data : []);
                setIsLoaded(true);
                setLastLoadTime(Date.now());
            })
            .catch(err => {
                if (controller.signal.aborted) return;
                if (seq !== loadSeqRef.current) return;
                setLastLoadError(err?.message ? String(err.message) : String(err));
                setIsLoaded(true);
            });
    }, [imageId, projectId]);

    useEffect(() => {
        load();
        return () => {
            if (abortRef.current) abortRef.current.abort();
        };
    }, [load]);

    const applyUserAnnotations = useCallback((nextOrUpdater) => {
        setAnnotations(prev => (typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater));
        setHasUnsavedChanges(true);
    }, []);

    const save = useCallback(async (options = {}) => {
        if (!projectId || !imageId) return { ok: false };
        if (saveInFlightRef.current) return { ok: false };
        if (!options.force) {
            if (!hasUnsavedChanges) return { ok: true, skipped: true };
            if (!isLoaded || lastLoadError) return { ok: false };
            if (conflictInfo) return { ok: false, conflict: true };
        }

        saveInFlightRef.current = true;
        setSaveStatus('saving');
        setLastSaveError(null);

        try {
            const response = await fetch(`http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/annotations/${encodeURIComponent(imageId)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(!options.force && annotationEtag ? { 'If-Match': annotationEtag } : {})
                },
                body: JSON.stringify(annotations)
            });

            if (response.ok) {
                const newEtag = response.headers.get('etag');
                if (newEtag) setAnnotationEtag(newEtag);
                setSaveStatus('saved');
                setHasUnsavedChanges(false);
                setLastSaveTime(Date.now());
                saveInFlightRef.current = false;
                return { ok: true };
            }

            if (response.status === 409) {
                const body = await response.json().catch(() => null);
                const serverEtag = response.headers.get('etag') || body?.etag || null;
                setSaveStatus('error');
                setLastSaveError('保存冲突：标注已被其他进程更新');
                setConflictInfo({ serverEtag });
                saveInFlightRef.current = false;
                return { ok: false, conflict: true };
            }

            const t = await response.text().catch(() => '');
            setSaveStatus('error');
            setLastSaveError(t ? `HTTP ${response.status}: ${t}` : `HTTP ${response.status}`);
            saveInFlightRef.current = false;
            return { ok: false };
        } catch (e) {
            setSaveStatus('error');
            setLastSaveError(e?.message ? String(e.message) : String(e));
            saveInFlightRef.current = false;
            return { ok: false };
        }
    }, [annotationEtag, annotations, conflictInfo, hasUnsavedChanges, imageId, isLoaded, lastLoadError, projectId]);

    useEffect(() => {
        if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
        }
        if (phase !== 'dirty') return;
        autosaveTimerRef.current = setTimeout(() => save(), 3000);
        return () => {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
                autosaveTimerRef.current = null;
            }
        };
    }, [phase, save]);

    const attemptNavigation = useCallback(async (nav, runNavigation) => {
        if (!runNavigation) return false;
        if (phase === 'loading' || phase === 'saving') {
            setLastSaveError('加载中或保存中，无法切换');
            setBlockedNavigation(nav);
            return false;
        }
        if (phase === 'error') {
            setLastSaveError(lastLoadError ? `加载失败，无法保存：${lastLoadError}` : '加载失败，无法保存');
            setBlockedNavigation(nav);
            return false;
        }
        if (phase === 'conflict') return false;
        if (!hasUnsavedChanges) {
            await runNavigation(nav);
            return true;
        }
        const result = await save();
        if (result.ok) {
            await runNavigation(nav);
            return true;
        }
        if (result.conflict) return false;
        setBlockedNavigation(nav);
        return false;
    }, [hasUnsavedChanges, lastLoadError, phase, save]);

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
