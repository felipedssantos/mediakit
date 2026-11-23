import { ptBR } from "../../i18n/pt-BR";

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
  return (
    <div>
      <label className="flex items-baseline justify-between gap-3">
        <span className="stamp text-paint-dim">{ptBR.common.qualityLabel}</span>
        <span className="cell text-[11px] text-lamp">
          {value} · {label}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 w-full accent-lamp"
      />
    </div>
  );
}
