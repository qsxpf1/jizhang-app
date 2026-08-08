import type { Account, Tx, Transfer, TxType } from '../types';
import { round2 } from './money';

/** Date → 'YYYY-MM-DD' */
export function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Date → 'YYYY-MM' */
export function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** 当前 YYYY-MM */
export function currentMonth(): string {
  return monthKey(new Date());
}

/**
 * 计算账户当前余额 = 初始余额 + 该账户收入 - 支出 + 转入 - 转出。
 * 由交易数据推导，避免余额漂移。
 */
export function getAccountBalance(
  accountId: string,
  accounts: Account[],
  txs: Tx[],
  transfers: Transfer[],
): number {
  const acc = accounts.find((a) => a.id === accountId);
  let bal = acc?.initialBalance ?? 0;
  for (const t of txs) {
    if (t.accountId !== accountId) continue;
    bal += t.type === 'income' ? t.amount : -t.amount;
  }
  for (const tr of transfers) {
    if (tr.fromAccountId === accountId) bal -= tr.amount;
    if (tr.toAccountId === accountId) bal += tr.amount;
  }
  return round2(bal);
}

export interface MonthSummary {
  income: number;
  expense: number;
  balance: number;
}

/** 某月（YYYY-MM）收支汇总 */
export function monthSummary(txs: Tx[], ym: string): MonthSummary {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (!t.date.startsWith(ym)) continue;
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income: round2(income), expense: round2(expense), balance: round2(income - expense) };
}

/** 某月某类型的分类小计 Map<categoryId, amount> */
export function categoryTotals(txs: Tx[], ym: string, type: TxType): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== type || !t.date.startsWith(ym)) continue;
    m.set(t.categoryId, round2((m.get(t.categoryId) ?? 0) + t.amount));
  }
  return m;
}

/** 某月每日小计（含无数据的天，值为 0），用于折线图 */
export function dailyTotals(txs: Tx[], ym: string, type: TxType): { day: string; value: number }[] {
  const [y, mo] = ym.split('-').map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const arr: { day: string; value: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${ym}-${String(d).padStart(2, '0')}`;
    let v = 0;
    for (const t of txs) if (t.date === key && t.type === type) v += t.amount;
    arr.push({ day: String(d), value: round2(v) });
  }
  return arr;
}

/** 某年每月小计，用于柱状图 */
export function monthlyTotals(
  txs: Tx[],
  year: number,
  type: TxType,
): { month: string; value: number }[] {
  const arr: { month: string; value: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`;
    let v = 0;
    for (const t of txs) if (t.date.startsWith(ym) && t.type === type) v += t.amount;
    arr.push({ month: `${m}月`, value: round2(v) });
  }
  return arr;
}

/** 当前连续记账天数（今天没记则从昨天开始数） */
export function currentStreak(txs: Tx[]): number {
  const days = new Set(txs.map((t) => t.date));
  const d = new Date();
  if (!days.has(dateStr(d))) d.setDate(d.getDate() - 1);
  let count = 0;
  while (days.has(dateStr(d))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

/** 按日期（倒序）+ 时间（HH:mm 可字典序）+ 创建时间排序 */
export function sortTx(a: Tx, b: Tx): number {
  return (
    b.date.localeCompare(a.date) ||
    (b.time ?? '').localeCompare(a.time ?? '') ||
    b.createdAt - a.createdAt
  );
}

export interface TxGroup {
  date: string;
  list: Tx[];
  income: number;
  expense: number;
}

/** 按日期分组（输入应为已排序的 txs），供首页 / 流水页共用 */
export function groupByDate(txs: Tx[]): TxGroup[] {
  const map = new Map<string, Tx[]>();
  for (const t of txs) {
    const arr = map.get(t.date) ?? [];
    arr.push(t);
    map.set(t.date, arr);
  }
  return [...map.entries()].map(([date, list]) => ({
    date,
    list,
    income: round2(list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)),
    expense: round2(list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)),
  }));
}
