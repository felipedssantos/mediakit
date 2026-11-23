import { FolderOpen, RotateCcw, X } from "lucide-react";

import { JobRow, RowAction } from "./JobRow";
import { BOARD_STATUS } from "../lib/boardStatus";
import { IMAGE_PRESETS } from "../lib/imagePresets";
import { PRESETS, fileNameFromPath } from "../lib/presets";
import { revealPath } from "../lib/tauri";
import type { Job } from "../types/job";

interface JobCardProps {
  job: Job;
  line: number;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

export function JobCard({ job, line, onCancel, onRetry }: JobCardProps) {
  const canCancel = job.status === "queued" || job.status === "running";
  const canRetry = job.status === "failed" || job.status === "cancelled";
  const preset =
    PRESETS.find((item) => item.id === job.options.preset_id) ??
    IMAGE_PRESETS.find((item) => item.id === job.options.preset_id);

  const resolutionLabel =
    !job.options.resolution || job.options.resolution === "original"
      ? "tamanho original"
      : job.options.resolution;

  const target =
    job.options.container?.toUpperCase() ??
    (job.options.image_format
      ? job.options.image_format.toUpperCase()
      : undefined);

  const detail = [
    preset?.label ?? job.options.preset_id,
    target,
    resolutionLabel,
    fileNameFromPath(job.output_path),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <JobRow
      line={line}
      title={fileNameFromPath(job.input_path)}
      detail={detail}
      status={BOARD_STATUS[job.status]}
      progress={job.progress}
      speed={job.speed ?? null}
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
            <RowAction onClick={() => void revealPath(job.output_path)}>
              <FolderOpen size={12} />
              Abrir pasta
            </RowAction>
          )}
        </>
      }
    />
  );
}
