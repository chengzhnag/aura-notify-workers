import type { Bindings, NotificationChannel, NotificationTask } from '@shared/types';
import { now } from './utils/db';
import { sendToChannel as commonSend } from './push/index';

/**
 * 这个模块负责处理 Worker 定时任务的调度与发送逻辑。
 *
 * 主要职责包括：
 * 1. 读取数据库中的通知任务，判断当前时刻是否命中任务的执行条件；
 * 2. 根据环境变量 UTC_BENCHMARK 把 UTC 时间换算成业务基准时区；
 * 3. 解析任务配置中的频率、日期范围、渠道列表等字段；
 * 4. 根据渠道类型调用对应的推送适配器发送通知；
 * 5. 把执行结果写入 notification_execution_logs 表，方便后续排查。
 */

/**
 * 解析数据库字段里存储的 JSON 数组。
 *
 * 例如 notification_tasks.frequency / channel_ids 会以字符串形式保存，
 * 这里先尝试 JSON.parse，再保证结果一定是数组。如果原始字段为空、非法或不是数组，
 * 就返回空数组，避免后续代码因为类型异常而中断。
 */
function parseJsonArray<T = unknown>(value?: string | null): T[] {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 解析渠道配置 JSON。
 *
 * 渠道表中的 config 字段通常保存的是 JSON 字符串，例如 webhook 地址、token、邮箱等。
 * 这里统一把它解析成对象，后续发送时直接从对象里读取字段。
 */
function parseConfig(value?: string | null): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * 解析 UTC 基准时区配置。
 *
 * 环境变量 UTC_BENCHMARK 的格式类似 "UTC+8" 或 "UTC-5"，
 * 这里把它转换为分钟偏移量，后续用于把 UTC 时间换算为业务时区。
 *
 * 例子：
 * - UTC+8 => 480 分钟
 * - UTC-5 => -300 分钟
 */
function parseUtcBenchmark(benchmark?: string): number {
  if (!benchmark) {
    return 0;
  }

  const normalized = benchmark.trim();
  const match = /^UTC([+-])(\d{1,2})(?::(\d{2}))?$/.exec(normalized);
  if (!match) {
    return 0;
  }

  const sign = match[1] === '+' ? 1 : -1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] || '0');
  return sign * (hours * 60 + minutes);
}

/**
 * 把 UTC 时间转换为业务基准时区对应的时间。
 *
 * Cloudflare 的 scheduled handler 触发时拿到的是 UTC 时间戳。
 * 但实际业务中，任务往往按照中国时区、东八区等“本地业务时区”执行，
 * 所以这里通过加上偏移分钟来得到基准时区下的日期和时间。
 *
 * 例如：
 * - 当前 UTC 时间是 2026-07-13 00:30:00Z
 * - 基准时区是 UTC+8
 * - 转换后得到 2026-07-13 08:30:00
 *
 * 如果基准时区在 UTC 之前（例如 UTC-8），那么转换后的时间可能落在前一天，
 * 这正是“跨天”场景需要特别注意的地方。
 */
function getDateInBenchmark(date: Date, benchmark?: string): Date {
  const offsetMinutes = parseUtcBenchmark(benchmark);
  return new Date(date.getTime() + offsetMinutes * 60 * 1000);
}

/**
 * 把基准时区下的时间格式化为 YYYY-MM-DD 字符串。
 *
 * 这个函数用于判断单次任务的执行日期，以及周期任务的起止日期是否命中。
 */
function formatDateLocal(date: Date, benchmark?: string): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  const benchmarkDate = getDateInBenchmark(date, benchmark);
  return `${benchmarkDate.getUTCFullYear()}-${pad(benchmarkDate.getUTCMonth() + 1)}-${pad(benchmarkDate.getUTCDate())}`;
}

/**
 * 把基准时区下的时间格式化为 YYYY-MM-DD HH:mm:ss 字符串。
 *
 * 这个方法目前主要用于调试和日志记录，方便确认当前触发时对应的“业务时间”。
 */
function formatDateTimeLocal(date: Date, benchmark?: string): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  const benchmarkDate = getDateInBenchmark(date, benchmark);
  return `${benchmarkDate.getUTCFullYear()}-${pad(benchmarkDate.getUTCMonth() + 1)}-${pad(benchmarkDate.getUTCDate())} ${pad(benchmarkDate.getUTCHours())}:${pad(benchmarkDate.getUTCMinutes())}:${pad(benchmarkDate.getUTCSeconds())}`;
}

/**
 * 把 HH:mm 这样的字符串转成“分钟数”。
 *
 * 例如 09:30 -> 570。
 * 作用是方便和当前时间的分钟数做比较，判断是否命中频率配置。
 */
function getMinutes(value: string): number {
  const [hour, minute] = value.split(':').map((item) => Number(item));
  return hour * 60 + minute;
}

/**
 * 判断任务是否符合日期类型过滤条件。
 *
 * date_types 取值有三种：
 * - all：任何日期都允许
 * - workday：仅工作日
 * - holiday：仅节假日（周末）
 *
 * 这里必须使用基准时区的日期来判断，否则在 UTC 午夜附近触发时，可能会出现
 * 周末/工作日判断错误的情况。
 */
function matchesDateType(task: NotificationTask, date: Date, benchmark?: string): boolean {
  if (task.date_types === 'all') {
    return true;
  }

  const benchmarkDate = getDateInBenchmark(date, benchmark);
  const weekday = benchmarkDate.getUTCDay();
  if (task.date_types === 'workday') {
    return weekday >= 1 && weekday <= 5;
  }

  return weekday === 0 || weekday === 6;
}

