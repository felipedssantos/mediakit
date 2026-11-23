interface ProgressBarProps {
  value: number;
  tone?: "lamp" | "cleared" | "fault";
}

const TONE = {
  lamp: "bg-lamp",
  cleared: "bg-cleared",
  fault: "bg-fault",
} as const;

export function ProgressBar({ value, tone = "lamp" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-[3px] w-full overflow-hidden bg-steel-dim"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`board-progress h-full w-full ${TONE[tone]}`}
        style={{ transform: `scaleX(${clamped / 100})` }}
      />
    </div>
  );
}
