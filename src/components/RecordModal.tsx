import { useEffect, useState } from 'react';
import { Modal } from 'animal-island-ui';
import { useBookStore } from '../store/useBookStore';
import { useUiStore } from '../store/useUiStore';
import RecordForm from './RecordForm';

/** 记一笔 / 编辑账目弹窗（全局唯一，由 uiStore 控制） */
export default function RecordModal() {
  const open = useUiStore((s) => s.recordOpen);
  const editing = useUiStore((s) => s.editingTx);
  const close = useUiStore((s) => s.closeRecord);
  const addTx = useBookStore((s) => s.addTx);
  const updateTx = useBookStore((s) => s.updateTx);

  // 每次打开都重新挂载表单，保证新增/编辑状态干净
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (open) setFormKey((k) => k + 1);
  }, [open]);

  return (
    <Modal
      open={open}
      title={editing ? '编辑账目' : '记一笔'}
      width={600}
      onClose={close}
      typewriter={false}
      footer={null}
    >
      <RecordForm
        key={`${formKey}-${editing?.id ?? 'new'}`}
        editing={editing}
        showCancel
        onCancel={close}
        autoFocusAmount={!editing}
        onSubmit={(p) => {
          if (editing) updateTx(editing.id, p);
          else addTx(p);
          close();
        }}
      />
    </Modal>
  );
}
