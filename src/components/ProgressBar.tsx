interface Props {
  /** 0-100 */
  percent: number;
  color?: string;
  /** 轨道高度 px */
  height?: number;
  /** 超支/超额：填充变红 */
  danger?: boolean;
  className?: string;
}

/** 动森风进度条（圆角 + 3D 阴影轨道） */
export default function ProgressBar({
  percent,
  color = '#19c8b9',
  height = 14,
  danger = false,
  className,
}: Props) {
  const pct = Math.min(100, Math.max(0, percent));
  return (
    <div className={className ? `progress-bar ${className}` : 'progress-bar'} style={{ height }}>
      <div
        className="progress-fill"
        style={{
          width: `${pct}%`,
          background: danger ? '#e05a5a' : color,
        }}
      />
    </div>
  );
}
