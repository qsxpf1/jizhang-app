import { useMemo, useRef, useState } from 'react';
import { Button, Card, Divider, Input, Modal, Switch } from 'animal-island-ui';
import type { Category, CategoryGroup } from '../types';
import { useBookStore } from '../store/useBookStore';
import { useAuthStore } from '../store/useAuthStore';
import { dateStr } from '../utils/calc';
import { downloadJSON } from '../utils/storage';
import CategoryModal from '../components/CategoryModal';
import CategoryGroupModal from '../components/CategoryGroupModal';

export default function Settings() {
  const settings = useBookStore((s) => s.settings);
  const categories = useBookStore((s) => s.categories);
  const categoryGroups = useBookStore((s) => s.categoryGroups);
  const txs = useBookStore((s) => s.txs);
  const updateSettings = useBookStore((s) => s.updateSettings);
  const deleteCategory = useBookStore((s) => s.deleteCategory);
  const deleteCategoryGroup = useBookStore((s) => s.deleteCategoryGroup);
  const username = useAuthStore((s) => s.username);
  const logout = useAuthStore((s) => s.logout);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense');
  const [delCat, setDelCat] = useState<Category | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CategoryGroup | null>(null);
  const [newGroupType, setNewGroupType] = useState<'expense' | 'income'>('expense');
  const [delGroup, setDelGroup] = useState<CategoryGroup | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const exportData = () => {
    const st = useBookStore.getState();
    downloadJSON(`岛屿记账-${dateStr(new Date())}.json`, {
      app: 'jizhang-app',
      version: 1,
      exportedAt: Date.now(),
      accounts: st.accounts,
      categories: st.categories,
      categoryGroups: st.categoryGroups,
      txs: st.txs,
      transfers: st.transfers,
      budgets: st.budgets,
      goals: st.goals,
      settings: st.settings,
    });
  };

  const onImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data.txs) || !Array.isArray(data.categories)) {
          throw new Error('bad format');
        }
        await useBookStore.getState().importData({
          accounts: data.accounts,
          categories: data.categories,
          categoryGroups: data.categoryGroups,
          txs: data.txs,
          transfers: data.transfers,
          budgets: data.budgets,
          goals: data.goals,
          settings: data.settings,
        });
        setImportMsg('✓ 导入成功');
      } catch {
        setImportMsg('⚠️ 保存失败');
      }
      window.setTimeout(() => setImportMsg(''), 3000);
    };
    reader.readAsText(file);
  };

  const expenseCats = useMemo(
    () => categories.filter((c) => c.type === 'expense').sort((a, b) => a.sort - b.sort),
    [categories],
  );
  const incomeCats = useMemo(
    () => categories.filter((c) => c.type === 'income').sort((a, b) => a.sort - b.sort),
    [categories],
  );
  const expenseGroups = useMemo(
    () => categoryGroups.filter((g) => g.type === 'expense').sort((a, b) => a.sort - b.sort),
    [categoryGroups],
  );

  const countOf = (id: string) => txs.filter((t) => t.categoryId === id).length;
  const groupCountOf = (id: string) => categories.filter((c) => c.groupId === id).length;

  const openAddCat = (type: 'expense' | 'income') => {
    setNewCatType(type);
    setEditingCat(null);
    setCatModalOpen(true);
  };

  const openAddGroup = (type: 'expense' | 'income') => {
    setNewGroupType(type);
    setEditingGroup(null);
    setGroupModalOpen(true);
  };

  return (
    <div className="page">
      <h1 className="page-title">设置</h1>
      <p className="page-desc">偏好、分类与数据</p>
      <Divider type="wave-yellow" className="mt16" />

      <div className="section-label">账号</div>
      <Card>
        <div className="settings-row">
          <div className="grow">
            <div className="settings-name">👤 {username}</div>
            <div className="settings-desc">当前登录账号，各账号数据相互隔离</div>
          </div>
          <Button danger onClick={() => logout()}>
            退出登录
          </Button>
        </div>
      </Card>

      <Card className="mt16">
        <div className="settings-row">
          <div className="grow">
            <div className="settings-name">🏝️ 岛主名</div>
            <div className="settings-desc">首页问候语中显示的名字</div>
          </div>
        </div>
        <Input
          className="mt8"
          value={settings.firstName}
          maxLength={12}
          placeholder="岛主名"
          onChange={(e) => updateSettings({ firstName: e.target.value })}
        />
      </Card>

      <div className="section-label">大类管理</div>
      <Card>
        <div className="cat-manage-head">
          <span>支出大类</span>
          <Button size="small" type="dashed" onClick={() => openAddGroup('expense')}>
            ＋ 新增大类
          </Button>
        </div>
        {expenseGroups.length === 0 && <p className="empty">暂无支出大类</p>}
        {expenseGroups.map((g) => (
          <div key={g.id} className="cat-manage-item">
            <span className="cat-icon-sm" style={{ background: g.color }}>
              {g.icon}
            </span>
            <span className="grow">
              {g.name}
              {groupCountOf(g.id) > 0 ? `（${groupCountOf(g.id)}个分类）` : ''}
            </span>
            <button
              type="button"
              aria-label="编辑大类"
              onClick={() => {
                setEditingGroup(g);
                setGroupModalOpen(true);
              }}
            >
              ✏️
            </button>
            <button type="button" aria-label="删除大类" onClick={() => setDelGroup(g)}>
              🗑
            </button>
          </div>
        ))}
      </Card>

      <div className="section-label">分类管理</div>
      <Card>
        <div className="cat-manage">
          <div className="cat-manage-col">
            <div className="cat-manage-head">
              <span>支出分类</span>
              <Button size="small" type="dashed" onClick={() => openAddCat('expense')}>
                ＋ 新增
              </Button>
            </div>
            {expenseCats.map((c) => (
              <div key={c.id} className="cat-manage-item">
                <span className="cat-icon-sm" style={{ background: c.color }}>
                  {c.icon}
                </span>
                <span className="grow">
                  {c.name}
                  {countOf(c.id) > 0 ? `（${countOf(c.id)}笔）` : ''}
                </span>
                <button
                  type="button"
                  aria-label="编辑"
                  onClick={() => {
                    setEditingCat(c);
                    setCatModalOpen(true);
                  }}
                >
                  ✏️
                </button>
                <button type="button" aria-label="删除" onClick={() => setDelCat(c)}>
                  🗑
                </button>
              </div>
            ))}
            {expenseCats.length === 0 && <p className="empty">暂无支出分类</p>}
          </div>

          <div className="cat-manage-col">
            <div className="cat-manage-head">
              <span>收入分类</span>
              <Button size="small" type="dashed" onClick={() => openAddCat('income')}>
                ＋ 新增
              </Button>
            </div>
            {incomeCats.map((c) => (
              <div key={c.id} className="cat-manage-item">
                <span className="cat-icon-sm" style={{ background: c.color }}>
                  {c.icon}
                </span>
                <span className="grow">
                  {c.name}
                  {countOf(c.id) > 0 ? `（${countOf(c.id)}笔）` : ''}
                </span>
                <button
                  type="button"
                  aria-label="编辑"
                  onClick={() => {
                    setEditingCat(c);
                    setCatModalOpen(true);
                  }}
                >
                  ✏️
                </button>
                <button type="button" aria-label="删除" onClick={() => setDelCat(c)}>
                  🗑
                </button>
              </div>
            ))}
            {incomeCats.length === 0 && <p className="empty">暂无收入分类</p>}
          </div>
        </div>
      </Card>

      <div className="section-label">数据</div>
      <Card>
        <div className="data-actions">
          <Button onClick={exportData}>⬇️ 导出备份</Button>
          <Button onClick={() => fileRef.current?.click()}>⬆️ 导入备份</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = '';
            }}
          />
          <Button type="dashed" onClick={() => setSeedOpen(true)}>
            🔄 重新导入示例
          </Button>
          <Button danger onClick={() => setResetOpen(true)}>
            🗑 清空全部
          </Button>
        </div>
        {importMsg && <p className="form-tip mt8">{importMsg}</p>}
        <p className="form-tip mt8">备份为本地 JSON 文件；换设备/清缓存后可重新导入。</p>
      </Card>

      <CategoryModal
        open={catModalOpen}
        editing={editingCat}
        defaultType={newCatType}
        onClose={() => setCatModalOpen(false)}
      />

      <CategoryGroupModal
        open={groupModalOpen}
        editing={editingGroup}
        defaultType={newGroupType}
        onClose={() => setGroupModalOpen(false)}
      />

      <Modal
        open={resetOpen}
        title="清空全部数据？"
        onClose={() => setResetOpen(false)}
        typewriter={false}
        footer={
          <>
            <Button type="text" onClick={() => setResetOpen(false)}>
              取消
            </Button>
            <Button
              type="primary"
              danger
              onClick={async () => {
                await useBookStore.getState().resetAll();
                setResetOpen(false);
              }}
            >
              清空
            </Button>
          </>
        }
      >
        将恢复默认分类与账户，并删除全部账目、预算、目标。此操作不可撤销！
      </Modal>

      <Modal
        open={seedOpen}
        title="重新导入示例数据？"
        onClose={() => setSeedOpen(false)}
        typewriter={false}
        footer={
          <>
            <Button type="text" onClick={() => setSeedOpen(false)}>
              取消
            </Button>
            <Button
              type="primary"
              onClick={async () => {
                await useBookStore.getState().seedDemo();
                setSeedOpen(false);
              }}
            >
              导入
            </Button>
          </>
        }
      >
        将导入一组近 3 个月的示例账目（仅当当前没有任何账目时生效）。确定？
      </Modal>

      <Modal
        open={delCat !== null}
        title="删除分类？"
        onClose={() => setDelCat(null)}
        typewriter={false}
        footer={
          <>
            <Button type="text" onClick={() => setDelCat(null)}>
              取消
            </Button>
            <Button
              type="primary"
              danger
              onClick={() => {
                if (delCat) deleteCategory(delCat.id);
                setDelCat(null);
              }}
            >
              删除
            </Button>
          </>
        }
      >
        {delCat && countOf(delCat.id) > 0 ? (
          <>
            该分类下有 {countOf(delCat.id)} 笔账目，删除后这些账目将显示为「未知」，相关预算会一并删除。确定删除？
          </>
        ) : (
          '确定删除该分类？'
        )}
      </Modal>

      <Modal
        open={delGroup !== null}
        title="删除大类？"
        onClose={() => setDelGroup(null)}
        typewriter={false}
        footer={
          <>
            <Button type="text" onClick={() => setDelGroup(null)}>
              取消
            </Button>
            <Button
              type="primary"
              danger
              onClick={() => {
                if (delGroup) deleteCategoryGroup(delGroup.id);
                setDelGroup(null);
              }}
            >
              删除
            </Button>
          </>
        }
      >
        {delGroup && groupCountOf(delGroup.id) > 0 ? (
          <>
            该大类下有 {groupCountOf(delGroup.id)} 个分类，删除后这些分类将不再归属任何大类。确定删除？
          </>
        ) : (
          '确定删除该大类？'
        )}
      </Modal>
    </div>
  );
}
