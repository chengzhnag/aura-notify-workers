/**
 * =====================================================================
 * validators.ts - 通用数据校验工具
 * =====================================================================
 *
 * 职责：
 *   1. 提供常用字段校验函数（必填、长度、枚举等）
 *   2. 返回结构化的校验结果，方便路由层快速判断
 *   3. 支持 JSON 字符串格式校验
 *
 * 设计思路：
 *   - 每个校验函数返回 { valid: boolean, message?: string }
 *   - 路由层可以收集所有校验错误后一次性返回给前端
 *   - 保持简单，不引入第三方校验库
 */

/** 校验结果类型 */
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * 校验字段是否为非空字符串
 *
 * @param {any} value - 待校验的值
 * @param {string} fieldName - 字段名（用于错误提示）
 * @returns {ValidationResult}
 */
export function required(value: any, fieldName: string): ValidationResult {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { valid: false, message: `${fieldName} 不能为空` };
  }
  return { valid: true };
}

/**
 * 校验字符串最大长度
 *
 * @param {string} value - 待校验的字符串
 * @param {number} maxLen - 最大长度
 * @param {string} fieldName - 字段名
 * @returns {ValidationResult}
 */
export function maxLength(
  value: string,
  maxLen: number,
  fieldName: string
): ValidationResult {
  if (value && value.length > maxLen) {
    return { valid: false, message: `${fieldName} 长度不能超过 ${maxLen} 个字符` };
  }
  return { valid: true };
}

/**
 * 校验值是否在允许的枚举列表中
 *
 * @param {any} value - 待校验的值
 * @param {any[]} allowed - 允许的值列表
 * @param {string} fieldName - 字段名
 * @returns {ValidationResult}
 */
export function enumCheck(
  value: any,
  allowed: any[],
  fieldName: string
): ValidationResult {
  if (!allowed.includes(value)) {
    return {
      valid: false,
      message: `${fieldName} 必须是 [${allowed.join(', ')}] 之一`,
    };
  }
  return { valid: true };
}

/**
 * 校验字符串是否为合法的 JSON 格式
 *
 * @param {string} value - 待校验的 JSON 字符串
 * @param {string} fieldName - 字段名
 * @returns {ValidationResult}
 */
export function validJson(value: string, fieldName: string): ValidationResult {
  try {
    JSON.parse(value);
    return { valid: true };
  } catch {
    return { valid: false, message: `${fieldName} 必须是合法的 JSON 格式` };
  }
}

/**
 * 校验字符串是否为合法日期格式（YYYY-MM-DD）
 *
 * @param {string} value - 待校验的日期字符串
 * @param {string} fieldName - 字段名
 * @returns {ValidationResult}
 */
export function validDate(value: string, fieldName: string): ValidationResult {
  // 使用正则检查格式，再用 Date 验证有效性
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    return { valid: false, message: `${fieldName} 格式必须为 YYYY-MM-DD` };
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    return { valid: false, message: `${fieldName} 不是有效日期` };
  }
  return { valid: true };
}

/**
 * 批量运行多个校验，收集所有错误
 *
 * 使用方法：
 *   const errors = validateAll([
 *     required(body.name, 'name'),
 *     maxLength(body.name, 100, 'name'),
 *     enumCheck(body.task_type, ['single', 'recurring', 'permanent'], 'task_type'),
 *   ]);
 *   if (errors.length > 0) return error(c, errors.join('; '));
 *
 * @param {ValidationResult[]} results - 校验结果数组
 * @returns {string[]} 所有校验失败的错误信息数组
 */
export function validateAll(results: ValidationResult[]): string[] {
  return results
    .filter((r) => !r.valid)
    .map((r) => r.message!)
    .filter(Boolean);
}