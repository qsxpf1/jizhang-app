import { currentMonth, monthKey } from '../utils/calc';

interface Props {
  /** YYYY-MM */
  value: string;
  onChange: (ym: string) => void;
}

/** 月份切换器（◀ 2026年08月 ▶，含「回到本月」） */
export default function MonthNav({ value, onChange }: Props) {
  const now = currentMonth();
  const shift = (delta: number) => {
    const [y, m] = value.split('-').map(Number);
    onChange(monthKey(new Date(y, m - 1 + delta, 1)));
  };

  return (
    <div className="month-nav">
      <button type="button" onClick={() => shift(-1)} aria-label="上个月">
        ◀
      </button>
      <span className="month-nav-label">
        {Number(value.slice(0, 4))} 年 {Number(value.slice(5))} 月
      </span>
      <button type="button" onClick={() => shift(1)} disabled={value >= now} aria-label="下个月">
        ▶
      </button>
      {value !== now && (
        <button type="button" className="month-nav-today" onClick={() => onChange(now)}>
          回到本月
        </button>
      )}
    </div>
  );
}
