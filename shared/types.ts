import { CHANNEL_TYPES, TASK_TYPES, DATE_TYPES, TASK_STATUS } from './constants';

export interface ApiResponse<T = unknown> {
  code?: number;
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
  };
}

// ======================== Cloudflare Workers 环境绑定 ========================

/**
 * Workers 环境变量绑定接口
 * 在 Hono 中通过 app.get('*', async (c) => { c.env.DB }) 访问
 */
export type Bindings = {
  /** D1 数据库实例，对应 wrangler.toml 中 binding = "DB" */
  DB: D1Database;
  /** 登录密码变量，对应 wrangler.jsonc 中的 vars.PASSWORD */
  PASSWORD: string;
  /** JWT 秘钥变量，对应 wrangler.jsonc 中的 vars.JWT_SECRET */
  JWT_SECRET: string;
  /** 基准时区变量，对应 wrangler.jsonc 中的 vars.UTC_BENCHMARK，例如 UTC+8 */
  UTC_BENCHMARK?: string;
};

export type ChannelType = typeof CHANNEL_TYPES[keyof typeof CHANNEL_TYPES];
export type TaskType = typeof TASK_TYPES[keyof typeof TASK_TYPES];
export type DateType = typeof DATE_TYPES[keyof typeof DATE_TYPES];
export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

// DateType 说明：
// - 'workday': 仅工作日（周一至周五）
// - 'holiday': 仅节假日（周末）
// - 'all': 每天

// TaskStatus 说明：
// - 'active': 运行中
// - 'inactive': 已暂停
// - 'finished': 已结束（任务完成后不再执行）


// ======================== notification_channels 行类型 ========================

/**
 * 通知渠道表的完整行类型
 * 对应数据库表 notification_channels
 */
export interface NotificationChannel {
  id: number;
  name: string;
  type: ChannelType;
  config: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// ======================== notification_tasks 行类型 ========================

/**
 * 通知任务表的完整行类型
 * 对应数据库表 notification_tasks
 */
export interface NotificationTask {
  id: number;
  name: string;
  description?: string;
  title: string;
  content: string;
  task_type: TaskType;
  execute_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  frequency: string;
  channel_ids: string;
  date_types: DateType;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

// ======================== notification_execution_logs 行类型 ========================

/**
 * 执行日志表的完整行类型
 * 对应数据库表 notification_execution_logs
 */
export interface NotificationExecutionLog {
  id: number;
  task_id: number;
  task_name?: string;
  channel_id: number;
  channel_name?: string;
  status: 'success' | 'failed';
  response?: string | null;
  error_message?: string | null;
  scheduled_time?: string;
  executed_at?: string;
}
