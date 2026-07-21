/**
 * 发送邮件（Resend API）
 * @param {Object} options
 * @param {string} options.from - 发件人地址，例如 "Name <email@example.com>"
 * @param {string} options.to - 收件人地址，支持多个地址请在 Resend 中用逗号分隔
 * @param {string} options.subject - 邮件主题
 * @param {string} [options.text] - 文本内容
 * @param {string} [options.html] - HTML 内容
 * @param {string} apiKey - Resend API Key
 * @returns {Promise<Object>} Resend API 返回的数据
 */
interface EmailSendOptions {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

interface ResendApiResponse {
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export async function sendEmail(options: EmailSendOptions, apiKey: string): Promise<ResendApiResponse> {
  const { from, to, subject, text, html } = options;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is required for email sending');
  }
  if (!to || !subject) {
    throw new Error('Email send requires both to and subject');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ from, to, subject, text, html })
  });

  const responseData = await response.json() as ResendApiResponse;
  if (!response.ok) {
    const message = responseData.error || responseData.message || 'Email send failed';
    throw new Error(`Resend API error: ${message}`);
  }

  return responseData;
}