/**
 * =====================================================================
 * tasks.ts - 通知任务（notification_tasks）CRUD 路由
 * =====================================================================
 *
 * API 列表：
 *   GET    /api/tasks              - 获取任务列表（支持分页+筛选）
 *   GET    /api/tasks/active-count - 获取活跃任务数量
 *   GET    /api/tasks/:id          - 获取单个任务详情
 *   POST   /api/tasks              - 创建任务
 *   POST   /api/tasks/:id/trigger  - 手动触发任务（向配置的渠道发送通知）
 *   PUT    /api/tasks/:id          - 更新任务
 *   PATCH  /api/tasks/:id/status   - 切换任务启用/禁用状态
 *   DELETE /api/tasks/:id          - 删除任务
 *
 * 业务说明：
 *   - single（单次任务）：在 execute_date 指定的日期执行
 *   - recurring（周期任务）：在 start_date ~ end_date 之间按 frequency 循环执行
 *   - permanent（永久任务）：无结束日期，按 frequency 持续执行
 *   - frequency: JSON 数组，如 ["08:00", "12:00", "18:00"]
 *   - channel_ids: JSON 数组，如 [1, 2, 3] 指定通知发送到的渠道
 *   - date_types: all=每天, workday=仅工作日, holiday=仅节假日
 */

import { Hono } from 'hono';
import type { Bindings, NotificationChannel, NotificationTask } from '@shared/types';
import { TASK_STATUS } from '@shared/constants';
import { getPagination, now } from '../utils/db';
import { success, successWithPagination, error } from '../utils/response';
import {
  required,
  maxLength,
  enumCheck,
  validJson,
  validDate,
  validateAll,
} from '../utils/validators';
import { sendToChannels, NotificationContent } from '../push/index';

const tasks = new Hono<{ Bindings: Bindings }>();

// ======================== GET /api/tasks - 获取任务列表 ========================

/**
 * 获取通知任务列表（分页 + 多条件筛选）
 *
 * Query 参数：
 *   - page / pageSize: 分页参数
 *   - task_type: 按任务类型筛选（single / recurring / permanent）
  *   - status: 按状态筛选（active / inactive / finished）
 *   - date_types: 按日期类型筛选（all / workday / holiday）
 *   - keyword: 按任务名称模糊搜索
 *
 * 示例请求：GET /api/tasks?page=1&pageSize=10&status=active&keyword=日报
 */
tasks.get('/', async (c) => {
  const db = c.env.DB;
  const { page, pageSize, limit, offset } = getPagination(
    c.req.query('page'),
    c.req.query('pageSize')
  );

  // ---- 动态构建 WHERE 条件 ----
  const conditions: string[] = [];
  const params: any[] = [];

  // 按任务类型筛选
  const taskType = c.req.query('task_type');
  if (taskType) {
    conditions.push('task_type = ?');
    params.push(taskType);
  }

  // 按状态筛选
  const status = c.req.query('status');
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  // 按日期类型筛选
  const dateTypes = c.req.query('date_types');
  if (dateTypes) {
    conditions.push('date_types = ?');
    params.push(dateTypes);
  }

  // 按名称关键词模糊搜索（使用 LIKE）
  const keyword = c.req.query('keyword');
  if (keyword) {
    conditions.push('name LIKE ?');
    params.push(`%${keyword}%`); // SQL LIKE 通配符
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    // 查询总数
    const countResult = await db
      .prepare(`SELECT COUNT(*) as total FROM notification_tasks ${whereClause}`)
      .bind(...params)
      .first<{ total: number }>();

    const total = countResult?.total || 0;

    // 查询当前页数据（finished 状态排在最后，其余按 id 倒序）
    const listResult = await db
      .prepare(
        `SELECT * FROM notification_tasks ${whereClause} ORDER BY CASE WHEN status = 'finished' THEN 1 ELSE 0 END, id DESC LIMIT ? OFFSET ?`
      )
      .bind(...params, limit, offset)
      .all();

    return successWithPagination(c, listResult.results, total, page, pageSize);
  } catch (err: any) {
    console.error('[TASKS] 查询列表失败:', err);
    return error(c, `查询失败: ${err.message}`, -1, 500);
  }
});

