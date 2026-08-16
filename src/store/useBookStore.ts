import { create } from 'zustand';
import type { Account, Budget, Category, CategoryGroup, Goal, Settings, Transfer, Tx } from '../types';
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, seedTransactions } from '../data/defaults';
import { uid } from '../utils/storage';
import {
  getState, ConflictError,
  entitiesApi, setCurrentVersion,
  batchOps, type BatchOp,
  type Snapshot,
} from '../api';

interface BookState {
  /** 是否已从后端加载完成 */
  hydrated: boolean;
  /** 加载失败信息（后端连不上时展示） */
  loadError: string | null;
  /** 写入后端状态 */
  saveStatus: 'idle' | 'saving' | 'success' | 'error' | 'conflict';
  /** 上次写入失败原因 */
  saveError: string | null;

  accounts: Account[];
  categories: Category[];
  categoryGroups: CategoryGroup[];
  txs: Tx[];
  transfers: Transfer[];
  budgets: Budget[];
  goals: Goal[];
  settings: Settings;

  /** 从后端加载当前账号数据；空库自动种入默认分类/账户 */
  init: () => Promise<void>;
  /** 清空内存数据（退出登录时调用，不触发保存） */
  reset: () => void;

  // ---- 账目 ----
  addTx: (t: Omit<Tx, 'id' | 'createdAt'>) => Promise<void>;
  updateTx: (id: string, patch: Partial<Omit<Tx, 'id'>>) => Promise<void>;
  deleteTx: (id: string) => Promise<void>;

