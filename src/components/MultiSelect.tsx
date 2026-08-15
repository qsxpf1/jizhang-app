import { useEffect, useRef, useState } from 'react';

export interface MultiSelectOption {
  key: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  values: string[];
  onChange: (keys: string[]) => void;
  placeholder?: string;
  /** 「全部」选项的标签，默认「全部 xxx」 */
  allLabel?: string;
}

/**
 * 多选下拉组件。
 * - 点击展开下拉面板（始终在正下方）
 * - 支持多选（带 ✓ 标记）
 * - 点击外部关闭
 */
export default function MultiSelect({
  options,
  values,
  onChange,
  placeholder = '请选择',
  allLabel,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const allSelected = options.length > 0 && values.length === options.length;
  const noneSelected = values.length === 0;

  /** 切换单个选项 */
  const toggle = (key: string) => {
    const next = values.includes(key)
      ? values.filter((k) => k !== key)
      : [...values, key];
    onChange(next);
  };

  /** 全选 / 取消全选 */
  const toggleAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(options.map((o) => o.key));
    }
  };

  // 触发按钮文字
  const triggerLabel =
    noneSelected
      ? allLabel ?? `全部${options.length > 0 ? options.length : ''}`
      : allSelected
        ? allLabel ?? `全部${options.length}`
        : `已选 ${values.length} 项`;

  return (
    <div className={`multi-select ${open ? 'open' : ''}`} ref={wrapperRef}>
      <button
        type="button"
        className="multi-select-trigger"
        onClick={() => setOpen(!open)}
      >
        <span className="multi-select-label">{triggerLabel}</span>
        <span className={`multi-select-arrow ${open ? 'up' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {!noneSelected && (
          <span
            className="multi-select-clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
          >
            ✕
          </span>
        )}
      </button>

      {open && (
        <div className="multi-select-dropdown">
          {options.length > 1 && (
            <div
              className={`multi-select-option all ${allSelected ? 'checked' : ''}`}
              onClick={toggleAll}
            >
              <span className="multi-select-check">
                {allSelected ? '✓' : ''}
              </span>
              <span>{allLabel ?? '全选'}</span>
            </div>
          )}
          {options.map((opt) => {
            const checked = values.includes(opt.key);
            return (
              <div
                key={opt.key}
                className={`multi-select-option ${checked ? 'checked' : ''}`}
                onClick={() => toggle(opt.key)}
              >
                <span className="multi-select-check">
                  {checked ? '✓' : ''}
                </span>
                <span>{opt.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}