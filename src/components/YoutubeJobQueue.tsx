import { ptBR } from "../i18n/pt-BR";
import type { YoutubeDownloadJob } from "../types/youtube";
import { JobQueueList } from "./JobQueueList";
import { YoutubeJobCard } from "./YoutubeJobCard";

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
  return (
    <JobQueueList
      jobs={jobs}
      fill
      emptyDetail={ptBR.youtube.queueEmpty}
      renderItem={(job, line) => (
        <YoutubeJobCard
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
