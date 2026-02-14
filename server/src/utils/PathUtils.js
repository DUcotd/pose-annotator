const path = require('path');

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

  parseYamlPath(userPath, defaultPath, rootPath) {
    if (!userPath || typeof userPath !== 'string' || userPath.trim() === '') {
      return {
        path: defaultPath,
        isAbsolute: path.isAbsolute(defaultPath),
        normalized: path.normalize(defaultPath)
      };
    }

    const trimmedPath = userPath.trim();
    
    if (path.isAbsolute(trimmedPath)) {
      return {
        path: trimmedPath,
        isAbsolute: true,
        normalized: path.normalize(trimmedPath)
      };
    }

    const resolvedPath = path.resolve(rootPath, trimmedPath);
    return {
      path: resolvedPath,
      isAbsolute: true,
      normalized: path.normalize(resolvedPath),
      originalInput: trimmedPath,
      resolvedFrom: rootPath
    };
  },

  validateForYaml(filePath) {
    const errors = [];
    const warnings = [];

    if (!filePath || typeof filePath !== 'string') {
      errors.push('路径不能为空');
      return { valid: false, errors, warnings };
    }

    const trimmed = filePath.trim();
    
    if (trimmed.length === 0) {
      errors.push('路径不能为空');
      return { valid: false, errors, warnings };
    }

    const normalized = path.normalize(trimmed);

    if (normalized.includes('\\')) {
      warnings.push('检测到 Windows 路径分隔符，将转换为正斜杠以确保跨平台兼容');
    }

    if (!normalized.toLowerCase().endsWith('.yaml') && !normalized.toLowerCase().endsWith('.yml')) {
      warnings.push('文件扩展名不是 .yaml 或 .yml');
    }

    return {
      valid: errors.length === 0,
      path: normalized,
      yoloPath: normalized.replace(/\\/g, '/'),
      errors,
      warnings
    };
  },

  checkFileExists(filePath) {
    const fs = require('fs');
    if (!filePath || typeof filePath !== 'string') {
      return { exists: false, error: '路径无效' };
    }
    
    try {
      const exists = fs.existsSync(filePath);
      return { exists, error: null };
    } catch (err) {
      return { exists: false, error: err.message };
    }
  },

  getDetailedPathInfo(filePath) {
    const fs = require('fs');
    const info = {
      original: filePath,
      normalized: null,
      absolute: null,
      exists: false,
      isFile: false,
      isDirectory: false,
      isReadable: false,
      size: null,
      error: null
    };

    try {
      info.normalized = path.normalize(filePath);
      info.absolute = path.resolve(filePath);
      
      const stats = fs.statSync(info.absolute);
      info.exists = true;
      info.isFile = stats.isFile();
      info.isDirectory = stats.isDirectory();
      info.size = stats.size;
      
      try {
        fs.accessSync(info.absolute, fs.constants.R_OK);
        info.isReadable = true;
      } catch (e) {
        info.isReadable = false;
      }
    } catch (err) {
      info.error = err.message;
    }

    return info;
  },

  formatErrorMessage(pathValidationResult, originalPath) {
    if (pathValidationResult.valid) {
      return null;
    }

    const messages = ['配置文件路径验证失败:'];
    
    for (const error of pathValidationResult.errors) {
      messages.push(`- ${error}`);
    }

    if (originalPath) {
      messages.push(`\n您提供的路径: ${originalPath}`);
    }

    messages.push('\n可能的解决方案:');
    messages.push('- 确保数据集已正确导出');
    messages.push('- 检查路径是否包含特殊字符');
    messages.push('- 尝试使用绝对路径而非相对路径');

    return messages.join('\n');
  },

  convertYamlPaths(yamlPath) {
    const fs = require('fs');
    
    try {
      if (!fs.existsSync(yamlPath)) {
        return { success: false, error: '文件不存在' };
      }

      let content = fs.readFileSync(yamlPath, 'utf-8');
      const originalContent = content;
      
      const pathFields = ['path', 'train', 'val', 'test', 'nc', 'names'];
      let modified = false;

      for (const field of pathFields) {
        const regex = new RegExp(`^(\\s*${field}:\\s*)([^\\n]+)`, 'gm');
        content = content.replace(regex, (match, prefix, value) => {
          const trimmedValue = value.trim();
          if (trimmedValue.includes('\\')) {
            modified = true;
            const converted = trimmedValue.replace(/\\\\/g, '/').replace(/\\/g, '/');
            return `${prefix}${converted}`;
          }
          return match;
        });
      }

      if (modified) {
        fs.writeFileSync(yamlPath, content, 'utf-8');
        return { success: true, message: '已转换 YAML 中的反斜杠路径为正斜杠' };
      }

      return { success: true, message: '无需转换，路径格式正确' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  normalizeYamlPaths(yamlPath) {
    const fs = require('fs');
    
    try {
      if (!fs.existsSync(yamlPath)) {
        return { valid: false, error: 'YAML 文件不存在' };
      }

      const yaml = require('yaml');
      const content = fs.readFileSync(yamlPath, 'utf-8');
      const parsed = yaml.parse(content);
      
      if (!parsed) {
        return { valid: false, error: 'YAML 文件为空或格式错误' };
      }

      const pathsToCheck = ['path', 'train', 'val', 'test'];
      const issues = [];

      for (const field of pathsToCheck) {
        if (parsed[field] && typeof parsed[field] === 'string') {
          if (parsed[field].includes('\\')) {
            issues.push({
              field,
              original: parsed[field],
              converted: parsed[field].replace(/\\/g, '/')
            });
          }
        }
      }

      if (issues.length > 0) {
        return {
          valid: false,
          issues,
          message: '检测到 YAML 中存在反斜杠路径',
          suggestion: '建议运行 PathUtils.convertYamlPaths() 进行修复'
        };
      }

      return { valid: true, message: 'YAML 路径格式正确' };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  },

  isPathTraversal(pathString) {
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

  validatePathWithinBounds(targetPath, allowedRoot, options = {}) {
    const { 
      allowAbsolute = false, 
      allowedExtensions = [] 
    } = options;

    const issues = [];
    const warnings = [];

    if (!targetPath || typeof targetPath !== 'string') {
      return { valid: false, issues: ['路径不能为空'] };
    }

    if (this.isPathTraversal(targetPath)) {
      issues.push('检测到路径遍历攻击: 路径包含 ".." 跳转');
    }

    const absolutePath = path.isAbsolute(targetPath) ? targetPath : path.resolve(allowedRoot, targetPath);
    
    if (!allowAbsolute && path.isAbsolute(targetPath)) {
      warnings.push('建议使用相对路径而非绝对路径');
    }

    if (!this.isWithinDirectory(absolutePath, allowedRoot)) {
      issues.push(`路径越界: ${targetPath} 不在允许的目录 ${allowedRoot} 内`);
    }

    if (allowedExtensions.length > 0) {
      const ext = path.extname(targetPath).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        issues.push(`不支持的文件类型: ${ext}，允许的类型: ${allowedExtensions.join(', ')}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      resolvedPath: absolutePath
    };
  },

  sanitizePath(inputPath, baseDir = '') {
    if (!inputPath || typeof inputPath !== 'string') {
      return '';
    }

    let sanitized = inputPath.trim();

    sanitized = sanitized.replace(/[<>:"|?*]/g, '');

    sanitized = sanitized.replace(/\.\.+/g, '.');

    if (baseDir) {
      const resolved = path.resolve(baseDir, sanitized);
      if (!this.isWithinDirectory(resolved, baseDir)) {
        return path.basename(sanitized);
      }
      return path.relative(baseDir, resolved);
    }

    return sanitized;
  }
};

module.exports = PathUtils;
