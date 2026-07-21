/**
 * =====================================================================
 * response.ts - 统一 API 响应格式工具
 * =====================================================================
 *
 * 职责：
 *   提供标准化的 JSON 响应格式，确保所有 API 返回一致的数据结构
 *
 * 统一响应结构：
 * {
 *   code: number,      // 业务状态码（0=成功，非0=失败）
 *   message: string,   // 人类可读的描述信息
 *   data?: any,        // 响应数据（可选）
 *   meta?: object      // 分页等元数据（可选）
 * }
 *
 * 使用示例：
 *   return success(c, { id: 1, name: 'test' });
 *   return error(c, '参数错误', -1, 400);
 *   return successWithPagination(c, list, 100, 1, 20);
 */

import { Context } from 'hono';

/**
 * 成功响应
 *
 * @param {Context} c - Hono 请求上下文
 * @param {any} data - 返回的业务数据
 * @param {string} message - 成功提示，默认 "ok"
 * @param {any} status - HTTP 状态码，默认 200
 * @returns {Response} 标准 JSON 响应
 */
export function success(
  c: Context,
  data: any = null,
  message: string = 'ok',
  status: any = 200
) {
  return c.json(
    {
      code: 0, // 0 表示业务成功
      success: true,
      message,
      data,
    },
    status
  );
}

/**
 * 带分页信息的成功响应
 *
 * @param {Context} c - Hono 请求上下文
 * @param {any[]} list - 当前页数据列表
 * @param {number} total - 总记录数
 * @param {number} page - 当前页码
 * @param {number} pageSize - 每页数量
 * @returns {Response} 包含 meta 分页信息的 JSON 响应
 */
export function successWithPagination(
  c: Context,
  list: any[],
  total: number,
  page: number,
  pageSize: number
) {
  return c.json({
    code: 0,
    success: true,
    message: 'ok',
    data: list,
    meta: {
      total,                                  // 总记录数
      page,                                   // 当前页码
      pageSize,                               // 每页数量
      totalPages: Math.ceil(total / pageSize), // 总页数
    },
  });
}

/**
 * 失败/错误响应
 *
 * @param {Context} c - Hono 请求上下文
 * @param {string} message - 错误描述信息
 * @param {number} code - 业务错误码，默认 -1
 * @param {number} status - HTTP 状态码，默认 400
 * @returns {Response} 标准错误 JSON 响应
 */
export function error(
  c: Context,
  message: string = '操作失败',
  code: number = -1,
  status: any = 400
) {
  return c.json(
    {
      code,
      success: false,
      message,
      data: null,
    },
    status
  );
}