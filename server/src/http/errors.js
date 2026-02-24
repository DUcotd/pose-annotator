const { ERROR_CODES, DEFAULT_HINTS, RETRYABLE_CODES } = require('./errorCodes');

class AppError extends Error {
  constructor({
    code = ERROR_CODES.INTERNAL_ERROR,
    message = 'Internal server error',
    status = 500,
    hint = DEFAULT_HINTS[ERROR_CODES.INTERNAL_ERROR],
    details = {},
    where = null,
    retryable = RETRYABLE_CODES.has(code)
  } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.hint = hint;
    this.details = details;
    this.where = where;
    this.retryable = retryable;
  }

  static badRequest(code, message, details = {}, hint) {
    return new AppError({
      code: code || ERROR_CODES.BAD_REQUEST,
      message: message || 'Bad request',
      status: 400,
      details,
      hint: hint || DEFAULT_HINTS[code] || DEFAULT_HINTS[ERROR_CODES.BAD_REQUEST],
      retryable: false
    });
  }

  static conflict(message, details = {}) {
    return new AppError({
      code: ERROR_CODES.CONFLICT,
      message: message || 'Conflict',
      status: 409,
      details,
      hint: DEFAULT_HINTS[ERROR_CODES.CONFLICT],
      retryable: false
    });
  }

  static notFound(message, details = {}) {
    return new AppError({
      code: ERROR_CODES.ROUTE_NOT_FOUND,
      message: message || 'Route not found',
      status: 404,
      details,
      hint: DEFAULT_HINTS[ERROR_CODES.ROUTE_NOT_FOUND],
      retryable: false
    });
  }
}

function inferCodeFromLegacyPayload(payload, status = 500) {
  const codeFromPayload = typeof payload?.code === 'string' ? payload.code : '';
  if (codeFromPayload) {
    return codeFromPayload.toUpperCase();
  }

  const text = String(
    payload?.error ||
    payload?.message ||
    payload?.details ||
    ''
  ).toLowerCase();

  if (text.includes('only available in desktop') || text.includes('仅在桌面版应用中可用') || text.includes('desktop version')) {
    return ERROR_CODES.DESKTOP_ONLY_FEATURE;
  }
  if (text.includes('model') || text.includes('模型')) {
    return ERROR_CODES.MODEL_INVALID;
  }
  if (text.includes('python')) {
    return ERROR_CODES.PYTHON_ENV_INVALID;
  }
  if (text.includes('project not found') || text.includes('项目不存在') || text.includes('project')) {
    if (text.includes('not found') || text.includes('不存在')) {
      return ERROR_CODES.PROJECT_NOT_FOUND;
    }
  }
  if (text.includes('validation') || text.includes('校验') || text.includes('参数')) {
    return ERROR_CODES.VALIDATION_ERROR;
  }
  if (text.includes('eperm') || text.includes('eacces') || text.includes('permission') || text.includes('权限')) {
    return ERROR_CODES.FS_PERMISSION_DENIED;
  }
  if (status === 409) return ERROR_CODES.CONFLICT;
  if (status === 401) return ERROR_CODES.UNAUTHORIZED;
  if (status === 403) return ERROR_CODES.FORBIDDEN;
  if (
    status === 404 &&
    (
      text.includes('route not found') ||
      text.includes('请求的接口不存在') ||
      text.includes('接口不存在') ||
      text.includes('not found')
    )
  ) {
    return ERROR_CODES.ROUTE_NOT_FOUND;
  }
  if (status === 400) {
    return ERROR_CODES.VALIDATION_ERROR;
  }
  if (status >= 400 && status < 500) {
    return ERROR_CODES.BAD_REQUEST;
  }
  return ERROR_CODES.INTERNAL_ERROR;
}

function toAppError(input, req, statusOverride = null) {
  if (input instanceof AppError) {
    return input;
  }

  if (input && typeof input === 'object' && input.ok === false && input.error) {
    const nested = input.error;
    const normalizedCode = String(nested.code || ERROR_CODES.INTERNAL_ERROR).toUpperCase();
    return new AppError({
      code: normalizedCode,
      message: nested.message || 'Internal server error',
      status: statusOverride || nested.status || 500,
      hint: nested.hint || DEFAULT_HINTS[normalizedCode] || DEFAULT_HINTS[ERROR_CODES.INTERNAL_ERROR],
      details: nested.details || {},
      where: nested.where || (req ? { method: req.method, path: req.path } : null),
      retryable: typeof nested.retryable === 'boolean' ? nested.retryable : RETRYABLE_CODES.has(normalizedCode)
    });
  }

  if (input && typeof input === 'object' && (input.error || input.message || input.code)) {
    const status = Number.isInteger(statusOverride) ? statusOverride : 500;
    const code = String(inferCodeFromLegacyPayload(input, status)).toUpperCase();
    const message = String(input.error || input.message || 'Request failed');
    const details = input.details !== undefined ? input.details : input;

    return new AppError({
      code,
      message,
      status,
      hint: DEFAULT_HINTS[code] || DEFAULT_HINTS[ERROR_CODES.INTERNAL_ERROR],
      details,
      where: req ? { method: req.method, path: req.path } : null,
      retryable: RETRYABLE_CODES.has(code)
    });
  }

  if (input instanceof Error) {
    const code = inferCodeFromLegacyPayload({ error: input.message }, statusOverride || 500);
    return new AppError({
      code,
      message: input.message || 'Internal server error',
      status: statusOverride || 500,
      hint: DEFAULT_HINTS[code] || DEFAULT_HINTS[ERROR_CODES.INTERNAL_ERROR],
      details: { name: input.name, stack: input.stack },
      where: req ? { method: req.method, path: req.path } : null,
      retryable: RETRYABLE_CODES.has(code)
    });
  }

  const status = Number.isInteger(statusOverride) ? statusOverride : 500;
  const code = inferCodeFromLegacyPayload({}, status);
  return new AppError({
    code,
    message: 'Internal server error',
    status,
    hint: DEFAULT_HINTS[code] || DEFAULT_HINTS[ERROR_CODES.INTERNAL_ERROR],
    details: {},
    where: req ? { method: req.method, path: req.path } : null,
    retryable: RETRYABLE_CODES.has(code)
  });
}

module.exports = {
  AppError,
  toAppError,
  inferCodeFromLegacyPayload
};