// ======================== GET /api/tasks/active-count - 获取活跃任务数量 ========================

/**
 * 获取状态为 active 的任务数量
 *
 * 响应示例：
 * {
 *   "code": 0,
 *   "data": { "activeCount": 5, "totalCount": 10 }
 * }
 */
tasks.get('/active-count', async (c) => {
  const db = c.env.DB;

  try {
    const activeCountResult = await db
      .prepare('SELECT COUNT(*) as count FROM notification_tasks WHERE status = ?')
      .bind(TASK_STATUS.ACTIVE)
      .first<{ count: number }>();

    const totalCountResult = await db
      .prepare('SELECT COUNT(*) as count FROM notification_tasks')
      .first<{ count: number }>();

    return success(c, {
      activeCount: activeCountResult?.count || 0,
      totalCount: totalCountResult?.count || 0,
    });
  } catch (err: any) {
    console.error('[TASKS] 获取活跃任务数量失败:', err);
    return error(c, `查询失败: ${err.message}`, -1, 500);
  }
});

// ======================== GET /api/tasks/:id - 获取单个任务 ========================

/**
 * 获取单个通知任务的详细信息
 *
 * 响应包含任务的所有字段，前端可据此渲染编辑表单
 */
tasks.get('/:id', async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return error(c, '无效的任务 ID');
  }

  try {
    const task = await db
      .prepare('SELECT * FROM notification_tasks WHERE id = ?')
      .bind(id)
      .first();

    if (!task) {
      return error(c, '任务不存在', -1, 404);
    }

    return success(c, task);
  } catch (err: any) {
    console.error('[TASKS] 查询详情失败:', err);
    return error(c, `查询失败: ${err.message}`, -1, 500);
  }
});

// ======================== POST /api/tasks - 创建任务 ========================

/**
 * 创建新的通知任务
 *
 * 请求体示例：
 * {
 *   "name": "每日站会提醒",
 *   "description": "提醒团队参加每日站会",
 *   "title": "站会提醒",
 *   "content": "请准时参加今天的站会",
 *   "task_type": "recurring",
 *   "start_date": "2026-01-01",
 *   "end_date": "2026-12-31",
 *   "frequency": "[\"09:00\", \"09:30\"]",
 *   "channel_ids": "[1, 2]",
 *   "date_types": "workday"
 * }
 *
 * 校验规则：
 *   - name: 必填 + 最大100字符
 *   - title / content: 必填
 *   - task_type: 必填 + 枚举
 *   - frequency / channel_ids: 必填 + 合法 JSON
 *   - date_types: 必填 + 枚举
 *   - 日期字段：如果提供则必须是合法日期格式
 *   - 业务规则：根据 task_type 校验对应日期字段
 */
