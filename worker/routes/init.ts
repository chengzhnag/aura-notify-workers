/**
 * =====================================================================
 * init.ts - 数据库表结构初始化路由
 * =====================================================================
 *
 * 职责：
 *   1. 提供 POST /api/init 接口，初始化所有表结构
 *   2. 自动检查每张表是否已存在，避免重复创建
 *   3. 返回每张表的初始化状态
 *
 * 注意事项：
 *   - 使用 IF NOT EXISTS 作为双重保险（即使逻辑层已判断）
 *   - 使用 db.exec() 执行 DDL 语句（不支持参数绑定，但建表不需要）
 *   - 外键表 notification_execution_logs 必须在依赖表之后创建
 */

import { Hono } from 'hono';
import type { Bindings } from '@shared/types';
import { tableExists } from '../utils/db';
import { success, error } from '../utils/response';

// 创建 init 子路由
const init = new Hono<{ Bindings: Bindings }>();

// ======================== SQL 建表语句定义 ========================

/**
 * notification_channels 建表 SQL
 * 通知渠道配置表：存储各种通知渠道（钉钉、飞书、Telegram、Resend）的配置信息
 */
const CREATE_CHANNELS_TABLE = `CREATE TABLE IF NOT EXISTS notification_channels (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT NOT NULL CHECK(length(name) <= 50),
type TEXT NOT NULL,
config TEXT NOT NULL,
is_active BOOLEAN NOT NULL DEFAULT 1,
created_at DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
updated_at DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
)`;

/**
 * notification_tasks 建表 SQL
 * 通知任务表：存储通知任务的配置，包括执行计划、渠道、频率等
 */
const CREATE_TASKS_TABLE = `CREATE TABLE IF NOT EXISTS notification_tasks (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT NOT NULL CHECK(length(name) <= 100),
description TEXT,
title TEXT NOT NULL,
content TEXT NOT NULL,
task_type TEXT NOT NULL CHECK(task_type IN ('single', 'recurring', 'permanent')),
execute_date DATE,
start_date DATE,
end_date DATE,
frequency TEXT NOT NULL,
channel_ids TEXT NOT NULL,
date_types TEXT NOT NULL CHECK(date_types IN ('all', 'workday', 'holiday')),
status TEXT NOT NULL CHECK(status IN ('active', 'inactive', 'finished')) DEFAULT 'active',
created_at DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
updated_at DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
)`;

/**
 * notification_execution_logs 建表 SQL
 * 执行日志表：记录每次通知执行的结果
 * 注意：外键依赖 notification_tasks 和 notification_channels，必须最后创建
 */
const CREATE_LOGS_TABLE = `CREATE TABLE IF NOT EXISTS notification_execution_logs (
id INTEGER PRIMARY KEY AUTOINCREMENT,
task_id INTEGER NOT NULL,
channel_id INTEGER NOT NULL,
scheduled_time DATETIME NOT NULL,
executed_at DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
status TEXT NOT NULL CHECK(status IN ('success', 'failed')),
response TEXT,
error_message TEXT,
FOREIGN KEY (task_id) REFERENCES notification_tasks(id) ON DELETE CASCADE,
FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
)`;

// ======================== 路由定义 ========================

/**
 * GET /api/init
 *
 * 初始化所有数据库表
 *
 * 流程：
 *   1. 依次检查三张表是否已存在
 *   2. 对不存在的表执行 CREATE TABLE
 *   3. 返回每张表的操作结果（created=新建 / exists=已存在）
 *
 * 响应示例：
 * {
 *   "code": 0,
 *   "message": "数据库初始化完成",
 *   "data": {
 *     "notification_channels": "created",
 *     "notification_tasks": "created",
 *     "notification_execution_logs": "exists"
 *   }
 * }
 */
init.get('/', async (c) => {
  const db = c.env.DB;

  try {
    // 记录每张表的操作结果
    const results: Record<string, string> = {};

    // -------- 1. 初始化 notification_channels --------
    // 先检查表是否已存在
    const channelsExists = await tableExists(db, 'notification_channels');
    if (!channelsExists) {
      // 表不存在，执行建表
      await db.exec(CREATE_CHANNELS_TABLE.replaceAll(/\n/gm, " ")); // 去掉换行符，不然 D1 执行报错
      results['notification_channels'] = 'created'; // 标记为"已创建"
    } else {
      results['notification_channels'] = 'exists';  // 标记为"已存在"
    }

    // -------- 2. 初始化 notification_tasks --------
    const tasksExists = await tableExists(db, 'notification_tasks');
    if (!tasksExists) {
      await db.exec(CREATE_TASKS_TABLE.replaceAll(/\n/gm, " "));
      results['notification_tasks'] = 'created';
    } else {
      results['notification_tasks'] = 'exists';
    }

    // -------- 3. 初始化 notification_execution_logs --------
    // 注意：该表有外键依赖，必须在 channels 和 tasks 之后创建
    const logsExists = await tableExists(db, 'notification_execution_logs');
    if (!logsExists) {
      await db.exec(CREATE_LOGS_TABLE.replaceAll(/\n/gm, " "));
      results['notification_execution_logs'] = 'created';
    } else {
      results['notification_execution_logs'] = 'exists';
    }

    // 返回每张表的初始化状态
    return success(c, results, '数据库初始化完成');
  } catch (err: any) {
    // 捕获建表过程中的 SQL 错误
    console.error('[INIT] 初始化失败:', err);
    return error(c, `初始化创建表失败: ${err.message}`, -1, 500);
  }
});

export default init;