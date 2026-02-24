const { toAppError } = require('./errors');

function buildMeta(req) {
  return {
    requestId: req?.requestId || null,
    timestamp: new Date().toISOString()
  };
}

function isEnvelope(body) {
  return Boolean(
    body &&
    typeof body === 'object' &&
    Object.prototype.hasOwnProperty.call(body, 'ok') &&
    Object.prototype.hasOwnProperty.call(body, 'meta')
  );
}

function isLegacyErrorPayload(body) {
  return Boolean(
    body &&
    typeof body === 'object' &&
    body.success === false &&
    (body.error || body.message)
  );
}

function attachResponseHelpers(req, res, next) {
  const originalJson = res.json.bind(res);
  if (req?.requestId) {
    res.setHeader('x-request-id', req.requestId);
  }

  res.sendOk = (data, status = 200) => {
    res.status(status);
    return originalJson({
      ok: true,
      data: data === undefined ? null : data,
      meta: buildMeta(req)
    });
  };

  res.sendError = (err, statusOverride = null) => {
    const appError = toAppError(err, req, statusOverride || res.statusCode || 500);
    const status = Number.isInteger(statusOverride) ? statusOverride : appError.status || 500;
    res.status(status);
    return originalJson({
      ok: false,
      error: {
        code: appError.code,
        message: appError.message,
        hint: appError.hint,
        where: appError.where || { method: req.method, path: req.path },
        details: appError.details || {},
        retryable: !!appError.retryable,
        requestId: req?.requestId || null
      },
      meta: buildMeta(req)
    });
  };

  res.json = (body) => {
    if (isEnvelope(body)) {
      const withMeta = { ...body, meta: body.meta || buildMeta(req) };
      return originalJson(withMeta);
    }

    if (res.statusCode >= 400) {
      return res.sendError(body, res.statusCode);
    }

    if (isLegacyErrorPayload(body)) {
      const status = Number.isInteger(body.status) ? body.status : 400;
      return res.sendError(body, status);
    }

    return res.sendOk(body, res.statusCode || 200);
  };

  next();
}

function collectRouterRoutes(router, basePath = '') {
  if (!router || !Array.isArray(router.stack)) return [];
  const results = [];
  for (const layer of router.stack) {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods || {})
        .filter((m) => layer.route.methods[m])
        .map((m) => m.toUpperCase());
      for (const method of methods) {
        const routePath = `${basePath}${layer.route.path}`.replace(/\/+/g, '/');
        results.push(`${method} ${routePath}`);
      }
    }
  }
  return results;
}

function buildRouteManifest(routeMounts = []) {
  const routes = [];
  for (const mount of routeMounts) {
    const base = mount.base || '';
    const router = mount.router;
    routes.push(...collectRouterRoutes(router, base));
  }
  const deduped = Array.from(new Set(routes)).sort();
  return {
    routes: deduped,
    signature: deduped.join('\n')
  };
}

module.exports = {
  attachResponseHelpers,
  buildMeta,
  buildRouteManifest
};
