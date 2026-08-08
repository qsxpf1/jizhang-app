import { useEffect, useMemo, useState } from 'react';
import { Button, Input } from 'animal-island-ui';
import type { PaymentMethod, Tx, TxType } from '../types';
import { PAY_METHODS } from '../data/payMethods';
import { useBookStore } from '../store/useBookStore';
import { dateStr } from '../utils/calc';
import { round2 } from '../utils/money';
import DatePicker from './DatePicker';

const TYPE_TABS: { key: TxType; label: string }[] = [
  { key: 'expense', label: '支出' },
  { key: 'income', label: '收入' },
];

interface RecordFormProps {
  /** 编辑目标；null = 新增 */
  editing: Tx | null;
  /** 变化时重置为新增默认值（快速记账连记用） */
  resetKey?: number;
  /** 是否显示「取消」按钮 */
  showCancel?: boolean;
  onCancel?: () => void;
  /** 提交回调（父组件负责写 store / 关闭弹窗） */
  onSubmit: (payload: Omit<Tx, 'id' | 'createdAt'>) => void;
  /** 打开弹窗时聚焦金额输入 */
  autoFocusAmount?: boolean;
}

/** 记一笔表单（弹窗 / 首页快速记账共用） */
export default function RecordForm({
  editing,
  resetKey = 0,
  showCancel = false,
  onCancel,
  onSubmit,
  autoFocusAmount = false,
}: RecordFormProps) {
  const accounts = useBookStore((s) => s.accounts);
  const categories = useBookStore((s) => s.categories);

  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(() => dateStr(new Date()));
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const cats = useMemo(
    () => categories.filter((c) => c.type === type).sort((a, b) => a.sort - b.sort),
    [categories, type],
  );

  // 初始化：编辑回填；否则新增默认（resetKey 变化时重置，用于快速连记）
  useEffect(() => {
    if (editing) {
      setType(editing.type);
      setAmount(String(editing.amount));
      setCategoryId(editing.categoryId);
      setAccountId(editing.accountId);
      setDate(editing.date);
      setTime(editing.time ?? '');
      setLocation(editing.location ?? '');
      setPayMethod(editing.payMethod ?? '');
      setNote(editing.note ?? '');
    } else {
      setType('expense');
      setAmount('');
      setDate(dateStr(new Date()));
      setTime('');
      setLocation('');
      setPayMethod('');
      setNote('');
      setCategoryId(categories.filter((c) => c.type === 'expense')[0]?.id ?? '');
      setAccountId(accounts[0]?.id ?? '');
    }
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, resetKey]);

  const switchType = (t: TxType) => {
    setType(t);
    setCategoryId(categories.filter((c) => c.type === t)[0]?.id ?? '');
  };

  const handleSave = () => {
    const val = parseFloat(amount);
    if (Number.isNaN(val) || val <= 0) {
      setError('请输入正确的金额');
      return;
    }
    if (!categoryId) {
      setError('请选择分类');
      return;
    }
    if (!accountId) {
      setError('请选择账户');
      return;
    }
    onSubmit({
      type,
      amount: round2(val),
      categoryId,
      accountId,
      date,
      time: time.trim() || undefined,
      location: location.trim() || undefined,
      payMethod: payMethod || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="record-form">
      <div className="type-toggle">
        {TYPE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`type-btn ${type === t.key ? `active ${t.key}` : ''}`}
            onClick={() => switchType(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="amount-field">
        <span className="amount-prefix">¥</span>
        <input
          className="amount-input"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus={autoFocusAmount}
        />
      </div>

      <div className="form-label">分类</div>
      <div className="cat-grid">
        {cats.map((c) => (
          <button
            key={c.id}
            type="button"
            className={categoryId === c.id ? 'cat-chip active' : 'cat-chip'}
            style={
              categoryId === c.id
                ? { borderColor: c.color, background: `${c.color}22` }
                : undefined
            }
            onClick={() => setCategoryId(c.id)}
          >
            <span className="cat-icon">{c.icon}</span>
            <span className="cat-name">{c.name}</span>
          </button>
        ))}
      </div>
      {cats.length === 0 && <p className="form-tip">该类型下暂无分类，可在「设置」中添加</p>}

      <div className="form-label">账户</div>
      <div className="acc-chips">
        {accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            className={accountId === a.id ? 'acc-chip active' : 'acc-chip'}
            onClick={() => setAccountId(a.id)}
          >
            {a.icon} {a.name}
          </button>
        ))}
      </div>
      {accounts.length === 0 && <p className="form-tip">暂无账户，可在「账户」中添加</p>}

      <div className="form-label">支付方式</div>
      <div className="acc-chips">
        {PAY_METHODS.map((m) => (
          <button
            key={m.key}
            type="button"
            className={payMethod === m.key ? 'acc-chip active' : 'acc-chip'}
            onClick={() => setPayMethod(payMethod === m.key ? '' : m.key)}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      <div className="form-row">
        <div>
          <div className="form-label">日期</div>
          <DatePicker value={date} onChange={setDate} />
        </div>
        <div>
          <div className="form-label">时间</div>
          <input
            className="date-native"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>

      <div className="form-label">地点</div>
      <Input
        placeholder="地点（选填）"
        allowClear
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />

      <div className="form-label">详细说明</div>
      <textarea
        className="note-textarea"
        rows={3}
        placeholder="详细说明（选填）"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {error && <p className="form-error">{error}</p>}

      <div className="record-actions">
        {showCancel && (
          <Button type="text" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="primary" onClick={handleSave}>
          {editing ? '保存' : '记一笔'}
        </Button>
      </div>
    </div>
  );
}
