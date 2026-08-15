/** 成就上下文：由页面从 store 计算后传入 */
export interface AchCtx {
  txCount: number;
  streak: number;
  totalIncome: number;
  /** 使用过的不同分类数 */
  catUsed: number;
  /** 已设置的预算条数 */
  budgetCount: number;
  /** 本月是否设了总预算 */
  currentBudgetSet: boolean;
  /** 本月是否超支 */
  overBudget: boolean;
  goalDone: number;
}

export interface AchievementDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  /** 计算解锁态与进度 */
  check: (ctx: AchCtx) => { unlocked: boolean; progress: number; detail: string };
}

const countCheck = (current: number, target: number, unit = '笔') => ({
  unlocked: current >= target,
  progress: Math.min(1, current / target),
  detail: `${Math.min(current, target)}/${target}${unit}`,
});

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-tx',
    icon: '📝',
    name: '第一笔账',
    desc: '记下第一笔收支',
    check: (c) => countCheck(c.txCount, 1),
  },
  {
    id: 'tx-10',
    icon: '✏️',
    name: '记账新人',
    desc: '累计记账 10 笔',
    check: (c) => countCheck(c.txCount, 10),
  },
  {
    id: 'tx-100',
    icon: '📚',
    name: '记账达人',
    desc: '累计记账 100 笔',
    check: (c) => countCheck(c.txCount, 100),
  },
  {
    id: 'tx-500',
    icon: '🏛️',
    name: '记账狂人',
    desc: '累计记账 500 笔',
    check: (c) => countCheck(c.txCount, 500),
  },
  {
    id: 'streak-3',
    icon: '🌱',
    name: '连续 3 天',
    desc: '连续记账 3 天',
    check: (c) => ({ unlocked: c.streak >= 3, progress: Math.min(1, c.streak / 3), detail: `${c.streak}/3 天` }),
  },
  {
    id: 'streak-7',
    icon: '🌿',
    name: '坚持一周',
    desc: '连续记账 7 天',
    check: (c) => ({ unlocked: c.streak >= 7, progress: Math.min(1, c.streak / 7), detail: `${c.streak}/7 天` }),
  },
  {
    id: 'streak-30',
    icon: '🌳',
    name: '满月记录',
    desc: '连续记账 30 天',
    check: (c) => ({ unlocked: c.streak >= 30, progress: Math.min(1, c.streak / 30), detail: `${c.streak}/30 天` }),
  },
  {
    id: 'cat-8',
    icon: '🎨',
    name: '分类达人',
    desc: '用过 8 个不同分类',
    check: (c) => countCheck(c.catUsed, 8, '类'),
  },
  {
    id: 'budget-set',
    icon: '🧮',
    name: '未雨绸缪',
    desc: '设置任意预算',
    check: (c) => ({ unlocked: c.budgetCount >= 1, progress: c.budgetCount >= 1 ? 1 : 0, detail: c.budgetCount >= 1 ? '已设置' : '未设置' }),
  },
  {
    id: 'budget-ok',
    icon: '🛡️',
    name: '预算守卫',
    desc: '本月支出控制在总预算内',
    check: (c) => ({
      unlocked: c.currentBudgetSet && !c.overBudget,
      progress: c.currentBudgetSet ? (c.overBudget ? 0 : 1) : 0,
      detail: !c.currentBudgetSet ? '未设预算' : c.overBudget ? '已超支' : '未超支',
    }),
  },
  {
    id: 'goal-done',
    icon: '⛳',
    name: '心愿达成',
    desc: '完成 1 个存钱目标',
    check: (c) => countCheck(c.goalDone, 1, '个'),
  },
  {
    id: 'goal-3',
    icon: '🏆',
    name: '梦想家',
    desc: '完成 3 个存钱目标',
    check: (c) => countCheck(c.goalDone, 3, '个'),
  },
  {
    id: 'income-1w',
    icon: '💰',
    name: '第一桶金',
    desc: '累计收入达到 1 万元',
    check: (c) => ({
      unlocked: c.totalIncome >= 10000,
      progress: Math.min(1, c.totalIncome / 10000),
      detail: `${Math.round(Math.min(c.totalIncome, 10000) / 10000 * 100)}%`,
    }),
  },
  ];
