/**
 * =====================================================================
 * logs.ts - 执行日志（notification_execution_logs）路由
 * =====================================================================
 *
 * API 列表：
 *   GET    /api/logs              - 获取日志列表（分页+筛选）
 *   GET    /api/logs/:id          - 获取单条日志详情
 *   POST   /api/logs              - 创建执行日志（记录一次执行结果）
 *   DELETE /api/logs/:id          - 删除单条日志
 *   DELETE /api/logs              - 批量清理日志（按条件）
 *
 * 设计说明：
 *   - 不提供 PUT/PATCH 接口（日志是只读记录，创建后不可修改）
 *   - 支持按 task_id、channel_id、status、日期范围筛选
 *   - 提供批量清理功能，避免日志无限增长
 *
 * 关联关系：
 *   - task_id -> notification_tasks.id（外键，CASCADE 删除）
 *   - channel_id -> notification_channels.id（外键，CASCADE 删除）
 */

import { Hono } from 'hono';
import type { Bindings } from '@shared/types';
import { getPagination, now } from '../utils/db';
import { success, successWithPagination, error } from '../utils/response';
import { required, enumCheck, validateAll } from '../utils/validators';

const logs = new Hono<{ Bindings: Bindings }>();

// ======================== GET /api/logs - 获取日志列表 ========================

/**
 * 获取执行日志列表（分页 + 多条件筛选）
 *
 * Query 参数：
 *   - page / pageSize: 分页
 *   - task_id: 按任务 ID 筛选
 *   - channel_id: 按渠道 ID 筛选
 *   - status: 按执行结果筛选（success / failed）
 *   - start_time: 开始时间（格式 YYYY-MM-DD HH:mm:ss）
 *   - end_time: 结束时间
 *
 * 示例：GET /api/logs?task_id=1&status=failed&page=1
 */
logs.get('/', async (c) => {
  const db = c.env.DB;
  const { page, pageSize, limit, offset } = getPagination(
    c.req.query('page'),
    c.req.query('pageSize')
  );

  const conditions: string[] = [];
  const params: any[] = [];

  // 按任务 ID 筛选
  const taskId = c.req.query('task_id');
  if (taskId) {
    conditions.push('l.task_id = ?');
    params.push(parseInt(taskId, 10));
  }

  // 按渠道 ID 筛选
  const channelId = c.req.query('channel_id');
  if (channelId) {
    conditions.push('l.channel_id = ?');
    params.push(parseInt(channelId, 10));
  }

  // 按执行结果筛选
  const status = c.req.query('status');
  if (status) {
    conditions.push('l.status = ?');
    params.push(status);
  }

  // 按时间范围筛选（executed_at 字段）
  const startTime = c.req.query('start_time');
  if (startTime) {
    conditions.push('l.executed_at >= ?');
    params.push(startTime);
  }

  const endTime = c.req.query('end_time');
  if (endTime) {
    conditions.push('l.executed_at <= ?');
    params.push(endTime);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    // 查询总数
    const countResult = await db
      .prepare(`SELECT COUNT(*) as total FROM notification_execution_logs l ${whereClause}`)
      .bind(...params)
      .first<{ total: number }>();

    const total = countResult?.total || 0;

    /**
     * 使用 LEFT JOIN 关联任务表和渠道表，获取名称信息
     * 这样前端可以直接展示任务名称和渠道名称，不需要额外查询
     */
    const listResult = await db
      .prepare(
        `SELECT
           l.*,
           t.name AS task_name,
           ch.name AS channel_name
         FROM notification_execution_logs l
         LEFT JOIN notification_tasks t ON l.task_id = t.id
         LEFT JOIN notification_channels ch ON l.channel_id = ch.id
         ${whereClause}
         ORDER BY l.id DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, limit, offset)
      .all();

    return successWithPagination(c, listResult.results, total, page, pageSize);
  } catch (err: any) {
    console.error('[LOGS] 查询列表失败:', err);
    return error(c, `查询失败: ${err.message}`, -1, 500);
  }
});

// ======================== GET /api/logs/:id - 获取单条日志 ========================

/**
 * 获取单条执行日志详情
 *
 * 同样通过 JOIN 获取关联的任务名称和渠道名称
 */
logs.get('/:id', async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return error(c, '无效的日志 ID');
  }

  try {
    const log = await db
      .prepare(
        `SELECT
           l.*,
           t.name AS task_name,
           ch.name AS channel_name
         FROM notification_execution_logs l
         LEFT JOIN notification_tasks t ON l.task_id = t.id
         LEFT JOIN notification_channels ch ON l.channel_id = ch.id
         WHERE l.id = ?`
      )
      .bind(id)
      .first();

    if (!log) {
      return error(c, '日志不存在', -1, 404);
    }

    return success(c, log);
  } catch (err: any) {
    console.error('[LOGS] 查询详情失败:', err);
    return error(c, `查询失败: ${err.message}`, -1, 500);
  }
});

// ======================== POST /api/logs - 创建执行日志 ========================

/**
 * 创建一条执行日志
 *
 * 通常在通知发送后由调度器调用，记录执行结果
 *
 * 请求体：
 * {
 *   "task_id": 1,
 *   "channel_id": 2,
 *   "scheduled_time": "2026-07-10 09:00:00",
 *   "status": "success",          // 或 "failed"
 *   "response": "{\"errcode\":0}",  // 成功时的原始响应（可选）
 *   "error_message": null          // 失败时的错误信息（可选）
 * }
 *
 * 校验规则：
 *   - task_id / channel_id: 必填 + 正整数
 *   - scheduled_time: 必填
 *   - status: 必填 + 枚举值
 */
logs.post('/', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();

  // ---- 参数校验 ----
  const errors = validateAll([
    required(body.task_id, 'task_id'),
    required(body.channel_id, 'channel_id'),
    required(body.scheduled_time, 'scheduled_time'),
    required(body.status, 'status'),
    enumCheck(body.status, ['success', 'failed'], 'status'),
  ]);

  if (errors.length > 0) {
    return error(c, errors.join('; '));
  }

  // 校验 ID 为正整数
  if (!Number.isInteger(body.task_id) || body.task_id <= 0) {
    return error(c, 'task_id 必须是正整数');
  }
  if (!Number.isInteger(body.channel_id) || body.channel_id <= 0) {
    return error(c, 'channel_id 必须是正整数');
  }

  try {
    // 验证关联的任务是否存在
    const taskExists = await db
      .prepare('SELECT id FROM notification_tasks WHERE id = ?')
      .bind(body.task_id)
      .first();

    if (!taskExists) {
      return error(c, `任务 ID ${body.task_id} 不存在`);
    }

    // 验证关联的渠道是否存在
    const channelExists = await db
      .prepare('SELECT id FROM notification_channels WHERE id = ?')
      .bind(body.channel_id)
      .first();

    if (!channelExists) {
      return error(c, `渠道 ID ${body.channel_id} 不存在`);
    }

    const currentTime = now();

    const result = await db
      .prepare(
        `INSERT INTO notification_execution_logs
         (task_id, channel_id, scheduled_time, executed_at, status, response, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        body.task_id,
        body.channel_id,
        body.scheduled_time,
        currentTime,                       // executed_at 使用当前时间
        body.status,
        body.response || null,             // 成功时的原始响应
        body.error_message || null         // 失败时的错误信息
      )
      .run();

    const newId = result.meta.last_row_id;

    // 返回新创建的日志记录
    const newLog = await db
      .prepare('SELECT * FROM notification_execution_logs WHERE id = ?')
      .bind(newId)
      .first();

    return success(c, newLog, '日志创建成功', 201);
  } catch (err: any) {
    console.error('[LOGS] 创建失败:', err);
    return error(c, `创建失败: ${err.message}`, -1, 500);
  }
});

// ======================== DELETE /api/logs/:id - 删除单条日志 ========================

/**
 * 删除单条执行日志
 */
logs.delete('/:id', async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return error(c, '无效的日志 ID');
  }

  try {
    const existing = await db
      .prepare('SELECT id FROM notification_execution_logs WHERE id = ?')
      .bind(id)
      .first();

    if (!existing) {
      return error(c, '日志不存在', -1, 404);
    }

    await db
      .prepare('DELETE FROM notification_execution_logs WHERE id = ?')
      .bind(id)
      .run();

    return success(c, { id }, '删除成功');
  } catch (err: any) {
    console.error('[LOGS] 删除失败:', err);
    return error(c, `删除失败: ${err.message}`, -1, 500);
  }
});

