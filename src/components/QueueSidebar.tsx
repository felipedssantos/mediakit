import type { ReactNode } from "react";

interface QueueSidebarProps {
  title: string;
  count: number;
  children: ReactNode;
}

export function QueueSidebar({ title, count, children }: QueueSidebarProps) {
  return (
    <aside className="flex min-h-0 flex-col border-t border-line bg-surface/70 lg:border-l lg:border-t-0">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <span className="mono-num rounded-full border border-line bg-elevated px-2 py-0.5 text-xs font-semibold text-ink-2">
          {count}
        </span>
      </div>
      {children}
    </aside>
  );
}
