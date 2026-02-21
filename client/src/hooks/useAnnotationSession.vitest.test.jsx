import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnnotationSession } from './useAnnotationSession';

function createJsonResponse(data, { status = 200, etag = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return name?.toLowerCase() === 'etag' ? etag : null;
      }
    },
    async json() {
      return data;
    },
    async text() {
      return typeof data === 'string' ? data : JSON.stringify(data);
    }
  };
}

describe('useAnnotationSession (vitest)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads annotations and enters ready phase', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      createJsonResponse([{ id: 'b1', type: 'bbox', x: 1, y: 2, width: 10, height: 12 }], { etag: 'W/"1"' })
    );

    const { result } = renderHook(() => useAnnotationSession({ projectId: 'p1', imageId: 'img1.jpg' }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.isLoaded).toBe(true);

    expect(result.current.annotations).toHaveLength(1);
    expect(result.current.annotationEtag).toBe('W/"1"');
    expect(result.current.phase).toBe('ready');
  });

  it('autosaves after dirty changes and clears dirty flag', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(createJsonResponse([], { etag: 'W/"1"' }))
      .mockResolvedValueOnce(createJsonResponse([], { etag: 'W/"2"' }));

    const { result } = renderHook(() => useAnnotationSession({ projectId: 'p1', imageId: 'img1.jpg' }));

    await waitFor(() => expect(result.current.isLoaded).toBe(true), { timeout: 3000 });

    act(() => {
      result.current.setAnnotations([{ id: 'b1', type: 'bbox', x: 0, y: 0, width: 20, height: 20 }]);
    });
    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.phase).toBe('dirty');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.current.hasUnsavedChanges).toBe(false);
      expect(result.current.phase).toBe('ready');
    }, { timeout: 8000 });
  }, 12000);

  it('enters conflict phase on 409 and exposes server etag', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(createJsonResponse([], { etag: 'W/"1"' }))
      .mockResolvedValueOnce(createJsonResponse({ etag: 'W/"2"' }, { status: 409, etag: 'W/"2"' }));

    const { result } = renderHook(() => useAnnotationSession({ projectId: 'p1', imageId: 'img1.jpg' }));

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.setAnnotations([{ id: 'b1', type: 'bbox', x: 3, y: 4, width: 30, height: 40 }]);
    });

    let saveResult = null;
    await act(async () => {
      saveResult = await result.current.save();
    });

    expect(saveResult).toEqual(expect.objectContaining({ ok: false, conflict: true }));
    expect(result.current.phase).toBe('conflict');
    expect(result.current.conflictInfo).toEqual({ serverEtag: 'W/"2"' });
  });
});
