import type { Context, Next } from 'hono';
import { verify, sign } from 'hono/jwt';
import type { Bindings } from '@shared/types';
import { error } from './response';

export async function generateToken(extra: Record<string, unknown>, secret: string) {
  const now = Math.floor(Date.now() / 1000);
  return await sign(
    {
      ...extra,
      iat: now,
      exp: now + 7 * 24 * 60 * 60,
    },
    secret
  );
}

export const authMiddleware = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  let token: string | null = null;
  const authHeader = c.req.header('Authorization') || c.req.header('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    const cookieHeader = c.req.header('cookie') || c.req.header('Cookie') || '';
    const match = cookieHeader.match(/(?:^|; )token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) {
    return error(c, '未授权访问', -1, 401);
  }

  try {
    await verify(token, c.env.JWT_SECRET, 'HS256');
    await next();
  } catch {
    return error(c, 'Token 无效或已过期', -1, 401);
  }
};

/**
 * 启发式检测文本是否大概率是 Markdown 格式
 * @param {string} text - 待检测的文本
 * @returns {boolean}
 */
export function isLikelyMarkdown(text: string | undefined) {
  if (!text || typeof text !== 'string') return false;

  // 1. 强特征正则（普通文本极难偶然触发，命中即加分）
  const strongPatterns = [
    /^(`{3,}|~{3,})/m,                      // 围栏代码块 (``` 或 ~~~)
    /^#{1,6}[ \t]+\S/m,                     // ATX 标题 (# 到 ######)
    /!?  $ [^ $  ]* $    $ [^)]+ $  /,                // 链接或图片 [text](url)
    /^>[ \t]+\S/m,                          // 块引用 (> )
    /^\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)+\|?[ \t]* $ /m, // 表格分隔行 (|---|---|)
  ];

  // 2. 弱特征正则（容易误判，需要多个组合出现才可信）
  const weakPatterns = [
    /^[ \t]*[-*+][ \t]+\S/m,                // 无序列表 (-, *, +)
    /^[ \t]*\d+\.[ \t]+\S/m,                // 有序列表 (1. )
    /(\*\*|__).+?\1/,                       // 加粗 (**text** 或 __text__)
    /<[/]?[a-z][\s\S]*>/i                   // 内嵌 HTML 标签
  ];

  let score = 0;

  // 强特征命中一个得 2 分
  for (const regex of strongPatterns) {
    if (regex.test(text)) score += 2;
  }

  // 弱特征命中一个得 1 分
  for (const regex of weakPatterns) {
    if (regex.test(text)) score += 1;
  }

  // 经验阈值：得分 >= 3 大概率是 Markdown
  // (例如：包含一个标题(2分) + 一个列表(1分) = 3分)
  return score >= 3;
}

/**
 * 将标准 Markdown 转换为飞书卡片支持的 Markdown (降级处理)
 * @param {string} md - 原始标准 Markdown
 * @returns {string} - 飞书兼容的 Markdown
 */
export function sanitizeMdForFeishu(md: string | undefined) {
  if (!md) return "";

  let feishuMd = md;

  // 1. 标题降级：将 # H1 转换为 **H1** (加粗)
  // 匹配 1-6 个 # 开头的标题，替换为加粗
  feishuMd = feishuMd.replace(/^#{1,6}\s+(.+)$/gm, "**$1**");

  // 2. 表格处理：飞书卡片完全不支持 Markdown 表格！
  // 这里只能做一个简单的降级：将表格转为纯文本列表，或者直接提示
  // 复杂表格建议使用飞书的 column_set 组件，这里我们将其转为代码块展示
  feishuMd = feishuMd.replace(/(?:^|\n)(\|.+\|\n)(?:\|[-:\s|]+\|\n)((?:\|.+\|\n?)+)/g, (match, header, body) => {
    // 简单的降级：将表格内容提取出来，用代码块包裹，防止排版错乱
    return `\n\`\`\`text\n${header}${body}\`\`\`\n`;
  });

  // 3. 列表前后的空行补齐（飞书的怪癖，列表前后必须有真正的空行）
  // 在列表项 (- 或 * 或 1.) 前面强制加一个空行
  feishuMd = feishuMd.replace(/([^\n])\n(\s*[-*+]\s+)/g, "$1\n\n$2");
  feishuMd = feishuMd.replace(/([^\n])\n(\s*\d+\.\s+)/g, "$1\n\n$2");

  // 4. 移除 HTML 标签（飞书卡片 Markdown 对 HTML 支持极差）
  feishuMd = feishuMd.replace(/<[^>]+>/g, "");

  // 5. 引用块降级：将 > text 转换为 🟢 text (用 emoji 代替，更醒目)
  feishuMd = feishuMd.replace(/^>\s+(.+)$/gm, "🟢 $1");

  // 6. 修复连续的多个空行，避免卡片渲染出巨大空白
  feishuMd = feishuMd.replace(/\n{3,}/g, "\n\n");

  return feishuMd.trim();
}
