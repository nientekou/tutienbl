// C-05: Input Validation

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

class InputValidator {
  /**
   * C-05: Validate string input
   */
  validateString(value: any, options: { minLength?: number; maxLength?: number; pattern?: RegExp; required?: boolean } = {}): ValidationResult {
    const errors: string[] = [];

    if (options.required && (value === undefined || value === null || value === '')) {
      errors.push('Trường bắt buộc');
    }

    if (typeof value === 'string') {
      if (options.minLength && value.length < options.minLength) {
        errors.push(`Quá ngắn (tối thiểu ${options.minLength})`);
      }
      if (options.maxLength && value.length > options.maxLength) {
        errors.push(`Quá dài (tối đa ${options.maxLength})`);
      }
      if (options.pattern && !options.pattern.test(value)) {
        errors.push('Định dạng không hợp lệ');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * C-05: Validate number input
   */
  validateNumber(value: any, options: { min?: number; max?: number; integer?: boolean; required?: boolean } = {}): ValidationResult {
    const errors: string[] = [];

    if (options.required && (value === undefined || value === null)) {
      errors.push('Trường bắt buộc');
    }

    if (typeof value === 'number') {
      if (isNaN(value)) errors.push('Số không hợp lệ');
      if (options.min !== undefined && value < options.min) errors.push(`Quá nhỏ (tối thiểu ${options.min})`);
      if (options.max !== undefined && value > options.max) errors.push(`Quá lớn (tối đa ${options.max})`);
      if (options.integer && !Number.isInteger(value)) errors.push('Phải là số nguyên');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * C-05: Validate enum input
   */
  validateEnum(value: any, enumValues: any[]): ValidationResult {
    if (!enumValues.includes(value)) {
      return { valid: false, errors: ['Giá trị không hợp lệ'] };
    }
    return { valid: true, errors: [] };
  }

  /**
   * C-05: Sanitize string input
   */
  sanitizeString(value: string): string {
    return value
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .replace(/;/g, '') // Remove semicolons
      .trim();
  }

  /**
   * C-05: Validate multiple fields
   */
  validateFields(data: Record<string, any>, rules: Record<string, { type: string; required?: boolean; minLength?: number; maxLength?: number; min?: number; max?: number; enumValues?: any[] }>): ValidationResult {
    const errors: string[] = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];

      if (rule.type === 'string') {
        const result = this.validateString(value, {
          required: rule.required,
          minLength: rule.minLength,
          maxLength: rule.maxLength
        });
        if (!result.valid) errors.push(`${field}: ${result.errors.join(', ')}`);
      } else if (rule.type === 'number') {
        const result = this.validateNumber(value, {
          required: rule.required,
          min: rule.min,
          max: rule.max
        });
        if (!result.valid) errors.push(`${field}: ${result.errors.join(', ')}`);
      } else if (rule.type === 'enum' && rule.enumValues) {
        const result = this.validateEnum(value, rule.enumValues);
        if (!result.valid) errors.push(`${field}: ${result.errors.join(', ')}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export const inputValidator = new InputValidator();
