import { useMemo, useState } from 'react';
import { Button, Card, Input, Modal, Select } from 'animal-island-ui';
import type { Tx, TxType } from '../types';
import { useBookStore } from '../store/useBookStore';
import { useUiStore } from '../store/useUiStore';
import { groupByDate, sortTx } from '../utils/calc';
import { formatMoney } from '../utils/money';
import { payMethodLabel } from '../data/payMethods';
import TxGrouped from '../components/TxGrouped';

type TypeFilter = 'all' | TxType;

export default function List() {
  const txs = useBookStore((s) => s.txs);
  const categories = useBookStore((s) => s.categories);
  const accounts = useBookStore((s) => s.accounts);
  const settings = useBookStore((s) => s.settings);
  const deleteTx = useBookStore((s) => s.deleteTx);
  const openRecord = useUiStore((s) => s.openRecord);

  const [type, setType] = useState<TypeFilter>('all');
  const [catId, setCatId] = useState('all');
  const [accId, setAccId] = useState('all');
  const [q, setQ] = useState('');
  const [delTarget, setDelTarget] = useState<Tx | null>(null);

  const filtered = useMemo(
    () =>
      txs
        .filter((t) => {
          if (type !== 'all' && t.type !== type) return false;
          if (catId !== 'all' && t.categoryId !== catId) return false;
          if (accId !== 'all' && t.accountId !== accId) return false;
          if (q) {
            const meta = `${t.note ?? ''} ${t.location ?? ''} ${payMethodLabel(t.payMethod)}`;
            if (!meta.includes(q)) return false;
          }
          return true;
        })
        .sort(sortTx),
    [txs, type, catId, accId, q],
  );

  const income = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const categoryOptions = useMemo(
    () => [
      { key: 'all', label: '全部分类' },
      ...categories
        .filter((c) => type === 'all' || c.type === type)
        .map((c) => ({ key: c.id, label: `${c.icon} ${c.name}` })),
    ],
    [categories, type],
  );

  const accountOptions = useMemo(
    () => [
      { key: 'all', label: '全部账户' },
      ...accounts.map((a) => ({ key: a.id, label: `${a.icon} ${a.name}` })),
    ],
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
                  setCatId('all');
                }}
              >
                {t === 'all' ? '全部' : t === 'expense' ? '支出' : '收入'}
              </button>
            ))}
          </div>
          <div className="filter-selects">
            <Select value={catId} onChange={setCatId} options={categoryOptions} />
            <Select value={accId} onChange={setAccId} options={accountOptions} />
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