/**
 * 判断某个任务当前是否应该执行。
 *
 * 这个函数会综合检查以下条件：
 * 1. 任务状态必须是 active；
 * 2. 单次任务必须在对应 execute_date 执行；
 * 3. 周期任务必须在 start_date 和 end_date 范围内；
 * 4. 当前基准时区日期必须满足 date_types 的工作日/节假日规则；
 * 5. 当前基准时区的小时/分钟必须落在 frequency 配置的某个时间点附近（允许 5 分钟误差）。
 */
function matchesSchedule(task: NotificationTask, date: Date, benchmark?: string): boolean {
  if (task.status !== 'active') {
    return false;
  }

  // 先基于基准时区得到“今天”的日期字符串。这个值会影响单次任务和周期任务是否命中。
  // 这样做的目的是：即使触发器的 UTC 时间在 00:00 附近，也能根据业务时区判断对应的是哪一天。
  const today = formatDateLocal(date, benchmark);

  if (task.task_type === 'single') {
    if (!task.execute_date) {
      return false;
    }
    if (task.execute_date !== today) {
      return false;
    }
  } else if (task.task_type === 'recurring') {
    if (!task.start_date || !task.end_date) {
      return false;
    }
    if (today < task.start_date || today > task.end_date) {
      return false;
    }
  }

  if (!matchesDateType(task, date, benchmark)) {
    return false;
  }

  // 读取基准时区下的当前时间的分钟数，并和频率列表中的每个执行时间做比较。
  // 由于定时任务触发可能有轻微延迟，因此容忍 5 分钟误差。
  const benchmarkDate = getDateInBenchmark(date, benchmark);
  const nowMinutes = benchmarkDate.getUTCHours() * 60 + benchmarkDate.getUTCMinutes();
  const frequencies = parseJsonArray<string>(task.frequency);
  return frequencies.some((value) => Math.abs(nowMinutes - getMinutes(value)) <= 5);
}

/**
 * 根据任务和渠道信息把通知发送出去。
 *
 * 这个函数会根据渠道类型执行不同的发送逻辑：
 * - 钉钉/飞书：调用 webhook；
 * - Telegram：调用机器人消息接口；
 * - 邮件：调用 Resend 发送邮件。
 *
 * 发送成功或失败后，都会把结果写入执行日志表。
 */
async function sendToChannel(db: D1Database, task: NotificationTask, channel: NotificationChannel, scheduledTime: string): Promise<void> {
  const basePayload = {
    title: task.title,
    content: task.content,
  };

  try {
    const result = await commonSend(channel, basePayload, task);
    if (result.success) {
      await insertLog(db, task.id, channel.id, scheduledTime, 'success', JSON.stringify(result.response), null);
    } else {
      await insertLog(db, task.id, channel.id, scheduledTime, 'failed', null, result.error || 'Unknown send error');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown send error';
    await insertLog(db, task.id, channel.id, scheduledTime, 'failed', null, message);
  }
}

/**
 * 把单次发送结果写入执行日志表。
 *
 * scheduled_time 保存的是当前触发时对应的基准时区时间点，
 * executed_at 保存的是实际执行写入数据库的时间。
 */
async function insertLog(db: D1Database, taskId: number, channelId: number, scheduledTime: string, status: 'success' | 'failed', response: string | null, errorMessage: string | null): Promise<void> {
  await db.prepare(
    `INSERT INTO notification_execution_logs (task_id, channel_id, scheduled_time, executed_at, status, response, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(taskId, channelId, scheduledTime, now(), status, response, errorMessage).run();
}

/**
 * 定时任务主入口。
 *
 * 这个函数会在 Worker 的 scheduled handler 中被调用，流程如下：
 * 1. 读取当前 UTC 时间，并按照 UTC_BENCHMARK 换算成业务基准时区；
 * 2. 根据基准时区下的日期和分钟数，筛选出应该执行的任务；
 * 3. 读取这些任务绑定的渠道；
 * 4. 挨个调用发送逻辑，把通知推送出去；
 * 5. 记录日志，供后续排查和审计。
 */
export async function executeScheduledTasks(env: Bindings): Promise<void> {
  const db = env.DB;
  const benchmark = env.UTC_BENCHMARK;

  // 触发器收到的是 UTC 时间戳，因此先把它换算成业务基准时区，确保后续判断基于同一个“业务时间”。
  const nowDate = new Date();
  const benchmarkDate = getDateInBenchmark(nowDate, benchmark);
  const currentDate = formatDateLocal(nowDate, benchmark);
  const currentTime = `${String(benchmarkDate.getUTCHours()).padStart(2, '0')}:${String(benchmarkDate.getUTCMinutes()).padStart(2, '0')}:00`;
  const scheduledTime = `${currentDate} ${currentTime}`;

  const tasksResult = await db.prepare(
    `SELECT * FROM notification_tasks WHERE status = 'active' ORDER BY id ASC`
  ).all<NotificationTask>();

  const tasks = tasksResult.results as NotificationTask[];
  for (const task of tasks) {
    // 只有当任务在当前基准时区下同时满足日期范围和频率条件时才真正执行。
    // 这样能避免 UTC 午夜附近变成“下一天”的情况，误触发或漏触发。
    if (!matchesSchedule(task, nowDate, benchmark)) {
      continue;
    }

    const channelIds = parseJsonArray<number>(task.channel_ids);
    if (channelIds.length === 0) {
      continue;
    }

    const channelsResult = await db.prepare(
      `SELECT id, name, type, config, is_active FROM notification_channels WHERE id IN (${channelIds.map(() => '?').join(',')})`
    ).bind(...channelIds).all<NotificationChannel>();

    const channels = channelsResult.results as NotificationChannel[];
    for (const channel of channels) {
      if (!channel || channel.is_active === 0) {
        continue;
      }
      await sendToChannel(db, task, channel, scheduledTime);
    }
  }
}
