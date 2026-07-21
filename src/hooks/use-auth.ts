import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserInfo {
  username: string;
  role: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      login: async (password) => {
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password }),
          });

          const json = await response.json().catch(() => null);
          if (!response.ok || !json?.success) {
            return false;
          }

          set({
            isAuthenticated: true,
            user: json.data ?? { username: 'admin', role: 'administrator' },
          });
          return true;
        } catch {
          return false;
        }
      },
      logout: async () => {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
          });
        } catch {
          // ignore logout errors and clear local state
        }

        set({ isAuthenticated: false, user: null });
        localStorage.removeItem('auth-storage');
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
// Stable selectors to prevent re-renders and follow the "Law of Zustand"
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
export const useAuthUser = () => useAuthStore((s) => s.user);
export const useAuthLogin = () => useAuthStore((s) => s.login);
export const useAuthLogout = () => useAuthStore((s) => s.logout);

// 清除认证状态（用于非组件代码如 API 客户端）
export function clearAuthState() {
  const state = useAuthStore.getState();
  state.logout();
}