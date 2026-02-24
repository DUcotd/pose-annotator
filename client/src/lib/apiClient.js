import { apiUrl } from '../api.js';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isJsonSerializable(value) {
  return value !== undefined && (Array.isArray(value) || isObject(value));
}

function isApiEnvelope(payload) {
  return isObject(payload) && typeof payload.ok === 'boolean' && isObject(payload.meta);
}

export class ApiError extends Error {
  constructor({
    message,
    code = 'API_ERROR',
    status = 500,
    hint = '',
    requestId = null,
    where = null,
    details = null,
    retryable = false
  }) {
    super(message || '请求失败');
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.hint = hint;
    this.requestId = requestId;
    this.where = where;
    this.details = details;
    this.retryable = !!retryable;
  }
}

async function parseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (response.status === 204) return null;

  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => '');
  return text || null;
}

function toApiErrorFromEnvelope(envelope, status) {
  const err = envelope?.error || {};
  return new ApiError({
    message: err.message || '请求失败',
    code: err.code || 'API_ERROR',
    status,
    hint: err.hint || '',
    requestId: err.requestId || envelope?.meta?.requestId || null,
    where: err.where || null,
    details: err.details || null,
    retryable: err.retryable === true
  });
}

function toApiErrorFromLegacy(body, status, response) {
  if (body instanceof ApiError) return body;
  if (body instanceof Error) {
    return new ApiError({
      message: body.message,
      status
    });
  }

  if (isObject(body)) {
    return new ApiError({
      message: body.error || body.message || `HTTP ${status}`,
      code: body.code || 'API_ERROR',
      status,
      hint: body.hint || '',
      requestId: body.requestId || response.headers.get('x-request-id') || null,
      where: body.where || null,
      details: body.details || body,
      retryable: !!body.retryable
    });
  }

  return new ApiError({
    message: typeof body === 'string' && body ? body : `HTTP ${status}`,
    status
  });
}

function normalizeBodyAndHeaders(options = {}) {
  const init = { ...options };
  const headers = new Headers(options.headers || {});

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body !== undefined && !isFormData) {
    if (!headers.has('Content-Type') && isJsonSerializable(init.body)) {
      headers.set('Content-Type', 'application/json');
    }

    const contentType = headers.get('Content-Type') || '';
    if (contentType.toLowerCase().includes('application/json') && typeof init.body !== 'string') {
      init.body = JSON.stringify(init.body);
    }
  }

  init.headers = headers;
  return init;
}

function toNetworkError(err, url, init = {}) {
  return new ApiError({
    message: err?.message || '网络请求失败',
    code: 'NETWORK_ERROR',
    status: 0,
    hint: '请检查网络连接或后端服务状态。',
    details: { url, method: init.method || 'GET' },
    retryable: true
  });
}

export async function request(pathOrUrl, options = {}) {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : apiUrl(pathOrUrl);
  const init = normalizeBodyAndHeaders(options);

  let response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    throw toNetworkError(err, url, init);
  }

  const body = await parseBody(response);
  if (isApiEnvelope(body)) {
    if (body.ok) {
      return {
        data: body.data,
        meta: body.meta,
        response
      };
    }
    throw toApiErrorFromEnvelope(body, response.status);
  }

  if (!response.ok) {
    throw toApiErrorFromLegacy(body, response.status, response);
  }

  return {
    data: body,
    meta: {
      requestId: response.headers.get('x-request-id') || null,
      timestamp: null
    },
    response
  };
}

export async function get(pathOrUrl, options = {}) {
  const result = await request(pathOrUrl, { ...options, method: 'GET' });
  return result.data;
}

export async function post(pathOrUrl, body, options = {}) {
  const result = await request(pathOrUrl, { ...options, method: 'POST', body });
  return result.data;
}

export async function del(pathOrUrl, options = {}) {
  const result = await request(pathOrUrl, { ...options, method: 'DELETE' });
  return result.data;
}

export async function requestRaw(pathOrUrl, options = {}) {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : apiUrl(pathOrUrl);
  const { allowErrorResponse = false, ...rest } = options;
  const init = normalizeBodyAndHeaders(rest);
  let response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    throw toNetworkError(err, url, init);
  }

  if (!response.ok && !allowErrorResponse) {
    const body = await parseBody(response);
    if (isApiEnvelope(body)) {
      throw toApiErrorFromEnvelope(body, response.status);
    }
    throw toApiErrorFromLegacy(body, response.status, response);
  }
  return response;
}

export const apiClient = {
  request,
  requestRaw,
  get,
  post,
  del
};
