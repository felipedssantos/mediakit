import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Download,
  FileVideo,
  FolderOpen,
  Gauge,
  Image as ImageIcon,
  Moon,
  RefreshCw,
  RotateCcw,
  Sun,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { SelectField } from "../components/SelectField";
import { ConcurrencySlider } from "../components/settings/ConcurrencySlider";
import { OutputDirField } from "../components/settings/OutputDirField";
import { useAppSettings } from "../hooks/useAppSettings";
import { useJobs } from "../hooks/useJobs";
import { useLocale, useT } from "../hooks/useLocale";
import { useSidecars } from "../hooks/useSidecars";
import { useTheme } from "../hooks/useTheme";
import { useToast } from "../hooks/useToast";
import { LOCALE_OPTIONS, type Locale } from "../i18n";
import { pickExecutableFile, pickOutputDirectory } from "../lib/api/files";
import {
  IMAGE_COMPRESS_PRESETS,
  IMAGE_OUTPUT_FORMATS,
  type ImageFormat,
  type ImagePresetId,
} from "../lib/imagePresets";
import { animatePageEnter } from "../lib/motion";
import {
  AUDIO_OUTPUT_FORMATS,
  VIDEO_COMPRESS_PRESETS,
  VIDEO_OUTPUT_FORMATS,
  type AudioContainer,
  type PresetId,
  type VideoContainer,
} from "../lib/presets";
import type { YoutubeDownloadOptions } from "../types/youtube";

interface SettingsPageProps {
  onBack: () => void;
}

interface SectionCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

