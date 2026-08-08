import { useMemo, useState } from 'react';
import { Button, Card, Divider } from 'animal-island-ui';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useBookStore } from '../store/useBookStore';
import { categoryTotals, currentMonth, dailyTotals, monthSummary, monthlyTotals } from '../utils/calc';
import { formatMoney, formatMoneyPlain } from '../utils/money';
import { downloadJSON } from '../utils/storage';
import MonthNav from '../components/MonthNav';

interface PieDatum {
  name: string;
  value: number;
  color: string;
}

export default function Stats() {
  const txs = useBookStore((s) => s.txs);
  const categories = useBookStore((s) => s.categories);
  const settings = useBookStore((s) => s.settings);

  const [ym, setYm] = useState(currentMonth());
  const year = Number(ym.slice(0, 4));

  const catOf = (id: string) => categories.find((c) => c.id === id);

  const sum = useMemo(() => monthSummary(txs, ym), [txs, ym]);
  const expCat = useMemo(() => categoryTotals(txs, ym, 'expense'), [txs, ym]);
  const incCat = useMemo(() => categoryTotals(txs, ym, 'income'), [txs, ym]);
  const dailyExp = useMemo(() => dailyTotals(txs, ym, 'expense'), [txs, ym]);
  const dailyInc = useMemo(() => dailyTotals(txs, ym, 'income'), [txs, ym]);
  const monthly = useMemo(() => {
    const exp = monthlyTotals(txs, year, 'expense');
    const inc = monthlyTotals(txs, year, 'income');
    return exp.map((e, i) => ({ month: e.month, 支出: e.value, 收入: inc[i].value }));
  }, [txs, year]);

  // 饼图：支出分类占比，最多 7 类，其余聚合为「其他」
  const pieData = useMemo<PieDatum[]>(() => {
    let arr: PieDatum[] = [...expCat.entries()]
      .map(([id, value]) => ({
        name: catOf(id)?.name ?? '未知',
        value,
        color: catOf(id)?.color ?? '#9a835a',
      }))
      .sort((a, b) => b.value - a.value);
    if (arr.length > 7) {
      const top = arr.slice(0, 7);
      const rest = arr.slice(7);
      arr = [...top, { name: '其他', value: rest.reduce((s, d) => s + d.value, 0), color: '#9a835a' }];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expCat, categories]);

  const lineData = useMemo(
    () => dailyExp.map((d, i) => ({ day: d.day, 支出: d.value, 收入: dailyInc[i].value })),
    [dailyExp, dailyInc],
  );

  // 报表分类明细（支出/收入）
  const expRows = useMemo(
    () =>
      [...expCat.entries()]
        .map(([id, value]) => ({ id, name: catOf(id)?.name ?? '未知', icon: catOf(id)?.icon ?? '❓', value, color: catOf(id)?.color ?? '#9a835a' }))
        .sort((a, b) => b.value - a.value),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expCat, categories],
  );
  const incRows = useMemo(
    () =>
      [...incCat.entries()]
        .map(([id, value]) => ({ id, name: catOf(id)?.name ?? '未知', icon: catOf(id)?.icon ?? '❓', value }))
        .sort((a, b) => b.value - a.value),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [incCat, categories],
  );

  const [copied, setCopied] = useState(false);

  const money = (v: number) => formatMoneyPlain(v, settings);

  const exportReport = () => {
    downloadJSON(`记账报表-${ym}.json`, {
      month: ym,
      summary: sum,
      expenses: expRows.map((r) => ({ category: r.name, amount: r.value })),
      incomes: incRows.map((r) => ({ category: r.name, amount: r.value })),
    });
  };

  const copyReport = async () => {
    const lines = [
      `【${ym} 记账报表】`,
      `收入 ${money(sum.income)} / 支出 ${money(sum.expense)} / 结余 ${money(sum.balance)}`,
      '--- 支出 ---',
      ...expRows.map((r) => `${r.name}：${money(r.value)}`),
      '--- 收入 ---',
      ...incRows.map((r) => `${r.name}：${money(r.value)}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 剪贴板不可用时忽略 */
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">统计</h1>
          <p className="page-desc">
            收入 {formatMoney(sum.income, settings)} · 支出 {formatMoney(sum.expense, settings)} · 结余{' '}
            {formatMoney(sum.balance, settings)}
          </p>
        </div>
        <MonthNav value={ym} onChange={setYm} />
      </div>

      <Divider type="wave-yellow" />

      <div className="chart-grid">
        <Card className="mt16">
          <h3 className="chart-title">支出分类占比</h3>
          {pieData.length === 0 ? (
            <p className="empty">本月暂无支出</p>
          ) : (
            <>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {pieData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => money(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend">
                {pieData.map((d) => {
                  const pct = sum.expense > 0 ? (d.value / sum.expense) * 100 : 0;
                  return (
                    <div key={d.name} className="legend-item">
                      <span className="legend-dot" style={{ background: d.color }} />
                      <span className="legend-name">{d.name}</span>
                      <span className="legend-val">{money(d.value)}</span>
                      <span className="legend-pct">{pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        <Card className="mt16">
          <h3 className="chart-title">本月收支趋势</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d4c9b4" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8a7b66' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: '#8a7b66' }} width={72} tickFormatter={(v) => money(Number(v))} />
                <Tooltip
                  formatter={(value) => money(Number(value))}
                  labelFormatter={(label) => `${Number(ym.slice(0, 4))} 年 ${Number(ym.slice(5))} 月 ${label} 日`}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Line type="monotone" dataKey="支出" stroke="#e05a5a" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="收入" stroke="#6fba2c" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="mt16 chart-wide">
          <h3 className="chart-title">{year} 年收支对比</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d4c9b4" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8a7b66' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8a7b66' }} width={72} tickFormatter={(v) => money(Number(v))} />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="支出" fill="#e59266" radius={[6, 6, 0, 0]} />
                <Bar dataKey="收入" fill="#6fba2c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="mt16">
          <div className="card-head">
            <h3 className="chart-title">{ym} 分类报表</h3>
            <div className="row">
              <Button size="small" onClick={copyReport}>
                {copied ? '✓ 已复制' : '复制'}
              </Button>
              <Button size="small" type="primary" onClick={exportReport}>
                导出
              </Button>
            </div>
          </div>

          <div className="section-label">支出</div>
          {expRows.length === 0 ? (
            <p className="empty">本月暂无支出</p>
          ) : (
            <div className="report-list">
              {expRows.map((r) => {
                const pct = sum.expense > 0 ? (r.value / sum.expense) * 100 : 0;
                return (
                  <div key={r.id} className="report-item">
                    <span className="report-icon">{r.icon}</span>
                    <div className="grow">
                      <div className="report-top">
                        <span className="report-name">{r.name}</span>
                        <span className="report-val">
                          {money(r.value)}
                          <span className="report-pct"> {pct.toFixed(1)}%</span>
                        </span>
                      </div>
                      <div className="report-track">
                        <div className="report-fill" style={{ width: `${pct}%`, background: r.color }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="section-label">收入</div>
          {incRows.length === 0 ? (
            <p className="empty">本月暂无收入</p>
          ) : (
            <div className="report-list">
              {incRows.map((r) => (
                <div key={r.id} className="report-item">
                  <span className="report-icon">{r.icon}</span>
                  <div className="grow">
                    <div className="report-top">
                      <span className="report-name">{r.name}</span>
                      <span className="report-val">{money(r.value)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
