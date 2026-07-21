/**
 * =====================================================================
 * channels.ts - 通知渠道（notification_channels）CRUD 路由
 * =====================================================================
 *
 * API 列表：
 *   GET    /api/channels           - 获取渠道列表（支持分页）
 *   GET    /api/channels/all       - 获取所有渠道（不分页）
 *   GET    /api/channels/:id       - 获取单个渠道详情
 *   POST   /api/channels           - 创建渠道
 *   PUT    /api/channels/:id       - 更新渠道
 *   PATCH  /api/channels/:id/toggle - 切换渠道启用/禁用状态
 *   DELETE /api/channels/:id       - 删除渠道
 *
 * 表结构：
 *   id         - 自增主键
 *   name       - 渠道显示名称（如"工作群-钉钉"），最大50字符
 *   type       - 渠道类型：dingtalk / feishu / telegram / resend
 *   config     - 渠道配置 JSON（存储 webhook URL、密钥等）
 *   is_active  - 启用状态（1=启用，0=禁用）
 *   created_at - 创建时间
 *   updated_at - 更新时间
 */

import { Hono } from 'hono';
import type { Bindings, NotificationChannel } from '@shared/types';
import { getPagination, now } from '../utils/db';
import { success, successWithPagination, error } from '../utils/response';
import { required, maxLength, enumCheck, validJson, validateAll } from '../utils/validators';
import { sendToChannel } from '../push/index';
import type { NotificationContent } from '../push/index';
import {CHANNEL_TYPES} from '@shared/constants';

// 创建 channels 子路由
const channels = new Hono<{ Bindings: Bindings }>();

// ======================== GET /api/channels - 获取渠道列表 ========================

/**
 * 获取通知渠道列表（分页）
 *
 * Query 参数：
 *   - page: 页码（默认 1）
 *   - pageSize: 每页数量（默认 20，最大 100）
 *   - type: 按渠道类型筛选（可选）
 *   - is_active: 按启用状态筛选（可选，1=启用 0=禁用）
 *
 * 响应示例：
 * {
 *   "code": 0,
 *   "data": [{ "id": 1, "name": "工作群-钉钉", ... }],
 *   "meta": { "total": 5, "page": 1, "pageSize": 20, "totalPages": 1 }
 * }
 */
channels.get('/', async (c) => {
  const db = c.env.DB;

  // 解析分页参数
  const { page, pageSize, limit, offset } = getPagination(
    c.req.query('page'),
    c.req.query('pageSize')
  );

  // 构建动态 WHERE 条件
  const conditions: string[] = [];  // SQL 条件片段
  const params: any[] = [];         // 绑定参数值

  // 按渠道类型筛选（如只查钉钉渠道）
  const type = c.req.query('type');
  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }

  // 按启用状态筛选
  const isActive = c.req.query('is_active');
  if (isActive !== undefined && isActive !== '') {
    conditions.push('is_active = ?');
    params.push(parseInt(isActive, 10));
  }

  // 拼接 WHERE 子句（无条件时为空字符串）
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    // 查询总记录数（用于分页计算）
    const countResult = await db
      .prepare(`SELECT COUNT(*) as total FROM notification_channels ${whereClause}`)
      .bind(...params)
      .first<{ total: number }>();

    const total = countResult?.total || 0;

    // 查询当前页数据
    const listResult = await db
      .prepare(
        `SELECT * FROM notification_channels ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`
      )
      .bind(...params, limit, offset)
      .all();

    return successWithPagination(c, listResult.results, total, page, pageSize);
  } catch (err: any) {
    console.error('[CHANNELS] 查询列表失败:', err);
    return error(c, `查询失败: ${err.message}`, -1, 500);
  }
});

// ======================== GET /api/channels/all - 获取所有渠道（不分页） ========================

/**
 * 获取所有通知渠道（不分页）
 *
 * Query 参数：
 *   - type: 按渠道类型筛选（可选）
 *   - is_active: 按启用状态筛选（可选，1=启用 0=禁用）
 *
 * 响应示例：
 * {
 *   "code": 0,
 *   "data": [{ "id": 1, "name": "工作群-钉钉", ... }, ...]
 * }
 */
channels.get('/all', async (c) => {
  const db = c.env.DB;

  // 构建动态 WHERE 条件
  const conditions: string[] = [];
  const params: any[] = [];

  // 按渠道类型筛选
  const type = c.req.query('type');
  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }

  // 按启用状态筛选
  const isActive = c.req.query('is_active');
  if (isActive !== undefined && isActive !== '') {
    conditions.push('is_active = ?');
    params.push(parseInt(isActive, 10));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await db
      .prepare(`SELECT * FROM notification_channels ${whereClause} ORDER BY id DESC`)
      .bind(...params)
      .all();

    return success(c, result.results);
  } catch (err: any) {
    console.error('[CHANNELS] 查询所有渠道失败:', err);
    return error(c, `查询失败: ${err.message}`, -1, 500);
  }
});