function SectionCard({
  icon,
  title,
  description,
  children,
  className = "",
}: SectionCardProps) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface p-5 ${className}`}
    >
      <div className="flex items-start gap-3 border-b border-line pb-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent-soft text-accent">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-xs text-ink-2">{description}</p>
        </div>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

interface OptionPill<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface OptionGroupProps<T extends string> {
  label: string;
  value: T;
  options: OptionPill<T>[];
  onChange: (value: T) => void;
}

function OptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: OptionGroupProps<T>) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              title={option.hint}
              className={`ui-control rounded-xl border px-3 py-1.5 text-xs font-medium ${
                active
                  ? "border-accent/50 bg-accent-soft text-accent"
                  : "border-line bg-inset text-ink-2 hover:border-line-strong hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const t = useT();
  const locale = useLocale((state) => state.locale);
  const setLocale = useLocale((state) => state.setLocale);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => animatePageEnter(mainRef.current), []);

  const youtubeQualityOptions: OptionPill<YoutubeDownloadOptions["quality"]>[] =
    [
      { value: "best", label: t.settings.youtubeQualityBest },
      { value: "1080p", label: "1080p" },
      { value: "720p", label: "720p" },
      { value: "480p", label: "480p" },
    ];

  const theme = useTheme((state) => state.theme);
  const setTheme = useTheme((state) => state.setTheme);
  const showToast = useToast((state) => state.show);

  const nvenc = useJobs((state) => state.nvenc);
  const maxConcurrency = useJobs((state) => state.maxConcurrency);
  const setConcurrency = useJobs((state) => state.setConcurrency);

  const settings = useAppSettings();
  const sidecars = useSidecars();
  const [showCustomPaths, setShowCustomPaths] = useState(false);

  const hasCustomConfig = Boolean(
    sidecars.config.custom_dir ||
      sidecars.config.ffmpeg_path ||
      sidecars.config.ffprobe_path ||
      sidecars.config.ytdlp_path,
  );

  const sourceLabels = {
    bundled: t.sidecars.sourceBundled,
    repaired: t.sidecars.sourceRepaired,
    custom: t.sidecars.sourceCustom,
    missing: t.sidecars.sourceMissing,
  } as const;

  async function handlePickCustomDir() {
    const dir = await pickOutputDirectory();
    if (dir) await sidecars.saveConfig({ custom_dir: dir });
  }

  async function handlePickExe(
    key: "ffmpeg_path" | "ffprobe_path" | "ytdlp_path",
  ) {
    const file = await pickExecutableFile();
    if (file) await sidecars.saveConfig({ [key]: file });
  }

  async function handleRepairSidecars() {
    const next = await sidecars.repair();
    if (next?.all_ok) {
      showToast(t.sidecars.repairSuccess);
    }
  }

  async function handleRestoreDefault(name: string) {
    if (name === "ffmpeg") await sidecars.saveConfig({ ffmpeg_path: null });
    else if (name === "ffprobe")
      await sidecars.saveConfig({ ffprobe_path: null });
    else if (name === "yt-dlp")
      await sidecars.saveConfig({ ytdlp_path: null });
  }

  async function handlePickMediaDir() {
    const dir = await pickOutputDirectory();
    if (dir) settings.updateSettings({ defaultOutputDir: dir });
  }

  async function handlePickYoutubeDir() {
    const dir = await pickOutputDirectory();
    if (dir) settings.updateSettings({ youtubeOutputDir: dir });
  }

  function handleReset() {
    settings.resetSettings();
    showToast(t.settings.resetDone);
  }

  return (
    <main
      ref={mainRef}
      className="bg-studio-canvas flex h-full min-h-0 flex-col text-ink"
    >
      <header className="shrink-0 border-b border-line bg-surface px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label={t.common.backHome}
              className="ui-btn flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-elevated text-ink-2 hover:border-accent/40 hover:text-ink"
            >
              <ArrowLeft size={15} />
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink">
                {t.settings.title}
              </h1>
              <p className="mt-0.5 text-sm text-ink-2">
                {t.settings.detail}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="ui-btn inline-flex items-center gap-1.5 rounded-xl border border-line bg-elevated px-3 py-2 text-xs font-medium text-ink-2 hover:border-accent/40 hover:text-ink"
          >
            <RotateCcw size={13} />
            {t.settings.resetDefaults}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-2">
          <SectionCard
            className="lg:col-span-2"
            icon={<Wrench size={16} />}
            title={t.sidecars.sectionTitle}
            description={t.sidecars.sectionDetail}
          >
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {sidecars.report?.items.map((item) =>
                item.ok ? (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-line bg-inset px-3 py-2.5 text-xs"
                    title={item.path ?? undefined}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <CheckCircle2
                        size={14}
                        className="shrink-0 text-emerald-400"
                      />
                      <span className="font-mono font-medium text-ink">
                        {item.name}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                      {sourceLabels[item.source]}
                    </span>
                  </div>
                ) : (
                  <div
                    key={item.name}
                    className="space-y-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs sm:col-span-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <XCircle size={15} className="shrink-0 text-rose-400" />
                        <span className="font-mono font-semibold text-ink">
                          {item.name}
                        </span>
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-medium text-rose-300">
                          {sourceLabels[item.source]} {t.sidecars.withError}
                        </span>
                      </div>
                      {item.source === "custom" ? (
                        <button
                          type="button"
                          onClick={() => void handleRestoreDefault(item.name)}
                          className="ui-control rounded-lg border border-rose-500/40 bg-surface px-2.5 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20"
                        >
                          {t.sidecars.restoreDefault}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={sidecars.repairing}
                          onClick={() => void handleRepairSidecars()}
                          className="ui-control rounded-lg border border-accent/40 bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {t.sidecars.repairButton}
                        </button>
                      )}
                    </div>
                    <div className="space-y-1 pl-6 text-[11px] leading-relaxed">
                      <p className="text-ink">
                        <strong className="text-rose-400">
                          {t.sidecars.problemLabel}{" "}
                        </strong>
                        {item.error}
                      </p>
                      {item.suggestion && (
                        <p className="text-ink-2">
                          <strong className="text-emerald-400">
                            {t.sidecars.solutionLabel}{" "}
                          </strong>
                          {item.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>

            {sidecars.repairing && sidecars.progress && (
              <div className="space-y-1.5 rounded-xl border border-line bg-inset px-3 py-2.5">
                <div className="flex items-center justify-between text-xs text-ink-2">
                  <span>{sidecars.progress.message}</span>
                  {typeof sidecars.progress.percent === "number" && (
                    <span>{sidecars.progress.percent}%</span>
                  )}
                </div>
                {typeof sidecars.progress.percent === "number" && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${sidecars.progress.percent}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {sidecars.error && !sidecars.repairing && (
              <p className="text-xs text-rose-400">{sidecars.error}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={sidecars.checking || sidecars.repairing}
                onClick={() => void sidecars.check()}
                className="ui-control inline-flex items-center gap-1.5 rounded-xl border border-line bg-inset px-3 py-1.5 text-xs font-medium text-ink hover:border-line-strong disabled:opacity-50"
              >
                <RefreshCw
                  size={13}
                  className={sidecars.checking ? "animate-spin" : ""}
                />
                {sidecars.checking
                  ? t.sidecars.checkingButton
                  : t.sidecars.checkButton}
              </button>
              <button
                type="button"
                disabled={sidecars.repairing}
                onClick={() => void handleRepairSidecars()}
                className="ui-control inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent hover:border-accent disabled:opacity-50"
              >
                <Wrench size={13} />
                {sidecars.repairing
                  ? t.sidecars.repairingButton
                  : t.sidecars.repairButton}
              </button>
            </div>

            <div className="border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setShowCustomPaths((prev) => !prev)}
                className="ui-control inline-flex items-center gap-2 text-xs font-medium text-ink-2 hover:text-ink"
              >
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${
                    showCustomPaths ? "rotate-180" : ""
                  }`}
                />
                <span>{t.sidecars.customPathsToggle}</span>
                {hasCustomConfig && (
                  <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                    {t.sidecars.customPathsActive}
                  </span>
                )}
              </button>

              {showCustomPaths && (
                <div className="mt-3 space-y-4 rounded-xl border border-line bg-inset/50 p-3.5">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-ink-2">
                      {t.sidecars.customDirLabel}
                    </p>
                    <p className="text-[11px] text-ink-3">
                      {t.sidecars.customDirHint}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink-2">
                        {sidecars.config.custom_dir ??
                          t.sidecars.customDirPlaceholder}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handlePickCustomDir()}
                        className="ui-control shrink-0 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink hover:border-line-strong"
                      >
                        {t.sidecars.pickFolder}
                      </button>
                      {sidecars.config.custom_dir && (
                        <button
                          type="button"
                          onClick={() =>
                            void sidecars.saveConfig({ custom_dir: null })
                          }
                          className="ui-control shrink-0 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-2 hover:text-ink"
                        >
                          {t.sidecars.clearPath}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-line pt-3">
                    <p className="text-xs font-medium text-ink-2">
                      {t.sidecars.customExeSection}
                    </p>
                    {(
                      [
                        ["ffmpeg_path", t.sidecars.ffmpegExeLabel],
                        ["ffprobe_path", t.sidecars.ffprobeExeLabel],
                        ["ytdlp_path", t.sidecars.ytdlpExeLabel],
                      ] as const
                    ).map(([fieldKey, label]) => {
                      const value = sidecars.config[fieldKey];
                      return (
                        <div key={fieldKey} className="space-y-1">
                          <p className="text-[11px] text-ink-3">{label}</p>
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink-2">
                              {value ?? "—"}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handlePickExe(fieldKey)}
                              className="ui-control shrink-0 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-line-strong"
                            >
                              {t.sidecars.pickExe}
                            </button>
                            {value && (
                              <button
                                type="button"
                                onClick={() =>
                                  void sidecars.saveConfig({ [fieldKey]: null })
                                }
                                className="ui-control shrink-0 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:text-ink"
                              >
                                {t.sidecars.clearPath}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            icon={theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
            title={t.settings.appearanceTitle}
            description={t.settings.appearanceDetail}
          >
            <OptionGroup
              label={t.settings.themeLabel}
              value={theme}
              onChange={setTheme}
              options={[
                { value: "dark", label: t.theme.darkLabel },
                { value: "light", label: t.theme.lightLabel },
              ]}
            />
            <SelectField<Locale>
              id="language-select"
              label={t.settings.languageLabel}
              value={locale}
              options={LOCALE_OPTIONS}
              onChange={setLocale}
              selectClassName="ui-control w-full appearance-none rounded-xl border border-line bg-inset pr-9 pl-3 py-2 text-xs font-medium text-ink outline-none hover:border-line-strong focus:border-accent"
            />
          </SectionCard>

          <SectionCard
            icon={<Gauge size={16} />}
            title={t.settings.performanceTitle}
            description={t.settings.performanceDetail}
          >
            <ConcurrencySlider
              value={maxConcurrency}
              onChange={(value) => void setConcurrency(value)}
            />
          </SectionCard>

          <SectionCard
            icon={<FolderOpen size={16} />}
            title={t.settings.foldersTitle}
            description={t.settings.foldersDetail}
          >
            <div className="space-y-2">
              <OutputDirField
                label={t.settings.mediaDirLabel}
                value={settings.defaultOutputDir}
                onPick={() => void handlePickMediaDir()}
              />
              {settings.defaultOutputDir && (
                <button
                  type="button"
                  onClick={() =>
                    settings.updateSettings({ defaultOutputDir: null })
                  }
                  className="text-xs font-medium text-accent hover:underline"
                >
                  {t.settings.useOriginalDir}
                </button>
              )}
            </div>

            <div className="space-y-2 border-t border-line pt-4">
              <OutputDirField
                label={t.settings.youtubeDirLabel}
                value={settings.youtubeOutputDir}
                placeholder={t.settings.youtubeDirPlaceholder}
                onPick={() => void handlePickYoutubeDir()}
              />
              {settings.youtubeOutputDir && (
                <button
                  type="button"
                  onClick={() =>
                    settings.updateSettings({ youtubeOutputDir: null })
                  }
                  className="text-xs font-medium text-accent hover:underline"
                >
                  {t.settings.useSystemDownloads}
                </button>
              )}
            </div>
          </SectionCard>

          <SectionCard
            icon={<FileVideo size={16} />}
            title={t.settings.videoTitle}
            description={t.settings.videoDetail}
          >
            <OptionGroup<PresetId>
              label={t.settings.videoCompressPresetLabel}
              value={settings.videoCompressPreset}
              onChange={(videoCompressPreset) =>
                settings.updateSettings({ videoCompressPreset })
              }
              options={VIDEO_COMPRESS_PRESETS.map((preset) => ({
                value: preset.id,
                label: t.presets[preset.id].label,
                hint: t.presets[preset.id].bestFor,
              }))}
            />

            <OptionGroup<VideoContainer>
              label={t.settings.videoConvertFormatLabel}
              value={settings.videoConvertContainer}
              onChange={(videoConvertContainer) =>
                settings.updateSettings({ videoConvertContainer })
              }
              options={VIDEO_OUTPUT_FORMATS.map((fmt) => ({
                value: fmt.id,
                label: fmt.label,
                hint: t.videoFormats[fmt.id].bestFor,
              }))}
            />

            <OptionGroup<AudioContainer>
              label={t.settings.audioExtractFormatLabel}
              value={settings.audioExtractContainer}
              onChange={(audioExtractContainer) =>
                settings.updateSettings({ audioExtractContainer })
              }
              options={AUDIO_OUTPUT_FORMATS.map((fmt) => ({
                value: fmt.id,
                label: fmt.label,
                hint: t.audioFormats[fmt.id].bestFor,
              }))}
            />

            <div className="border-t border-line pt-3">
              <label className="flex cursor-pointer items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-ink">
                    <Zap size={13} className="text-accent" />
                    {t.settings.preferGpuLabel}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-ink-3">
                    {nvenc
                      ? t.settings.preferGpuHint
                      : t.settings.gpuUnavailableHint}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.preferGpu}
                  onChange={(e) =>
                    settings.updateSettings({ preferGpu: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard
            icon={<ImageIcon size={16} />}
            title={t.settings.imageTitle}
            description={t.settings.imageDetail}
          >
            <OptionGroup<ImagePresetId>
              label={t.settings.imageCompressPresetLabel}
              value={settings.imageCompressPreset}
              onChange={(imageCompressPreset) =>
                settings.updateSettings({ imageCompressPreset })
              }
              options={IMAGE_COMPRESS_PRESETS.map((preset) => ({
                value: preset.id,
                label: t.imagePresets[preset.id].label,
                hint: t.imagePresets[preset.id].bestFor,
              }))}
            />

            <OptionGroup<ImageFormat>
              label={t.settings.imageConvertFormatLabel}
              value={settings.imageConvertFormat}
              onChange={(imageConvertFormat) =>
                settings.updateSettings({ imageConvertFormat })
              }
              options={IMAGE_OUTPUT_FORMATS.map((fmt) => ({
                value: fmt.id,
                label: fmt.label,
                hint: t.imageFormats[fmt.id].bestFor,
              }))}
            />
          </SectionCard>

          <SectionCard
            icon={<Download size={16} />}
            title={t.settings.youtubeTitle}
            description={t.settings.youtubeDetail}
          >
            <OptionGroup<"video" | "audio">
              label={t.settings.youtubeModeLabel}
              value={settings.youtubeMode}
              onChange={(youtubeMode) =>
                settings.updateSettings({ youtubeMode })
              }
              options={[
                { value: "video", label: t.settings.youtubeModeVideo },
                { value: "audio", label: t.settings.youtubeModeAudio },
              ]}
            />

            <OptionGroup
              label={t.settings.youtubeQualityLabel}
              value={settings.youtubeQuality}
              onChange={(youtubeQuality) =>
                settings.updateSettings({ youtubeQuality })
              }
              options={youtubeQualityOptions}
            />

            <OptionGroup<YoutubeDownloadOptions["audio_format"]>
              label={t.settings.youtubeAudioFormatLabel}
              value={settings.youtubeAudioFormat}
              onChange={(youtubeAudioFormat) =>
                settings.updateSettings({ youtubeAudioFormat })
              }
              options={[
                { value: "m4a", label: "M4A" },
                { value: "mp3", label: "MP3" },
              ]}
            />
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
