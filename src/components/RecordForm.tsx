import { useEffect, useMemo, useRef, useState } from 'react';
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

/** 折叠状态下一行最多展示多少项 */
const MAX_VISIBLE_CATS = 5;
const MAX_VISIBLE_ACCS = 3;
const MAX_VISIBLE_PAYS = 3;

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
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [expandedCat, setExpandedCat] = useState(false);
  const [expandedAcc, setExpandedAcc] = useState(false);
  const [expandedPay, setExpandedPay] = useState(false);

  const cats = useMemo(
    () => categories.filter((c) => c.type === type).sort((a, b) => a.sort - b.sort),
    [categories, type],
  );

  const txs = useBookStore((s) => s.txs);
  const locationHistory = useMemo(() => {
    const set = new Set<string>();
    txs.forEach((t) => { if (t.location) set.add(t.location); });
    return [...set].sort();
  }, [txs]);

  // 根据输入过滤历史地点
  const filteredLocations = useMemo(() => {
    if (!location.trim()) return locationHistory;
    const q = location.toLowerCase();
    return locationHistory.filter((l) => l.toLowerCase().includes(q));
  }, [locationHistory, location]);

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
      // 编辑时展开所有区块以确保选中项可见
      setExpandedCat(true);
      setExpandedAcc(true);
      setExpandedPay(true);
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
    setExpandedCat(false);
    setExpandedAcc(false);
    setExpandedPay(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, resetKey]);

  // 点击外部关闭地点下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
      <div className="cat-grid-wrap">
        <div className={`cat-grid ${!expandedCat && cats.length > MAX_VISIBLE_CATS ? 'collapsed' : ''}`}>
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
        {!expandedCat && cats.length > MAX_VISIBLE_CATS && (
          <button type="button" className="cat-expand-btn" onClick={() => setExpandedCat(true)}>
            <span className="cat-expand-dots">···</span>
            <span className="cat-expand-label">展开</span>
          </button>
        )}
      </div>
      {cats.length === 0 && <p className="form-tip">该类型下暂无分类，可在「设置」中添加</p>}

      <div className="form-label">账户</div>
      <div className={`acc-chips ${expandedAcc ? '' : 'collapsed'}`}>
        {(expandedAcc ? accounts : accounts.slice(0, MAX_VISIBLE_ACCS)).map((a) => (
          <button
            key={a.id}
            type="button"
            className={accountId === a.id ? 'acc-chip active' : 'acc-chip'}
            onClick={() => setAccountId(a.id)}
          >
            {a.icon} {a.name}
          </button>
        ))}
        {!expandedAcc && accounts.length > MAX_VISIBLE_ACCS && (
          <button
            type="button"
            className="acc-chip more-chip"
            onClick={() => setExpandedAcc(true)}
          >
            <span className="more-dots">···</span>
          </button>
        )}
      </div>
      {accounts.length === 0 && <p className="form-tip">暂无账户，可在「账户」中添加</p>}

      <div className="form-label">支付方式</div>
      <div className={`acc-chips ${expandedPay ? '' : 'collapsed'}`}>
        {(expandedPay ? PAY_METHODS : PAY_METHODS.slice(0, MAX_VISIBLE_PAYS)).map((m) => (
          <button
            key={m.key}
            type="button"
            className={payMethod === m.key ? 'acc-chip active' : 'acc-chip'}
            onClick={() => setPayMethod(payMethod === m.key ? '' : m.key)}
          >
            {m.icon} {m.label}
          </button>
        ))}
        {!expandedPay && PAY_METHODS.length > MAX_VISIBLE_PAYS && (
          <button
            type="button"
            className="acc-chip more-chip"
            onClick={() => setExpandedPay(true)}
          >
            <span className="more-dots">···</span>
          </button>
        )}
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
      <div className="location-wrapper" ref={locationRef}>
        <Input
          placeholder="地点（选填）"
          allowClear
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            if (e.target.value.trim()) {
              setShowLocationDropdown(true);
            } else {
              setShowLocationDropdown(false);
            }
          }}
          onFocus={() => {
            if (location.trim() || filteredLocations.length > 0) {
              setShowLocationDropdown(true);
            }
          }}
        />
        {showLocationDropdown && filteredLocations.length > 0 && (
          <ul className="location-dropdown">
            {filteredLocations.map((loc) => (
              <li
                key={loc}
                className="location-option"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setLocation(loc);
                  setShowLocationDropdown(false);
                }}
              >
                📍 {loc}
              </li>
            ))}
          </ul>
        )}
      </div>

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
