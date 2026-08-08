import { Card, Divider } from 'animal-island-ui';

interface Props {
  title: string;
  desc?: string;
}

/** 建设中占位页，后续阶段逐个替换为真实功能 */
export default function Placeholder({ title, desc }: Props) {
  return (
    <div className="page">
      <h1 className="page-title">{title}</h1>
      <p className="page-desc">{desc ?? '功能建设中，敬请期待…'}</p>
      <Divider type="wave-yellow" className="mt16" />
      <Card type="dashed" className="mt24">
        <div className="building">🔨 正在建设中</div>
      </Card>
    </div>
  );
}
