import { create } from 'zustand';
import type { Tx } from '../types';

interface UiState {
  /** 记账弹窗是否打开 */
  recordOpen: boolean;
  /** 正在编辑的账目（null = 新增） */
  editingTx: Tx | null;
  openRecord: (tx?: Tx) => void;
  closeRecord: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  recordOpen: false,
  editingTx: null,
  openRecord: (tx) => set({ recordOpen: true, editingTx: tx ?? null }),
  closeRecord: () => set({ recordOpen: false, editingTx: null }),
}));
