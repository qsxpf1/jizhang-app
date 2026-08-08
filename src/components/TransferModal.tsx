import { useEffect, useState } from 'react';
import { Button, Input, Modal } from 'animal-island-ui';
import { useBookStore } from '../store/useBookStore';
import { dateStr } from '../utils/calc';
import { round2 } from '../utils/money';
import DatePicker from './DatePicker';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** 账户转账弹窗（只动余额，不产生收支） */
export default function TransferModal({ open, onClose }: Props) {
  const accounts = useBookStore((s) => s.accounts);
  const addTransfer = useBookStore((s) => s.addTransfer);

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => dateStr(new Date()));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setFromId(accounts[0]?.id ?? '');
    setToId(accounts[1]?.id ?? accounts[0]?.id ?? '');
    setAmount('');
    setDate(dateStr(new Date()));
    setNote('');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = () => {
    const val = parseFloat(amount);
    if (Number.isNaN(val) || val <= 0) {
      setError('请输入正确的金额');
      return;
    }
    if (!fromId || !toId) {
      setError('请选择账户');
      return;
    }
    if (fromId === toId) {
      setError('转出和转入账户不能相同');
      return;
    }
    addTransfer({
      fromAccountId: fromId,
      toAccountId: toId,
      amount: round2(val),
      date,
      note: note.trim(),
    });
    onClose();
  };

  const chips = (selected: string, onSelect: (id: string) => void) => (
    <div className="acc-chips">
      {accounts.map((a) => (
        <button
          key={a.id}
          type="button"
          className={selected === a.id ? 'acc-chip active' : 'acc-chip'}
          onClick={() => onSelect(a.id)}
        >
          {a.icon} {a.name}
        </button>
      ))}
    </div>
  );

  return (
    <Modal
      open={open}
      title="账户转账"
      width={480}
      onClose={onClose}
      typewriter={false}
      footer={
        <>
          <Button type="text" onClick={onClose}>
            取消
          </Button>
          <Button type="primary" onClick={save}>
            转账
          </Button>
        </>
      }
    >
      <div className="modal-form">
        <div className="form-label">转出账户</div>
        {chips(fromId, setFromId)}
        <div className="form-label">转入账户</div>
        {chips(toId, setToId)}

        <div className="form-label">金额</div>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <div className="form-row">
          <div>
            <div className="form-label">日期</div>
            <DatePicker value={date} onChange={setDate} />
          </div>
          <div className="grow">
            <div className="form-label">备注</div>
            <Input
              placeholder="备注（选填）"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
      </div>
    </Modal>
  );
}
