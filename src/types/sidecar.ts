export type SidecarSource = "custom" | "repaired" | "bundled" | "missing";

export interface SidecarInfo {
  name: string;
  ok: boolean;
  source: SidecarSource;
  path: string | null;
  error: string | null;
  suggestion: string | null;
}

export interface SidecarStatusReport {
  all_ok: boolean;
  items: SidecarInfo[];
}

export interface SidecarConfig {
  custom_dir: string | null;
  ffmpeg_path: string | null;
  ffprobe_path: string | null;
  ytdlp_path: string | null;
}

export interface SidecarRepairProgress {
  component: string;
  stage: string;
  percent: number | null;
  message: string;
}
