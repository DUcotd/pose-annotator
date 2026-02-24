const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'client', 'src');
const ALLOWLIST = new Set([
  path.normalize(path.join('client', 'src', 'lib', 'apiClient.js'))
]);

function isIgnored(filePath) {
  const base = path.basename(filePath);
  if (base.endsWith('.test.js') || base.endsWith('.test.jsx') || base.endsWith('.spec.js') || base.endsWith('.spec.jsx')) {
    return true;
  }
  if (filePath.includes(`${path.sep}test${path.sep}`)) return true;
  return false;
}

function walk(dir, out = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full, out);
    if (item.isFile() && /\.(js|jsx|ts|tsx)$/.test(item.name)) out.push(full);
  }
  return out;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.log('[verify-no-direct-fetch] skip: client/src not found');
    return;
  }

  const files = walk(SRC);
  const violations = [];

  for (const abs of files) {
    if (isIgnored(abs)) continue;
    const rel = path.normalize(path.relative(ROOT, abs));
    if (ALLOWLIST.has(rel)) continue;
    const content = fs.readFileSync(abs, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (line.includes('fetch(')) {
        violations.push(`${rel}:${i + 1}`);
      }
    });
  }

  if (violations.length > 0) {
    console.error('[verify-no-direct-fetch] 检测到直接 fetch 调用，请改为 apiClient:');
    console.error(violations.join('\n'));
    process.exit(1);
  }

  console.log('[verify-no-direct-fetch] OK');
}

main();

