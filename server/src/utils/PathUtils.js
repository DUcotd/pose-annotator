const path = require('path');
const fs = require('fs');

const PathUtils = {
  normalize(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
      return '';
    }
    return path.normalize(inputPath.trim());
  },

  toYoloFormat(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
      return '';
    }
    const normalized = path.normalize(inputPath.trim());
    return normalized.replace(/\\/g, '/');
  },

  isAbsolute(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
      return false;
    }
    return path.isAbsolute(inputPath.trim());
  },

  resolve(...paths) {
    return path.resolve(...paths);
  },

  join(...paths) {
    return path.join(...paths);
  },

  dirname(filePath) {
    return path.dirname(filePath);
  },

  basename(filePath, ext) {
    return path.basename(filePath, ext);
  },

  extname(filePath) {
    return path.extname(filePath);
  },

  isPathTraversal(pathString) {
    if (!pathString || typeof pathString !== 'string') return false;
    const normalized = path.normalize(pathString);
    return normalized.includes('..');
  },

  isWithinDirectory(filePath, allowedDir) {
    try {
      const normalizedFile = path.normalize(path.resolve(filePath));
      const normalizedDir = path.normalize(path.resolve(allowedDir));
      return normalizedFile.startsWith(normalizedDir + path.sep) || normalizedFile === normalizedDir;
    } catch (err) {
      return false;
    }
  },

  sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') return '';
    return filename.trim().replace(/[<>:"|?*]/g, '').replace(/\.\.+/g, '.');
  },

  parseYamlPath(inputPath, defaultPath, rootPath) {
    if (!inputPath || typeof inputPath !== 'string' || inputPath.trim() === '') {
      return { path: defaultPath };
    }
    
    let resolvedPath = inputPath.trim();
    
    if (!path.isAbsolute(resolvedPath)) {
      resolvedPath = path.resolve(rootPath, resolvedPath);
    }
    
    return { path: resolvedPath };
  },

  validatePathWithinBounds(filePath, rootPath, options = {}) {
    const issues = [];
    
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, issues: ['路径不能为空'] };
    }
    
    const { allowAbsolute = false, allowedExtensions = [] } = options;
    
    if (!allowAbsolute && path.isAbsolute(filePath)) {
      issues.push('不允许使用绝对路径');
    }
    
    if (allowedExtensions.length > 0) {
      const ext = path.extname(filePath).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        issues.push(`不支持的文件扩展名: ${ext}，允许的扩展名: ${allowedExtensions.join(', ')}`);
      }
    }
    
    if (PathUtils.isPathTraversal(filePath)) {
      issues.push('路径包含非法的遍历字符 (..)');
    }
    
    const resolvedPath = path.resolve(rootPath, filePath);
    if (!PathUtils.isWithinDirectory(resolvedPath, rootPath)) {
      issues.push('路径超出允许的目录范围');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  },

  validateForYaml(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, error: '路径不能为空' };
    }
    
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.yaml' && ext !== '.yml') {
      return { valid: false, error: '文件必须是 YAML 格式 (.yaml 或 .yml)' };
    }
    
    return { valid: true };
  },

  checkFileExists(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return { exists: false, error: '路径不能为空' };
    }
    
    try {
      const exists = fs.existsSync(filePath);
      return { exists };
    } catch (err) {
      return { exists: false, error: err.message };
    }
  },

  getDetailedPathInfo(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return { error: '路径不能为空' };
    }
    
    try {
      const resolved = path.resolve(filePath);
      const dirname = path.dirname(resolved);
      const basename = path.basename(resolved);
      const ext = path.extname(resolved);
      
      const info = {
        resolved,
        dirname,
        basename,
        ext,
        dirExists: fs.existsSync(dirname),
        fileExists: fs.existsSync(resolved)
      };
      
      if (info.dirExists) {
        try {
          const files = fs.readdirSync(dirname);
          info.siblingFiles = files.slice(0, 20);
        } catch (e) {
          info.readdirError = e.message;
        }
      }
      
      return info;
    } catch (err) {
      return { error: err.message };
    }
  },

  normalizeYamlPaths(yamlPath) {
    if (!yamlPath || typeof yamlPath !== 'string') {
      return { valid: true, issues: [] };
    }
    
    const issues = [];
    
    try {
      if (!fs.existsSync(yamlPath)) {
        return { valid: true, issues: [] };
      }
      
      const content = fs.readFileSync(yamlPath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (line.includes('\\') && !line.trim().startsWith('#')) {
          const match = line.match(/^(\s*)(\w+):\s*(.+)$/);
          if (match) {
            const value = match[3].trim();
            if (value.includes('\\') && !value.startsWith('"') && !value.startsWith("'")) {
              issues.push(`第 ${index + 1} 行: 路径包含反斜杠`);
            }
          }
        }
      });
      
      return {
        valid: issues.length === 0,
        issues
      };
    } catch (err) {
      return { valid: true, issues: [], error: err.message };
    }
  },

  convertYamlPaths(yamlPath) {
    if (!yamlPath || typeof yamlPath !== 'string') {
      return { success: false, error: '路径不能为空' };
    }
    
    try {
      if (!fs.existsSync(yamlPath)) {
        return { success: false, error: '文件不存在' };
      }
      
      const content = fs.readFileSync(yamlPath, 'utf8');
      const converted = content.replace(/\\\\/g, '/').replace(/\\/g, '/');
      
      if (content === converted) {
        return { success: true, changed: false };
      }
      
      fs.writeFileSync(yamlPath, converted, 'utf8');
      return { success: true, changed: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  formatErrorMessage(validation, inputPath) {
    if (!validation) {
      return '未知错误';
    }
    
    if (validation.valid) {
      return '';
    }
    
    if (validation.error) {
      return `路径验证失败: ${validation.error}`;
    }
    
    if (validation.issues && validation.issues.length > 0) {
      return `路径验证失败: ${validation.issues.join('; ')}`;
    }
    
    return `路径验证失败: ${inputPath || '未知路径'}`;
  }
};

module.exports = PathUtils;
