import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Modal } from 'animal-island-ui';
import type { Tx, TxType } from '../types';
import { useBookStore } from '../store/useBookStore';
import { useUiStore } from '../store/useUiStore';
import { groupByDate, sortTx } from '../utils/calc';
import { formatMoney } from '../utils/money';
import { payMethodLabel } from '../data/payMethods';
import TxGrouped from '../components/TxGrouped';
import MultiSelect from '../components/MultiSelect';

const PAGE_SIZE = 20;
type TypeFilter = 'all' | TxType;

export default function List() {
  const txs = useBookStore((s) => s.txs);
  const categories = useBookStore((s) => s.categories);
  const accounts = useBookStore((s) => s.accounts);
  const settings = useBookStore((s) => s.settings);
  const deleteTx = useBookStore((s) => s.deleteTx);
  const openRecord = useUiStore((s) => s.openRecord);

  const [type, setType] = useState<TypeFilter>('all');
  const [catIds, setCatIds] = useState<string[]>([]);
  const [accIds, setAccIds] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [page, setPage] = useState(1);
  const [delTarget, setDelTarget] = useState<Tx | null>(null);

  const filtered = useMemo(
    () =>
      txs
        .filter((t) => {
          if (type !== 'all' && t.type !== type) return false;
          if (catIds.length > 0 && !catIds.includes(t.categoryId)) return false;
          if (accIds.length > 0 && !accIds.includes(t.accountId)) return false;
          if (dateStart && t.date < dateStart) return false;
          if (dateEnd && t.date > dateEnd) return false;
          if (q) {
            const meta = `${t.note ?? ''} ${t.location ?? ''} ${payMethodLabel(t.payMethod)}`;
            if (!meta.includes(q)) return false;
          }
          return true;
        })
        .sort(sortTx),
    [txs, type, catIds, accIds, q, dateStart, dateEnd],
  );

  // 筛选条件变化时回到第一页
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, catIds, accIds, q, dateStart, dateEnd]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const groups = useMemo(() => groupByDate(paged), [paged]);

  const income = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const categoryOptions = useMemo(
    () =>
      categories
        .filter((c) => type === 'all' || c.type === type)
        .map((c) => ({ key: c.id, label: `${c.icon} ${c.name}` })),
    [categories, type],
  );

  const accountOptions = useMemo(
    () => accounts.map((a) => ({ key: a.id, label: `${a.icon} ${a.name}` })),
    [accounts],
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">流水明细</h1>
          <p className="page-desc">
            共 {filtered.length} 笔 · 收入 {formatMoney(income, settings)} · 支出{' '}
            {formatMoney(expense, settings)}
          </p>
        </div>
        <Button type="primary" onClick={() => openRecord()}>
          ＋ 记一笔
        </Button>
      </div>

      <Card className="filter-card">
        <div className="filter-row">
          <div className="type-toggle small">
            {(['all', 'expense', 'income'] as TypeFilter[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`type-btn ${
                  type === t
                    ? t === 'expense'
                      ? 'active expense'
                      : t === 'income'
                        ? 'active income'
                        : 'active'
                    : ''
                }`}
                onClick={() => {
                  setType(t);
                  setCatIds([]);
                }}
              >
                {t === 'all' ? '全部' : t === 'expense' ? '支出' : '收入'}
              </button>
            ))}
          </div>
          <div className="filter-selects">
            <MultiSelect values={catIds} onChange={setCatIds} options={categoryOptions} allLabel="全部分类" />
            <MultiSelect values={accIds} onChange={setAccIds} options={accountOptions} allLabel="全部账户" />
            <div className="search-box">
              <Input
                placeholder="搜索说明/地点"
                allowClear
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </div>
        {/* 日期区间筛选 */}
        <div className="filter-row" style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="date-native"
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              style={{ fontSize: 13, padding: '5px 10px', minWidth: 130 }}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ac-sub)' }}>~</span>
            <input
              className="date-native"
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              style={{ fontSize: 13, padding: '5px 10px', minWidth: 130 }}
            />
            {(dateStart || dateEnd) && (
              <Button
                size="small"
                type="dashed"
                onClick={() => {
                  setDateStart('');
                  setDateEnd('');
                }}
              >
                清除
              </Button>
            )}
          </div>
        </div>
      </Card>

      <TxGrouped
        groups={groups}
        categories={categories}
        accounts={accounts}
        settings={settings}
        onEdit={openRecord}
        onDelete={setDelTarget}
        emptyText="没有符合条件的账目"
      />

      {/* 分页 */}
      {totalPages > 1 && (
        <div
          className="pagination"
        >
          <Button
            size="small"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← 上一页
          </Button>
          <span className="pagination-info">
            第 {page} / {totalPages} 页（共 {filtered.length} 笔）
          </span>
          <Button
            size="small"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页 →
          </Button>
        </div>
      )}

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