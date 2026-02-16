const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function main() {
  const editorPath = path.join(__dirname, '..', 'client', 'src', 'components', 'AnnotationEditor.jsx');
  const hookPath = path.join(__dirname, '..', 'client', 'src', 'hooks', 'useAnnotationSession.js');

  const editor = fs.readFileSync(editorPath, 'utf8');
  const hook = fs.readFileSync(hookPath, 'utf8');

  const postAnnotationsInEditor = /fetch\([^\n]*\/annotations\/[^\n]*\)\s*,?\s*\{[\s\S]*method:\s*['"]POST['"][\s\S]*\}/m.test(editor);
  assert(!postAnnotationsInEditor, 'AnnotationEditor.jsx 不应直接 POST /annotations/*，必须通过同步模块');

  const postAnnotationsInHook = /fetch\([^\n]*\/annotations\/[^\n]*\)[\s\S]*method:\s*['"]POST['"]/m.test(hook);
  assert(postAnnotationsInHook, 'useAnnotationSession.js 应包含 POST /annotations/* 的保存逻辑');
}

main();

