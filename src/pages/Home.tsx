import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Modal } from 'animal-island-ui';
import type { Tx } from '../types';
import { useBookStore } from '../store/useBookStore';
import { useUiStore } from '../store/useUiStore';
import { currentMonth, groupByDate, monthSummary, sortTx } from '../utils/calc';
import { formatMoney } from '../utils/money';
import RecordForm from '../components/RecordForm';
import TxGrouped from '../components/TxGrouped';

export default function Home() {
  const txs = useBookStore((s) => s.txs);
  const categories = useBookStore((s) => s.categories);
  const accounts = useBookStore((s) => s.accounts);
  const budgets = useBookStore((s) => s.budgets);
  const settings = useBookStore((s) => s.settings);
  const addTx = useBookStore((s) => s.addTx);
  const deleteTx = useBookStore((s) => s.deleteTx);
  const openRecord = useUiStore((s) => s.openRecord);

  const ym = currentMonth();
  const sum = useMemo(() => monthSummary(txs, ym), [txs, ym]);
  const totalBudget = useMemo(
    () => budgets.filter((b) => b.categoryId !== null && b.month === ym).reduce((s, b) => s + b.amount, 0),
    [budgets, ym],
  );
  const budgetRemaining = totalBudget - sum.expense;
  const monthTxs = useMemo(() => txs.filter((t) => t.date.startsWith(ym)).sort(sortTx), [txs, ym]);

  const [showAll, setShowAll] = useState(false);
  const visibleTxs = useMemo(
    () => (showAll ? monthTxs : monthTxs.slice(0, 5)),
    [monthTxs, showAll],
  );
  const groups = useMemo(() => groupByDate(visibleTxs), [visibleTxs]);

  // 首页快速记账：保存后清空表单并提示
  const [resetKey, setResetKey] = useState(0);
  const [savedFlash, setSavedFlash] = useState(false);
  const handleQuickSave = (payload: Omit<Tx, 'id' | 'createdAt'>) => {
    addTx(payload);
    setResetKey((k) => k + 1);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  const [delTarget, setDelTarget] = useState<Tx | null>(null);

  return (
    <div className="page">
      <div className="home-head">
        <h1 className="page-title">你好，{settings.firstName} 👋</h1>
        <p className="page-desc">
          {ym.slice(0, 4)} 年 {Number(ym.slice(5))} 月 · 今天也要好好记账哦
        </p>
      </div>

      <div className="stat-row">
        <Card color="app-blue">
          <div className="stat-card">
            <span>本月收入</span>
            <strong>{formatMoney(sum.income, settings)}</strong>
          </div>
        </Card>
        <Card color="app-orange">
          <div className="stat-card">
            <span>本月支出</span>
            <strong>{formatMoney(sum.expense, settings)}</strong>
          </div>
        </Card>
        <Card color={sum.balance >= 0 ? 'app-green' : 'app-red'}>
          <div className="stat-card">
            <span>结余</span>
            <strong>{formatMoney(sum.balance, settings)}</strong>
          </div>
        </Card>
        <Card color={totalBudget > 0 ? (budgetRemaining >= 0 ? 'app-teal' : 'app-red') : 'default'}>
          <div className="stat-card">
            <span>预算结余</span>
            <strong>{totalBudget > 0 ? formatMoney(budgetRemaining, settings) : '未设置'}</strong>
          </div>
        </Card>
      </div>

      <Card className="mt16 quick-record">
        <div className="card-head">
          <h3>记一笔</h3>
          {savedFlash && <span className="saved-flash">✓ 已记录</span>}
        </div>
        <RecordForm editing={null} resetKey={resetKey} onSubmit={handleQuickSave} />
      </Card>

      <div className="section-head">
        <h3>本月流水</h3>
        <Link to="/list" className="more">
          查看全部 ›
        </Link>
      </div>
      <TxGrouped
        groups={groups}
        categories={categories}
        accounts={accounts}
        settings={settings}
        onEdit={openRecord}
        onDelete={setDelTarget}
        emptyText="本月还没有账目，用上面的「记一笔」记下第一笔吧 ✍️"
      />

      {!showAll && monthTxs.length > 5 && (
        <button className="home-more-btn" onClick={() => setShowAll(true)}>
          查看更多 ›
        </button>
      )}
      {showAll && monthTxs.length > 5 && (
        <p className="home-end-tip">— 到底啦... ... —</p>
      )}

      <div className="quick-grid">
        <Link to="/budget">
          <Card type="dashed">🎯 预算</Card>
        </Link>
        <Link to="/goals">
          <Card type="dashed">⛳ 存钱目标</Card>
        </Link>
        <Link to="/achievements">
          <Card type="dashed">🏆 成就</Card>
        </Link>
      </div>

      <Modal
        open={delTarget !== null}
        title="删除这笔账？"
        onClose={() => setDelTarget(null)}
        typewriter={false}
        footer={
          <>
            <Button type="text" onClick={() => setDelTarget(null)}>
              取消
            </Button>
            <Button
              type="primary"
              danger
              onClick={() => {
                if (delTarget) deleteTx(delTarget.id);
                setDelTarget(null);
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
