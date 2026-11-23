import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

interface BoardHeaderProps {
  title: string;
  detail: string;
  onBack: () => void;
  action?: ReactNode;
}

export function BoardHeader({
  title,
  detail,
  onBack,
  action,
}: BoardHeaderProps) {
  return (
    <header className="steel flex shrink-0 items-center justify-between gap-4 px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="stamp ink inline-flex shrink-0 items-center gap-1.5 border border-rule bg-void px-2.5 py-1.5 text-paint-dim hover:border-lamp hover:text-lamp"
        >
          <ArrowLeft size={13} />
          Início
        </button>
        <div className="min-w-0 border-l border-rule pl-3">
          <h1 className="truncate text-base font-semibold leading-tight text-paint">
            {title}
          </h1>
          <p className="hidden truncate text-xs text-paint-faint sm:block">
            {detail}
          </p>
        </div>
      </div>
      {action}
    </header>
  );
}
