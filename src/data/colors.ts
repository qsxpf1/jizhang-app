import type { CardColor } from '../types';

/** 分类可选色板（图表 / 图标底色共用） */
export const CATEGORY_COLORS: string[] = [
  '#19c8b9', '#6fba2c', '#f5c31c', '#e05a5a', '#f8a6b2', '#b77dee',
  '#889df0', '#f7cd67', '#e59266', '#82d5bb', '#8ac68a', '#fc736d',
  '#d1da49', '#9a835a', '#e18c6f',
];

/** CardColor 名称 → 色值（账户卡片色板） */
export const CARD_COLOR_HEX: Record<CardColor, string> = {
  default: '#f7f3df',
  'app-pink': '#f8a6b2',
  purple: '#b77dee',
  'app-blue': '#889df0',
  'app-yellow': '#f7cd67',
  'app-orange': '#e59266',
  'app-teal': '#82d5bb',
  'app-green': '#8ac68a',
  'app-red': '#fc736d',
  'lime-green': '#d1da49',
  'yellow-green': '#ecdf52',
  brown: '#9a835a',
  'warm-peach-pink': '#e18c6f',
};

/** 账户可选卡片颜色 */
export const CARD_COLOR_KEYS: CardColor[] = Object.keys(CARD_COLOR_HEX) as CardColor[];

/** 账户图标候选 */
export const ACCOUNT_ICONS = ['💵', '🏦', '📱', '💬', '🪙', '💳', '💰', '🏧'];

/** 分类图标候选 */
export const CATEGORY_ICONS = [
  '🍔', '🍜', '☕', '🍰', '🚌', '🚕', '🚗', '🛍️', '👗', '🏠', '💡',
  '🎮', '🎬', '📚', '💊', '✈️', '📦', '💼', '📈', '🧧', '💰', '🎁', '🐱', '🌸',
];