tasks.post('/', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();

  // ---- 基础字段校验 ----
  const errors = validateAll([
    required(body.name, 'name'),
    maxLength(body.name, 100, 'name'),
    required(body.title, 'title'),
    required(body.content, 'content'),
    required(body.task_type, 'task_type'),
    enumCheck(body.task_type, ['single', 'recurring', 'permanent'], 'task_type'),
    required(body.frequency, 'frequency'),
    validJson(body.frequency, 'frequency'),
    required(body.channel_ids, 'channel_ids'),
    validJson(body.channel_ids, 'channel_ids'),
    required(body.date_types, 'date_types'),
    enumCheck(body.date_types, ['all', 'workday', 'holiday'], 'date_types'),
  ]);

  if (errors.length > 0) {
    return error(c, errors.join('; '));
  }

  // ---- 按任务类型进行业务规则校验 ----
  if (body.task_type === 'single') {
    // 单次任务必须有 execute_date
    if (!body.execute_date) {
      return error(c, '单次任务必须指定 execute_date');
    }
    const dateErr = validateAll([validDate(body.execute_date, 'execute_date')]);
    if (dateErr.length > 0) return error(c, dateErr.join('; '));
  }

  if (body.task_type === 'recurring') {
    // 周期任务必须有 start_date 和 end_date
    if (!body.start_date || !body.end_date) {
      return error(c, '周期任务必须指定 start_date 和 end_date');
    }
    const dateErrs = validateAll([
      validDate(body.start_date, 'start_date'),
      validDate(body.end_date, 'end_date'),
    ]);
    if (dateErrs.length > 0) return error(c, dateErrs.join('; '));
  }

  // permanent（永久任务）：无额外日期要求，start_date 可选

  try {
    const currentTime = now();

    const result = await db
      .prepare(
        `INSERT INTO notification_tasks
         (name, description, title, content, task_type, execute_date, start_date, end_date,
          frequency, channel_ids, date_types, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        body.name,
        body.description || null,       // description 可选，默认 null
        body.title,
        body.content,
        body.task_type,
        body.execute_date || null,      // 非单次任务时为 null
        body.start_date || null,        // 永久任务可不传
        body.end_date || null,          // 永久任务可不传
        body.frequency,
        body.channel_ids,
        body.date_types,
        body.status || TASK_STATUS.ACTIVE,  // 状态默认为 active
        currentTime,
        currentTime
      )
      .run();

    const newId = result.meta.last_row_id;

    // 返回完整的新记录
    const newTask = await db
      .prepare('SELECT * FROM notification_tasks WHERE id = ?')
      .bind(newId)
      .first();

    return success(c, newTask, '创建成功', 201);
  } catch (err: any) {
    console.error('[TASKS] 创建失败:', err);
    return error(c, `创建失败: ${err.message}`, -1, 500);
  }
});

// ======================== POST /api/tasks/:id/trigger - 手动触发任务 ========================

/**
 * 手动触发任务，向任务配置的所有渠道发送通知
 *
 * 功能说明：
 *   - 根据任务配置的 channel_ids 获取对应的渠道
 *   - 仅发送状态为启用 (is_active=1) 的渠道
 *   - 向每个渠道发送任务配置的 title 和 content
 *   - 记录执行日志
 *
 * 响应示例：
 * {
 *   "code": 0,
 *   "data": {
 *     "total": 2,
 *     "success": 1,
 *     "failed": 1,
 *     "results": [
 *       { "channelId": 1, "channelName": "钉钉群", "success": true },
 *       { "channelId": 2, "channelName": "飞书群", "success": false, "error": "webhook URL 无效" }
 *     ]
 *   }
 * }
 */
tasks.post('/:id/trigger', async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return error(c, '无效的任务 ID');
  }

  try {
    // 1. 获取任务详情
    const task = await db
      .prepare('SELECT * FROM notification_tasks WHERE id = ?')
      .bind(id)
      .first<NotificationTask>();

    if (!task) {
      return error(c, '任务不存在', -1, 404);
    }

    // 2. 解析渠道 ID 列表
    let channelIds: number[] = [];
    try {
      const parsed = JSON.parse(task.channel_ids || '[]');
      channelIds = Array.isArray(parsed) ? parsed.map((id: any) => Number(id)).filter(Boolean) : [];
    } catch {
      channelIds = [];
    }

    if (channelIds.length === 0) {
      return error(c, '该任务未配置任何推送渠道', -1, 400);
    }

    // 3. 获取所有启用的渠道信息
    const placeholders = channelIds.map(() => '?').join(',');
    const channels = await db
      .prepare(`SELECT * FROM notification_channels WHERE id IN (${placeholders}) AND is_active = 1`)
      .bind(...channelIds)
      .all<NotificationChannel>();

    if (channels.results.length === 0) {
      return error(c, '没有找到可用的推送渠道（请检查渠道是否启用）', -1, 400);
    }

    // 4. 构造通知内容
    const notification: NotificationContent = {
      title: task.title || '[无标题]',
      content: task.content || '[无内容]',
    };

    // 5. 发送到所有渠道
    const results = await sendToChannels(channels.results, notification, task);

    // 6. 记录执行日志
    const scheduledTime = now();
    const logPromises = results.map((result) => {
      return db
        .prepare(
          `INSERT INTO notification_execution_logs
           (task_id, channel_id, scheduled_time, executed_at, status, response, error_message)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          result.channelId,
          scheduledTime,
          scheduledTime,
          result.success ? 'success' : 'failed',
          result.response ? JSON.stringify(result.response) : null,
          result.error || null
        )
        .run();
    });

    await Promise.all(logPromises);

    // 7. 统计结果
    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;

    return success(c, {
      total: results.length,
      success: successCount,
      failed: failedCount,
      results: results.map((r) => ({
        channelId: r.channelId,
        channelName: r.channelName,
        success: r.success,
        error: r.error,
      })),
    }, failedCount > 0 ? '部分渠道发送失败' : '发送成功');
  } catch (err: any) {
    console.error('[TASKS] 手动触发失败:', err);
    return error(c, `触发失败: ${err.message}`, -1, 500);
  }
});

