import { useMemo } from 'react';
import { Card } from 'animal-island-ui';
import { useBookStore } from '../store/useBookStore';
import { currentMonth, currentStreak, monthSummary } from '../utils/calc';
import { ACHIEVEMENTS, type AchCtx } from '../data/achievements';
import ProgressBar from '../components/ProgressBar';

export default function Achievements() {
  const txs = useBookStore((s) => s.txs);
  const budgets = useBookStore((s) => s.budgets);
  const goals = useBookStore((s) => s.goals);
  const settings = useBookStore((s) => s.settings);

  const ctx = useMemo<AchCtx>(() => {
    const ym = currentMonth();
    const currentExpense = monthSummary(txs, ym).expense;
    const totalBudget = budgets.find((b) => b.categoryId === null && b.month === ym);
    return {
      txCount: txs.length,
      streak: currentStreak(txs),
      totalIncome: txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      catUsed: new Set(txs.map((t) => t.categoryId)).size,
      budgetCount: budgets.length,
      currentBudgetSet: !!totalBudget,
      overBudget: totalBudget ? currentExpense > totalBudget.amount : false,
      goalDone: goals.filter((g) => g.savedAmount >= g.targetAmount).length,
      bellMode: settings.bellMode,
    };
  }, [txs, budgets, goals, settings]);

  const unlockedCount = ACHIEVEMENTS.filter((a) => a.check(ctx).unlocked).length;

  return (
    <div className="page">
      <h1 className="page-title">成就</h1>
      <p className="page-desc">
        已解锁 {unlockedCount}/{ACHIEVEMENTS.length} · 坚持记账，点亮徽章
      </p>

      <div className="ach-grid">
        {ACHIEVEMENTS.map((a) => {
          const { unlocked, progress, detail } = a.check(ctx);
          return (
            <Card key={a.id} type={unlocked ? 'default' : 'dashed'} className="ach-card">
              <div className={unlocked ? 'ach-inner' : 'ach-inner locked'}>
                <div className="ach-top">
                  <span className="ach-icon">{a.icon}</span>
                  {unlocked ? <span className="ach-badge">✓</span> : <span className="ach-lock">🔒</span>}
                </div>
                <div className="ach-name">{a.name}</div>
                <div className="ach-desc">{a.desc}</div>
                {!unlocked && (
                  <div className="ach-progress">
                    <ProgressBar percent={progress * 100} height={8} color="#9a835a" />
                    <span className="ach-detail">{detail}</span>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
