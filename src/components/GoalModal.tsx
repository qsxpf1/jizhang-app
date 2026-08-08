import { useEffect, useState } from 'react';
import { Button, Input, Modal } from 'animal-island-ui';
import type { CardColor, Goal } from '../types';
import { useBookStore } from '../store/useBookStore';
import { CARD_COLOR_HEX, CARD_COLOR_KEYS } from '../data/colors';

interface Props {
  open: boolean;
  editing: Goal | null;
  onClose: () => void;
}

/** 新增 / 编辑存钱目标弹窗（颜色存 CardColor 命名色，Card 才认） */
export default function GoalModal({ open, editing, onClose }: Props) {
  const addGoal = useBookStore((s) => s.addGoal);
  const updateGoal = useBookStore((s) => s.updateGoal);

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [savedAmount, setSavedAmount] = useState('0');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState<CardColor>('app-teal');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setTargetAmount(String(editing.targetAmount));
      setSavedAmount(String(editing.savedAmount));
      setDeadline(editing.deadline ?? '');
      setColor((editing.color as CardColor) || 'app-teal');
    } else {
      setName('');
      setTargetAmount('');
      setSavedAmount('0');
      setDeadline('');
      setColor('app-teal');
    }
  }, [open, editing]);

  const save = () => {
    const target = parseFloat(targetAmount);
    if (!name.trim() || Number.isNaN(target) || target <= 0) return;
    const saved = Math.min(parseFloat(savedAmount || '0') || 0, target);
    const payload = {
      name: name.trim(),
      targetAmount: target,
      savedAmount: saved,
      deadline: deadline || undefined,
      color,
    };
    if (editing) updateGoal(editing.id, payload);
    else addGoal(payload);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={editing ? '编辑目标' : '新增目标'}
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
        <div className="form-label">目标名称</div>
        <Input
          placeholder="例如：换新手机"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="form-row">
          <div className="grow">
            <div className="form-label">目标金额</div>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="目标"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
            />
          </div>
          <div className="grow">
            <div className="form-label">已存金额</div>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="0"
              value={savedAmount}
              onChange={(e) => setSavedAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="form-label">截止日期（选填）</div>
        <input
          type="date"
          className="date-native"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />

        <div className="form-label">颜色</div>
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
      </div>
    </Modal>
  );
}
