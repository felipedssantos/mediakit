import { ptBR } from "../i18n/pt-BR";
import { BOARD_STATUS } from "../lib/boardStatus";
import type { YoutubeDownloadJob } from "../types/youtube";
import { JobCardBase } from "./JobCardBase";

interface YoutubeJobCardProps {
  job: YoutubeDownloadJob;
  line: number;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

export function YoutubeJobCard({
  job,
  line,
  onCancel,
  onRetry,
}: YoutubeJobCardProps) {
  const statusLabel =
    job.status === "running"
      ? ptBR.youtube.cardDownloading
      : BOARD_STATUS[job.status].label;

  const detail =
    job.options.mode === "audio"
      ? ptBR.youtube.cardAudioDetail(job.options.audio_format.toUpperCase())
      : ptBR.youtube.cardVideoDetail(job.options.quality);

  const speed =
    job.status === "finalizing"
      ? ptBR.youtube.cardFinalizingSpeed
      : job.status === "running"
        ? job.speed
        : null;

  return (
    <JobCardBase
      id={job.id}
      line={line}
      title={job.title}
      detail={detail}
      jobStatus={job.status}
      statusLabel={statusLabel}
      progress={job.progress}
      speed={speed}
      error={job.error}
      revealTarget={job.output_path ?? job.output_dir}
      onCancel={onCancel}
      onRetry={onRetry}
    />
  );
}
