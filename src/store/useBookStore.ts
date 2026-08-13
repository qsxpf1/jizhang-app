import { create } from 'zustand';
import type { Account, Budget, Category, CategoryGroup, Goal, Settings, Transfer, Tx } from '../types';
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, seedTransactions } from '../data/defaults';
import { uid } from '../utils/storage';
import { getState, putState, ConflictError, type Snapshot } from '../api';

interface BookState {
  /** 是否已从后端加载完成 */
  hydrated: boolean;
  /** 加载失败信息（后端连不上时展示） */
  loadError: string | null;
  /** 写入后端状态：idle=无 / saving=写入中 / success=成功 / error=失败 / conflict=版本冲突已刷新 */
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

  // 分类组（大类）
  addCategoryGroup: (g: Omit<CategoryGroup, 'id' | 'createdAt'>) => void;
  updateCategoryGroup: (id: string, patch: Partial<Omit<CategoryGroup, 'id'>>) => void;
  deleteCategoryGroup: (id: string) => void;

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
      currentVersion = version;
      // 仅当确属「全新账号」（服务端版本为 0 且账户列表确实为空）才种默认数据。
      // 用可选链 + 版本双重判断：即使接口返回形状异常，也绝不把已有账号当空账号清空。
      const isNewAccount = version === 0 && snap.accounts?.length === 0;
      if (isNewAccount) {
        // 新账号首次使用：只种默认分类/账户，流水从空开始
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
        const res = await putState(seeded, currentVersion);
        currentVersion = res.version;
        lastSavedJson = JSON.stringify(seeded);
        set({ ...seeded, hydrated: true, loadError: null });
      } else {
        lastSavedJson = JSON.stringify(snap);
        set({
          ...snap,
          // 兼容旧后端返回的数据：分类组字段缺失时兜底为空数组
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
    lastSavedJson = null;
    currentVersion = 0;
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

  // 分类组（大类）
  addCategoryGroup: (g) =>
    set((s) => ({ categoryGroups: [...s.categoryGroups, { ...g, id: uid(), createdAt: Date.now() }] })),
  updateCategoryGroup: (id, patch) =>
    set((s) => ({
      categoryGroups: s.categoryGroups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    })),
  deleteCategoryGroup: (id) =>
    set((s) => ({
      categoryGroups: s.categoryGroups.filter((g) => g.id !== id),
      // 删除大类时，其下小类自动脱离分组
      categories: s.categories.map((c) => (c.groupId === id ? { ...c, groupId: undefined } : c)),
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
      categoryGroups: [],
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
      categoryGroups: data.categoryGroups ?? s.categoryGroups,
      txs: data.txs ?? s.txs,
      transfers: data.transfers ?? s.transfers,
      budgets: data.budgets ?? s.budgets,
      goals: data.goals ?? s.goals,
      settings: data.settings ?? s.settings,
    })),
}));

// 自动保存：业务数据一变 → 防抖 200ms → 把最新全量提交到后端，并反馈保存结果
/** 上次成功写入服务器时的快照 JSON（用于跳过「登录后回显」等无需重复写入的场景） */
let lastSavedJson: string | null = null;
/** 当前账号在服务器端的数据版本（乐观并发控制） */
let currentVersion = 0;

/** 取当前业务数据快照（不含 hydrated / saveStatus 等 UI 状态） */
function buildPayload(s: {
  accounts: Account[];
  categories: Category[];
  categoryGroups: CategoryGroup[];
  txs: Tx[];
  transfers: Transfer[];
  budgets: Budget[];
  goals: Goal[];
  settings: Settings;
}): Snapshot {
  return {
    accounts: s.accounts,
    categories: s.categories,
    categoryGroups: s.categoryGroups,
    txs: s.txs,
    transfers: s.transfers,
    budgets: s.budgets,
    goals: s.goals,
    settings: s.settings,
  };
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

useBookStore.subscribe((state, prevState) => {
  if (!state.hydrated) return;
  // 仅当业务数据真的变化才触发保存；saveStatus/saveError 等状态变化不触发，避免循环
  const dataChanged =
    state.accounts !== prevState.accounts ||
    state.categories !== prevState.categories ||
    state.categoryGroups !== prevState.categoryGroups ||
    state.txs !== prevState.txs ||
    state.transfers !== prevState.transfers ||
    state.budgets !== prevState.budgets ||
    state.goals !== prevState.goals ||
    state.settings !== prevState.settings;
  if (!dataChanged) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 200);
});

async function saveNow() {
  const s = useBookStore.getState();
  if (!s.hydrated) return;
  const payload = buildPayload(s);
  const json = JSON.stringify(payload);
  if (json === lastSavedJson) return; // 与服务器已一致，无需重复写入
  useBookStore.setState({ saveStatus: 'saving', saveError: null });
  try {
    const res = await putState(payload, currentVersion);
    currentVersion = res.version;
    lastSavedJson = json;
    useBookStore.setState({ saveStatus: 'success' });
  } catch (e) {
    if (e instanceof ConflictError) {
      // 本设备快照已过期：不覆盖另一台设备的写入，改为刷新为服务器最新数据
      currentVersion = e.latest.version;
      const latest = e.latest.data;
      lastSavedJson = JSON.stringify(latest);
      useBookStore.setState({
        ...latest,
        saveStatus: 'conflict',
        saveError: e.message || '检测到另一台设备已修改数据，已为你刷新',
      });
    } else {
      console.error('保存到后端失败：', e);
      useBookStore.setState({
        saveStatus: 'error',
        saveError: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
