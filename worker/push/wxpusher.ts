/**
 * WxPusher 消息推送 Cloudflare Workers 适配版
 * 特点：
 * 1. 零外部依赖，纯原生 Fetch API
 * 2. 支持 HTML、Markdown、纯文本三种格式
 * 3. 支持群发 (Topic) 和单发 (UID)
 * 4. 完善的 TypeScript 类型提示
 */

// ================= 类型定义 =================

export interface WxPusherOptions {
  /** WxPusher 应用的 AppToken (例如: AT_xxx) */
  appToken: string;
}

export type ContentType = 1 | 2 | 3; // 1: 文本, 2: HTML, 3: Markdown
export type VerifyPayType = 0 | 1 | 2; // 0: 不验证, 1: 只发给付费用户, 2: 只发给免费/过期用户

export interface WxPusherPayload {
  /** 必传：消息内容 */
  content: string;
  /** 可选：消息摘要 (最长100字，不传则自动截取 content) */
  summary?: string;
  /** 必传：内容类型 (1:文本, 2:HTML, 3:Markdown) */
  contentType: ContentType;
  /** 可选：发送目标的 TopicId 数组 (群发) */
  topicIds?: number[];
  /** 可选：发送目标的 UID 数组 (单发) */
  uids?: string[];
  /** 可选：原文链接 */
  url?: string;
  /** 可选：是否验证付费 (0:不验证, 1:只发给付费, 2:只发给未订阅/过期) */
  verifyPayType?: VerifyPayType;
}

export interface WxPusherResponseData {
  uid?: string;
  topicId?: number | null;
  messageContentId?: number;
  sendRecordId?: number;
  code: number;
  status: string;
}

export interface WxPusherResponse {
  code: number;
  msg: string;
  data: WxPusherResponseData[];
  success: boolean;
}

// ================= 核心类 =================

export class WxPusher {
  private appToken: string;
  private apiUrl = "https://wxpusher.zjiecode.com/api/send/message";

  constructor(options: WxPusherOptions) {
    this.appToken = options.appToken;
  }

  /**
   * 底层发送请求方法
   */
  private async send(payload: WxPusherPayload): Promise<WxPusherResponse> {
    if (!payload.topicIds?.length && !payload.uids?.length) {
      throw new Error("WxPusher Error: 'topicIds' or 'uids' must be provided.");
    }

    const requestBody = {
      appToken: this.appToken,
      ...payload,
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as WxPusherResponse;

    // WxPusher 业务状态码非 1000 表示异常
    if (result.code !== 1000) {
      throw new Error(`WxPusher API Error: [${result.code}] ${result.msg}`);
    }

    return result;
  }

  /**
   * 发送 HTML 消息 (官方推荐，支持复杂排版和复制按钮)
   */
  async sendHtml(
    html: string, 
    target: { uids?: string[], topicIds?: number[] },
    options?: { summary?: string, url?: string, verifyPayType?: VerifyPayType }
  ): Promise<WxPusherResponse> {
    return this.send({
      content: html,
      contentType: 2,
      uids: target.uids,
      topicIds: target.topicIds,
      summary: options?.summary,
      url: options?.url,
      verifyPayType: options?.verifyPayType,
    });
  }

  /**
   * 发送 Markdown 消息
   */
  async sendMarkdown(
    markdown: string, 
    target: { uids?: string[], topicIds?: number[] },
    options?: { summary?: string, url?: string, verifyPayType?: VerifyPayType }
  ): Promise<WxPusherResponse> {
    return this.send({
      content: markdown,
      contentType: 3,
      uids: target.uids,
      topicIds: target.topicIds,
      summary: options?.summary,
      url: options?.url,
      verifyPayType: options?.verifyPayType,
    });
  }

  /**
   * 发送纯文本消息
   */
  async sendText(
    text: string, 
    target: { uids?: string[], topicIds?: number[] },
    options?: { summary?: string, url?: string, verifyPayType?: VerifyPayType }
  ): Promise<WxPusherResponse> {
    return this.send({
      content: text,
      contentType: 1,
      uids: target.uids,
      topicIds: target.topicIds,
      summary: options?.summary,
      url: options?.url,
      verifyPayType: options?.verifyPayType,
    });
  }
}