import { FolderOpen, RotateCcw, X } from "lucide-react";

import { JobRow, RowAction } from "./JobRow";
import { BOARD_STATUS } from "../lib/boardStatus";
import { revealPath } from "../lib/tauri";
import type { YoutubeDownloadJob } from "../types/youtube";

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
  const canCancel = job.status === "queued" || job.status === "running";
  const canRetry = job.status === "failed" || job.status === "cancelled";
  const openPath = job.output_path ?? job.output_dir;
  const status = BOARD_STATUS[job.status];

  const finalizing = job.status === "running" && job.speed === "finalizando";
  const statusLabel = finalizing
    ? "Juntando"
    : job.status === "running"
      ? "Baixando"
      : status.label;

  const detail =
    job.options.mode === "audio"
      ? `Áudio ${job.options.audio_format.toUpperCase()}`
      : `Vídeo ${job.options.quality === "best" ? "melhor disponível" : job.options.quality}`;

  return (
    <JobRow
      line={line}
      title={job.title}
      detail={detail}
      status={status}
      statusLabel={statusLabel}
      progress={job.progress}
      speed={
        job.status === "running"
          ? job.speed === "finalizando"
            ? "juntando arquivo"
            : job.speed
          : null
      }
      error={job.error}
      actions={
        <>
          {canCancel && (
            <RowAction danger onClick={() => onCancel(job.id)}>
              <X size={12} />
              Cancelar
            </RowAction>
          )}
          {canRetry && (
            <RowAction onClick={() => onRetry(job.id)}>
              <RotateCcw size={12} />
              De novo
            </RowAction>
          )}
          {job.status === "completed" && (
            <RowAction onClick={() => void revealPath(openPath)}>
              <FolderOpen size={12} />
              Abrir pasta
            </RowAction>
          )}
        </>
      }
    />
  );
}
