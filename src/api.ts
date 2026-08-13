import type { Account, Budget, Category, CategoryGroup, Goal, Settings, Transfer, Tx } from './types';

/** 后端全量数据快照 */
export interface Snapshot {
  accounts: Account[];
  categories: Category[];
  categoryGroups: CategoryGroup[];
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

/** GET /api/state 的结果：数据快照 + 该账号数据版本（乐观并发用） */
export interface StateResult {
  data: Snapshot;
  version: number;
}

export async function getState(): Promise<StateResult> {
  const token = getToken();
  const res = await fetch(`${BASE}/state`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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
  const data = (await res.json()) as Snapshot;
  const version = Number(res.headers.get('X-Version') ?? 0);
  return { data, version };
}

/** 版本冲突：本设备快照已过期，服务器返回了最新快照，用它刷新本地即可 */
export class ConflictError extends Error {
  latest: { data: Snapshot; version: number };
  constructor(message: string, data: Snapshot, version: number) {
    super(message);
    this.name = 'ConflictError';
    this.latest = { data, version };
  }
}

export function putState(state: Snapshot, version: number): Promise<{ ok: boolean; version: number }> {
  const task = writeChain.then(async () => {
    const token = getToken();
    const res = await fetch(`${BASE}/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Version': String(version),
      },
      body: JSON.stringify(state),
    });
    if (res.status === 409) {
      // 另一台设备改过数据：服务器拒绝并附带最新快照，抛出后由 store 刷新
      let data: Snapshot = {} as Snapshot;
      let serverVersion = version;
      let msg = '数据已过期，已为你刷新';
      try {
        const body = await res.json();
        if (body && typeof body.data === 'object' && body.data) data = body.data as Snapshot;
        serverVersion = Number(body?.version ?? version);
        if (body && typeof body.error === 'string') msg = body.error;
      } catch {
        /* 忽略解析错误 */
      }
      throw new ConflictError(msg, data, serverVersion);
    }
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
    const newVersion = Number(res.headers.get('X-Version') ?? version);
    return { ok: true, version: newVersion };
  });
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
