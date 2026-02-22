const logger = require('../utils/logger');

const IPV4_PATTERN = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(?:\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$/;

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const ValidationRules = {
  number: (value, options = {}) => {
    if (typeof value !== 'number' || isNaN(value)) {
      return { valid: false, error: '必须是数字类型' };
    }
    if (options.min !== undefined && value < options.min) {
      return { valid: false, error: `必须大于等于 ${options.min}` };
    }
    if (options.max !== undefined && value > options.max) {
      return { valid: false, error: `必须小于等于 ${options.max}` };
    }
    if (options.integer && !Number.isInteger(value)) {
      return { valid: false, error: '必须是整数' };
    }
    return { valid: true };
  },

  string: (value, options = {}) => {
    if (typeof value !== 'string') {
      return { valid: false, error: '必须是字符串类型' };
    }
    if (options.minLength !== undefined && value.length < options.minLength) {
      return { valid: false, error: `长度必须至少 ${options.minLength} 个字符` };
    }
    if (options.maxLength !== undefined && value.length > options.maxLength) {
      return { valid: false, error: `长度不能超过 ${options.maxLength} 个字符` };
    }
    if (options.pattern && !options.pattern.test(value)) {
      return { valid: false, error: options.patternMessage || '格式不正确' };
    }
    if (options.enum && !options.enum.includes(value)) {
      return { valid: false, error: `必须是以下值之一: ${options.enum.join(', ')}` };
    }
    return { valid: true };
  },

  boolean: (value) => {
    if (typeof value !== 'boolean') {
      return { valid: false, error: '必须是布尔类型' };
    }
    return { valid: true };
  },

  array: (value, options = {}) => {
    if (!Array.isArray(value)) {
      return { valid: false, error: '必须是数组类型' };
    }
    if (options.minItems !== undefined && value.length < options.minItems) {
      return { valid: false, error: `至少需要 ${options.minItems} 个元素` };
    }
    if (options.maxItems !== undefined && value.length > options.maxItems) {
      return { valid: false, error: `最多只能有 ${options.maxItems} 个元素` };
    }
    if (options.items) {
      for (let i = 0; i < value.length; i++) {
        const itemValidation = validate(value[i], options.items);
        if (!itemValidation.valid) {
          return { valid: false, error: `第 ${i + 1} 个元素: ${itemValidation.error}` };
        }
      }
    }
    return { valid: true };
  }
};

function validate(value, schema) {
  const errors = [];

  if (schema.required && value === undefined) {
    return { valid: false, error: '此字段为必填项' };
  }

  if (value === undefined || value === null) {
    return { valid: true };
  }

  for (const [field, rules] of Object.entries(schema.properties)) {
    const fieldValue = value[field];
    
    if (rules.required && (fieldValue === undefined || fieldValue === null)) {
      errors.push({ field, error: `${field} 为必填项` });
      continue;
    }

    if (fieldValue === undefined || fieldValue === null) {
      continue;
    }

    let result;
    switch (rules.type) {
      case 'number':
        result = ValidationRules.number(fieldValue, rules);
        break;
      case 'string':
        result = ValidationRules.string(fieldValue, rules);
        break;
      case 'boolean':
        result = ValidationRules.boolean(fieldValue);
        break;
      case 'array':
        result = ValidationRules.array(fieldValue, rules);
        break;
      default:
        continue;
    }

    if (!result.valid) {
      errors.push({ field, error: result.error });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

const TrainConfigSchema = {
  type: 'object',
  required: false,
  properties: {
    epochs: {
      type: 'number',
      required: true,
      min: 1,
      max: 10000,
      integer: true
    },
    batch: {
      type: 'number',
      required: true,
      min: 1,
      max: 512,
      integer: true
    },
    imgsz: {
      type: 'number',
      required: true,
      min: 32,
      max: 4096,
      integer: true
    },
    model: {
      type: 'string',
      required: true,
      enum: ['yolov8n.pt', 'yolov8s.pt', 'yolov8m.pt', 'yolov8l.pt', 'yolov8x.pt', 
             'yolov8n-pose.pt', 'yolov8s-pose.pt', 'yolov8m-pose.pt', 'yolov8l-pose.pt', 'yolov8x-pose.pt']
    },
    device: {
      type: 'string',
      required: false,
      enum: ['0', '1', '2', '3', 'cpu', 'auto']
    },
    data: {
      type: 'string',
      required: false
    },
    workers: {
      type: 'number',
      required: false,
      min: 0,
      max: 32,
      integer: true
    },
    optimizer: {
      type: 'string',
      required: false,
      enum: ['auto', 'SGD', 'Adam', 'AdamW', 'NAdam', 'RAdam', 'RMSProp']
    },
    lr0: {
      type: 'number',
      required: false,
      min: 0,
      max: 1
    },
    lrf: {
      type: 'number',
      required: false,
      min: 0,
      max: 1
    },
    momentum: {
      type: 'number',
      required: false,
      min: 0,
      max: 1
    },
    weight_decay: {
      type: 'number',
      required: false,
      min: 0,
      max: 1
    },
    patience: {
      type: 'number',
      required: false,
      min: 0,
      max: 1000,
      integer: true
    },
    cos_lr: {
      type: 'boolean',
      required: false
    },
    rect: {
      type: 'boolean',
      required: false
    },
    cache_images: {
      type: 'boolean',
      required: false
    },
    export_formats: {
      type: 'string',
      required: false,
      pattern: /^[a-z0-9,]*$/i,
      patternMessage: '格式应为逗号分隔的格式名称，如: onnx,tflite'
    },
    remoteEnabled: {
      type: 'boolean',
      required: false
    },
    remoteHost: {
      type: 'string',
      required: false,
      maxLength: 255
    },
    remotePort: {
      type: 'number',
      required: false,
      min: 1,
      max: 65535,
      integer: true
    },
    remoteUser: {
      type: 'string',
      required: false,
      maxLength: 128
    },
    remotePassword: {
      type: 'string',
      required: false,
      maxLength: 512
    },
    remotePath: {
      type: 'string',
      required: false,
      maxLength: 1024
    },
    remotePython: {
      type: 'string',
      required: false,
      maxLength: 256
    }
  }
};

function validateRemoteTrainConfig(config = {}) {
  if (!config || config.remoteEnabled !== true) {
    return { valid: true };
  }

  const errors = [];

  const remoteHost = toTrimmedString(config.remoteHost);
  if (!remoteHost) {
    errors.push({ field: 'remoteHost', error: '启用远程训练时必须填写主机地址' });
  } else if (!(IPV4_PATTERN.test(remoteHost) || HOSTNAME_PATTERN.test(remoteHost))) {
    errors.push({ field: 'remoteHost', error: '主机地址格式不正确（支持 IP 或主机名）' });
  }

  const remotePort = Number(config.remotePort);
  if (!Number.isInteger(remotePort) || remotePort < 1 || remotePort > 65535) {
    errors.push({ field: 'remotePort', error: '端口必须是 1-65535 之间的整数' });
  }

  const remoteUser = toTrimmedString(config.remoteUser);
  if (!remoteUser) {
    errors.push({ field: 'remoteUser', error: '启用远程训练时必须填写用户名' });
  }

  const remotePassword = toTrimmedString(config.remotePassword);
  if (!remotePassword) {
    errors.push({ field: 'remotePassword', error: '启用远程训练时必须填写密码' });
  }

  const remotePath = toTrimmedString(config.remotePath);
  if (!remotePath) {
    errors.push({ field: 'remotePath', error: '启用远程训练时必须填写远程工作路径' });
  } else if (!remotePath.startsWith('/')) {
    errors.push({ field: 'remotePath', error: '远程工作路径必须使用 Linux 绝对路径（以 / 开头）' });
  } else if (/[\r\n]/.test(remotePath)) {
    errors.push({ field: 'remotePath', error: '远程工作路径不能包含换行符' });
  }

  const remotePython = toTrimmedString(config.remotePython);
  if (!remotePython) {
    errors.push({ field: 'remotePython', error: '启用远程训练时必须填写 Python 解释器路径' });
  } else if (/[\r\n]/.test(remotePython)) {
    errors.push({ field: 'remotePython', error: 'Python 解释器路径不能包含换行符' });
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

function validateTrainConfig(config) {
  const baseValidation = validate(config, TrainConfigSchema);
  const remoteValidation = validateRemoteTrainConfig(config);

  if (baseValidation.valid && remoteValidation.valid) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: [
      ...(Array.isArray(baseValidation.errors) ? baseValidation.errors : []),
      ...(Array.isArray(remoteValidation.errors) ? remoteValidation.errors : [])
    ]
  };
}

function formatValidationErrors(validationResult) {
  if (validationResult.valid) {
    return null;
  }

  const errorMessages = [];
  
  if (validationResult.errors) {
    for (const err of validationResult.errors) {
      errorMessages.push(`- ${err.field}: ${err.error}`);
    }
  } else if (validationResult.error) {
    errorMessages.push(`- ${validationResult.error}`);
  }

  return {
    code: 'VALIDATION_ERROR',
    message: '参数校验失败',
    details: errorMessages,
    originalError: validationResult.error || '请检查输入的参数'
  };
}

module.exports = {
  validate,
  validateRemoteTrainConfig,
  validateTrainConfig,
  formatValidationErrors,
  TrainConfigSchema
};
