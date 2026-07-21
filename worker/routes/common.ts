import { Hono } from 'hono';
import { html } from 'hono/html'
import type { Bindings } from '@shared/types';
import { success, error } from '../utils/response';
import { CHANNEL_TYPES } from '@shared/constants';
import { NotificationChannel, NotificationTask } from '@shared/types';
import { sendToChannels } from '../push/index';

const common = new Hono<{ Bindings: Bindings }>();

// get 和 post请求都可以访问 /api/common/notice
common.on(['GET', 'POST'], '/notice', async (c) => {
  // 根据请求类型接收参数
  let title, content, channels;
  if (c.req.method === 'GET') {
    ({ title, content, channels } = c.req.query());
  } else {
    const body = await c.req.json().catch(() => ({}));
    title = body.title;
    content = body.content;
    channels = body.channels;
  }

  // 参数校验
  if (!title && !content) {
    return error(c, '缺少必要参数title和content', 400);
  }

  // 解析 channels：支持逗号分隔的字符串，也兼容数组传入
  let channelList: string[] = [];
  if (channels) {
    channelList = Array.isArray(channels)
      ? channels.map((s: string) => s.trim()).filter(Boolean)
      : channels.split(',').map((s: string) => s.trim()).filter(Boolean);

    // 逐个校验渠道类型
    const validTypes = Object.values(CHANNEL_TYPES);
    const invalid = channelList.filter((t: any) => !validTypes.includes(t));
    if (invalid.length === channelList.length) {
      return error(c, '传递的渠道全部不符，请查看文档', 400);
    }
  }

  // 根据渠道数据查询
  const db = c.env.DB;
  let query = `SELECT * FROM notification_channels WHERE is_active = 1`;
  let result: any;

  if (channelList.length > 0) {
    // 动态生成 IN (?, ?, ...) 占位符
    const placeholders = channelList.map(() => '?').join(', ');
    query += ` AND type IN (${placeholders})`;
    result = await db.prepare(query).bind(...channelList).all<{ results: NotificationChannel[] }>();
  } else {
    result = await db.prepare(query).all<{ results: NotificationChannel[] }>();
  }

  if (!result.results || result.results.length === 0) {
    return error(c, '没有找到可用的渠道', 400);
  }

  // 根据渠道数据发送通知
  const notification = { title: title || '', content: content || '' };
  const results = await sendToChannels(result.results, notification);
  return success(c, { results });
});

common.get('notice-detail', async (c) => {
  // 1. 使用 Hono 的方式获取 URL 参数
  const { id } = c.req.query()
  // 查询任务表
  const task = await c.env.DB.prepare(`SELECT * FROM notification_tasks WHERE id = ?`).bind(id).first<NotificationTask>();

  if (!task) {
    return error(c, '找不到该任务', 404);
  }

  // 2. 将参数转义并插入到 HTML 中
  // 注意：为了防止 XSS，这里使用了简单的转义，但因为我们要支持 Markdown，所以 message 不转义，由 marked 处理
  const safeTitle = task.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const page = html`
<!DOCTYPE html>
<html lang="zh-CN" dir="ltr">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- 动态标题 -->
    <title>${safeTitle}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: "Courier New", monospace;
            background: #000; color: #00ff00; min-height: 100vh;
            overflow-x: hidden; position: relative;
            display: flex; justify-content: center; align-items: center;
        }
        .matrix-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #000; z-index: -1; }
        .matrix-text { position: fixed; top: 20px; right: 20px; color: #00ff00; font-family: "Courier New", monospace; font-size: 0.8rem; opacity: 0.6; }

        .terminal {
            width: 90%; max-width: 800px; height: auto;
            background: rgba(0, 0, 0, 0.9); border: 2px solid #00ff00;
            border-radius: 8px; box-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
            position: relative; z-index: 1; overflow: hidden;
        }

        .terminal-header {
            background: rgba(0, 20, 0, 0.8); padding: 10px 15px;
            border-bottom: 1px solid #00ff00; display: flex; align-items: center;
        }

        .terminal-buttons {
            display: flex; gap: 8px;
        }

        .terminal-button {
            width: 12px; height: 12px; border-radius: 50%;
            background: #ff5f57; border: none;
        }
        .terminal-button:nth-child(2) { background: #ffbd2e; }
        .terminal-button:nth-child(3) { background: #28ca42; }

        .terminal-title {
            margin-left: 15px; color: #00ff00; font-size: 14px; font-weight: bold;
        }

        .terminal-body {
            padding: 20px; height: calc(100% - 50px);
            overflow-y: auto; font-size: 14px; line-height: 1.4;
        }

        /* 适配中间的通知内容 */
        .info-card {
            background: rgba(0, 30, 30, 0.85); 
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 25px;
            border-left: 4px solid #00ff00;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }

        .info-card:hover {
            transform: translateX(5px);
            background: rgba(0, 128, 0, 0.9); 
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }

        .info-label {
            font-size: 1.3rem;
            color: #80deea;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
        }

        .info-label::before {
            content: '';
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #00bcd4;
            margin-right: 10px;
        }

        .info-content {
            font-size: 1.2rem;
            color: #e0f7fa;
            font-weight: 500;
            line-height: 1.6;
            word-break: break-all;
            /* 移除 white-space: pre-line，让 Markdown 样式生效 */
        }

        /* Markdown 渲染后的样式优化 */
        .info-content h1, .info-content h2 {
            color: #a5d6a7;
            border-bottom: 1px solid #00ff0040;
            padding-bottom: 5px;
        }
        .info-content a {
            color: #80deea;
            text-decoration: underline;
        }
        .info-content code {
            background: #333;
            padding: 2px 5px;
            border-radius: 3px;
        }

        /* 响应式设计 */
        @media (max-width: 768px) {
            .terminal {
                width: 100%; max-width: 100%;
                height: auto;
            }
        }
    </style>
</head>
<body>
    <div class="matrix-bg"></div>

    <div class="terminal">
        <div class="terminal-header">
            <div class="terminal-buttons">
                <div class="terminal-button"></div>
                <div class="terminal-button"></div>
                <div class="terminal-button"></div>
            </div>
            <!-- 动态终端标题 -->
            <div class="terminal-title">${safeTitle}</div>
        </div>
        <div class="terminal-body">
            <div class="info-card">
                <div class="info-label">📢 通知详情</div>
                <!-- 这里使用 innerHTML 来渲染 Markdown 生成的 HTML -->
                <div class="info-content" id="message">${task.content}</div>
            </div>
            <div class="info-card">
                <div class="info-label">🔥 任务名称</div>
                <div class="info-content">${task.name}</div>
            </div>
        </div>
    </div>

    <!-- 引入 Marked.js CDN -->
    <script src="https://cdn.jsdelivr.net/npm/marked/lib/marked.umd.js"></script>
    <script>
        // 页面加载完成后，用 Marked.js 渲染消息内容
        document.addEventListener('DOMContentLoaded', function() {
          const messageEl = document.getElementById('message');
          if (messageEl) {
            // 获取原始文本（即 Hono 注入的 message 变量）
            const rawText = messageEl.textContent || messageEl.innerText;
            
            // 使用 marked 将 Markdown 转换为 HTML
            messageEl.innerHTML = marked.parse(rawText);
          }
        });
    </script>
</body>
</html>
  `;

  return c.html(page);
});

export default common;
