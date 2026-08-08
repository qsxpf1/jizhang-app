import { dateStr } from '../utils/calc';

interface Props {
  /** YYYY-MM-DD */
  value: string;
  onChange: (v: string) => void;
}

/**
 * 记账日期选择：原生日期输入（浏览器自带日历，不受弹窗 overflow 裁剪）
 * + 今天/昨天快捷按钮。
 */
export default function DatePicker({ value, onChange }: Props) {
  const quick = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    onChange(dateStr(d));
  };

  return (
    <div className="date-picker">
      <input
        className="date-native"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="date-quick">
        <button type="button" onClick={() => quick(0)}>今天</button>
        <button type="button" onClick={() => quick(-1)}>昨天</button>
      </div>
    </div>
  );
}
