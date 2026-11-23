import { useT } from "../hooks/useLocale";
import { getBoardStatus } from "../lib/boardStatus";
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
  const t = useT();
  const statusLabel =
    job.status === "running"
      ? t.youtube.cardDownloading
      : getBoardStatus(job.status, t).label;

  const detail =
    job.options.mode === "audio"
      ? t.youtube.cardAudioDetail(job.options.audio_format.toUpperCase())
      : t.youtube.cardVideoDetail(job.options.quality);

  const speed =
    job.status === "finalizing"
      ? t.youtube.cardFinalizingSpeed
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
