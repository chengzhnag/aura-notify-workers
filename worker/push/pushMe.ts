/**
 * PushMe 消息推送 Cloudflare Workers 适配版
 * 特点：
 * 1. 零外部依赖，纯原生 Fetch API
 * 2. 支持官方接口与自建接口地址
 * 3. 支持 text、markdown、html 三种消息类型
 * 4. 自动处理 PushMe 特殊的纯文本返回值 ("success")
 */

// ================= 类型定义 =================

export interface PushMeOptions {
  /** 接口密钥 (在 PushMe App 获取，与 temp_key 二选一) */
  pushKey?: string;
  /** 临时密钥 (在 PushMe App 获取，与 push_key 二选一) */
  tempKey?: string;
  /** 接口地址，默认为官方地址，支持自建服务地址 */
  apiUrl?: string;
}

export type PushMeMessageType = 'text' | 'markdown' | 'html';

export interface PushMePayload {
  /** 消息标题 (title 和 content 至少填一项) */
  title?: string;
  /** 消息内容 (title 和 content 至少填一项) */
  content?: string;
  /** 消息时间，格式 "YYYY-mm-dd HH:ii:ss"，不传则默认为当前时间 */
  date?: string;
  /** 消息类型，默认为 "text" */
  type?: PushMeMessageType;
}

export interface PushMeResponse {
  success: boolean;
  message: string; // 成功时为 "success"，失败时为具体错误信息
}

// ================= 核心类 =================

export class PushMe {
  private pushKey?: string;
  private tempKey?: string;
  private apiUrl: string;

  constructor(options: PushMeOptions) {
    this.pushKey = options.pushKey;
    this.tempKey = options.tempKey;
    this.apiUrl = options.apiUrl || "https://push.i-i.me";

    if (!this.pushKey && !this.tempKey) {
      throw new Error("PushMe Error: Either 'pushKey' or 'tempKey' must be provided.");
    }
  }

  /**
   * 底层发送请求方法
   */
  private async send(payload: PushMePayload): Promise<PushMeResponse> {
    if (!payload.title && !payload.content) {
      throw new Error("PushMe Error: Either 'title' or 'content' must be provided.");
    }

    // 构建请求体 (PushMe 官方要求所有参数值类型都为 string)
    const requestBody: Record<string, string> = {
      type: payload.type || 'text',
    };

    if (this.pushKey) requestBody.push_key = this.pushKey;
    if (this.tempKey) requestBody.temp_key = this.tempKey;
    if (payload.title) requestBody.title = payload.title;
    if (payload.content) requestBody.content = payload.content;
    if (payload.date) requestBody.date = payload.date;

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    // PushMe 成功时 HTTP 状态码为 200，且 body 纯文本返回 "success"
    const responseText = await response.text();

    if (response.ok && responseText.toLowerCase().includes('success')) {
      return { success: true, message: responseText };
    }

    // 如果 HTTP 报错或返回非 success 文本，则视为失败
    throw new Error(`PushMe API Error: [${response.status}] ${responseText || 'Unknown error'}`);
  }

  /**
   * 发送纯文本消息
   */
  async sendText(title: string, content?: string, date?: string): Promise<PushMeResponse> {
    return this.send({ title, content, date, type: 'text' });
  }

  /**
   * 发送 Markdown 消息
   */
  async sendMarkdown(title: string, content: string, date?: string): Promise<PushMeResponse> {
    return this.send({ title, content, date, type: 'markdown' });
  }

  /**
   * 发送 HTML 消息
   */
  async sendHtml(title: string, content: string, date?: string): Promise<PushMeResponse> {
    return this.send({ title, content, date, type: 'html' });
  }
}