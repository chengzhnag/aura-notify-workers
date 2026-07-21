/**
 * 飞书 Webhook 机器人 Cloudflare Workers 适配版
 * 特点：
 * 1. 零外部依赖，纯原生 Fetch API + Web Crypto API
 * 2. 支持签名校验 (Sign) 保障安全性
 * 3. 支持纯文本、富文本、交互式消息卡片
 * 4. 完善的 TypeScript 类型提示
 */

// ================= 类型定义 =================

export interface FeishuBotOptions {
  /** 完整的 Webhook 地址 (例如: https://open.feishu.cn/open-apis/bot/v2/hook/xxx) */
  webhook: string;
  /** 签名密钥 (如果在飞书后台开启了签名校验，则必须传入) */
  secret?: string;
}

export interface FeishuResponse {
  StatusCode: number; // 0 表示成功
  StatusMessage: string;
  code?: number; // 旧版 API 返回的错误码
  msg?: string;  // 旧版 API 返回的错误信息
}

// 消息卡片颜色主题
export type CardTemplate = 

  | 'blue' | 'wathet' | 'turquoise' | 'green' | 'yellow' 
  | 'orange' | 'red' | 'carmine' | 'violet' | 'purple' 
  | 'indigo' | 'grey';

export interface CardHeader {
  title: { tag: 'plain_text' | 'lark_md'; content: string };
  template?: CardTemplate;
}

export interface CardElement {
  tag: string;
  [key: string]: any; // 允许任意卡片元素属性 (如 markdown, button 等)
}

export interface CardPayload {
  header?: CardHeader;
  elements: CardElement[];
}

// ================= 核心类 =================

export class FeishuBot {
  private webhook: string;
  private secret?: string;

  constructor(options: FeishuBotOptions) {
    this.webhook = options.webhook;
    this.secret = options.secret;
  }

  /**
   * 生成签名 (使用 Web Crypto API，完美兼容 Cloudflare Workers)
   */
  private async genSign(timestamp: number): Promise<string> {
    if (!this.secret) return "";
    
    const encoder = new TextEncoder();
    
    // 【核心修复】：飞书使用 `timestamp + "\n" + secret` 作为 HMAC 的 KEY
    const keyData = encoder.encode(`${timestamp}\n${this.secret}`);
    // 【核心修复】：飞书是对【空字符串】进行签名
    const messageData = encoder.encode(""); 
    
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign("HMAC", key, messageData);
    
    // 将 ArrayBuffer 安全转换为 Base64 字符串 (兼容 Workers 环境)
    const bytes = new Uint8Array(signature);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * 底层发送请求方法
   */
  private async send(payload: Record<string, any>): Promise<FeishuResponse> {
    // 如果配置了 secret，则追加 timestamp 和 sign 参数
    if (this.secret) {
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = await this.genSign(timestamp);
      payload.timestamp = timestamp.toString();
      payload.sign = sign;
    }

    const response = await fetch(this.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as FeishuResponse;
    
    // 飞书 API 成功返回的 StatusCode 应该是 0
    if (result.StatusCode !== 0 && result.code !== 0) {
      throw new Error(`Feishu API Error: [${result.StatusCode || result.code}] ${result.StatusMessage || result.msg}`);
    }
    
    return result;
  }

  /**
   * 发送纯文本消息
   * @param text 文本内容 (支持 @用户，如: "<at user_id='ou_xxx'>测试</at>")
   */
  async sendText(text: string): Promise<FeishuResponse> {
    return this.send({
      msg_type: 'text',
      content: { text },
    });
  }

  /**
   * 发送交互式消息卡片 (最常用，支持 Markdown、按钮、多列布局)
   * @param card 卡片 JSON 对象 (可在飞书卡片搭建工具中可视化生成)
   */
  async sendCard(card: CardPayload): Promise<FeishuResponse> {
    return this.send({
      msg_type: 'interactive',
      card: card,
    });
  }

  /**
   * 快捷发送 Markdown 卡片 (封装好的常用卡片格式)
   * @param title 卡片标题
   * @param markdown Markdown 内容
   * @param template 标题颜色主题
   */
  async sendMarkdown(
    title: string, 
    markdown: string, 
    template: CardTemplate = 'blue'
  ): Promise<FeishuResponse> {
    const card: CardPayload = {
      header: {
        title: { tag: 'plain_text', content: title },
        template: template,
      },
      elements: [
        { tag: 'markdown', content: markdown }
      ],
    };
    return this.sendCard(card);
  }
}