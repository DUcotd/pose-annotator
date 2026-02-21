import { apiUrl } from '../../api';

const datasetStatsCache = new Map();

function projectPath(projectId, suffix = '') {
  const tail = suffix ? `/${suffix.replace(/^\/+/, '')}` : '';
  return `/api/projects/${encodeURIComponent(projectId)}${tail}`;
}

async function readErrorText(res) {
  try {
    const text = await res.text();
    return text || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function getProjectConfig(projectId) {
  const res = await fetch(apiUrl(projectPath(projectId, 'config')));
  if (!res.ok) throw new Error(await readErrorText(res));
  return res.json();
}

export async function saveProjectConfig(projectId, config) {
  const res = await fetch(apiUrl(projectPath(projectId, 'config')), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config ?? {})
  });
  if (!res.ok) throw new Error(await readErrorText(res));
  return res.json();
}

export async function getImageAnnotations(projectId, imageId, options = {}) {
  const res = await fetch(
    apiUrl(projectPath(projectId, `annotations/${encodeURIComponent(imageId)}`)),
    options
  );
  if (!res.ok) throw new Error(await readErrorText(res));
  const data = await res.json();
  return {
    data: Array.isArray(data) ? data : [],
    etag: res.headers.get('etag') || null
  };
}

export function saveImageAnnotations(projectId, imageId, annotations, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.ifMatch ? { 'If-Match': options.ifMatch } : {})
  };
  return fetch(apiUrl(projectPath(projectId, `annotations/${encodeURIComponent(imageId)}`)), {
    method: 'POST',
    headers,
    body: JSON.stringify(annotations ?? [])
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

  const req = fetch(apiUrl(projectPath(projectId, 'dataset/stats')))
    .then(async (res) => {
      if (!res.ok) throw new Error(await readErrorText(res));
      return res.json();
    })
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

