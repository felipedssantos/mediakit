import { YoutubeJobCard } from "./YoutubeJobCard";
import type { YoutubeDownloadJob } from "../types/youtube";

interface YoutubeJobQueueProps {
  jobs: YoutubeDownloadJob[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

export function YoutubeJobQueue({
  jobs,
  onCancel,
  onRetry,
}: YoutubeJobQueueProps) {
  if (jobs.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-start justify-center border border-dashed border-steel-dim px-4 py-8">
        <span className="stamp text-paint-faint">Fila vazia</span>
        <p className="mt-2 text-sm leading-6 text-paint-dim">
          Cada download aparece aqui com o progresso ao vivo, e você pode
          cancelar a qualquer momento.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto border-t border-rule">
      {jobs
        .map((job, index) => ({ job, line: index + 1 }))
        .reverse()
        .map(({ job, line }) => (
          <YoutubeJobCard
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
