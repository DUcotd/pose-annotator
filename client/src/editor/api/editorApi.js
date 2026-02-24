import { apiUrl } from '../../api';
import { apiClient } from '../../lib/apiClient';

const datasetStatsCache = new Map();

function projectPath(projectId, suffix = '') {
  const tail = suffix ? `/${suffix.replace(/^\/+/, '')}` : '';
  return `/api/projects/${encodeURIComponent(projectId)}${tail}`;
}

export async function getProjectConfig(projectId) {
  return apiClient.get(projectPath(projectId, 'config'));
}

export async function saveProjectConfig(projectId, config) {
  return apiClient.post(projectPath(projectId, 'config'), config ?? {});
}

export async function getImageAnnotations(projectId, imageId, options = {}) {
  const result = await apiClient.request(
    projectPath(projectId, `annotations/${encodeURIComponent(imageId)}`),
    { ...options, method: options.method || 'GET' }
  );
  const data = result.data;
  return {
    data: Array.isArray(data) ? data : [],
    etag: result.response.headers.get('etag') || null
  };
}

export function saveImageAnnotations(projectId, imageId, annotations, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.ifMatch ? { 'If-Match': options.ifMatch } : {})
  };
  return apiClient.requestRaw(projectPath(projectId, `annotations/${encodeURIComponent(imageId)}`), {
    method: 'POST',
    headers,
    body: annotations ?? []
  });
}

export function getUploadImageUrl(projectId, imageId, cacheToken = 0) {
  return apiUrl(
    projectPath(
      projectId,
      `uploads/${encodeURIComponent(imageId)}?v=${encodeURIComponent(cacheToken || 0)}`
    )
  );
}

export async function getDatasetStats(projectId, options = {}) {
  const cacheMs = Number.isFinite(options.cacheMs) ? options.cacheMs : 1200;
  const now = Date.now();
  const cached = datasetStatsCache.get(projectId);
  if (cached && now - cached.ts < cacheMs) {
    if (cached.data) return cached.data;
    if (cached.promise) return cached.promise;
  }

  const req = apiClient.get(projectPath(projectId, 'dataset/stats'))
    .then((data) => {
      const next = data || null;
      datasetStatsCache.set(projectId, { ts: Date.now(), data: next, promise: null });
      return next;
    })
    .catch((err) => {
      datasetStatsCache.delete(projectId);
      throw err;
    });

  datasetStatsCache.set(projectId, { ts: now, data: null, promise: req });
  return req;
}

export function clearDatasetStatsCache(projectId) {
  if (projectId) {
    datasetStatsCache.delete(projectId);
    return;
  }
  datasetStatsCache.clear();
}