// ======================== GET /api/channels/:id - 获取单个渠道 ========================

/**
 * 获取单个通知渠道的详细信息
 *
 * @param {string} id - 渠道 ID（路径参数）
 *
 * 响应：
 *   - 200: 返回渠道完整信息
 *   - 404: 渠道不存在
 */
channels.get('/:id', async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);

  // 校验 ID 是否为有效数字
  if (isNaN(id)) {
    return error(c, '无效的渠道 ID', -1, 400);
  }

  try {
    // 使用 first() 获取单条记录，不存在时返回 null
    const channel = await db
      .prepare('SELECT * FROM notification_channels WHERE id = ?')
      .bind(id)
      .first();

    if (!channel) {
      return error(c, '渠道不存在', -1, 404);
    }

    return success(c, channel);
  } catch (err: any) {
    console.error('[CHANNELS] 查询详情失败:', err);
    return error(c, `查询失败: ${err.message}`, -1, 500);
  }
});

// ======================== POST /api/channels - 创建渠道 ========================

/**
 * 创建新的通知渠道
 *
 * 请求体（JSON）：
 * {
 *   "name": "工作群-钉钉",           // 必填，最大50字符
 *   "type": "dingtalk",              // 必填，枚举值
 *   "config": "{\"webhook\":\"...\"}", // 必填，JSON 字符串
 *   "is_active": 1                   // 可选，默认 1
 * }
 *
 * 校验规则：
 *   - name: 必填 + 最大50字符
 *   - type: 必填 + 枚举值
 *   - config: 必填 + 合法 JSON
 */
channels.post('/', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();

  // ---- 参数校验 ----
  const errors = validateAll([
    required(body.name, 'name'),
    maxLength(body.name, 50, 'name'),
    required(body.type, 'type'),
    enumCheck(body.type, Object.values(CHANNEL_TYPES), 'type'),
    required(body.config, 'config'),
    validJson(body.config, 'config'),
  ]);

  // 如果有校验错误，返回 400 + 所有错误信息
  if (errors.length > 0) {
    return error(c, errors.join('; '));
  }

  try {
    // 执行 INSERT，is_active 默认为 1（如果未传入则使用默认值）
    const is_active = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1;
    const currentTime = now();

    const result = await db
      .prepare(
        `INSERT INTO notification_channels (name, type, config, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(body.name, body.type, body.config, is_active, currentTime, currentTime)
      .run();

    // D1 的 run() 返回 { success, meta: { last_row_id, changes } }
    // 通过 last_row_id 获取新插入记录的 ID
    const newId = result.meta.last_row_id;

    // 查询刚插入的完整记录返回给前端
    const newChannel = await db
      .prepare('SELECT * FROM notification_channels WHERE id = ?')
      .bind(newId)
      .first();

    return success(c, newChannel, '创建成功', 201);
  } catch (err: any) {
    console.error('[CHANNELS] 创建失败:', err);
    return error(c, `创建失败: ${err.message}`, -1, 500);
  }
});

// ======================== PUT /api/channels/:id - 更新渠道 ========================

/**
 * 更新通知渠道信息
 *
 * 请求体（JSON）：与创建相同，所有字段可选，只更新传入的字段
 *
 * 注意：
 *   - 采用"部分更新"策略：只更新请求体中包含的字段
 *   - 自动更新 updated_at 时间戳
 *   - 如果渠道不存在返回 404
 */
channels.put('/:id', async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json();

  if (isNaN(id)) {
    return error(c, '无效的渠道 ID');
  }

  try {
    // 先检查渠道是否存在
    const existing = await db
      .prepare('SELECT * FROM notification_channels WHERE id = ?')
      .bind(id)
      .first();

    if (!existing) {
      return error(c, '渠道不存在', -1, 404);
    }

    // ---- 构建动态 UPDATE 语句 ----
    // 只更新请求体中提供的字段，未提供的保持原值
    const updates: string[] = [];
    const params: any[] = [];

    if (body.name !== undefined) {
      // 校验 name 字段
      const nameErrors = validateAll([
        required(body.name, 'name'),
        maxLength(body.name, 50, 'name'),
      ]);
      if (nameErrors.length > 0) return error(c, nameErrors.join('; '));

      updates.push('name = ?');
      params.push(body.name);
    }

    if (body.type !== undefined) {
      const typeErrors = validateAll([
        enumCheck(body.type, Object.values(CHANNEL_TYPES), 'type'),
      ]);
      if (typeErrors.length > 0) return error(c, typeErrors.join('; '));

      updates.push('type = ?');
      params.push(body.type);
    }

    if (body.config !== undefined) {
      const configErrors = validateAll([validJson(body.config, 'config')]);
      if (configErrors.length > 0) return error(c, configErrors.join('; '));

      updates.push('config = ?');
      params.push(body.config);
    }

    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(body.is_active ? 1 : 0);
    }

    // 如果没有需要更新的字段，直接返回
    if (updates.length === 0) {
      return error(c, '没有需要更新的字段');
    }

    // 自动更新 updated_at 时间戳
    updates.push('updated_at = ?');
    params.push(now());

    // 添加 WHERE 条件的参数（id）
    params.push(id);

    // 执行 UPDATE
    await db
      .prepare(`UPDATE notification_channels SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();

    // 查询更新后的完整记录
    const updated = await db
      .prepare('SELECT * FROM notification_channels WHERE id = ?')
      .bind(id)
      .first();

    return success(c, updated, '更新成功');
  } catch (err: any) {
    console.error('[CHANNELS] 更新失败:', err);
    return error(c, `更新失败: ${err.message}`, -1, 500);
  }
});

