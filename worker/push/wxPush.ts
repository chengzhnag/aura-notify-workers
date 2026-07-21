/**
 * 获取稳定的微信 Access Token
 * @param {string} appid - 微信 AppID
 * @param {string} secret - 微信 Secret
 * @returns {Promise<string>} access_token
 */

interface StableTokenRequest {
  grant_type: 'client_credential';
  appid: string;
  secret: string;
  force_refresh: boolean;
}

interface StableTokenResponse {
  access_token?: string;
  errcode?: number;
  errmsg?: string;
  expires_in?: number;
  [key: string]: unknown;
}

export async function getStableToken(
  appid: string,
  secret: string
): Promise<string> {
  const tokenUrl = 'https://api.weixin.qq.com/cgi-bin/stable_token';
  const payload: StableTokenRequest = {
    grant_type: 'client_credential',
    appid,
    secret,
    force_refresh: false,
  };

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json() as StableTokenResponse;
  if (!data.access_token) {
    throw new Error(
      `WXPush 获取 access_token 失败: ${JSON.stringify(data)}`
    );
  }
  return data.access_token;
}

/**
 * 发送单条微信模板消息
 * @param {string} accessToken - 微信 access_token
 * @param {string} userid - 接收者 userid
 * @param {string} template_id - 模板 ID
 * @param {string} base_url - 跳转链接
 * @param {string} title - 消息标题
 * @param {string} content - 消息内容
 * @returns {Promise<Object>} 微信 API 返回值
 */

interface TemplateDataField {
  value: string;
  color?: string;
}

interface TemplateSendPayload {
  touser: string;
  template_id: string;
  url: string;
  data: Record<string, TemplateDataField>;
}

interface WxApiResponse {
  errcode?: number;
  errmsg?: string;
  [key: string]: unknown;
}

interface SendWxMessageOptions {
  accessToken: string;
  userid: string;
  template_id: string;
  base_url?: string;
  title: string;
  content: string;
}

export async function sendWxMessage(
  options: SendWxMessageOptions
): Promise<WxApiResponse> {
  const {
    accessToken,
    userid,
    template_id,
    base_url = '',
    title,
    content,
  } = options;

  const sendUrl = `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`;
  const payload: TemplateSendPayload = {
    touser: userid,
    template_id,
    url: base_url,
    data: {
      title: { value: title || '', color: '#173177' },
      content: { value: content || '' },
    },
  };

  const response = await fetch(sendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response.json() as Promise<WxApiResponse>;
}

/**
 * 发送微信模板消息给多个用户
 * @param {string} appid - 微信 AppID
 * @param {string} secret - 微信 Secret
 * @param {string} userid - 接收用户 ID，可用 `|` 分隔多个
 * @param {string} template_id - 模板 ID
 * @param {string} title - 消息标题
 * @param {string} content - 消息内容
 * @param {string} base_url - 跳转链接
 * @returns {Promise<Object>} 发送结果汇总
 */

interface WxSendResult {
  name: 'wxpush';
  success: boolean;
  total: number;
  successCount: number;
  details: WxApiResponse[];
}

interface SendWxpushOptions {
  appid: string;
  secret: string;
  userid: string;
  template_id: string;
  title: string;
  content: string;
  base_url?: string;
}

export async function sendWxpush(
  options: SendWxpushOptions
): Promise<WxSendResult> {
  const { appid, secret, userid, template_id, title, content, base_url } =
    options;

  const accessToken = await getStableToken(appid, secret);
  const userList = userid
    .replaceAll('，', ',')
    .split(',')
    .map((uid) => uid.trim())
    .filter(Boolean);

  const results = await Promise.all(
    userList.map((id) =>
      sendWxMessage({
        accessToken,
        userid: id,
        template_id,
        base_url,
        title,
        content,
      })
    )
  );

  const successCount = results.filter((r) => r.errmsg === 'ok').length;
  const failedResults = results.filter((r) => r.errmsg !== 'ok');
  if (failedResults.length > 0) {
    const error = new Error('WXPush 部分发送失败');
    (error as Error & { details: WxApiResponse[] }).details = failedResults;
    throw error;
  }

  return {
    name: 'wxpush',
    success: true,
    total: results.length,
    successCount,
    details: results,
  };
}