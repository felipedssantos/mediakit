import { ptBR } from "../../i18n/pt-BR";
import type { YoutubeDownloadOptions } from "../../types/youtube";
import { FieldHint } from "../FieldHint";
import { SectionRule } from "../SectionRule";
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

const selectClass =
  "ink mt-1.5 w-full border border-steel-dim bg-flap px-2.5 py-1.5 text-sm text-paint outline-none focus:border-lamp";

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
  return (
    <div>
      <SectionRule step="02" title={ptBR.youtube.stepMode} />
      <div className="flex flex-col border border-rule">
        <div className="grid grid-cols-2">
          <button
            type="button"
            aria-pressed={mode === "video"}
            onClick={() => onModeChange("video")}
            className={`ink border-r border-rule px-3 py-2.5 text-left ${
              mode === "video" ? "bg-flap" : "hover:bg-flap"
            }`}
          >
            <span
              className={`block text-sm font-semibold ${
                mode === "video" ? "text-lamp" : "text-paint-dim"
              }`}
            >
              {ptBR.youtube.modeVideo}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-paint-faint">
              {ptBR.youtube.modeVideoDetail}
            </span>
          </button>
          <button
            type="button"
            aria-pressed={mode === "audio"}
            onClick={() => onModeChange("audio")}
            className={`ink px-3 py-2.5 text-left ${
              mode === "audio" ? "bg-flap" : "hover:bg-flap"
            }`}
          >
            <span
              className={`block text-sm font-semibold ${
                mode === "audio" ? "text-lamp" : "text-paint-dim"
              }`}
            >
              {ptBR.youtube.modeAudio}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-paint-faint">
              {ptBR.youtube.modeAudioDetail}
            </span>
          </button>
        </div>

        <div className="grid gap-4 border-t border-rule px-3 py-3 sm:grid-cols-2">
          {mode === "video" ? (
            <div>
              <label className="stamp block text-paint-dim">
                {ptBR.youtube.videoQualityLabel}
              </label>
              <select
                value={quality}
                onChange={(event) =>
                  onQualityChange(
                    event.target.value as YoutubeDownloadOptions["quality"],
                  )
                }
                className={selectClass}
              >
                <option value="best">{ptBR.youtube.qualityBest}</option>
                <option value="1080p">{ptBR.youtube.quality1080}</option>
                <option value="720p">{ptBR.youtube.quality720}</option>
                <option value="480p">{ptBR.youtube.quality480}</option>
              </select>
              <FieldHint>{ptBR.youtube.videoQualityHint}</FieldHint>
            </div>
          ) : (
            <div>
              <label className="stamp block text-paint-dim">
                {ptBR.youtube.audioFormatLabel}
              </label>
              <select
                value={audioFormat}
                onChange={(event) =>
                  onAudioFormatChange(
                    event.target
                      .value as YoutubeDownloadOptions["audio_format"],
                  )
                }
                className={selectClass}
              >
                <option value="m4a">{ptBR.youtube.audioM4a}</option>
                <option value="mp3">{ptBR.youtube.audioMp3}</option>
              </select>
              <FieldHint>{ptBR.youtube.audioFormatHint}</FieldHint>
            </div>
          )}

          <div>
            <OutputDirField
              value={outputDir}
              placeholder={ptBR.youtube.windowsVideosDir}
              onPick={onPickFolder}
            />
            <FieldHint>{ptBR.youtube.batchDirHint}</FieldHint>
          </div>
        </div>
      </div>
    </div>
  );
}
