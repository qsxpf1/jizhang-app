import { Card } from 'animal-island-ui';
import type { Account, Category, Settings, Tx } from '../types';
import { payMethodLabel } from '../data/payMethods';
import type { TxGroup } from '../utils/calc';
import { formatMoney } from '../utils/money';

interface Props {
  groups: TxGroup[];
  categories: Category[];
  accounts: Account[];
  settings: Settings;
  onEdit: (tx: Tx) => void;
  onDelete: (tx: Tx) => void;
  emptyText?: string;
}

/** 按日期分组的流水渲染（首页 / 流水页共用） */
export default function TxGrouped({
  groups,
  categories,
  accounts,
  settings,
  onEdit,
  onDelete,
  emptyText = '暂无账目',
}: Props) {
  const catOf = (id: string) => categories.find((c) => c.id === id);
  const accOf = (id: string) => accounts.find((a) => a.id === id);

  if (groups.length === 0) {
    return (
      <Card type="dashed" className="mt16">
        <p className="empty">{emptyText}</p>
      </Card>
    );
  }

  return (
    <>
      {groups.map((g) => (
        <Card key={g.date} className="mt16">
          <div className="tx-day-head">
            <span className="tx-day">{g.date}</span>
            <span className="tx-day-sum">
              {g.income > 0 && (
                <span className="income">收 {formatMoney(g.income, settings)}</span>
              )}
              {g.expense > 0 && (
                <span className="expense">支 {formatMoney(g.expense, settings)}</span>
              )}
            </span>
          </div>
          <ul className="tx-list">
            {g.list.map((t) => (
              <li key={t.id} className="tx-item">
                <button type="button" className="tx-item-main" onClick={() => onEdit(t)}>
                  <span className="tx-icon">{catOf(t.categoryId)?.icon ?? '❓'}</span>
                  <span className="tx-info">
                    <span className="tx-cat">{catOf(t.categoryId)?.name ?? '未知'}</span>
                    <span className="tx-date">
                      {accOf(t.accountId)?.name ?? '未知'}
                      {t.time ? ` · ${t.time}` : ''}
                      {t.payMethod ? ` · ${payMethodLabel(t.payMethod)}` : ''}
                    </span>
                    {t.location && <span className="tx-location">📍 {t.location}</span>}
                    {t.note && <span className="tx-note">{t.note}</span>}
                  </span>
                  <span className={t.type === 'income' ? 'tx-amt income' : 'tx-amt expense'}>
                    {formatMoney(t.amount, settings)}
                  </span>
                </button>
                <button
                  type="button"
                  className="tx-del"
                  aria-label="删除"
                  onClick={() => onDelete(t)}
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </>
  );
}
