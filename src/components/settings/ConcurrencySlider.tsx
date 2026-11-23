import { ptBR } from "../../i18n/pt-BR";

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
  return (
    <div className={className}>
      <label className="flex items-baseline justify-between gap-3">
        <span className="stamp text-paint-dim">
          {ptBR.common.concurrencyLabel}
        </span>
        <span className="cell text-[11px] text-lamp">{value}</span>
      </label>
      <input
        type="range"
        min={1}
        max={4}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 w-full accent-lamp"
      />
    </div>
  );
}
