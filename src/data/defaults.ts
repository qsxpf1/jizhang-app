import type { Account, Category, Tx } from '../types';
import { dateStr } from '../utils/calc';
import { uid } from '../utils/storage';

/** 默认分类（支出 8 + 收入 4） */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'exp-food', name: '餐饮', type: 'expense', icon: '🍔', color: '#e59266', isDefault: true, sort: 0 },
  { id: 'exp-transport', name: '交通', type: 'expense', icon: '🚌', color: '#889df0', isDefault: true, sort: 1 },
  { id: 'exp-shopping', name: '购物', type: 'expense', icon: '🛍️', color: '#f8a6b2', isDefault: true, sort: 2 },
  { id: 'exp-home', name: '居住', type: 'expense', icon: '🏠', color: '#b77dee', isDefault: true, sort: 3 },
  { id: 'exp-fun', name: '娱乐', type: 'expense', icon: '🎮', color: '#82d5bb', isDefault: true, sort: 4 },
  { id: 'exp-med', name: '医疗', type: 'expense', icon: '💊', color: '#e05a5a', isDefault: true, sort: 5 },
  { id: 'exp-travel', name: '旅行', type: 'expense', icon: '✈️', color: '#f7cd67', isDefault: true, sort: 6 },
  { id: 'exp-other', name: '其他', type: 'expense', icon: '📦', color: '#9a835a', isDefault: true, sort: 7 },
  { id: 'inc-salary', name: '工资', type: 'income', icon: '💼', color: '#6fba2c', isDefault: true, sort: 0 },
  { id: 'inc-invest', name: '理财', type: 'income', icon: '📈', color: '#19c8b9', isDefault: true, sort: 1 },
  { id: 'inc-redpacket', name: '红包', type: 'income', icon: '🧧', color: '#fc736d', isDefault: true, sort: 2 },
  { id: 'inc-other', name: '其他', type: 'income', icon: '💰', color: '#d1da49', isDefault: true, sort: 3 },
];

/** 默认账户 */
export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc-cash', name: '现金', type: 'cash', icon: '💵', color: 'app-green', initialBalance: 1000, createdAt: Date.now() },
  { id: 'acc-bank', name: '银行卡', type: 'bank', icon: '🏦', color: 'app-blue', initialBalance: 5000, createdAt: Date.now() },
  { id: 'acc-alipay', name: '支付宝', type: 'alipay', icon: '📱', color: 'app-teal', initialBalance: 3000, createdAt: Date.now() },
  { id: 'acc-wechat', name: '微信', type: 'wechat', icon: '💬', color: 'app-yellow', initialBalance: 2000, createdAt: Date.now() },
  { id: 'acc-bell', name: '铃钱袋', type: 'other', icon: '🪙', color: 'app-orange', initialBalance: 500, createdAt: Date.now() },
];

/**
 * 生成近 3 个月的示例账目，让首页/图表首次打开就有数据。
 * 仅首次启动（无持久化数据）时调用一次。
 */
export function seedTransactions(): Tx[] {
  const now = new Date();
  const out: Tx[] = [];
  const push = (
    monthsAgo: number,
    day: number,
    type: Tx['type'],
    amount: number,
    categoryId: string,
    accountId: string,
    note = '',
    extra: Partial<Pick<Tx, 'time' | 'location' | 'payMethod'>> = {},
  ) => {
    // 本月日期不能超过今天，避免出现"未来账目"
    const clamped = monthsAgo === 0 ? Math.min(day, now.getDate()) : day;
    const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, clamped);
    out.push({
      id: uid(),
      type,
      amount,
      categoryId,
      accountId,
      date: dateStr(d),
      note,
      ...extra,
      createdAt: d.getTime(),
    });
  };

  // 本月
  push(0, 1, 'income', 8500, 'inc-salary', 'acc-bank', '本月工资', { time: '09:00', location: '公司', payMethod: 'bank' });
  push(0, 2, 'expense', 320, 'exp-food', 'acc-alipay', '朋友聚餐', { time: '19:30', location: '海底捞·市中心店', payMethod: 'alipay' });
  push(0, 4, 'expense', 58, 'exp-transport', 'acc-wechat', '地铁充值', { time: '08:15', location: '地铁站', payMethod: 'wechat' });
  push(0, 6, 'expense', 1299, 'exp-shopping', 'acc-bank', '新外套', { time: '14:20', location: '天河城', payMethod: 'credit' });
  // 上月
  push(1, 1, 'income', 8500, 'inc-salary', 'acc-bank', '上月工资', { time: '09:00', location: '公司', payMethod: 'bank' });
  push(1, 3, 'expense', 2600, 'exp-home', 'acc-bank', '房租', { time: '10:00', payMethod: 'bank' });
  push(1, 5, 'expense', 88, 'exp-fun', 'acc-alipay', '买了个游戏', { time: '20:05', payMethod: 'alipay' });
  push(1, 10, 'expense', 200, 'exp-transport', 'acc-cash', '打车', { time: '22:40', location: '机场快线' });
  // 上上月
  push(2, 2, 'expense', 2450, 'exp-home', 'acc-bank', '房租', { time: '10:00', payMethod: 'bank' });
  push(2, 8, 'income', 500, 'inc-redpacket', 'acc-wechat', '朋友红包', { time: '12:00', payMethod: 'wechat' });
  push(2, 15, 'expense', 399, 'exp-shopping', 'acc-alipay', '新耳机', { time: '16:40', location: '京东自营', payMethod: 'credit' });

  return out;
}
