/**
 * Telegram 消息格式类型
 * - html: HTML 格式（支持 <b>, <i>, <code>, <a> 等标签）
 * - markdown: Markdown 格式（支持 *, _, `, [] 等语法）
 * - text: 纯文本格式（不做任何解析）
 */
export type TelegramFormat = "html" | "markdown" | "text";

interface TelegramResponse {
  ok: boolean;
  description?: string;
  [key: string]: unknown;
}

// ======================== HTML 清洗 ========================

/**
 * Telegram HTML 模式支持的标签白名单
 * 参考: https://core.telegram.org/bots/api#html-style
 */
const TELEGRAM_ALLOWED_TAGS = new Set([
  "b", "strong",
  "i", "em",
  "u", "ins",
  "s", "strike", "del",
  "tg-spoiler",
  "a",
  "code",
  "pre",
  "tg-emoji",
]);

/**
 * 块级标签 —— 剥离时需要在原位插入换行，保持排版
 */
const BLOCK_TAGS = new Set([
  "div", "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "ul", "ol", "li", "hr", "br",
  "table", "tr", "thead", "tbody", "tfoot",
  "section", "article", "header", "footer", "main",
]);

/**
 * 清洗 HTML 内容，使其兼容 Telegram 的 HTML parse_mode
 *
 * - 支持的标签：保留（b, i, u, s, a, code, pre 等）
 * - 块级标签：替换为换行符（div, p, br, h1~h6 等）
 * - 其他标签：静默剥离（span, img, table 等）
 * - HTML 实体：保留 &amp; &lt; &gt; 等
 */
function sanitizeHtmlForTelegram(html: string): string {
  // 先处理自闭合标签 <br>, <br/>, <hr>, <hr/> 等 → 替换为换行
  let result = html.replace(/<(br|hr)\s*\/?>/gi, "\n");

  // 处理所有标签
  result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tagName: string) => {
    const tag = tagName.toLowerCase();

    // 白名单标签：保留原样
    if (TELEGRAM_ALLOWED_TAGS.has(tag)) {
      // 对于 <a> 标签，只保留 href 属性
      if (tag === "a") {
        const hrefMatch = match.match(/href\s*=\s*["']([^"']*)["']/);
        const isClosing = match.startsWith("</");
        if (isClosing) return "</a>";
        return hrefMatch ? `<a href="${hrefMatch[1]}">` : "<a>";
      }
      return match;
    }

    // 块级标签：替换为换行
    if (BLOCK_TAGS.has(tag)) {
      return "\n";
    }

    // 其他标签：静默删除
    return "";
  });

  // 清理多余的空行（连续 3 个以上换行合并为 2 个）
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/**
 * 转义 MarkdownV2 特殊字符
 * 需要转义的字符: _ * [ ] ( ) ~ ` > # + - = | { } . !
 * 参考: https://core.telegram.org/bots/api#markdownv2-style
 */
function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

/** 根据格式类型生成消息文本和 parse_mode */
function buildMessage(
  title: string,
  content: string,
  format: TelegramFormat,
): { text: string; parse_mode?: string } {
  const body = content || "-";

  switch (format) {
    case "html":
      return {
        text: `📢通知标题：\n<b>${title}</b>\n\n📢通知内容：\n${sanitizeHtmlForTelegram(body)}`,
        parse_mode: "HTML",
      };

    case "markdown":
      // 使用 MarkdownV2（而非 legacy Markdown）
      // 注意：*bold* 标记本身不转义，只转义里面的内容
      return {
        text: `📢通知标题：\n*${escapeMarkdownV2(title)}*\n\n📢通知内容：\n${escapeMarkdownV2(body)}`,
        parse_mode: "MarkdownV2",
      };

    case "text":
    default:
      return {
        text: `📢通知标题：\n${title}\n\n📢通知内容：\n${body}`,
      };
  }
}

/**
 * 发送 Telegram 通知
 * @param token   - Telegram Bot Token
 * @param chatId  - Telegram Chat ID
 * @param title   - 通知标题
 * @param content - 通知内容
 * @param format  - 消息格式，默认 "html"
 * @returns 发送结果
 */
export async function sendTelegram(
  token: string,
  chatId: string | number,
  title: string,
  content?: string,
  format: TelegramFormat = "html",
): Promise<{ name: string; success: boolean }> {
  const { text, parse_mode } = buildMessage(title, content || "-", format);

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };

  if (parse_mode) {
    payload.parse_mode = parse_mode;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  const responseData = (await response.json()) as TelegramResponse;
  if (!responseData.ok) {
    throw new Error(`Telegram API返回错误: ${responseData.description}`);
  }

  return { name: "telegram", success: true };
}

/* ======================== 便捷方法 ======================== */

/** 发送 HTML 格式的 Telegram 通知 */
export function sendTelegramHtml(
  token: string,
  chatId: string | number,
  title: string,
  content?: string,
) {
  return sendTelegram(token, chatId, title, content, "html");
}

/** 发送 MarkdownV2 格式的 Telegram 通知 */
export function sendTelegramMarkdown(
  token: string,
  chatId: string | number,
  title: string,
  content?: string,
) {
  return sendTelegram(token, chatId, title, content, "markdown");
}

/** 发送纯文本格式的 Telegram 通知 */
export function sendTelegramText(
  token: string,
  chatId: string | number,
  title: string,
  content?: string,
) {
  return sendTelegram(token, chatId, title, content, "text");
}