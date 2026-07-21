export const TASK_TYPES = {
  SINGLE: 'single',
  RECURRING: 'recurring',
  PERMANENT: 'permanent',
} as const;

export const TASK_TYPE_OPTIONS = [
  { value: TASK_TYPES.SINGLE, label: '单次触发' },
  { value: TASK_TYPES.RECURRING, label: '周期循环' },
  { value: TASK_TYPES.PERMANENT, label: '永久循环' },
] as const;

// 任务状态
export const TASK_STATUS = {
  ACTIVE: 'active',     // 运行中
  INACTIVE: 'inactive',  // 已暂停
  FINISHED: 'finished',  // 已结束
} as const;

export const TASK_STATUS_OPTIONS = [
  { value: TASK_STATUS.ACTIVE, label: '启用' },
  { value: TASK_STATUS.INACTIVE, label: '禁用' },
  { value: TASK_STATUS.FINISHED, label: '结束' },
] as const;

export const DATE_TYPES = {
  ALL: 'all',
  WORKDAY: 'workday',
  HOLIDAY: 'holiday',
} as const;

export const DATE_TYPE_OPTIONS = [
  { value: DATE_TYPES.ALL, label: '无过滤 (每天)' },
  { value: DATE_TYPES.WORKDAY, label: '工作日 (周一至周五)' },
  { value: DATE_TYPES.HOLIDAY, label: '节假日 (周末)' },
] as const;

export const CHANNEL_TYPES = {
  DINGTALK: 'dingtalk',
  FEISHU: 'feishu',
  TELEGRAM: 'telegram',
  RESEND: 'resend',
  WXPUSH: 'wxpush',
  WXPUSHER: 'wxpusher',
  PUSHME: 'pushme'
} as const;

export const CHANNEL_TYPE_OPTIONS = [
  { value: CHANNEL_TYPES.DINGTALK, label: '钉钉 (DingTalk)', docLink: 'https://open.dingtalk.com/document/development/custom-bot-to-send-group-chat-messages' },
  { value: CHANNEL_TYPES.FEISHU, label: '飞书 (Lark)', docLink: 'https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot' },
  { value: CHANNEL_TYPES.TELEGRAM, label: '电报 (Telegram)', docLink: 'https://chengzhnag.github.io/collect/2025-9-15-1757907416553.html' },
  { value: CHANNEL_TYPES.RESEND, label: '邮件 (Resend)', docLink: 'https://resend.com/docs/send-with-hono' },
  { value: CHANNEL_TYPES.WXPUSH, label: '微信测试号 (WXPush)', docLink: 'https://chengzhnag.github.io/collect/2026-7-16-1784190432345.html' },
  { value: CHANNEL_TYPES.WXPUSHER, label: 'WxPusher消息推送', docLink: 'https://wxpusher.zjiecode.com/docs' },
  { value: CHANNEL_TYPES.PUSHME, label: 'PushMe', docLink: 'https://push.i-i.me' },
] as const;

export const TASK_TYPE_LABELS: Record<string, string> = {
  [TASK_TYPES.SINGLE]: '单次执行',
  [TASK_TYPES.RECURRING]: '周期任务',
  [TASK_TYPES.PERMANENT]: '长期任务',
};

export const DATE_TYPE_LABELS: Record<string, string> = {
  [DATE_TYPES.ALL]: '每天',
  [DATE_TYPES.WORKDAY]: '工作日',
  [DATE_TYPES.HOLIDAY]: '节假日',
};

export const CHANNEL_TYPE_LABELS: Record<string, string> = {
  [CHANNEL_TYPES.DINGTALK]: '钉钉机器人',
  [CHANNEL_TYPES.FEISHU]: '飞书机器人',
  [CHANNEL_TYPES.TELEGRAM]: 'Telegram 机器人',
  [CHANNEL_TYPES.RESEND]: 'Resend 邮件服务',
  [CHANNEL_TYPES.WXPUSH]: '微信测试号',
  [CHANNEL_TYPES.WXPUSHER]: 'WxPusher消息推送',
  [CHANNEL_TYPES.PUSHME]: 'PushMe 推送服务',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  [TASK_STATUS.ACTIVE]: '启用',
  [TASK_STATUS.INACTIVE]: '禁用',
  [TASK_STATUS.FINISHED]: '结束',
};
