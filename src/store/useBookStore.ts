import { create } from 'zustand';
import type { Account, Budget, Category, Goal, Settings, Transfer, Tx } from '../types';
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, seedTransactions } from '../data/defaults';
import { uid } from '../utils/storage';
import { getState, putState, type Snapshot } from '../api';

interface BookState {
  /** 是否已从后端加载完成 */
  hydrated: boolean;
  /** 加载失败信息（后端连不上时展示） */
  loadError: string | null;

  accounts: Account[];
  categories: Category[];
  txs: Tx[];
  transfers: Transfer[];
  budgets: Budget[];
  goals: Goal[];
  settings: Settings;

  /** 从后端加载当前账号数据；空库自动种入默认分类/账户 */
  init: () => Promise<void>;
  /** 清空内存数据（退出登录时调用，不触发保存） */
  reset: () => void;

  // 账目
  addTx: (t: Omit<Tx, 'id' | 'createdAt'>) => void;
  updateTx: (id: string, patch: Partial<Omit<Tx, 'id'>>) => void;
  deleteTx: (id: string) => void;

  // 账户
  addAccount: (a: Omit<Account, 'id' | 'createdAt'>) => void;
  updateAccount: (id: string, patch: Partial<Omit<Account, 'id'>>) => void;
  deleteAccount: (id: string) => void;
  addTransfer: (tr: Omit<Transfer, 'id' | 'createdAt'>) => void;
  deleteTransfer: (id: string) => void;

  // 分类
  addCategory: (c: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => void;
  deleteCategory: (id: string) => void;

  // 预算
  setBudget: (b: Omit<Budget, 'id'>) => void;
  deleteBudget: (id: string) => void;

  // 存钱目标
  addGoal: (g: Omit<Goal, 'id' | 'createdAt'>) => void;
  updateGoal: (id: string, patch: Partial<Omit<Goal, 'id'>>) => void;
  deleteGoal: (id: string) => void;

  // 设置
  updateSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;
  seedDemo: () => void;
  importData: (data: Partial<Snapshot>) => void;
}

const defaultSettings: Settings = { bellMode: false, bellRate: 10, firstName: '岛主' };

export const useBookStore = create<BookState>()((set) => ({
  hydrated: false,
  loadError: null,
  accounts: [],
  categories: [],
  txs: [],
  transfers: [],
  budgets: [],
  goals: [],
  settings: defaultSettings,

  init: async () => {
    try {
      const snap = await getState();
      if (!snap.accounts || snap.accounts.length === 0) {
        // 新账号首次使用：只种默认分类/账户，流水从空开始
        const seeded: Snapshot = {
          accounts: DEFAULT_ACCOUNTS,
          categories: DEFAULT_CATEGORIES,
          txs: [],
          transfers: [],
          budgets: [],
          goals: [],
          settings: defaultSettings,
        };
        await putState(seeded);
        set({ ...seeded, hydrated: true, loadError: null });
      } else {
        set({ ...snap, hydrated: true, loadError: null });
      }
    } catch (e) {
      set({ hydrated: false, loadError: e instanceof Error ? e.message : String(e) });
    }
  },

  reset: () =>
    set({
      hydrated: false,
      loadError: null,
      accounts: [],
      categories: [],
      txs: [],
      transfers: [],
      budgets: [],
      goals: [],
      settings: { ...defaultSettings },
    }),

  // 账目
  addTx: (t) => set((s) => ({ txs: [...s.txs, { ...t, id: uid(), createdAt: Date.now() }] })),
  updateTx: (id, patch) =>
    set((s) => ({
      txs: s.txs.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)),
    })),
  deleteTx: (id) => set((s) => ({ txs: s.txs.filter((t) => t.id !== id) })),

  // 账户
  addAccount: (a) =>
    set((s) => ({ accounts: [...s.accounts, { ...a, id: uid(), createdAt: Date.now() }] })),
  updateAccount: (id, patch) =>
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
  deleteAccount: (id) => set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) })),
  addTransfer: (tr) =>
    set((s) => ({ transfers: [...s.transfers, { ...tr, id: uid(), createdAt: Date.now() }] })),
  deleteTransfer: (id) =>
    set((s) => ({ transfers: s.transfers.filter((t) => t.id !== id) })),

  // 分类
  addCategory: (c) => set((s) => ({ categories: [...s.categories, { ...c, id: uid() }] })),
  updateCategory: (id, patch) =>
    set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  deleteCategory: (id) =>
    set((s) => ({
      categories: s.categories.filter((c) => c.id !== id),
      budgets: s.budgets.filter((b) => b.categoryId !== id),
    })),

  // 预算（同月同类目重复设置 = 更新）
  setBudget: (b) =>
    set((s) => {
      const exists = s.budgets.find((x) => x.categoryId === b.categoryId && x.month === b.month);
      if (exists) {
        return {
          budgets: s.budgets.map((x) => (x.id === exists.id ? { ...x, amount: b.amount } : x)),
        };
      }
      return { budgets: [...s.budgets, { ...b, id: uid() }] };
    }),
  deleteBudget: (id) => set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) })),

  // 存钱目标
  addGoal: (g) =>
    set((s) => ({ goals: [...s.goals, { ...g, id: uid(), createdAt: Date.now() }] })),
  updateGoal: (id, patch) =>
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
  deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

  // 设置
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  resetAll: () =>
    set({
      accounts: DEFAULT_ACCOUNTS,
      categories: DEFAULT_CATEGORIES,
      txs: [],
      transfers: [],
      budgets: [],
      goals: [],
      settings: { ...defaultSettings },
    }),
  seedDemo: () => set((s) => (s.txs.length > 0 ? s : { txs: seedTransactions() })),
  importData: (data) =>
    set((s) => ({
      accounts: data.accounts ?? s.accounts,
      categories: data.categories ?? s.categories,
      txs: data.txs ?? s.txs,
      transfers: data.transfers ?? s.transfers,
      budgets: data.budgets ?? s.budgets,
      goals: data.goals ?? s.goals,
      settings: data.settings ?? s.settings,
    })),
}));

// 自动保存：数据一变 → 防抖 200ms → 把最新全量提交到后端
let saveTimer: ReturnType<typeof setTimeout> | undefined;

useBookStore.subscribe((state) => {
  if (!state.hydrated) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const s = useBookStore.getState();
    if (!s.hydrated) return;
    putState({
      accounts: s.accounts,
      categories: s.categories,
      txs: s.txs,
      transfers: s.transfers,
      budgets: s.budgets,
      goals: s.goals,
      settings: s.settings,
    }).catch((e) => console.error('保存到后端失败：', e));
  }, 200);
});
