import { Hono } from 'hono';
import type { Bindings } from '@shared/types';
import { generateToken } from '../utils';
import { success, error } from '../utils/response';

const auth = new Hono<{ Bindings: Bindings }>();

auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!password) {
    return error(c, '密码不能为空', -1, 400);
  }

  const expectedPassword = c.env.PASSWORD;
  if (password !== expectedPassword) {
    return error(c, '密码错误', -1, 401);
  }

  const token = await generateToken({ username: 'admin', role: 'administrator' }, c.env.JWT_SECRET);
  const cookieValue = `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`;
  c.header('Set-Cookie', cookieValue);

  return success(c, { username: 'admin', role: 'administrator' }, '登录成功');
});

auth.post('/logout', async (c) => {
  c.header('Set-Cookie', 'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  return success(c, null, '退出成功');
});

export default auth;