// ======================== PUT /api/tasks/:id - 更新任务 ========================

/**
 * 更新通知任务
 *
 * 采用"部分更新"策略，只更新请求体中包含的字段
 * 更新时同样进行字段校验和业务规则校验
 */
tasks.put('/:id', async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json();

  if (isNaN(id)) {
    return error(c, '无效的任务 ID');
  }

  try {
    // 检查任务是否存在
    const existing = await db
      .prepare('SELECT * FROM notification_tasks WHERE id = ?')
      .bind(id)
      .first<Record<string, any>>();

    if (!existing) {
      return error(c, '任务不存在', -1, 404);
    }

    // ---- 构建动态 UPDATE ----
    const updates: string[] = [];
    const params: any[] = [];

    // 逐字段校验并添加到更新列表
    if (body.name !== undefined) {
      const errs = validateAll([required(body.name, 'name'), maxLength(body.name, 100, 'name')]);
      if (errs.length > 0) return error(c, errs.join('; '));
      updates.push('name = ?');
      params.push(body.name);
    }

    if (body.description !== undefined) {
      updates.push('description = ?');
      params.push(body.description);
    }

    if (body.title !== undefined) {
      const errs = validateAll([required(body.title, 'title')]);
      if (errs.length > 0) return error(c, errs.join('; '));
      updates.push('title = ?');
      params.push(body.title);
    }

    if (body.content !== undefined) {
      const errs = validateAll([required(body.content, 'content')]);
      if (errs.length > 0) return error(c, errs.join('; '));
      updates.push('content = ?');
      params.push(body.content);
    }

    if (body.task_type !== undefined) {
      const errs = validateAll([
        enumCheck(body.task_type, ['single', 'recurring', 'permanent'], 'task_type'),
      ]);
      if (errs.length > 0) return error(c, errs.join('; '));
      updates.push('task_type = ?');
      params.push(body.task_type);
    }

    if (body.execute_date !== undefined) {
      if (body.execute_date) {
        const errs = validateAll([validDate(body.execute_date, 'execute_date')]);
        if (errs.length > 0) return error(c, errs.join('; '));
      }
      updates.push('execute_date = ?');
      params.push(body.execute_date || null);
    }

    if (body.start_date !== undefined) {
      if (body.start_date) {
        const errs = validateAll([validDate(body.start_date, 'start_date')]);
        if (errs.length > 0) return error(c, errs.join('; '));
      }
      updates.push('start_date = ?');
      params.push(body.start_date || null);
    }

    if (body.end_date !== undefined) {
      if (body.end_date) {
        const errs = validateAll([validDate(body.end_date, 'end_date')]);
        if (errs.length > 0) return error(c, errs.join('; '));
      }
      updates.push('end_date = ?');
      params.push(body.end_date || null);
    }

    if (body.frequency !== undefined) {
      const errs = validateAll([validJson(body.frequency, 'frequency')]);
      if (errs.length > 0) return error(c, errs.join('; '));
      updates.push('frequency = ?');
      params.push(body.frequency);
    }

    if (body.channel_ids !== undefined) {
      const errs = validateAll([validJson(body.channel_ids, 'channel_ids')]);
      if (errs.length > 0) return error(c, errs.join('; '));
      updates.push('channel_ids = ?');
      params.push(body.channel_ids);
    }

    if (body.date_types !== undefined) {
      const errs = validateAll([
        enumCheck(body.date_types, ['all', 'workday', 'holiday'], 'date_types'),
      ]);
      if (errs.length > 0) return error(c, errs.join('; '));
      updates.push('date_types = ?');
      params.push(body.date_types);
    }

    if (body.status !== undefined) {
      const errs = validateAll([enumCheck(body.status, [TASK_STATUS.ACTIVE, TASK_STATUS.INACTIVE, TASK_STATUS.FINISHED], 'status')]);
      if (errs.length > 0) return error(c, errs.join('; '));
      updates.push('status = ?');
      params.push(body.status);
    }

    if (updates.length === 0) {
      return error(c, '没有需要更新的字段');
    }

    // 自动更新时间戳
    updates.push('updated_at = ?');
    params.push(now());
    params.push(id);

    await db
      .prepare(`UPDATE notification_tasks SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();

    // 返回更新后的完整记录
    const updated = await db
      .prepare('SELECT * FROM notification_tasks WHERE id = ?')
      .bind(id)
      .first();

    return success(c, updated, '更新成功');
  } catch (err: any) {
    console.error('[TASKS] 更新失败:', err);
    return error(c, `更新失败: ${err.message}`, -1, 500);
  }
});

// ======================== PATCH /api/tasks/:id/status - 切换任务状态 ========================

/**
 * 切换任务的启用/禁用状态
 *
 * 状态切换规则：
 *   - active -> inactive（暂停）
 *   - inactive -> active（恢复）
 *   - finished 状态不可切换（任务已结束）
 */
tasks.patch('/:id/status', async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return error(c, '无效的任务 ID');
  }

  try {
    const existing = await db
      .prepare('SELECT * FROM notification_tasks WHERE id = ?')
      .bind(id)
      .first<{ status: string }>();

    if (!existing) {
      return error(c, '任务不存在', -1, 404);
    }

    // finished 状态不可切换
    if (existing.status === TASK_STATUS.FINISHED) {
      return error(c, '已结束的任务无法切换状态', -1, 400);
    }

    // 状态翻转：active -> inactive，inactive -> active
    const newStatus = existing.status === TASK_STATUS.ACTIVE ? TASK_STATUS.INACTIVE : TASK_STATUS.ACTIVE;

    await db
      .prepare('UPDATE notification_tasks SET status = ?, updated_at = ? WHERE id = ?')
      .bind(newStatus, now(), id)
      .run();

    return success(c, { id, status: newStatus }, '状态切换成功');
  } catch (err: any) {
    console.error('[TASKS] 切换状态失败:', err);
    return error(c, `操作失败: ${err.message}`, -1, 500);
  }
});

// ======================== DELETE /api/tasks/:id - 删除任务 ========================

/**
 * 删除通知任务
 *
 * 注意：外键设置了 ON DELETE CASCADE，删除任务时关联的执行日志也会被自动删除
 */
tasks.delete('/:id', async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return error(c, '无效的任务 ID');
  }

  try {
    const existing = await db
      .prepare('SELECT id FROM notification_tasks WHERE id = ?')
      .bind(id)
      .first();

    if (!existing) {
      return error(c, '任务不存在', -1, 404);
    }

    await db
      .prepare('DELETE FROM notification_tasks WHERE id = ?')
      .bind(id)
      .run();

    return success(c, { id }, '删除成功');
  } catch (err: any) {
    console.error('[TASKS] 删除失败:', err);
    return error(c, `删除失败: ${err.message}`, -1, 500);
  }
});

export default tasks;