import { ApiResponse } from "../../shared/types"
import { clearAuthState } from "@/hooks/use-auth"

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { 
    headers: { 'Content-Type': 'application/json' }, 
    credentials: 'include', 
    ...init 
  });

  // 处理 401 未授权，清除状态并跳转到登录页
  if (res.status === 401) {
    clearAuthState();
    window.location.assign('/login');
    throw new Error('未授权，请重新登录');
  }

  const json = (await res.json()) as ApiResponse<T>
  if (!res.ok || !json.success || json.data === undefined) {
    throw new Error(json.message || 'Request failed')
  }
  return json.data
}

export async function apiWithMeta<T>(path: string, init?: RequestInit): Promise<{ data: T; meta?: ApiResponse['meta'] }> {
  const res = await fetch(path, { 
    headers: { 'Content-Type': 'application/json' }, 
    credentials: 'include', 
    ...init 
  });

  // 处理 401 未授权，清除状态并跳转到登录页
  if (res.status === 401) {
    clearAuthState();
    window.location.assign('/login');
    throw new Error('未授权，请重新登录');
  }

  const json = (await res.json()) as ApiResponse<T>
  if (!res.ok || !json.success || json.data === undefined) {
    throw new Error(json.message || 'Request failed')
  }
  return { data: json.data, meta: json.meta }
}
