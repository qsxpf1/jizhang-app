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

// ---- 通用请求 ---- //
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

/** 当前账号在服务器端的数据版本（乐观并发控制） */
let currentVersion = 0;

export function getCurrentVersion(): number {
  return currentVersion;
}

export function setCurrentVersion(v: number): void {
  currentVersion = v;
}

// ---- 全量读写（初始化 + 批量操作用） ---- //

/** GET /api/state 的结果：数据快照 + 该账号数据版本 */
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

// ---- 批量操作（导入/清空/初始化等场景） ---- //

/** 批量操作类型 */
export type BatchOp =
  | { action: 'clear' }
  | { action: 'add_account'; data: Account }
  | { action: 'add_category'; data: Category }
  | { action: 'add_category_group'; data: CategoryGroup }
  | { action: 'add_tx'; data: Tx }
  | { action: 'add_transfer'; data: Transfer }
  | { action: 'add_budget'; data: Budget }
  | { action: 'add_goal'; data: Goal }
  | { action: 'update_settings'; data: Partial<Settings> };

/** POST /api/batch 批量操作（单事务，带版本校验），409 时抛 ConflictError */
export async function batchOps(ops: BatchOp[]): Promise<{ ok: boolean; version: number }> {
  const token = getToken();
  const res = await fetch(`${BASE}/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Version': String(currentVersion),
    },
    body: JSON.stringify({ ops }),
  });
  if (res.status === 409) {
    let data: Snapshot = {} as Snapshot;
    let serverVersion = currentVersion;
    let msg = '数据已过期，已为你刷新';
    try {
      const json = await res.json();
      if (json && typeof json.data === 'object' && json.data) data = json.data as Snapshot;
      serverVersion = Number(json?.version ?? currentVersion);
      if (json && typeof json.error === 'string') msg = json.error;
    } catch {
      /* 忽略解析错误 */
    }
    throw new ConflictError(msg, data, serverVersion);
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      if (json && typeof json.error === 'string') msg = json.error;
    } catch {
      /* 忽略解析错误 */
    }
    throw new Error(msg);
  }
  const newVersion = Number(res.headers.get('X-Version') ?? currentVersion);
  return { ok: true, version: newVersion };
}

// ---- 增量 CRUD 请求（带版本号） ---- //

/** 带版本号的写请求，409 时抛 ConflictError */
async function requestWrite<T>(path: string, method: string, body: unknown): Promise<T & { version: number }> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Version': String(currentVersion),
    },
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    let data: Snapshot = {} as Snapshot;
    let serverVersion = currentVersion;
    let msg = '数据已过期，已为你刷新';
    try {
      const json = await res.json();
      if (json && typeof json.data === 'object' && json.data) data = json.data as Snapshot;
      serverVersion = Number(json?.version ?? currentVersion);
      if (json && typeof json.error === 'string') msg = json.error;
    } catch {
      /* 忽略解析错误 */
    }
    throw new ConflictError(msg, data, serverVersion);
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      if (json && typeof json.error === 'string') msg = json.error;
    } catch {
      /* 忽略解析错误 */
    }
    throw new Error(msg);
  }
  const newVersion = Number(res.headers.get('X-Version') ?? currentVersion);
  const json = await res.json();
  return { ...json, version: newVersion } as T & { version: number };
}

/** 增量 CRUD API */
export const entitiesApi = {
  txs: {
    add: (data: Tx) => requestWrite<{ ok: boolean }>('/entities/txs', 'POST', data),
    update: (id: string, patch: Partial<Omit<Tx, 'id'>>) =>
      requestWrite<{ ok: boolean }>(`/entities/txs/${id}`, 'PUT', patch),
    delete: (id: string) => requestWrite<{ ok: boolean }>(`/entities/txs/${id}`, 'DELETE'),
  },
  accounts: {
    add: (data: Account) => requestWrite<{ ok: boolean }>('/entities/accounts', 'POST', data),
    update: (id: string, patch: Partial<Omit<Account, 'id'>>) =>
      requestWrite<{ ok: boolean }>(`/entities/accounts/${id}`, 'PUT', patch),
    delete: (id: string) => requestWrite<{ ok: boolean }>(`/entities/accounts/${id}`, 'DELETE'),
  },
  categories: {
    add: (data: Category) => requestWrite<{ ok: boolean }>('/entities/categories', 'POST', data),
    update: (id: string, patch: Partial<Omit<Category, 'id'>>) =>
      requestWrite<{ ok: boolean }>(`/entities/categories/${id}`, 'PUT', patch),
    delete: (id: string) => requestWrite<{ ok: boolean }>(`/entities/categories/${id}`, 'DELETE'),
  },
  categoryGroups: {
    add: (data: CategoryGroup) => requestWrite<{ ok: boolean }>('/entities/category-groups', 'POST', data),
    update: (id: string, patch: Partial<Omit<CategoryGroup, 'id'>>) =>
      requestWrite<{ ok: boolean }>(`/entities/category-groups/${id}`, 'PUT', patch),
    delete: (id: string) => requestWrite<{ ok: boolean }>(`/entities/category-groups/${id}`, 'DELETE'),
  },
  transfers: {
    add: (data: Transfer) => requestWrite<{ ok: boolean }>('/entities/transfers', 'POST', data),
    delete: (id: string) => requestWrite<{ ok: boolean }>(`/entities/transfers/${id}`, 'DELETE'),
  },
  budgets: {
    add: (data: Budget) => requestWrite<{ ok: boolean }>('/entities/budgets', 'POST', data),
    delete: (id: string) => requestWrite<{ ok: boolean }>(`/entities/budgets/${id}`, 'DELETE'),
  },
  goals: {
    add: (data: Goal) => requestWrite<{ ok: boolean }>('/entities/goals', 'POST', data),
    update: (id: string, patch: Partial<Omit<Goal, 'id'>>) =>
      requestWrite<{ ok: boolean }>(`/entities/goals/${id}`, 'PUT', patch),
    delete: (id: string) => requestWrite<{ ok: boolean }>(`/entities/goals/${id}`, 'DELETE'),
  },
  settings: {
    update: (data: Partial<Settings>) => requestWrite<{ ok: boolean }>('/entities/settings', 'PUT', { ...data }),
  },
} as const;

// ---- 认证 ---- //
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