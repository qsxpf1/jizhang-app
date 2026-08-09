import { useEffect, useState } from 'react';
import { useBookStore } from '../store/useBookStore';

/** 保存结果 toast：写入数据库成功/失败/版本冲突后短暂提示（动森风，固定顶部居中） */
export default function SaveToast() {
  const saveStatus = useBookStore((s) => s.saveStatus);
  const saveError = useBookStore((s) => s.saveError);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (saveStatus !== 'success' && saveStatus !== 'error' && saveStatus !== 'conflict') return;
    setShow(true);
    const t = window.setTimeout(() => {
      setShow(false);
      useBookStore.setState({ saveStatus: 'idle', saveError: null });
    }, 2200);
    return () => window.clearTimeout(t);
  }, [saveStatus]);

  let text = '✅ 记录成功';
  let kind = 'success';
  if (saveStatus === 'error') {
    text = '⚠️ 保存失败';
    kind = 'error';
  } else if (saveStatus === 'conflict') {
    text = '🔄 另一台设备已修改，已刷新最新数据';
    kind = 'conflict';
  }

  return (
    <div
      className={`save-toast ${kind} ${show ? 'show' : ''}`}
      role="status"
      title={kind !== 'success' && saveError ? saveError : undefined}
    >
      {text}
    </div>
  );
}
