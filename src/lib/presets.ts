export type PresetId =
  | "compress_web"
  | "compress_quality"
  | "convert_mp4"
  | "extract_audio"
  | "gpu_nvenc";

export interface PresetDefinition {
  id: PresetId;
  label: string;
  description: string;
  bestFor: string;
  defaultCrf: number | null;
  videoCodec: string | null;
  supportsVideo: boolean;
  usesGpu: boolean;
  recommended?: boolean;
}

export const PRESETS: PresetDefinition[] = [
  {
    id: "compress_web",
    label: "Comprimir para enviar",
    description: "Deixa o arquivo bem menor, com uma leve perda de qualidade.",
    bestFor: "Bom para WhatsApp, e-mail e upload rápido",
    defaultCrf: 28,
    videoCodec: "h264",
    supportsVideo: true,
    usesGpu: false,
    recommended: true,
  },
  {
    id: "compress_quality",
    label: "Comprimir com qualidade",
    description: "Reduz bastante o tamanho quase sem perder qualidade visual.",
    bestFor: "Bom para guardar vídeos importantes ocupando pouco espaço",
    defaultCrf: 23,
    videoCodec: "hevc",
    supportsVideo: true,
    usesGpu: false,
  },
  {
    id: "convert_mp4",
    label: "Converter o vídeo",
    description: "Troca o tipo do arquivo: MP4, MKV, MOV, WebM ou AVI.",
    bestFor: "Bom quando o vídeo não abre em algum programa ou você precisa de outro formato",
    defaultCrf: 18,
    videoCodec: "h264",
    supportsVideo: true,
    usesGpu: false,
    recommended: true,
  },
  {
    id: "extract_audio",
    label: "Extrair só o áudio",
    description: "Gera um arquivo de áudio (.m4a), sem a parte do vídeo.",
    bestFor: "Bom para salvar música, podcast ou uma fala do vídeo",
    defaultCrf: null,
    videoCodec: null,
    supportsVideo: false,
    usesGpu: false,
  },
  {
    id: "gpu_nvenc",
    label: "Comprimir com GPU (rápido)",
    description: "Usa a placa de vídeo NVIDIA para converter bem mais rápido.",
    bestFor: "Bom quando você tem muitos vídeos e pressa",
    defaultCrf: 28,
    videoCodec: "h264_nvenc",
    supportsVideo: true,
    usesGpu: true,
  },
];

export const VIDEO_COMPRESS_PRESET_IDS = [
  "compress_web",
  "compress_quality",
  "gpu_nvenc",
] as const satisfies readonly PresetId[];

export const VIDEO_CONVERT_PRESET_IDS = [
  "convert_mp4",
  "extract_audio",
] as const satisfies readonly PresetId[];

export const VIDEO_COMPRESS_PRESETS = PRESETS.filter((item) =>
  (VIDEO_COMPRESS_PRESET_IDS as readonly string[]).includes(item.id),
);

export const VIDEO_CONVERT_PRESETS = PRESETS.filter((item) =>
  (VIDEO_CONVERT_PRESET_IDS as readonly string[]).includes(item.id),
);

export function isVideoCompressPreset(id: string): boolean {
  return (VIDEO_COMPRESS_PRESET_IDS as readonly string[]).includes(id);
}

export function isVideoConvertPreset(id: string): boolean {
  return (VIDEO_CONVERT_PRESET_IDS as readonly string[]).includes(id);
}

export type VideoContainer = "mp4" | "mkv" | "mov" | "webm" | "avi";
export type AudioContainer = "m4a" | "mp3" | "wav" | "ogg" | "flac";

export const VIDEO_OUTPUT_FORMATS: {
  id: VideoContainer;
  code: string;
  label: string;
  bestFor: string;
  usesGpu: boolean;
  recommended?: boolean;
}[] = [
  {
    id: "mp4",
    code: "M4",
    label: "MP4",
    bestFor: "O mais compatível com celular, WhatsApp e players",
    usesGpu: false,
    recommended: true,
  },
  {
    id: "mkv",
    code: "MK",
    label: "MKV",
    bestFor: "Bom para guardar o arquivo, aceita quase qualquer codec",
    usesGpu: false,
  },
  {
    id: "mov",
    code: "MO",
    label: "MOV",
    bestFor: "Bom para QuickTime, Final Cut e aparelhos Apple",
    usesGpu: false,
  },
  {
    id: "webm",
    code: "WM",
    label: "WebM",
    bestFor: "Bom para site e navegador",
    usesGpu: false,
  },
  {
    id: "avi",
    code: "AV",
    label: "AVI",
    bestFor: "Bom quando um programa antigo pede AVI",
    usesGpu: false,
  },
];

export const AUDIO_OUTPUT_FORMATS: {
  id: AudioContainer;
  code: string;
  label: string;
  bestFor: string;
  usesGpu: boolean;
}[] = [
  {
    id: "m4a",
    code: "M4",
    label: "M4A",
    bestFor: "Áudio AAC, o mais comum em celular e iTunes",
    usesGpu: false,
  },
  {
    id: "mp3",
    code: "MP",
    label: "MP3",
    bestFor: "O formato que quase qualquer aparelho toca",
    usesGpu: false,
  },
  {
    id: "wav",
    code: "WV",
    label: "WAV",
    bestFor: "Sem perda, arquivo grande — bom para edição",
    usesGpu: false,
  },
  {
    id: "ogg",
    code: "OG",
    label: "OGG",
    bestFor: "Bom para web e programas livres",
    usesGpu: false,
  },
  {
    id: "flac",
    code: "FL",
    label: "FLAC",
    bestFor: "Sem perda e menor que WAV",
    usesGpu: false,
  },
];

export const VIDEO_OUTPUT_CODES: Record<VideoContainer, string> = {
  mp4: "M4",
  mkv: "MK",
  mov: "MO",
  webm: "WM",
  avi: "AV",
};

export const AUDIO_OUTPUT_CODES: Record<AudioContainer, string> = {
  m4a: "M4",
  mp3: "MP",
  wav: "WV",
  ogg: "OG",
  flac: "FL",
};

export const VIDEO_EXTENSIONS = [
  "mp4",
  "mkv",
  "mov",
  "avi",
  "webm",
  "m4v",
  "wmv",
  "flv",
  "mpeg",
  "mpg",
  "ts",
];

/** Extracts the filename from a Windows or POSIX file path. */
export function fileNameFromPath(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

/** Formats a byte count into a human-readable string (e.g., `1.5 MB`). */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/** Formats seconds into `m:ss` or `h:mm:ss` (`—` when zero or non-finite). */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
