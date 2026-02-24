# Error Contract

本文档定义前后端统一错误协议，目标是把错误从“模糊提示”升级为“可定位、可复现、可修复”。

## 1. Response Envelope

所有 JSON API 返回统一包结构。

成功响应：

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "requestId": "req_xxx",
    "timestamp": "2026-02-24T12:34:56.000Z"
  }
}
```

失败响应：

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数不合法",
    "hint": "请检查输入参数后重试。",
    "where": { "method": "POST", "path": "/api/..." },
    "details": {},
    "retryable": false,
    "requestId": "req_xxx"
  },
  "meta": {
    "requestId": "req_xxx",
    "timestamp": "2026-02-24T12:34:56.000Z"
  }
}
```

说明：
- `meta.requestId` 与 `error.requestId` 必须一致。
- 服务端同时通过响应头返回 `x-request-id`。
- 二进制接口（如 ZIP 下载）保持原行为；仅在失败时返回上面的错误 JSON。

## 2. Standard Error Codes

- `ROUTE_NOT_FOUND`
- `DESKTOP_ONLY_FEATURE`
- `MODEL_INVALID`
- `PYTHON_ENV_INVALID`
- `PROJECT_NOT_FOUND`
- `VALIDATION_ERROR`
- `FS_PERMISSION_DENIED`
- `BACKEND_BOOT_FAILED`
- `DIAGNOSTICS_EXPORT_FAILED`
- `INTERNAL_ERROR`

## 3. Health And Diagnostics APIs

- `GET /api/system/health`
  - 返回后端版本、能力清单、路由签名、启动模式和启动状态。
- `POST /api/system/diagnostics/export`
  - 返回 ZIP 诊断包（环境信息、最近错误摘要、日志尾部）。

## 4. Frontend Handling Rules

- 所有 API 请求必须走 `client/src/lib/apiClient.js`，禁止直接 `fetch`。
- 所有错误统一上报到 ErrorCenter。
- UI 默认显示用户友好提示；可展开技术详情（`code`/`path`/`requestId`/`hint`/`details`）。
