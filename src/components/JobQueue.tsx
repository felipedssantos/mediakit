import { JobCard } from "./JobCard";
import type { Job } from "../types/job";

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
  emptyDetail = "Assim que você iniciar a conversão, cada vídeo aparece aqui com o progresso ao vivo.",
}: JobQueueProps) {
  if (jobs.length === 0) {
    return (
      <div
        className={`flex flex-col items-start justify-center border border-dashed border-steel-dim px-4 py-8 ${
          fill ? "h-full min-h-0 flex-1" : ""
        }`}
      >
        <span className="stamp text-paint-faint">Fila vazia</span>
        <p className="mt-2 text-sm leading-6 text-paint-dim">
          {emptyDetail}
        </p>
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
        .map(({ job, line }) => (
          <JobCard
            key={job.id}
            job={job}
            line={line}
            onCancel={onCancel}
            onRetry={onRetry}
          />
        ))}
    </div>
  );
}
