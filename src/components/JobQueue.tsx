import { ptBR } from "../i18n/pt-BR";
import type { Job } from "../types/job";
import { JobCard } from "./JobCard";
import { JobQueueList } from "./JobQueueList";

interface JobQueueProps {
  jobs: Job[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  fill?: boolean;
  emptyDetail?: string;
}

export function JobQueue({
  jobs,
  onCancel,
  onRetry,
  fill,
  emptyDetail = ptBR.converter.queueConvertEmpty,
}: JobQueueProps) {
  return (
    <JobQueueList
      jobs={jobs}
      fill={fill}
      emptyDetail={emptyDetail}
      renderItem={(job, line) => (
        <JobCard
          key={job.id}
          job={job}
          line={line}
          onCancel={onCancel}
          onRetry={onRetry}
        />
      )}
    />
  );
}