// ======================== DELETE /api/logs - 批量清理日志 ========================

/**
 * 批量清理执行日志
 *
 * Query 参数（至少提供一个）：
 *   - task_id: 清理指定任务的日志
 *   - status: 清理指定状态的日志（如清理所有 failed 日志）
 *   - before: 清理指定日期之前的日志（格式 YYYY-MM-DD HH:mm:ss）
 *
 * 示例：
 *   DELETE /api/logs?status=failed           - 清理所有失败日志
 *   DELETE /api/logs?before=2026-01-01 00:00:00 - 清理 2026 年前的日志
 *
 * 安全限制：
 *   - 必须至少提供一个筛选条件，防止误删全部日志
 *   - 单次最多删除 10000 条
 */
logs.delete('/', async (c) => {
  const db = c.env.DB;

  const conditions: string[] = [];
  const params: any[] = [];

  const taskId = c.req.query('task_id');
  if (taskId) {
    conditions.push('task_id = ?');
    params.push(parseInt(taskId, 10));
  }

  const status = c.req.query('status');
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const before = c.req.query('before');
  if (before) {
    conditions.push('executed_at < ?');
    params.push(before);
  }

  // 安全限制：必须提供至少一个筛选条件
  if (conditions.length === 0) {
    return error(c, '必须提供至少一个筛选条件（task_id / status / before）');
  }

  try {
    const whereClause = conditions.join(' AND ');

    // 先查询将删除的记录数（用于返回结果）
    const countResult = await db
      .prepare(`SELECT COUNT(*) as total FROM notification_execution_logs WHERE ${whereClause}`)
      .bind(...params)
      .first<{ total: number }>();

    const totalToDelete = countResult?.total || 0;

    if (totalToDelete === 0) {
      return success(c, { deleted: 0 }, '没有符合条件的日志需要清理');
    }

    // 安全限制：单次最多删除 10000 条，防止长时间锁定数据库
    if (totalToDelete > 10000) {
      return error(c, `待清理日志数量过多（${totalToDelete}），请缩小筛选范围（单次上限 10000 条）`);
    }

    // 执行删除
    await db
      .prepare(`DELETE FROM notification_execution_logs WHERE ${whereClause}`)
      .bind(...params)
      .run();

    return success(c, { deleted: totalToDelete }, `成功清理 ${totalToDelete} 条日志`);
  } catch (err: any) {
    console.error('[LOGS] 批量清理失败:', err);
    return error(c, `清理失败: ${err.message}`, -1, 500);
  }
});

export default logs;