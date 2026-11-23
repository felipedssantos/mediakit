import type { ReactNode } from "react";

import { ptBR } from "../i18n/pt-BR";

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
  if (jobs.length === 0) {
    return (
      <div
        className={`flex flex-col items-start justify-center border border-dashed border-steel-dim px-4 py-8 ${
          fill ? "h-full min-h-0 flex-1" : ""
        }`}
      >
        <span className="stamp text-paint-faint">{ptBR.common.emptyQueue}</span>
        <p className="mt-2 text-sm leading-6 text-paint-dim">{emptyDetail}</p>
      </div>
    );
  }

  return (
    <div
      className={`border-t border-rule ${fill ? "min-h-0 flex-1 overflow-y-auto" : ""}`}
    >
      {jobs
        .map((job, index) => ({ job, line: index + 1 }))
        .reverse()
        .map(({ job, line }) => renderItem(job, line))}
    </div>
  );
}
