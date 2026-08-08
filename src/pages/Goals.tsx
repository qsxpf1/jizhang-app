import { useMemo, useState } from 'react';
import { Button, Card, Input, Modal } from 'animal-island-ui';
import type { CardColor, Goal } from '../types';
import { useBookStore } from '../store/useBookStore';
import { CARD_COLOR_HEX } from '../data/colors';
import { formatMoney, formatMoneyPlain, round2 } from '../utils/money';
import GoalModal from '../components/GoalModal';
import ProgressBar from '../components/ProgressBar';

function daysLeft(deadline?: string): { text: string; over: boolean } | null {
  if (!deadline) return null;
  const ms = new Date(`${deadline}T00:00:00`).getTime() - Date.now();
  const days = Math.ceil(ms / 86400000);
  if (days < 0) return { text: '已截止', over: true };
  if (days === 0) return { text: '今天截止', over: false };
  return { text: `还有 ${days} 天`, over: false };
}

export default function Goals() {
  const goals = useBookStore((s) => s.goals);
  const settings = useBookStore((s) => s.settings);
  const updateGoal = useBookStore((s) => s.updateGoal);
  const deleteGoal = useBookStore((s) => s.deleteGoal);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null);
  const [delGoal, setDelGoal] = useState<Goal | null>(null);
  const [depositAmt, setDepositAmt] = useState('');
  const [depositErr, setDepositErr] = useState('');

  const doneCount = useMemo(() => goals.filter((g) => g.savedAmount >= g.targetAmount).length, [goals]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const doDeposit = () => {
    if (!depositGoal) return;
    const n = parseFloat(depositAmt);
    if (Number.isNaN(n) || n <= 0) {
      setDepositErr('请输入正确的金额');
      return;
    }
    updateGoal(depositGoal.id, { savedAmount: round2(depositGoal.savedAmount + n) });
    setDepositGoal(null);
    setDepositAmt('');
    setDepositErr('');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">存钱目标</h1>
          <p className="page-desc">
            像攒铃钱一样实现心愿 · 已完成 {doneCount}/{goals.length}
          </p>
        </div>
        <Button type="primary" onClick={openAdd}>
          ＋ 新增目标
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card type="dashed">
          <p className="empty">还没有存钱目标，建一个吧 🎯</p>
        </Card>
      ) : (
        <div className="goal-grid">
          {goals.map((g) => {
            const done = g.savedAmount >= g.targetAmount;
            const pct = g.targetAmount > 0 ? (g.savedAmount / g.targetAmount) * 100 : 0;
            const left = daysLeft(g.deadline);
            const colorHex = CARD_COLOR_HEX[g.color as CardColor] ?? '#19c8b9';
            return (
              <Card key={g.id} color={g.color as CardColor}>
                <div className="goal-card">
                  <div className="goal-top">
                    <span className="goal-name">{g.name}</span>
                    {done && <span className="goal-done-chip">✓ 达成</span>}
                  </div>
                  <div className="goal-nums">
                    <span className="goal-saved">{formatMoney(g.savedAmount, settings)}</span>
                    <span className="goal-target">/ {formatMoneyPlain(g.targetAmount, settings)}</span>
                  </div>
                  <ProgressBar percent={pct} color={done ? '#6fba2c' : colorHex} height={14} />
                  <div className="goal-meta">
                    <span>{pct.toFixed(0)}%</span>
                    {left && <span className={left.over ? 'danger-text' : ''}>{left.text}</span>}
                  </div>
                  <div className="goal-actions">
                    <button
                      type="button"
                      className="goal-deposit"
                      onClick={() => {
                        setDepositGoal(g);
                        setDepositAmt('');
                        setDepositErr('');
                      }}
                    >
                      ＋ 存一笔
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(g);
                        setModalOpen(true);
                      }}
                    >
                      编辑
                    </button>
                    <button type="button" className="danger-text" onClick={() => setDelGoal(g)}>
                      删除
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <GoalModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} />

      <Modal
        open={depositGoal !== null}
        title="存一笔"
        width={420}
        onClose={() => setDepositGoal(null)}
        typewriter={false}
        footer={
          <>
            <Button type="text" onClick={() => setDepositGoal(null)}>
              取消
            </Button>
            <Button type="primary" onClick={doDeposit}>
              存入
            </Button>
          </>
        }
      >
        <div className="modal-form">
          <p className="deposit-tip">
            往「{depositGoal?.name}」存一笔
            {depositGoal ? `（已存 ${formatMoney(depositGoal.savedAmount, settings)}）` : ''}
          </p>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="本次存入金额"
            value={depositAmt}
            onChange={(e) => setDepositAmt(e.target.value)}
          />
          {depositErr && <p className="form-error">{depositErr}</p>}
        </div>
      </Modal>

      <Modal
        open={delGoal !== null}
        title="删除目标？"
        onClose={() => setDelGoal(null)}
        typewriter={false}
        footer={
          <>
            <Button type="text" onClick={() => setDelGoal(null)}>
              取消
            </Button>
            <Button
              type="primary"
              danger
              onClick={() => {
                if (delGoal) deleteGoal(delGoal.id);
                setDelGoal(null);
              }}
            >
              删除
            </Button>
          </>
        }
      >
        删除后无法恢复，确定删除吗？
      </Modal>
    </div>
  );
}
