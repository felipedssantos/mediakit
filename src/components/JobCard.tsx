import { ptBR } from "../i18n/pt-BR";
import { IMAGE_PRESETS } from "../lib/imagePresets";
import { PRESETS, fileNameFromPath } from "../lib/presets";
import type { Job } from "../types/job";
import { JobCardBase } from "./JobCardBase";

interface JobCardProps {
  job: Job;
  line: number;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

export function JobCard({ job, line, onCancel, onRetry }: JobCardProps) {
  const preset =
    PRESETS.find((item) => item.id === job.options.preset_id) ??
    IMAGE_PRESETS.find((item) => item.id === job.options.preset_id);

  const resolutionLabel =
    !job.options.resolution || job.options.resolution === "original"
      ? ptBR.common.originalSize
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
    <JobCardBase
      id={job.id}
      line={line}
      title={fileNameFromPath(job.input_path)}
      detail={detail}
      jobStatus={job.status}
      progress={job.progress}
      speed={job.speed ?? null}
      error={job.error}
      revealTarget={job.output_path}
      onCancel={onCancel}
      onRetry={onRetry}
    />
  );
}
