export const DINGTALK_MESSAGE_TYPES = [
  'text',
  'markdown',
  'link',
  'actionCard',
  'feedCard'
] as const;

export type DingtalkMessageType = (typeof DINGTALK_MESSAGE_TYPES)[number];

interface DingtalkAt {
  atMobiles?: string[];
  isAtAll?: boolean;
}

interface DingtalkMessageOptions {
  title?: string;
  content?: string;
  text?: string;
  at?: DingtalkAt;
  messageUrl?: string;
  url?: string;
  picUrl?: string;
  imageUrl?: string;
  hideAvatar?: number;
  btnOrientation?: number;
  btns?: Array<{ title: string; actionURL: string }>;
  links?: Array<{ title: string; messageURL: string; picURL?: string }>;
}

interface DingtalkResponse {
  errcode?: number;
  errmsg?: string;
  [key: string]: unknown;
}

/**
 * 根据钉钉消息类型构建发送对象。
 * @param {string} [type='text'] - 钉钉消息类型
 * @param {Object} [options={}] - 消息参数对象
 * @returns {Object} 钉钉消息 payload
 *
 * 支持的类型和参数：
 * - text: { content?, text?, title?, at? }
 *   - content / text：消息内容
 *   - title：可选标题，会与 content 拼接
 *   - at：{ atMobiles?: string[], isAtAll?: boolean }
 *
 * - markdown: { title, text?, content?, at? }
 *   - title：Markdown 标题
 *   - text / content：Markdown 正文
 *   - at：{ atMobiles?: string[], isAtAll?: boolean }
 *
 * - link: { title, text?, content?, messageUrl, url?, picUrl, imageUrl }
 *   - title：链接卡片标题
 *   - text / content：链接卡片描述
 *   - messageUrl / url：跳转链接
 *   - picUrl / imageUrl：图片链接
 *
 * - actionCard: { title, text?, content?, hideAvatar?, btnOrientation?, btns }
 *   - title：卡片标题
 *   - text / content：卡片内容，支持 Markdown
 *   - hideAvatar：是否隐藏机器人头像，默认为 1
 *   - btnOrientation：按钮排列方式，0 竖直，1 横向
 *   - btns：按钮数组，格式 [{ title, actionURL }]
 *
 * - feedCard: { links }
 *   - links：图文列表，数组元素格式 [{ title, messageURL, picURL }]
 */
export function buildDingtalkMessage(type: DingtalkMessageType = 'text', options: DingtalkMessageOptions = {}): Record<string, unknown> {
  const resolvedType = type || 'text';

  switch (resolvedType) {
    case 'text': {
      const content = [options.title, options.content].filter(Boolean).join('\n').trim() || options.text || '';
      return {
        msgtype: 'text',
        text: {
          content
        },
        at: options.at || { isAtAll: true }
      };
    }
    case 'markdown':
      return {
        msgtype: 'markdown',
        markdown: {
          title: options.title || '',
          text: options.text || options.content || ''
        },
        at: options.at || { isAtAll: true }
      };
    case 'link':
      return {
        msgtype: 'link',
        link: {
          title: options.title || '',
          text: options.text || options.content || '',
          messageUrl: options.messageUrl || options.url || '',
          picUrl: options.picUrl || options.imageUrl || ''
        }
      };
    case 'actionCard':
      return {
        msgtype: 'actionCard',
        actionCard: {
          title: options.title || '',
          text: options.text || options.content || '',
          hideAvatar: options.hideAvatar ?? 1,
          btnOrientation: options.btnOrientation ?? 0,
          btns: options.btns || []
        },
        at: options.at || { isAtAll: true }
      };
    case 'feedCard':
      return {
        msgtype: 'feedCard',
        feedCard: {
          links: options.links || []
        }
      };
    default:
      throw new Error(`Unsupported Dingtalk message type: ${resolvedType}`);
  }
}

/**
 * 发送钉钉消息到 webhook。
 * @param {string} webhook - 钉钉机器人 webhook 地址
 * @param {string} [secret] - 可选 secret，用于签名
 * @param {Object} message - 已构建好的钉钉消息 payload
 * @returns {Promise<Object>} 钉钉 API 返回结果
 */
export async function sendDingtalkMessage(webhook: string, secret?: string, message?: Record<string, unknown>): Promise<DingtalkResponse> {
  if (!webhook) {
    throw new Error('Dingtalk webhook is required');
  }

  const url = new URL(webhook);
  if (secret) {
    const timestamp = Date.now().toString();
    const signString = await generateDingtalkSign(secret, timestamp);
    url.searchParams.set('timestamp', timestamp);
    url.searchParams.set('sign', signString);
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    throw new Error(`钉钉API错误: ${response.status}`);
  }

  const responseData = await response.json() as DingtalkResponse;
  if (responseData.errcode !== 0) {
    throw new Error(`钉钉错误: ${responseData.errmsg || JSON.stringify(responseData)}`);
  }

  return responseData;
}

async function generateDingtalkSign(secret: string, timestamp: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const contentData = encoder.encode(`${timestamp}\n${secret}`);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: 'HMAC',
      hash: { name: 'SHA-256' }
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, contentData);
  const base64String = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return encodeURIComponent(base64String);
}