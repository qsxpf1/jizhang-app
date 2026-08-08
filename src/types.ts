/** 收支类型 */
export type TxType = 'income' | 'expense';

/** 账户类型 */
export type AccountType = 'cash' | 'bank' | 'alipay' | 'wechat' | 'other';

/** 与 animal-island-ui 一致的卡片色板（唯一合法的 CardColor） */
export type CardColor =
  | 'default'
  | 'app-pink'
  | 'purple'
  | 'app-blue'
  | 'app-yellow'
  | 'app-orange'
  | 'app-teal'
  | 'app-green'
  | 'app-red'
  | 'lime-green'
  | 'yellow-green'
  | 'brown'
  | 'warm-peach-pink';

/** 账户 */
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** emoji 图标 */
  icon: string;
  /** 卡片颜色（必须为 CardColor 之一） */
  color: CardColor;
  /** 初始余额（元） */
  initialBalance: number;
  hidden?: boolean;
  createdAt: number;
}

/** 分类 */
export interface Category {
  id: string;
  name: string;
  type: TxType;
  /** emoji 图标 */
  icon: string;
  /** 图表颜色（hex） */
  color: string;
  isDefault?: boolean;
  sort: number;
}

/** 支付方式（付款渠道，区别于账户=钱包余额） */
export type PaymentMethod = 'cash' | 'bank' | 'alipay' | 'wechat' | 'credit' | 'other';

/** 一笔账 */
export interface Tx {
  id: string;
  type: TxType;
  /** 金额（元，正数） */
  amount: number;
  categoryId: string;
  accountId: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm，可选 */
  time?: string;
  /** 地点，可选 */
  location?: string;
  /** 支付方式，可选 */
  payMethod?: PaymentMethod;
  note?: string;
  createdAt: number;
  updatedAt?: number;
}

/** 账户间转账（只变余额，不产生收支） */
export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  note?: string;
  createdAt: number;
}

/** 月度预算；categoryId 为 null 表示总预算 */
export interface Budget {
  id: string;
  categoryId: string | null;
  /** YYYY-MM */
  month: string;
  amount: number;
}

/** 存钱目标（动森特色） */
export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  /** 已存金额（手动维护 + 可选自动） */
  savedAmount: number;
  /** YYYY-MM-DD */
  deadline?: string;
  /** hex 颜色 */
  color: string;
  completed?: boolean;
  createdAt: number;
}

/** 全局设置 */
export interface Settings {
  /** 铃钱模式 */
  bellMode: boolean;
  /** 1 元 = N 铃 */
  bellRate: number;
  /** 岛主名字 */
  firstName: string;
  /** 最近一次数据导入时间 */
  lastImport?: number;
}
