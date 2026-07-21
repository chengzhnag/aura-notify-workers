import { NotificationChannel, NotificationTask } from "@shared/types";
import { CHANNEL_TYPES } from '@shared/constants';
import { marked } from 'marked';
import { buildDingtalkMessage, sendDingtalkMessage } from "./dingtalk";
import { FeishuBot } from "./feishu";
import { sendEmail } from "./email";
import { sendTelegram } from "./tg";
import { sendWxpush } from "./wxPush";
import { WxPusher } from "./wxpusher";
import { PushMe } from "./pushMe";
import { isLikelyMarkdown, sanitizeMdForFeishu } from '../utils';

export interface SendResult {
  channelName: string;
  channelId: number;
  channelType: string;
  success: boolean;
  response?: unknown;
  error?: string;
}

export interface NotificationContent {
  title: string;
  content: string;
}

export interface ChannelSender {
  send(channel: NotificationChannel, notification: NotificationContent, task?: NotificationTask): Promise<SendResult>;
}

class DingtalkSender implements ChannelSender {
  async send(channel: NotificationChannel, notification: NotificationContent): Promise<SendResult> {
    try {
      const config = JSON.parse(channel.config || "{}");
      let payload: any;
      if (isLikelyMarkdown(notification.content)) {
        payload = buildDingtalkMessage("markdown", { title: notification.title, content: notification.content });
      } else {
        payload = buildDingtalkMessage("text", { title: notification.title, content: notification.content });
      }
      const webhookUrl = config.webhookUrl || config.webhook || "";
      const secret = config.secret || "";
      if (!webhookUrl) {
        throw new Error("Missing webhook URL in channel config");
      }
      const response = await sendDingtalkMessage(webhookUrl, secret, payload);
      return { channelName: channel.name, channelId: channel.id, channelType: channel.type, success: true, response };
    } catch (error) {
      return { channelName: channel.name, channelId: channel.id, channelType: channel.type, success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

// ================= 飞书 Sender 实现 =================

class FeishuSender implements ChannelSender {

  /**
   * 根据通知类型映射飞书卡片头部颜色主题
   */
  private getCardTemplate(type?: string) {
    switch (type) {
      case 'error': return 'red';
      case 'warning': return 'orange';
      case 'success': return 'green';
      case 'info':
      default: return 'blue';
    }
  }

  async send(
    channel: NotificationChannel,
    notification: NotificationContent
  ): Promise<SendResult> {

    // 基础返回结构
    const baseResult = {
      channelName: channel.name,
      channelId: channel.id,
      channelType: channel.type,
    };

    try {
      // 1. 解析渠道配置
      const config = JSON.parse(channel.config || "{}");
      const webhookUrl = config.webhookUrl || config.webhook || "";
      const secret = config.secret || "";

      if (!webhookUrl) {
        throw new Error("Missing webhook URL in channel config");
      }

      // 2. 初始化飞书机器人 (使用上一版的 FeishuBot)
      const bot = new FeishuBot({ webhook: webhookUrl, secret });

      // 3. 构建飞书消息卡片 Payload
      // 飞书推荐使用 Interactive Card，展示效果最佳（支持 Markdown）
      const cardTemplate = this.getCardTemplate('success');

      const card: any = {
        header: {
          title: {
            tag: "plain_text",
            content: notification.title || "系统通知"
          },
          template: cardTemplate,
        },
        elements: [
          {
            tag: "markdown",
            content: sanitizeMdForFeishu(notification.content) || "无内容"
          }
        ],
      };

      // 4. 发送请求
      const response = await bot.sendCard(card);

      // 5. 返回成功结果
      return {
        ...baseResult,
        success: true,
        response
      };

    } catch (error) {
      // 捕获异常并返回标准化错误信息
      return {
        ...baseResult,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
}

class TelegramSender implements ChannelSender {
  async send(channel: NotificationChannel, notification: NotificationContent): Promise<SendResult> {
    try {
      const config = JSON.parse(channel.config || "{}");
      const botToken = config.botToken || "";
      const chatId = config.chatId || "";
      if (!botToken || !chatId) {
        throw new Error("Telegram 配置不完整：需要 botToken 和 chatId");
      }
      let format: any = 'text';
      if (isLikelyMarkdown(notification.content)) {
        format = 'markdown';
      } else if (/<[a-z][\s\S]*>/i.test(notification.content)) {
        format = 'html';
      }
      const response = await sendTelegram(botToken, chatId, notification.title, notification.content, format);
      return { channelName: channel.name, channelId: channel.id, channelType: channel.type, success: true, response };
    } catch (error) {
      return { channelName: channel.name, channelId: channel.id, channelType: channel.type, success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

class EmailSender implements ChannelSender {
  async send(channel: NotificationChannel, notification: NotificationContent): Promise<SendResult> {
    try {
      const config = JSON.parse(channel.config || "{}");
      const fromEmail = config.fromEmail || config.from || "";
      const toEmail = config.toEmail || config.to || "";
      const apiKey = config.apiKey || "";
      if (!fromEmail || !toEmail || !apiKey) {
        throw new Error("Email 配置不完整：需要 from, to 和 apiKey");
      }
      let htmlContent = notification.content;
      // 判断是否为 Markdown 内容，如果是则转换为 HTML
      if (isLikelyMarkdown(notification.content)) {
        htmlContent = await marked(notification.content, { async: true });
      }
      const response = await sendEmail({ from: fromEmail, to: toEmail, subject: notification.title, text: notification.content, html: htmlContent }, apiKey);
      return { channelName: channel.name, channelId: channel.id, channelType: channel.type, success: true, response };
    } catch (error) {
      return { channelName: channel.name, channelId: channel.id, channelType: channel.type, success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

class WxPushSender implements ChannelSender {
  async send(channel: NotificationChannel, notification: NotificationContent, task?: NotificationTask): Promise<SendResult> {
    try {
      const config = JSON.parse(channel.config || "{}");
      const appid = config.appid || "";
      const secret = config.secret || "";
      const userid = config.userid || "";
      const template_id = config.template_id || "";
      const base_url = config.base_url || (task?.id ? `https://notice.952737.xyz/api/common/notice-detail?id=${task?.id}` : '');

      if (!appid || !secret || !userid || !template_id) {
        throw new Error("WXPush 配置不完整：需要 appid, secret, userid, template_id");
      }

      const response = await sendWxpush({
        appid,
        secret,
        userid,
        template_id,
        title: notification.title,
        content: notification.content,
        base_url,
      });
      return { channelName: channel.name, channelId: channel.id, channelType: channel.type, success: true, response };
    } catch (error) {
      return { channelName: channel.name, channelId: channel.id, channelType: channel.type, success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

class WxPusherSender implements ChannelSender {
  async send(
    channel: NotificationChannel,
    notification: NotificationContent,
    task?: NotificationTask
  ): Promise<SendResult> {

    const baseResult = {
      channelName: channel.name,
      channelId: channel.id,
      channelType: channel.type,
    };

    try {
      const config = JSON.parse(channel.config || "{}");
      const appToken = config.appToken || "";
      const uids = (config.uids as string || '').replaceAll('，', ',').split(",") || [];
      const topicIds = (config.topicIds as string || '').replaceAll('，', ',').split(",").map(i => Number(i)) || [];

      if (!appToken) {
        throw new Error("Missing appToken in WxPusher channel config");
      }

      const pusher = new WxPusher({ appToken });

      // 将你的 notification.content 默认当作 Markdown 发送，如果包含 HTML 标签则用 HTML
      const isHtml = /<[a-z][\s\S]*>/i.test(notification.content);
      const isMarkdown = isLikelyMarkdown(notification.content);

      const baseUrl = config.url || (task?.id ? `https://notice.952737.xyz/api/common/notice-detail?id=${task?.id}` : '');

      let response: any;
      if (isMarkdown) {
        response = await pusher.sendMarkdown(notification.content, { uids, topicIds }, { summary: notification.title, url: baseUrl });
      } else if (isHtml) {
        response = await pusher.sendHtml(notification.content, { uids, topicIds }, { summary: notification.title, url: baseUrl });
      } else {
        response = await pusher.sendText(notification.content, { uids, topicIds }, { summary: notification.title, url: baseUrl });
      }

      return {
        ...baseResult,
        success: true,
        response
      };

    } catch (error) {
      return {
        ...baseResult,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
}

class PushMeSender implements ChannelSender {
  async send(
    channel: NotificationChannel,
    notification: NotificationContent,
  ): Promise<SendResult> {

    const baseResult = {
      channelName: channel.name,
      channelId: channel.id,
      channelType: channel.type,
    };

    try {
      const config = JSON.parse(channel.config || "{}");
      const pushKey = config.pushKey || config.push_key || "";
      const tempKey = config.tempKey || config.temp_key || "";
      const apiUrl = config.apiUrl || config.api_url || "";

      if (!pushKey && !tempKey) {
        throw new Error("Missing pushKey or tempKey in PushMe channel config");
      }

      const pusher = new PushMe({ pushKey, tempKey, apiUrl });

      // 简单判断内容类型：包含 HTML 标签用 html，包含 Markdown 特征用 markdown，否则用 text
      let type: 'text' | 'markdown' | 'html' = 'text';
      let response;
      if (isLikelyMarkdown(notification.content)) {
        type = 'markdown';
        response = await pusher.sendMarkdown(notification.title, notification.content);
      } else if (/<[a-z][\s\S]*>/i.test(notification.content)) {
        type = 'html';
        response = await pusher.sendHtml(notification.title, notification.content);
      } else {
        type = 'text';
        response = await pusher.sendText(notification.title, notification.content);
      }

      return {
        ...baseResult,
        success: response.success,
        response
      };

    } catch (error) {
      return {
        ...baseResult,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
}

const senderRegistry: Record<string, ChannelSender> = {
  [CHANNEL_TYPES.DINGTALK]: new DingtalkSender(),
  [CHANNEL_TYPES.FEISHU]: new FeishuSender(),
  [CHANNEL_TYPES.TELEGRAM]: new TelegramSender(),
  [CHANNEL_TYPES.RESEND]: new EmailSender(),
  [CHANNEL_TYPES.WXPUSH]: new WxPushSender(),
  [CHANNEL_TYPES.WXPUSHER]: new WxPusherSender(),
  [CHANNEL_TYPES.PUSHME]: new PushMeSender(),
};

export function registerChannelSender(type: string, sender: ChannelSender): void {
  senderRegistry[type] = sender;
}

export function getChannelSender(type: string): ChannelSender | null {
  return senderRegistry[type] || null;
}

export async function sendToChannel(channel: NotificationChannel, notification: NotificationContent, task?: NotificationTask): Promise<SendResult> {
  const sender = getChannelSender(channel.type);
  if (!sender) {
    return { channelName: channel.name, channelId: channel.id, channelType: channel.type, success: false, error: "Unsupported channel type: " + channel.type };
  }
  return sender.send(channel, notification, task);
}

export async function sendToChannels(channels: NotificationChannel[], notification: NotificationContent, task?: NotificationTask): Promise<SendResult[]> {
  const results: SendResult[] = [];
  for (const channel of channels) {
    const result = await sendToChannel(channel, notification, task);
    results.push(result);
  }
  return results;
}
