import type { Settings } from '../types';

/** 四舍五入到分 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 元 → 铃钱 */
export function toBells(yuan: number, rate: number): number {
  return round2(yuan * rate);
}

/** 带符号展示金额（收入 + / 支出 -） */
export function formatMoney(yuan: number, settings: Settings): string {
  const sign = yuan < 0 ? '-' : '+';
  if (settings.bellMode) {
    const bells = toBells(Math.abs(yuan), settings.bellRate);
    return `${sign}${bells.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 铃`;
  }
  return `${sign}¥${Math.abs(yuan).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** 无符号金额（用于卡片/图表数值） */
export function formatMoneyPlain(yuan: number, settings: Settings): string {
  const n = settings.bellMode ? toBells(yuan, settings.bellRate) : yuan;
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

/** 纯数字格式化 */
export function formatNumber(n: number): string {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}
