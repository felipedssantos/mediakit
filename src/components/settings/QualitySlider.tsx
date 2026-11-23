import { useT } from "../../hooks/useLocale";

interface QualitySliderProps {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
}

export function QualitySlider({
  value,
  min,
  max,
  label,
  onChange,
}: QualitySliderProps) {
  const t = useT();
  return (
    <div>
      <label className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-ink-2">
          {t.common.qualityLabel}
        </span>
        <span className="mono-num text-xs font-medium text-accent">
          {value} · {label}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-accent"
      />
    </div>
  );
}
