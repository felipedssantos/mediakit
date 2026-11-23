import type { JobStatus } from "./job";

export interface YoutubeVideo {
  id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string | null;
  url: string;
  source: string | null;
}

export interface YoutubeDownloadOptions {
  mode: "video" | "audio";
  quality: "best" | "1080p" | "720p" | "480p";
  audio_format: "m4a" | "mp3";
}

export interface YoutubeDownloadJob {
  id: string;
  url: string;
  title: string;
  output_dir: string;
  output_path: string | null;
  options: YoutubeDownloadOptions;
  status: JobStatus;
  progress: number;
  speed: string | null;
  error: string | null;
  created_at: number;
}
