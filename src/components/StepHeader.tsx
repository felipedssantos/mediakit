import type { ReactNode } from "react";

interface StepHeaderProps {
  step: string;
  title: string;
  right?: ReactNode;
}

export function StepHeader({ step, title, right }: StepHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="mono-num flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft px-1.5 text-xs font-semibold text-accent">
          {step}
        </span>
        <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
      </div>
      {right}
    </div>
  );
}
