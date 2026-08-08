import { useMemo, useState } from 'react';
import { Button, Card, Modal } from 'animal-island-ui';
import type { Account } from '../types';
import { useBookStore } from '../store/useBookStore';
import { getAccountBalance } from '../utils/calc';
import { formatMoney } from '../utils/money';
import AccountModal from '../components/AccountModal';
import TransferModal from '../components/TransferModal';

export default function Accounts() {
  const accounts = useBookStore((s) => s.accounts);
  const txs = useBookStore((s) => s.txs);
  const transfers = useBookStore((s) => s.transfers);
  const settings = useBookStore((s) => s.settings);
  const deleteAccount = useBookStore((s) => s.deleteAccount);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [delTarget, setDelTarget] = useState<Account | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const total = useMemo(
    () =>
      accounts.reduce(
        (s, a) => s + getAccountBalance(a.id, accounts, txs, transfers),
        0,
      ),
    [accounts, txs, transfers],
  );

  const txCountOf = (id: string) =>
    txs.filter((t) => t.accountId === id).length +
    transfers.filter((tr) => tr.fromAccountId === id || tr.toAccountId === id).length;

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (a: Account) => {
    setEditing(a);
    setModalOpen(true);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">账户</h1>
          <p className="page-desc">资产总计 {formatMoney(total, settings)}</p>
        </div>
        <div className="row">
          <Button onClick={() => setTransferOpen(true)}>⇄ 转账</Button>
          <Button type="primary" onClick={openAdd}>
            ＋ 新增账户
          </Button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <Card type="dashed">
          <p className="empty">还没有账户，点右上角新增一个吧</p>
        </Card>
      ) : (
        <div className="acc-grid">
          {accounts.map((a) => {
            const bal = getAccountBalance(a.id, accounts, txs, transfers);
            return (
              <Card key={a.id} color={a.color}>
                <div className="acc-card">
                  <div className="acc-card-top">
                    <span className="acc-icon">{a.icon}</span>
                    <span className="acc-name">{a.name}</span>
                  </div>
                  <div className="acc-balance">{formatMoney(bal, settings)}</div>
                  <div className="acc-actions">
                    <button type="button" onClick={() => openEdit(a)}>
                      编辑
                    </button>
                    <button
                      type="button"
                      className="danger-text"
                      onClick={() => setDelTarget(a)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AccountModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} />
      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} />

      <Modal
        open={delTarget !== null}
        title="删除账户？"
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
                if (delTarget) deleteAccount(delTarget.id);
                setDelTarget(null);
              }}
            >
              删除
            </Button>
          </>
        }
      >
        {delTarget && txCountOf(delTarget.id) > 0 ? (
          <>
            该账户下有 {txCountOf(delTarget.id)} 笔记录，删除后这些记录的账户将显示为
            「未知」。确定删除？
          </>
        ) : (
          '确定删除该账户？'
        )}
      </Modal>
    </div>
  );
}
