import { useT } from "../hooks/useLocale";
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
  emptyDetail,
}: JobQueueProps) {
  const t = useT();
  return (
    <JobQueueList
      jobs={jobs}
      fill={fill}
      emptyDetail={emptyDetail ?? t.converter.queueConvertEmpty}
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
