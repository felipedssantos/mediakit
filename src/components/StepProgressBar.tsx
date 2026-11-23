import { Check } from "lucide-react";

interface StepProgressBarProps {
  ariaLabel: string;
  steps: [string, string, string];
  firstStepDone: boolean;
}

export function StepProgressBar({
  ariaLabel,
  steps,
  firstStepDone,
}: StepProgressBarProps) {
  const [step1, step2, step3] = steps;

  return (
    <ol
      aria-label={ariaLabel}
      className="hidden items-center gap-2 rounded-xl border border-line bg-inset px-3 py-1.5 text-xs xl:flex"
    >
      <li className="flex items-center gap-1.5">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
            firstStepDone
              ? "bg-ok text-accent-ink"
              : "bg-accent text-accent-ink"
          }`}
        >
          {firstStepDone ? <Check size={11} /> : "1"}
        </span>
        <span
          className={
            firstStepDone ? "font-medium text-ok" : "font-semibold text-ink"
          }
        >
          {step1}
        </span>
      </li>
      <span className="h-px w-4 bg-line-strong" />
      <li className="flex items-center gap-1.5">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
            firstStepDone
              ? "bg-accent text-accent-ink"
              : "bg-elevated text-ink-3"
          }`}
        >
          2
        </span>
        <span className={firstStepDone ? "font-semibold text-ink" : "text-ink-3"}>
          {step2}
        </span>
      </li>
      <span className="h-px w-4 bg-line-strong" />
      <li className="flex items-center gap-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-elevated text-[10px] font-bold text-ink-3">
          3
        </span>
        <span className="text-ink-3">{step3}</span>
      </li>
    </ol>
  );
}
