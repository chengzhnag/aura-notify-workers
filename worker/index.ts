/**
 * =====================================================================
 * index.ts - 应用主入口文件
 * =====================================================================
 *
 * 职责：
 *   1. 创建 Hono 应用实例
 *   2. 注册全局中间件（CORS、日志、错误处理等）
 *   3. 挂载各子路由模块
 *   4. 导出默认模块供 Cloudflare Workers 运行时使用
 *
 * 路由总览：
 *   POST /api/init              -> 初始化数据库表结构
 *   *    /api/channels/*        -> 通知渠道 CRUD
 *   *    /api/tasks/*           -> 通知任务 CRUD
 *   *    /api/logs/*            -> 执行日志查询/清理
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Bindings } from '@shared/types';
import { authMiddleware } from './utils';

// 导入各路由模块
import init from './routes/init';
import channels from './routes/channels';
import tasks from './routes/tasks';
import logs from './routes/logs';
import auth from './routes/auth';
import common from './routes/common';
import { executeScheduledTasks } from './scheduler';

// ======================== 创建 Hono 应用实例 ========================

/**
 * 创建应用并指定类型绑定
 * Bindings 类型定义了 Workers 环境变量（如 D1 数据库）
 */
const app = new Hono<{ Bindings: Bindings }>();

// ======================== 全局中间件 ========================

/**
 * CORS 中间件
 * 允许跨域请求，开发时可设置为 '*'，生产环境建议指定具体域名
 */
app.use('*', cors({
  origin: (origin) => origin,  // 允许来自请求的 origin 或默认值
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,         // 允许发送凭证（cookies）
  maxAge: 86400,                  // 预检请求缓存时间（秒）
}));

/**
 * 请求日志中间件
 * 打印每个请求的方法、路径、状态码和耗时，方便调试
 */
app.use('*', logger());

// ======================== 健康检查 ========================

/**
 * GET /api/health
 * 健康检查接口，用于监控系统或负载均衡器探活
 */
app.get('/api/health', (c) => {
  return c.json({
    code: 0,
    message: 'ok',
    data: {
      service: 'notification-api',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});


// ======================== 挂载子路由 ========================

/**
 * 挂载各子路由模块
 * 每个模块负责处理特定的 API 路径
 */
app.route('/api/init', init);
app.route('/api/auth', auth);
app.use('/api/channels/*', authMiddleware);
app.use('/api/tasks/*', authMiddleware);
app.use('/api/logs/*', authMiddleware);
app.route('/api/channels', channels);
app.route('/api/tasks', tasks);
app.route('/api/logs', logs);
app.route('/api/common', common);

// ======================== 导出应用实例 ========================

/**
 * 导出默认应用实例供 Cloudflare Workers 运行时使用
 */
export default {
  fetch: app.fetch,
  scheduled: async (
    controller: ScheduledController,
    env: Bindings,
    ctx: ExecutionContext
  ) => {
    console.log('[SCHEDULER] trigger', controller.cron, new Date().toISOString());
    await executeScheduledTasks(env);
  }
};