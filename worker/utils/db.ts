/**
 * =====================================================================
 * db.ts - 数据库通用工具函数
 * =====================================================================
 *
 * 职责：
 *   1. 提供表存在性检查（查询 sqlite_master 系统表）
 *   2. 提供分页参数计算
 *   3. 提供本地时间生成工具
 *
 * 说明：
 *   - D1 是基于 SQLite 的边缘数据库，支持 sqlite_master 查询
 *   - 通过 c.env.DB 访问数据库实例，不在此文件中持有全局引用
 *   - 所有函数都是纯工具函数，接收 D1Database 实例作为参数
 */

/**
 * 检查指定表是否存在于 D1 数据库中
 *
 * 原理：SQLite 将所有数据库对象（表、索引、视图等）的元数据
 *       存储在系统表 sqlite_master 中，查询该表即可判断表是否存在
 *
 * @param {D1Database} db - D1 数据库实例（来自 c.env.DB）
 * @param {string} tableName - 要检查的表名
 * @returns {Promise<boolean>} 表是否存在
 *
 * @example
 * const exists = await tableExists(c.env.DB, 'notification_tasks');
 * if (!exists) {
 *   // 执行建表操作
 * }
 */
export async function tableExists(
  db: D1Database,
  tableName: string
): Promise<boolean> {
  // 查询 sqlite_master 系统表，检查 type='table' 且 name 匹配的记录
  const result = await db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .bind(tableName)
    .first();

  // first() 返回第一行对象或 null，!! 转换为布尔值
  return !!result;
}

/**
 * 批量检查多个表是否存在
 *
 * @param {D1Database} db - D1 数据库实例
 * @param {string[]} tableNames - 要检查的表名数组
 * @returns {Promise<Record<string, boolean>>} 表名 -> 是否存在的映射
 *
 * @example
 * const status = await checkTables(c.env.DB, ['notification_tasks', 'notification_channels']);
 * // { notification_tasks: true, notification_channels: false }
 */
export async function checkTables(
  db: D1Database,
  tableNames: string[]
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};

  // 逐个检查每张表（D1 不支持 INFORMATION_SCHEMA，需逐个查 sqlite_master）
  for (const name of tableNames) {
    result[name] = await tableExists(db, name);
  }

  return result;
}

/**
 * 通用分页参数计算
 *
 * 将前端传入的 page/pageSize 转换为 SQL 的 LIMIT/OFFSET
 * 同时做安全校验，防止异常值
 *
 * @param {string | undefined} pageStr - 页码字符串（来自 query 参数）
 * @param {string | undefined} pageSizeStr - 每页数量字符串（来自 query 参数）
 * @returns {{ page: number, pageSize: number, limit: number, offset: number }}
 *
 * @example
 * const { limit, offset } = getPagination('2', '10');
 * // { page: 2, pageSize: 10, limit: 10, offset: 10 }
 */
export function getPagination(
  pageStr?: string,
  pageSizeStr?: string
): { page: number; pageSize: number; limit: number; offset: number } {
  // 解析并限制页码最小为 1
  const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);

  // 解析每页数量，限制在 1~100 之间，防止一次查询过多数据
  const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr || '20', 10) || 20));

  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

/**
 * 获取当前本地时间字符串
 *
 * D1 的 DEFAULT (datetime('now', 'localtime')) 使用数据库服务器时间
 * 当需要手动设置时间字段时，可使用此函数保持一致
 *
 * @returns {string} 本地时间字符串
 */
export function now(): string {
  const d = new Date();
  return d.toISOString();
}