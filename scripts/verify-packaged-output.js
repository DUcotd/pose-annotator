const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`[verify-packaged-output] ${msg}`);
  process.exit(1);
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function walk(dir, out = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      out.push(full);
      walk(full, out);
    }
  }
  return out;
}

function findResourceAppDirs(distDir) {
  if (!isDir(distDir)) return [];
  const all = walk(distDir);
  return all.filter((d) => path.basename(d).toLowerCase() === 'app' && path.basename(path.dirname(d)).toLowerCase() === 'resources');
}

function ensureFileExists(base, rel) {
  const target = path.join(base, rel);
  if (!fs.existsSync(target)) {
    fail(`打包产物缺失文件: ${rel} (${target})`);
  }
}

function ensureFileNotExists(base, rel) {
  const target = path.join(base, rel);
  if (fs.existsSync(target)) {
    fail(`打包产物不应包含: ${rel} (${target})`);
  }
}

function main() {
  const root = path.join(__dirname, '..');
  const distDir = path.join(root, 'dist');
  const appDirs = findResourceAppDirs(distDir);
  if (appDirs.length === 0) {
    fail(`未在 dist 目录找到打包 app 目录（期待 */resources/app），当前路径: ${distDir}`);
  }

  for (const appDir of appDirs) {
    ensureFileExists(appDir, path.join('server', 'src', 'app.js'));
    ensureFileExists(appDir, path.join('scripts', 'predict.py'));
    ensureFileNotExists(appDir, 'server.js');
  }

  console.log(`[verify-packaged-output] OK (${appDirs.length} app roots checked)`);
}

main();

