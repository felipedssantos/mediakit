interface ProgressBarProps {
  value: number;
  tone?: "lamp" | "cleared" | "fault";
  active?: boolean;
}

const TONE = {
  lamp: "bg-accent",
  cleared: "bg-ok",
  fault: "bg-danger",
} as const;

export function ProgressBar({
  value,
  tone = "lamp",
  active = false,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className="relative h-2 w-full overflow-hidden rounded-full bg-elevated ring-1 ring-line"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`ui-progress relative h-full w-full overflow-hidden rounded-full ${TONE[tone]} ${
          active ? "progress-shimmer" : ""
        }`}
        style={{ transform: `scaleX(${clamped / 100})` }}
      />
    </div>
  );
}
