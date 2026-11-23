import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { useT } from "../hooks/useLocale";

interface JobQueueListProps<J extends { id: string }> {
  jobs: J[];
  fill?: boolean;
  emptyDetail: string;
  renderItem: (job: J, line: number) => ReactNode;
}

export function JobQueueList<J extends { id: string }>({
  jobs,
  fill,
  emptyDetail,
  renderItem,
}: JobQueueListProps<J>) {
  const t = useT();
  if (jobs.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-6 text-center ${
          fill ? "h-full min-h-0 flex-1" : ""
        }`}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-elevated text-ink-3">
          <Inbox size={20} />
        </span>
        <p className="mt-3 text-sm font-semibold text-ink">
          {t.common.emptyQueue}
        </p>
        <p className="mt-1 max-w-xs text-xs leading-5 text-ink-2">
          {emptyDetail}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-2.5 p-3 ${fill ? "min-h-0 flex-1 overflow-y-auto" : ""}`}
    >
      {jobs
        .map((job, index) => ({ job, line: index + 1 }))
        .reverse()
        .map(({ job, line }) => renderItem(job, line))}
    </div>
  );
}
