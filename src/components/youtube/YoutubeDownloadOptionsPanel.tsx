import { Film, Music } from "lucide-react";

import { useT } from "../../hooks/useLocale";
import type { YoutubeDownloadOptions } from "../../types/youtube";
import { FieldHint } from "../FieldHint";
import { SelectField } from "../SelectField";
import { StepHeader } from "../StepHeader";
import { OutputDirField } from "../settings/OutputDirField";

interface YoutubeDownloadOptionsPanelProps {
  mode: "video" | "audio";
  quality: YoutubeDownloadOptions["quality"];
  audioFormat: YoutubeDownloadOptions["audio_format"];
  outputDir: string;
  onModeChange: (mode: "video" | "audio") => void;
  onQualityChange: (quality: YoutubeDownloadOptions["quality"]) => void;
  onAudioFormatChange: (format: YoutubeDownloadOptions["audio_format"]) => void;
  onPickFolder: () => void;
}

export function YoutubeDownloadOptionsPanel({
  mode,
  quality,
  audioFormat,
  outputDir,
  onModeChange,
  onQualityChange,
  onAudioFormatChange,
  onPickFolder,
}: YoutubeDownloadOptionsPanelProps) {
  const t = useT();
  const modeOptions = [
    {
      id: "video" as const,
      icon: Film,
      label: t.youtube.modeVideo,
      detail: t.youtube.modeVideoDetail,
    },
    {
      id: "audio" as const,
      icon: Music,
      label: t.youtube.modeAudio,
      detail: t.youtube.modeAudioDetail,
    },
  ];

  return (
    <div>
      <StepHeader step="2" title={t.youtube.stepMode} />
      <div className="surface-card flex flex-col overflow-hidden rounded-2xl">
        <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {modeOptions.map(({ id, icon: Icon, label, detail }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => onModeChange(id)}
                className={`ui-control flex items-start gap-3 p-4 text-left ${
                  active ? "bg-accent-soft" : "hover:bg-elevated"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    active
                      ? "bg-accent text-accent-ink"
                      : "bg-elevated text-ink-2"
                  }`}
                >
                  <Icon size={17} />
                </span>
                <div>
                  <span
                    className={`block text-sm font-semibold ${
                      active ? "text-accent" : "text-ink"
                    }`}
                  >
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-ink-2">
                    {detail}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
          {mode === "video" ? (
            <SelectField<YoutubeDownloadOptions["quality"]>
              label={t.youtube.videoQualityLabel}
              value={quality}
              onChange={onQualityChange}
              hint={t.youtube.videoQualityHint}
              options={[
                { value: "best", label: t.youtube.qualityBest },
                { value: "1080p", label: t.youtube.quality1080 },
                { value: "720p", label: t.youtube.quality720 },
                { value: "480p", label: t.youtube.quality480 },
              ]}
            />
          ) : (
            <SelectField<YoutubeDownloadOptions["audio_format"]>
              label={t.youtube.audioFormatLabel}
              value={audioFormat}
              onChange={onAudioFormatChange}
              hint={t.youtube.audioFormatHint}
              options={[
                { value: "m4a", label: t.youtube.audioM4a },
                { value: "mp3", label: t.youtube.audioMp3 },
              ]}
            />
          )}

          <div>
            <OutputDirField
              value={outputDir}
              placeholder={t.youtube.windowsVideosDir}
              onPick={onPickFolder}
            />
            <FieldHint>{t.youtube.batchDirHint}</FieldHint>
          </div>
        </div>
      </div>
    </div>
  );
}
