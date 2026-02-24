const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`[verify-build-config] ${msg}`);
  process.exit(1);
}

function main() {
  const root = path.join(__dirname, '..');
  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const files = pkg?.build?.files;
  if (!Array.isArray(files)) fail('package.json build.files 缺失或格式错误');

  if (!files.includes('server/**/*')) fail('build.files 必须包含 server/**/*');
  if (!files.includes('scripts/**/*')) fail('build.files 必须包含 scripts/**/*');
  if (files.includes('server.js')) fail('build.files 不允许包含 server.js（legacy 后端已移除）');

  const legacyPath = path.join(root, 'server.js');
  if (fs.existsSync(legacyPath)) {
    fail('检测到 server.js，legacy 后端必须删除');
  }

  console.log('[verify-build-config] OK');
}

main();

