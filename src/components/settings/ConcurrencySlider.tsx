import { useT } from "../../hooks/useLocale";

interface ConcurrencySliderProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export function ConcurrencySlider({
  value,
  onChange,
  className,
}: ConcurrencySliderProps) {
  const t = useT();
  return (
    <div className={className}>
      <label className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-ink-2">
          {t.common.concurrencyLabel}
        </span>
        <span className="mono-num text-xs font-medium text-accent">{value}</span>
      </label>
      <input
        type="range"
        min={1}
        max={4}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-accent"
      />
    </div>
  );
}
