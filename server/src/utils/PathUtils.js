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
  }
};

module.exports = PathUtils;
