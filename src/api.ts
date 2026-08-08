import type { Account, Budget, Category, Goal, Settings, Transfer, Tx } from './types';

/** 后端全量数据快照 */
export interface Snapshot {
  accounts: Account[];
  categories: Category[];
  txs: Tx[];
  transfers: Transfer[];
  budgets: Budget[];
  goals: Goal[];
  settings: Settings;
}

const BASE = '/api';
const TOKEN_KEY = 'jizhang-token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 忽略 */
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data && typeof data.error === 'string') msg = data.error;
    } catch {
      /* 忽略解析错误 */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// 写请求串行化：后发的排在前一个完成之后，避免快速连续操作竞态
let writeChain: Promise<unknown> = Promise.resolve();

export function getState(): Promise<Snapshot> {
  return request<Snapshot>('/state');
}

export function putState(state: Snapshot): Promise<{ ok: boolean }> {
  const task = writeChain.then(() =>
    request<{ ok: boolean }>('/state', { method: 'PUT', body: JSON.stringify(state) }),
  );
  writeChain = task.catch(() => undefined);
  return task;
}

// ---- 认证 ----
export interface AuthResult {
  token: string;
  username: string;
}

export const authApi = {
  register: (username: string, password: string) =>
    request<AuthResult>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    request<AuthResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<{ username: string }>('/auth/me'),
};
