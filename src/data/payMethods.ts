import type { PaymentMethod } from '../types';

/** 支付方式选项（现金/银行卡/支付宝/微信/信用卡/其他） */
export const PAY_METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: 'cash', label: '现金', icon: '💵' },
  { key: 'bank', label: '银行卡', icon: '🏦' },
  { key: 'alipay', label: '支付宝', icon: '📱' },
  { key: 'wechat', label: '微信', icon: '💬' },
  { key: 'credit', label: '信用卡', icon: '💳' },
  { key: 'other', label: '其他', icon: '🧾' },
];

/** 支付方式 → 中文标签 */
export function payMethodLabel(key?: PaymentMethod): string {
  return PAY_METHODS.find((p) => p.key === key)?.label ?? '';
}
