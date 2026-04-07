type ProgressBarProps = {
  current: number;
  total: number;
};

export function ProgressBar({ current, total }: ProgressBarProps) {
  const progress = Math.max(0, Math.min(100, (current / total) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-muted">
        <span>Progress</span>
        <span>
          {current}/{total}
        </span>
      </div>
      <div className="h-2 border border-black bg-transparent">
        <div
          className="h-full bg-black transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
