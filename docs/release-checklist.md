# Release Checklist

## Build Gate

1. 运行 `npm run verify:build-config`
2. 确认 `build.files` 包含：
   - `server/**/*`
   - `scripts/**/*`
3. 确认以下项不存在：
   - `server.js`（legacy 后端）

## Test Gate

1. 运行 `npm test`
2. 确认通过：
   - 路由/错误契约测试
   - 训练相关单元测试
   - `verify:no-direct-fetch`（前端无直连 fetch）

## Packaging Gate

1. 运行 `npm run electron:build`
2. 运行 `npm run verify:packaged-output`
3. 确认打包产物：
   - 包含 `server/src/app.js`
   - 包含 `scripts/predict.py`
   - 不包含 `server.js`

## Runtime Smoke

1. 启动桌面应用，确认先完成后端健康检查再进入业务页
2. 模拟错误并确认 ErrorCenter 显示：
   - `code`
   - `where.path`
   - `requestId`
   - `hint`
3. 在错误详情面板验证“复制诊断 JSON”和“导出诊断包”
