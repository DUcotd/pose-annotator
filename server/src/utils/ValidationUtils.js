const logger = require('../utils/logger');

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
      required: true,
      minLength: 1
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
    }
  }
};

function validateTrainConfig(config) {
  return validate(config, TrainConfigSchema);
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
  validateTrainConfig,
  formatValidationErrors,
  TrainConfigSchema
};
