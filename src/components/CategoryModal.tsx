import { useEffect, useState } from 'react';
import { Button, Input, Modal } from 'animal-island-ui';
import type { Category, TxType } from '../types';
import { useBookStore } from '../store/useBookStore';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../data/colors';

interface Props {
  open: boolean;
  editing: Category | null;
  /** 新增时的默认类型 */
  defaultType: TxType;
  onClose: () => void;
}

/** 新增 / 编辑分类弹窗 */
export default function CategoryModal({ open, editing, defaultType, onClose }: Props) {
  const addCategory = useBookStore((s) => s.addCategory);
  const updateCategory = useBookStore((s) => s.updateCategory);

  const [name, setName] = useState('');
  const [type, setType] = useState<TxType>('expense');
  const [icon, setIcon] = useState(CATEGORY_ICONS[0]);
  const [color, setColor] = useState(CATEGORY_COLORS[0]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setType(editing.type);
      setIcon(editing.icon);
      setColor(editing.color);
    } else {
      setName('');
      setType(defaultType);
      setIcon(CATEGORY_ICONS[0]);
      setColor(CATEGORY_COLORS[0]);
    }
  }, [open, editing, defaultType]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const payload = { name: trimmed, type, icon, color };
    if (editing) updateCategory(editing.id, payload);
    else addCategory({ ...payload, sort: 99, isDefault: false });
    onClose();
  };

  return (
    <Modal
      open={open}
      title={editing ? '编辑分类' : '新增分类'}
      width={480}
      onClose={onClose}
      typewriter={false}
      footer={
        <>
          <Button type="text" onClick={onClose}>
            取消
          </Button>
          <Button type="primary" onClick={save}>
            保存
          </Button>
        </>
      }
    >
      <div className="modal-form">
        <div className="form-label">分类名称</div>
        <Input
          placeholder="例如：宠物"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="form-label">收支类型</div>
        <div className="type-toggle">
          <button
            type="button"
            className={`type-btn ${type === 'expense' ? 'active expense' : ''}`}
            onClick={() => setType('expense')}
          >
            支出
          </button>
          <button
            type="button"
            className={`type-btn ${type === 'income' ? 'active income' : ''}`}
            onClick={() => setType('income')}
          >
            收入
          </button>
        </div>

        <div className="form-label">图标</div>
        <div className="icon-picker">
          {CATEGORY_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              className={icon === ic ? 'icon-opt active' : 'icon-opt'}
              onClick={() => setIcon(ic)}
            >
              {ic}
            </button>
          ))}
        </div>

        <div className="form-label">颜色</div>
        <div className="color-picker">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={color === c ? 'color-opt active' : 'color-opt'}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
