import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select } from 'animal-island-ui';
import type { Account, AccountType, CardColor } from '../types';
import { useBookStore } from '../store/useBookStore';
import { ACCOUNT_ICONS, CARD_COLOR_HEX, CARD_COLOR_KEYS } from '../data/colors';

interface Props {
  open: boolean;
  editing: Account | null;
  onClose: () => void;
}

const TYPE_OPTIONS: { key: AccountType; label: string }[] = [
  { key: 'cash', label: '💵 现金' },
  { key: 'bank', label: '🏦 银行卡' },
  { key: 'alipay', label: '📱 支付宝' },
  { key: 'wechat', label: '💬 微信' },
  { key: 'other', label: '🪙 其他' },
];

/** 新增 / 编辑账户弹窗 */
export default function AccountModal({ open, editing, onClose }: Props) {
  const addAccount = useBookStore((s) => s.addAccount);
  const updateAccount = useBookStore((s) => s.updateAccount);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [icon, setIcon] = useState('💵');
  const [color, setColor] = useState<CardColor>('app-green');
  const [initialBalance, setInitialBalance] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setType(editing.type);
      setIcon(editing.icon);
      setColor(editing.color);
      setInitialBalance(String(editing.initialBalance));
    } else {
      setName('');
      setType('cash');
      setIcon('💵');
      setColor('app-green');
      setInitialBalance('');
    }
    setError('');
  }, [open, editing]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('请输入账户名称');
      return;
    }
    const bal = parseFloat(initialBalance || '0');
    const payload = {
      name: trimmed,
      type,
      icon,
      color,
      initialBalance: Number.isNaN(bal) ? 0 : bal,
    };
    if (editing) updateAccount(editing.id, payload);
    else addAccount(payload);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={editing ? '编辑账户' : '新增账户'}
      width={480}
      onClose={onClose}
      typewriter={false}
      footer={
        <>
          <Button type="text" onClick={onClose}>
            取消
          </Button>
          <Button type="primary" onClick={save}>
            保存
          </Button>
        </>
      }
    >
      <div className="modal-form">
        <div className="form-label">账户名称</div>
        <Input
          placeholder="例如：工资卡"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="form-label">类型</div>
        <Select
          value={type}
          onChange={(k) => setType(k as AccountType)}
          options={TYPE_OPTIONS.map((t) => ({ key: t.key, label: t.label }))}
        />

        <div className="form-label">图标</div>
        <div className="icon-picker">
          {ACCOUNT_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              className={icon === ic ? 'icon-opt active' : 'icon-opt'}
              onClick={() => setIcon(ic)}
            >
              {ic}
            </button>
          ))}
        </div>

        <div className="form-label">卡片颜色</div>
        <div className="color-picker">
          {CARD_COLOR_KEYS.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              className={color === c ? 'color-opt active' : 'color-opt'}
              style={{ background: CARD_COLOR_HEX[c] }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        <div className="form-label">初始余额</div>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="0"
          value={initialBalance}
          onChange={(e) => setInitialBalance(e.target.value)}
        />

        {error && <p className="form-error">{error}</p>}
      </div>
    </Modal>
  );
}
