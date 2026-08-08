import { create } from 'zustand';
import { authApi, getToken, setToken } from '../api';
import { useBookStore } from './useBookStore';

type AuthStatus = 'loading' | 'guest' | 'authed';

interface AuthState {
  token: string | null;
  username: string | null;
  status: AuthStatus;
  /** 登录/注册提交中 */
  busy: boolean;
  error: string | null;

  /** 启动时校验本地 token */
  boot: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getToken(),
  username: null,
  status: 'loading',
  busy: false,
  error: null,

  boot: async () => {
    const token = getToken();
    if (!token) {
      set({ status: 'guest' });
      return;
    }
    try {
      const me = await authApi.me();
      set({ token, username: me.username, status: 'authed' });
      await useBookStore.getState().init();
    } catch {
      setToken(null);
      set({ token: null, username: null, status: 'guest' });
    }
  },

  login: async (username, password) => {
    set({ busy: true, error: null });
    try {
      const r = await authApi.login(username, password);
      setToken(r.token);
      set({ token: r.token, username: r.username, status: 'authed' });
      await useBookStore.getState().init();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ busy: false });
    }
  },

  register: async (username, password) => {
    set({ busy: true, error: null });
    try {
      const r = await authApi.register(username, password);
      setToken(r.token);
      set({ token: r.token, username: r.username, status: 'authed' });
      await useBookStore.getState().init();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ busy: false });
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      /* 忽略（token 可能已失效） */
    }
    setToken(null);
    useBookStore.getState().reset(); // 清掉当前用户内存数据，避免串号
    set({ token: null, username: null, status: 'guest', error: null });
  },

  clearError: () => set({ error: null }),
}));