  // ---- 账户 ----
  addAccount: (a: Omit<Account, 'id' | 'createdAt'>) => Promise<void>;
  updateAccount: (id: string, patch: Partial<Omit<Account, 'id'>>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addTransfer: (tr: Omit<Transfer, 'id' | 'createdAt'>) => Promise<void>;
  deleteTransfer: (id: string) => Promise<void>;

  // ---- 分类 ----
  addCategory: (c: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // ---- 分类组（大类）----
  addCategoryGroup: (g: Omit<CategoryGroup, 'id' | 'createdAt'>) => Promise<void>;
  updateCategoryGroup: (id: string, patch: Partial<Omit<CategoryGroup, 'id'>>) => Promise<void>;
  deleteCategoryGroup: (id: string) => Promise<void>;

  // ---- 预算 ----
  setBudget: (b: Omit<Budget, 'id'>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;

  // ---- 存钱目标 ----
  addGoal: (g: Omit<Goal, 'id' | 'createdAt'>) => Promise<void>;
  updateGoal: (id: string, patch: Partial<Omit<Goal, 'id'>>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  // ---- 设置 ----
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  resetAll: () => Promise<void>;
  seedDemo: () => Promise<void>;
  importData: (data: Partial<Snapshot>) => Promise<void>;
}

const defaultSettings: Settings = { firstName: '岛主' };

export const useBookStore = create<BookState>()((set) => ({
  hydrated: false,
  loadError: null,
  saveStatus: 'idle',
  saveError: null,
  accounts: [],
  categories: [],
  categoryGroups: [],
  txs: [],
  transfers: [],
  budgets: [],
  goals: [],
  settings: defaultSettings,

  init: async () => {
    try {
      const { data: snap, version } = await getState();
      setCurrentVersion(version);
      const isNewAccount = version === 0 && snap.accounts?.length === 0;
      if (isNewAccount) {
        const ops: BatchOp[] = [
          ...DEFAULT_ACCOUNTS.map((a) => ({ action: 'add_account' as const, data: a })),
          ...DEFAULT_CATEGORIES.map((c) => ({ action: 'add_category' as const, data: c })),
        ];
        const res = await batchOps(ops);
        setCurrentVersion(res.version);
        const seeded: Snapshot = {
          accounts: DEFAULT_ACCOUNTS,
          categories: DEFAULT_CATEGORIES,
          categoryGroups: [],
          txs: [],
          transfers: [],
          budgets: [],
          goals: [],
          settings: defaultSettings,
        };
        set({ ...seeded, hydrated: true, loadError: null });
      } else {
        set({
          ...snap,
          categoryGroups: snap.categoryGroups ?? [],
          hydrated: true,
          loadError: null,
        });
      }
    } catch (e) {
      set({ hydrated: false, loadError: e instanceof Error ? e.message : String(e) });
    }
  },

  reset: () => {
    setCurrentVersion(0);
    set({
      hydrated: false,
      loadError: null,
      saveStatus: 'idle',
      saveError: null,
      accounts: [],
      categories: [],
      categoryGroups: [],
      txs: [],
      transfers: [],
      budgets: [],
      goals: [],
      settings: { ...defaultSettings },
    });
  },

  // ---- 账目 ----
  addTx: async (t) => {
    set({ saveStatus: 'saving', saveError: null });
    const id = uid();
    const createdAt = Date.now();
    const tx = { ...t, id, createdAt };
    try {
      const res = await entitiesApi.txs.add(tx);
      setCurrentVersion(res.version);
      set((s) => ({ txs: [...s.txs, tx], saveStatus: 'success' }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  updateTx: async (id, patch) => {
    set({ saveStatus: 'saving', saveError: null });
    try {
      const res = await entitiesApi.txs.update(id, { ...patch, updatedAt: Date.now() });
      setCurrentVersion(res.version);
      set((s) => ({
        txs: s.txs.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)),
        saveStatus: 'success',
      }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  deleteTx: async (id) => {
    set({ saveStatus: 'saving', saveError: null });
    try {
      const res = await entitiesApi.txs.delete(id);
      setCurrentVersion(res.version);
      set((s) => ({ txs: s.txs.filter((t) => t.id !== id), saveStatus: 'success' }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  // ---- 账户 ----
  addAccount: async (a) => {
    set({ saveStatus: 'saving', saveError: null });
    const id = uid();
    const createdAt = Date.now();
    const account = { ...a, id, createdAt };
    try {
      const res = await entitiesApi.accounts.add(account);
      setCurrentVersion(res.version);
      set((s) => ({ accounts: [...s.accounts, account], saveStatus: 'success' }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  updateAccount: async (id, patch) => {
    set({ saveStatus: 'saving', saveError: null });
    try {
      const res = await entitiesApi.accounts.update(id, patch);
      setCurrentVersion(res.version);
      set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)), saveStatus: 'success' }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  deleteAccount: async (id) => {
    set({ saveStatus: 'saving', saveError: null });
    try {
      const res = await entitiesApi.accounts.delete(id);
      setCurrentVersion(res.version);
      set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id), saveStatus: 'success' }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  addTransfer: async (tr) => {
    set({ saveStatus: 'saving', saveError: null });
    const id = uid();
    const createdAt = Date.now();
    const transfer = { ...tr, id, createdAt };
    try {
      const res = await entitiesApi.transfers.add(transfer);
      setCurrentVersion(res.version);
      set((s) => ({ transfers: [...s.transfers, transfer], saveStatus: 'success' }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  deleteTransfer: async (id) => {
    set({ saveStatus: 'saving', saveError: null });
    try {
      const res = await entitiesApi.transfers.delete(id);
      setCurrentVersion(res.version);
      set((s) => ({ transfers: s.transfers.filter((t) => t.id !== id), saveStatus: 'success' }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  // ---- 分类 ----
  addCategory: async (c) => {
    set({ saveStatus: 'saving', saveError: null });
    const id = uid();
    const category = { ...c, id };
    try {
      const res = await entitiesApi.categories.add(category);
      setCurrentVersion(res.version);
      set((s) => ({ categories: [...s.categories, category], saveStatus: 'success' }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  updateCategory: async (id, patch) => {
    set({ saveStatus: 'saving', saveError: null });
    try {
      const res = await entitiesApi.categories.update(id, patch);
      setCurrentVersion(res.version);
      set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)), saveStatus: 'success' }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  deleteCategory: async (id) => {
    set({ saveStatus: 'saving', saveError: null });
    try {
      const res = await entitiesApi.categories.delete(id);
      setCurrentVersion(res.version);
      set((s) => ({
        categories: s.categories.filter((c) => c.id !== id),
        budgets: s.budgets.filter((b) => b.categoryId !== id),
        saveStatus: 'success',
      }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  // ---- 分类组（大类）----
  addCategoryGroup: async (g) => {
    set({ saveStatus: 'saving', saveError: null });
    const id = uid();
    const createdAt = Date.now();
    const group = { ...g, id, createdAt };
    try {
      const res = await entitiesApi.categoryGroups.add(group);
      setCurrentVersion(res.version);
      set((s) => ({ categoryGroups: [...s.categoryGroups, group], saveStatus: 'success' }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  updateCategoryGroup: async (id, patch) => {
    set({ saveStatus: 'saving', saveError: null });
    try {
      const res = await entitiesApi.categoryGroups.update(id, patch);
      setCurrentVersion(res.version);
      set((s) => ({
        categoryGroups: s.categoryGroups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        saveStatus: 'success',
      }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  deleteCategoryGroup: async (id) => {
    set({ saveStatus: 'saving', saveError: null });
    try {
      const res = await entitiesApi.categoryGroups.delete(id);
      setCurrentVersion(res.version);
      set((s) => ({
        categoryGroups: s.categoryGroups.filter((g) => g.id !== id),
        categories: s.categories.map((c) => (c.groupId === id ? { ...c, groupId: undefined } : c)),
        saveStatus: 'success',
      }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  // ---- 预算（同月同分类 = 更新）----
  setBudget: async (b) => {
    set({ saveStatus: 'saving', saveError: null });
    const id = uid();
    try {
      const res = await entitiesApi.budgets.add({ ...b, id });
      setCurrentVersion(res.version);
      // 后端已处理 upsert，前端用返回的成功标志更新
      set((s) => {
        const exists = s.budgets.find((x) => x.categoryId === b.categoryId && x.month === b.month);
        if (exists) {
          return { budgets: s.budgets.map((x) => (x.id === exists.id ? { ...x, amount: b.amount } : x)), saveStatus: 'success' };
        }
        return { budgets: [...s.budgets, { ...b, id }], saveStatus: 'success' };
      });
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  deleteBudget: async (id) => {
    set({ saveStatus: 'saving', saveError: null });
    try {
      const res = await entitiesApi.budgets.delete(id);
      setCurrentVersion(res.version);
      set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id), saveStatus: 'success' }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  // ---- 存钱目标 ----
  addGoal: async (g) => {
    set({ saveStatus: 'saving', saveError: null });
    const id = uid();
    const createdAt = Date.now();
    const goal = { ...g, id, createdAt };
    try {
      const res = await entitiesApi.goals.add(goal);
      setCurrentVersion(res.version);
      set((s) => ({ goals: [...s.goals, goal], saveStatus: 'success' }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  updateGoal: async (id, patch) => {
    set({ saveStatus: 'saving', saveError: null });
    try {
      const res = await entitiesApi.goals.update(id, patch);
      setCurrentVersion(res.version);
      set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)), saveStatus: 'success' }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  deleteGoal: async (id) => {
    set({ saveStatus: 'saving', saveError: null });
    try {
      const res = await entitiesApi.goals.delete(id);
      setCurrentVersion(res.version);
      set((s) => ({ goals: s.goals.filter((g) => g.id !== id), saveStatus: 'success' }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  // ---- 设置 ----
  updateSettings: async (patch) => {
    set({ saveStatus: 'saving', saveError: null });
    try {
      const res = await entitiesApi.settings.update(patch);
      setCurrentVersion(res.version);
      set((s) => ({ settings: { ...s.settings, ...patch }, saveStatus: 'success' }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  // ---- 批量操作（通过 batch API 同步到服务器）----
  resetAll: async () => {
    set({ saveStatus: 'saving', saveError: null });
    try {
      const ops: BatchOp[] = [
        { action: 'clear' },
        ...DEFAULT_ACCOUNTS.map((a) => ({ action: 'add_account' as const, data: a })),
        ...DEFAULT_CATEGORIES.map((c) => ({ action: 'add_category' as const, data: c })),
      ];
      const res = await batchOps(ops);
      setCurrentVersion(res.version);
      set({
        accounts: DEFAULT_ACCOUNTS,
        categories: DEFAULT_CATEGORIES,
        categoryGroups: [],
        txs: [],
        transfers: [],
        budgets: [],
        goals: [],
        settings: { ...defaultSettings },
        saveStatus: 'success',
      });
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  seedDemo: async () => {
    const st = useBookStore.getState();
    if (st.txs.length > 0) return;
    set({ saveStatus: 'saving', saveError: null });
    try {
      const seeds = seedTransactions();
      const ops: BatchOp[] = seeds.map((t) => ({ action: 'add_tx' as const, data: t }));
      const res = await batchOps(ops);
      setCurrentVersion(res.version);
      set({ txs: seeds, saveStatus: 'success' });
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  importData: async (data) => {
    set({ saveStatus: 'saving', saveError: null });
    try {
      const ops: BatchOp[] = [{ action: 'clear' }];
      for (const a of data.accounts ?? []) ops.push({ action: 'add_account', data: a });
      for (const c of data.categories ?? []) ops.push({ action: 'add_category', data: c });
      for (const g of data.categoryGroups ?? []) ops.push({ action: 'add_category_group', data: g });
      for (const t of data.txs ?? []) ops.push({ action: 'add_tx', data: t });
      for (const tr of data.transfers ?? []) ops.push({ action: 'add_transfer', data: tr });
      for (const b of data.budgets ?? []) ops.push({ action: 'add_budget', data: b });
      for (const g of data.goals ?? []) ops.push({ action: 'add_goal', data: g });
      if (data.settings) ops.push({ action: 'update_settings', data: data.settings });
      const res = await batchOps(ops);
      setCurrentVersion(res.version);
      set((s) => ({
        accounts: data.accounts ?? s.accounts,
        categories: data.categories ?? s.categories,
        categoryGroups: data.categoryGroups ?? s.categoryGroups,
        txs: data.txs ?? s.txs,
        transfers: data.transfers ?? s.transfers,
        budgets: data.budgets ?? s.budgets,
        goals: data.goals ?? s.goals,
        settings: data.settings ?? s.settings,
        saveStatus: 'success',
      }));
    } catch (e) {
      if (e instanceof ConflictError) {
        setCurrentVersion(e.latest.version);
        set({ ...e.latest.data, saveStatus: 'conflict', saveError: e.message });
      } else {
        set({ saveStatus: 'error', saveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },
}));