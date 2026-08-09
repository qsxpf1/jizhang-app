import { useMemo, useState } from 'react';
import { Button, Card, Divider, Input } from 'animal-island-ui';
import { useBookStore } from '../store/useBookStore';
import { categoryTotals, currentMonth, monthSummary } from '../utils/calc';
import { formatMoney, formatMoneyPlain, round2 } from '../utils/money';
import MonthNav from '../components/MonthNav';
import ProgressBar from '../components/ProgressBar';

export default function Budget() {
  const txs = useBookStore((s) => s.txs);
  const categories = useBookStore((s) => s.categories);
  const budgets = useBookStore((s) => s.budgets);
  const setBudget = useBookStore((s) => s.setBudget);
  const deleteBudget = useBookStore((s) => s.deleteBudget);
  const settings = useBookStore((s) => s.settings);

  const [ym, setYm] = useState(currentMonth());

  const expenseCats = useMemo(
    () => categories.filter((c) => c.type === 'expense').sort((a, b) => a.sort - b.sort),
    [categories],
  );
  const sum = useMemo(() => monthSummary(txs, ym), [txs, ym]);
  const spent = useMemo(() => categoryTotals(txs, ym, 'expense'), [txs, ym]);

  const totalBudget = budgets.find((b) => b.categoryId === null && b.month === ym);
  const catBudgetOf = (catId: string) => budgets.find((b) => b.categoryId === catId && b.month === ym);

  const setTotalBudget = (v: string) => {
    const existing = totalBudget;
    const n = parseFloat(v);
    if (Number.isNaN(n) || n <= 0) {
      if (existing) deleteBudget(existing.id);
      return;
    }
    setBudget({ categoryId: null, month: ym, amount: round2(n) });
  };

  const setCatBudget = (catId: string, v: string) => {
    const existing = catBudgetOf(catId);
    const n = parseFloat(v);
    if (Number.isNaN(n) || n <= 0) {
      if (existing) deleteBudget(existing.id);
      return;
    }
    setBudget({ categoryId: catId, month: ym, amount: round2(n) });
  };

  const over = (amount: number, spentVal: number) => spentVal > amount;
  const budgetBar = (amount: number, spentVal: number) =>
    amount > 0 ? (spentVal / amount) * 100 : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">预算</h1>
          <p className="page-desc">给每类花销设个额度，守住小钱包</p>
        </div>
        <MonthNav value={ym} onChange={setYm} />
      </div>
      <Divider type="wave-yellow" />

      <Card className="mt16">
        <div className="budget-head">
          <div className="budget-total-wrap">
            <div className="budget-name">本月总预算</div>
            <Input
              type="number"
              min={0}
              className="budget-input"
              placeholder="设置总额（留空清除）"
              value={totalBudget ? String(totalBudget.amount) : ''}
              onChange={(e) => setTotalBudget(e.target.value)}
            />
          </div>
          <div className="budget-nums">
            <div>
              已用{' '}
              <strong
                className={totalBudget && over(totalBudget.amount, sum.expense) ? 'danger-text' : ''}
              >
                {formatMoney(sum.expense, settings)}
              </strong>
            </div>
            <div>
              预算{' '}
              {totalBudget ? formatMoneyPlain(totalBudget.amount, settings) : '未设置'}
            </div>
            {totalBudget && (
              <div className={over(totalBudget.amount, sum.expense) ? 'danger-text' : 'budget-left'}>
                剩余 {formatMoney(totalBudget.amount - sum.expense, settings)}
              </div>
            )}
          </div>
        </div>
        {totalBudget && totalBudget.amount > 0 && (
          <div className="mt16">
            <ProgressBar
              percent={budgetBar(totalBudget.amount, sum.expense)}
              danger={over(totalBudget.amount, sum.expense)}
              height={16}
            />
            {over(totalBudget.amount, sum.expense) && (
              <p className="over-budget">
                ⚠️ 已超支 {formatMoney(sum.expense - totalBudget.amount, settings)}
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="section-label">分类预算</div>
      <Card>
        <div className="budget-rows">
          {expenseCats.map((c) => {
            const budget = catBudgetOf(c.id);
            const spentVal = spent.get(c.id) ?? 0;
            const overIt = budget ? over(budget.amount, spentVal) : false;
            return (
              <div key={c.id} className="budget-row">
                <span className="cat-icon-sm" style={{ background: c.color }}>
                  {c.icon}
                </span>
                <div className="grow">
                  <div className="budget-row-top">
                    <span className="budget-cat">{c.name}</span>
                    <span className="budget-nums">
                      {budget
                        ? `${formatMoneyPlain(spentVal, settings)} / ${formatMoneyPlain(budget.amount, settings)}`
                        : formatMoneyPlain(spentVal, settings)}
                    </span>
                  </div>
                  {overIt && (
                    <p className="over-budget-sm">
                      超支 {formatMoney(spentVal - budget!.amount, settings)}
                    </p>
                  )}
                  <div className="budget-row-bottom">
                    <Input
                      type="number"
                      min={0}
                      className="budget-input-sm"
                      placeholder="预算金额（留空清除）"
                      value={budget ? String(budget.amount) : ''}
                      onChange={(e) => setCatBudget(c.id, e.target.value)}
                    />
                    {budget && budget.amount > 0 && (
                      <ProgressBar
                        className="budget-bar"
                        percent={budgetBar(budget.amount, spentVal)}
                        danger={overIt}
                        height={10}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {expenseCats.length === 0 && <p className="empty">暂无支出分类，可在「设置」中添加</p>}
      </Card>
    </div>
  );
}
