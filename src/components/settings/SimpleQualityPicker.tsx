import { useT } from "../../hooks/useLocale";

export interface QualityTier {
  id: "smaller" | "balanced" | "high";
  label: string;
  hint: string;
  value: number;
}

interface SimpleQualityPickerProps {
  tiers: QualityTier[];
  activeId: QualityTier["id"];
  onSelect: (value: number) => void;
}

export function SimpleQualityPicker({
  tiers,
  activeId,
  onSelect,
}: SimpleQualityPickerProps) {
  const t = useT();
  return (
    <div>
      <span className="block text-xs font-medium text-ink-2">
        {t.common.qualityLabel}
      </span>
      <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {tiers.map((tier) => {
          const selected = tier.id === activeId;
          return (
            <button
              key={tier.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(tier.value)}
              className={`ui-control rounded-xl border p-3 text-left ${
                selected
                  ? "border-accent bg-accent-soft ring-1 ring-accent/25"
                  : "border-line bg-inset hover:border-line-strong hover:bg-elevated"
              }`}
            >
              <span
                className={`block text-xs font-semibold ${
                  selected ? "text-accent" : "text-ink"
                }`}
              >
                {tier.label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 text-ink-2">
                {tier.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
