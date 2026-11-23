export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface StreamInfo {
  codec_type: string;
  codec_name: string;
  width: number | null;
  height: number | null;
  fps: number | null;
  bit_rate: number | null;
}

export interface MediaInfo {
  path: string;
  duration: number;
  size: number;
  format_name: string;
  bit_rate: number | null;
  video: StreamInfo | null;
  audio: StreamInfo | null;
}

export interface EncodeOptions {
  preset_id: string;
  crf?: number | null;
  video_codec?: string | null;
  audio_codec?: string | null;
  audio_bitrate?: string | null;
  resolution?: string | null;
  use_gpu?: boolean | null;
  quality?: number | null;
  image_format?: string | null;
  container?: string | null;
}

export interface Job {
  id: string;
  input_path: string;
  output_path: string;
  preset_id: string;
  options: EncodeOptions;
  status: JobStatus;
  progress: number;
  speed: string | null;
  error: string | null;
  duration: number;
  created_at: number;
}

export interface AddJobRequest {
  input_path: string;
  output_path: string;
  options: EncodeOptions;
}

export interface ProgressPayload {
  id: string;
  progress: number;
  speed: string | null;
}

export interface HwCapabilities {
  nvenc: boolean;
}

export interface PendingFile {
  path: string;
  name: string;
  info?: MediaInfo;
  error?: string;
}