// ======================== PATCH /api/channels/:id/toggle - 切换状态 ========================

/**
 * 切换渠道的启用/禁用状态
 *
 * 使用 PATCH 方法，符合 RESTful 语义（部分更新）
 * 通过 SQL 的 NOT 运算直接翻转 is_active 字段
 *
 * 响应：返回切换后的新状态
 */
channels.patch('/:id/toggle', async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return error(c, '无效的渠道 ID');
  }

  try {
    // 检查渠道是否存在
    const existing = await db
      .prepare('SELECT * FROM notification_channels WHERE id = ?')
      .bind(id)
      .first<{ is_active: number }>();

    if (!existing) {
      return error(c, '渠道不存在', -1, 404);
    }

    // 翻转 is_active 状态（1->0, 0->1）
    const newStatus = existing.is_active ? 0 : 1;

    await db
      .prepare('UPDATE notification_channels SET is_active = ?, updated_at = ? WHERE id = ?')
      .bind(newStatus, now(), id)
      .run();

    return success(c, { id, is_active: newStatus }, '状态切换成功');
  } catch (err: any) {
    console.error('[CHANNELS] 切换状态失败:', err);
    return error(c, `操作失败: ${err.message}`, -1, 500);
  }
});

// ======================== DELETE /api/channels/:id - 删除渠道 ========================

/**
 * 删除通知渠道
 *
 * 注意：
 *   - 如果有执行日志关联该渠道（外键 CASCADE），关联日志也会被删除
 *   - 删除前会检查渠道是否存在
 */
channels.delete('/:id', async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return error(c, '无效的渠道 ID');
  }

  try {
    // 先检查是否存在
    const existing = await db
      .prepare('SELECT id FROM notification_channels WHERE id = ?')
      .bind(id)
      .first();

    if (!existing) {
      return error(c, '渠道不存在', -1, 404);
    }

    // 执行删除
    await db
      .prepare('DELETE FROM notification_channels WHERE id = ?')
      .bind(id)
      .run();

    return success(c, { id }, '删除成功');
  } catch (err: any) {
    console.error('[CHANNELS] 删除失败:', err);
    return error(c, `删除失败: ${err.message}`, -1, 500);
  }
});

// ======================== POST /api/channels/test - 测试渠道 ========================
/**
 * 发送测试通知到指定渠道
 *
 * 请求体（JSON）：
 * {
 *   "type": "dingtalk",              // 必填，渠道类型
 *   "config": "{\"webhook\":\"...\"}" // 必填，渠道配置 JSON 字符串
 * }
 *
 * 响应：返回发送结果（成功/失败及详细信息）
 */
channels.post('/test', async (c) => {
  const body = await c.req.json();
  const { type, config } = body;
  // 参数校验
  const errors = validateAll([
    required(type, 'type'),
    enumCheck(type, Object.values(CHANNEL_TYPES), 'type'),
    required(config, 'config'),
    validJson(config, 'config'),
  ]);
  if (errors.length > 0) {
    return error(c, errors.join('; '), -1, 400);
  }
  try {
    // 构造临时渠道对象
    const tempChannel: NotificationChannel = {
      id: 0,
      name: '测试渠道',
      type,
      config,
      is_active: 1,
      created_at: now(),
      updated_at: now(),
    };
    // 构造测试消息内容
    const testNotification: NotificationContent = {
      title: '[测试通知] 渠道配置验证',
      content: `这是一条测试消息，发送时间：${new Date().toISOString()}。如果收到此消息，说明渠道配置正确。`,
    };
    // 发送测试通知
    const result = await sendToChannel(tempChannel, testNotification);
    if (result.success) {
      return success(c, result, '测试消息发送成功');
    } else {
      return error(c, result.error || '发送失败', -1, 400);
    }
  } catch (err: any) {
    console.error('[CHANNELS] 测试渠道失败:', err);
    return error(c, `测试失败：${err.message}`, -1, 500);
  }
});

export default channels;