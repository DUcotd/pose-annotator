export function getApiBaseUrl() {
  const fromWindow = window.__POSE_ANNOTATOR_API_BASE_URL;
  if (typeof fromWindow === 'string' && fromWindow.trim()) {
    return fromWindow.replace(/\/+$/, '');
  }

  const fromEnv = import.meta?.env?.VITE_API_BASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location?.protocol;
    if (protocol === 'http:' || protocol === 'https:') {
      return window.location.origin;
    }
  }

  return 'http://localhost:5000';
}

export function apiUrl(p) {
  const base = getApiBaseUrl();
  if (!p) return base;
  if (/^https?:\/\//i.test(p)) return p;
  const path = p.startsWith('/') ? p : `/${p}`;
  return `${base}${path}`;
}

