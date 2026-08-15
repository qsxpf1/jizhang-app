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
import {
  currentMonth,
  dateStr,
  monthlyTotals,
  monthRange,
  rangeCategoryTotals,
  rangeDailyTotals,
  rangeGroupTotals,
  rangeSummary,
} from '../utils/calc';
import { formatMoney, formatMoneyPlain } from '../utils/money';
import { downloadJSON } from '../utils/storage';

interface PieDatum {
  name: string;
  value: number;
  color: string;
}

/** YYYY-MM-DD */
function firstDayOfMonth(ym: string): string {
  return `${ym}-01`;
}
function lastDayOfMonth(ym: string): string {
  return monthRange(ym).end;
}

export default function Stats() {
  const txs = useBookStore((s) => s.txs);
  const categories = useBookStore((s) => s.categories);
  const categoryGroups = useBookStore((s) => s.categoryGroups);
  const settings = useBookStore((s) => s.settings);

  const [dateStart, setDateStart] = useState(() => firstDayOfMonth(currentMonth()));
  const [dateEnd, setDateEnd] = useState(() => lastDayOfMonth(currentMonth()));
  const [groupView, setGroupView] = useState(false);

  const catOf = (id: string) => categories.find((c) => c.id === id);
  const groupOf = (id: string) => categoryGroups.find((g) => g.id === id);

  const resolveKey = (key: string) => {
    const g = groupOf(key);
    if (g) return { name: g.name, icon: g.icon, color: g.color };
    const c = catOf(key);
    if (c) return { name: c.name, icon: c.icon, color: c.color };
    return { name: '未知', icon: '❓', color: '#9a835a' };
  };

  const sum = useMemo(() => rangeSummary(txs, dateStart, dateEnd), [txs, dateStart, dateEnd]);
  const expCat = useMemo(() => rangeCategoryTotals(txs, dateStart, dateEnd, 'expense'), [txs, dateStart, dateEnd]);
  const incCat = useMemo(() => rangeCategoryTotals(txs, dateStart, dateEnd, 'income'), [txs, dateStart, dateEnd]);
  const expGroup = useMemo(
    () => rangeGroupTotals(txs, dateStart, dateEnd, 'expense', categories, categoryGroups),
    [txs, dateStart, dateEnd, categories, categoryGroups],
  );
  const hasExpGroups = categoryGroups.some((g) => g.type === 'expense');

  // 大类视图下：每个大类的子分类明细
  const groupSubs = useMemo(() => {
    const m = new Map<string, { id: string; name: string; icon: string; value: number; color: string }[]>();
    for (const t of txs) {
      if (t.type !== 'expense' || t.date < dateStart || t.date > dateEnd) continue;
      const cat = catOf(t.categoryId);
      const gid = cat?.groupId && groupOf(cat.groupId) ? cat.groupId : undefined;
      if (!gid) continue;
      let arr = m.get(gid);
      if (!arr) {
        arr = [];
        m.set(gid, arr);
      }
      const found = arr.find((x) => x.id === t.categoryId);
      if (found) found.value += t.amount;
      else arr.push({ id: t.categoryId, name: cat?.name ?? '未知', icon: cat?.icon ?? '❓', value: t.amount, color: cat?.color ?? '#9a835a' });
    }
    for (const arr of m.values()) {
      arr.forEach((x) => (x.value = Math.round(x.value * 100) / 100));
      arr.sort((a, b) => b.value - a.value);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, dateStart, dateEnd, categories, categoryGroups]);

  const dailyExp = useMemo(() => rangeDailyTotals(txs, dateStart, dateEnd, 'expense'), [txs, dateStart, dateEnd]);
  const dailyInc = useMemo(() => rangeDailyTotals(txs, dateStart, dateEnd, 'income'), [txs, dateStart, dateEnd]);

  const ym = currentMonth(); // 仅用于年度柱状图
  const year = Number(ym.slice(0, 4));
  const monthly = useMemo(() => {
    const exp = monthlyTotals(txs, year, 'expense');
    const inc = monthlyTotals(txs, year, 'income');
    return exp.map((e, i) => ({ month: e.month, 支出: e.value, 收入: inc[i].value }));
  }, [txs, year]);

  // 饼图：支出分类/大类占比，最多 7 类，其余聚合为「其他」
  const pieData = useMemo<PieDatum[]>(() => {
    const map = groupView ? expGroup : expCat;
    let arr: PieDatum[] = [...map.entries()]
      .map(([key, value]) => {
        const info = resolveKey(key);
        return { name: info.name, value, color: info.color };
      })
      .sort((a, b) => b.value - a.value);
    if (arr.length > 7) {
      const top = arr.slice(0, 7);
      const rest = arr.slice(7);
      arr = [...top, { name: '其他', value: rest.reduce((s, d) => s + d.value, 0), color: '#9a835a' }];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expCat, expGroup, groupView]);

  const lineData = useMemo(
    () => dailyExp.map((d, i) => ({ day: d.day, 支出: d.value, 收入: dailyInc[i].value })),
    [dailyExp, dailyInc],
  );

  // 报表分类明细（支出/收入）
  const expRows = useMemo(
    () => {
      const map = groupView ? expGroup : expCat;
      return [...map.entries()]
        .map(([key, value]) => {
          const info = resolveKey(key);
          return {
            id: key,
            name: info.name,
            icon: info.icon,
            value,
            color: info.color,
            subs: groupView ? groupSubs.get(key) : undefined,
          };
        })
        .sort((a, b) => b.value - a.value);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expCat, expGroup, groupView, groupSubs],
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
    downloadJSON(`记账报表-${dateStart}-${dateEnd}.json`, {
      period: { start: dateStart, end: dateEnd },
      summary: sum,
      expenses: expRows.map((r) => ({ category: r.name, amount: r.value })),
      incomes: incRows.map((r) => ({ category: r.name, amount: r.value })),
    });
  };

  const copyReport = async () => {
    const lines = [
      `【记账报表 ${dateStart} ~ ${dateEnd}】`,
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

  /** 设置为当月第一天至最后一天 */
  const setToCurrentMonth = () => {
    setDateStart(firstDayOfMonth(currentMonth()));
    setDateEnd(lastDayOfMonth(currentMonth()));
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
      </div>

      {/* 日期区间选择 */}
      <Card className="mt8">
        <div className="settings-row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="date-range-picker" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>起始</span>
            <input
              className="date-native"
              type="date"
              value={dateStart}
              onChange={(e) => { if (e.target.value <= dateEnd) setDateStart(e.target.value); }}
            />
            <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>终止</span>
            <input
              className="date-native"
              type="date"
              value={dateEnd}
              onChange={(e) => { if (e.target.value >= dateStart) setDateEnd(e.target.value); }}
            />
          </div>
          <Button size="small" type="dashed" onClick={setToCurrentMonth}>
            本月
          </Button>
        </div>
      </Card>

      <Divider type="wave-yellow" />

      <div className="chart-grid">
        <Card className="mt16">
          <div className="card-head">
            <h3 className="chart-title">{groupView ? '支出大类占比' : '支出分类占比'}</h3>
            {hasExpGroups && (
              <div className="view-toggle">
                <button
                  type="button"
                  className={!groupView ? 'active' : ''}
                  onClick={() => setGroupView(false)}
                >
                  按分类
                </button>
                <button
                  type="button"
                  className={groupView ? 'active' : ''}
                  onClick={() => setGroupView(true)}
                >
                  按大类
                </button>
              </div>
            )}
          </div>
          {pieData.length === 0 ? (
            <p className="empty">期间暂无支出</p>
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
          <h3 className="chart-title">期间收支趋势</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d4c9b4" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8a7b66' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: '#8a7b66' }} width={72} tickFormatter={(v) => money(Number(v))} />
                <Tooltip
                  formatter={(value) => money(Number(value))}
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
            <h3 className="chart-title">{dateStart} ~ {dateEnd} 分类报表</h3>
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
            <p className="empty">期间暂无支出</p>
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
                      {r.subs && r.subs.length > 0 && (
                        <div className="report-subs">
                          {r.subs.map((s) => {
                            const spct = r.value > 0 ? (s.value / r.value) * 100 : 0;
                            return (
                              <div key={s.id} className="report-sub">
                                <span className="report-sub-icon">{s.icon}</span>
                                <span className="report-sub-name">{s.name}</span>
                                <span className="report-sub-val">{money(s.value)}</span>
                                <span className="report-sub-pct">{spct.toFixed(1)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="section-label">收入</div>
          {incRows.length === 0 ? (
            <p className="empty">期间暂无收入</p>
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