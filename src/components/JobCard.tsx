import { useT } from "../hooks/useLocale";
import { IMAGE_PRESETS, type ImagePresetId } from "../lib/imagePresets";
import { PRESETS, fileNameFromPath, type PresetId } from "../lib/presets";
import type { Job } from "../types/job";
import { JobCardBase } from "./JobCardBase";

interface JobCardProps {
  job: Job;
  line: number;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

export function JobCard({ job, line, onCancel, onRetry }: JobCardProps) {
  const t = useT();
  const presetId = job.options.preset_id;
  const videoPreset = PRESETS.find((item) => item.id === presetId);
  const imagePreset = IMAGE_PRESETS.find((item) => item.id === presetId);
  const presetLabel = videoPreset
    ? t.presets[videoPreset.id as PresetId].label
    : imagePreset
      ? t.imagePresets[imagePreset.id as ImagePresetId].label
      : presetId;

  const resolutionLabel =
    !job.options.resolution || job.options.resolution === "original"
      ? t.common.originalSize
      : job.options.resolution;

  const target =
    job.options.container?.toUpperCase() ??
    (job.options.image_format
      ? job.options.image_format.toUpperCase()
      : undefined);

  const detail = [
    presetLabel,
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
