import { ArrowRight, Cpu, FolderCheck, Globe, Image, Video } from "lucide-react";

import type { AppScreen } from "../../types/navigation";

interface ToolDiagramProps {
  toolId: AppScreen;
}

function PulseTrack() {
  return (
    <div
      aria-hidden
      className="relative mx-1.5 h-px flex-1 overflow-hidden bg-line-strong"
    >
      <span
        data-diagram-pulse
        className="absolute top-1/2 left-0 h-1.5 w-4 -translate-y-1/2 rounded-full bg-accent opacity-0 shadow-[0_0_8px_var(--accent)]"
      />
    </div>
  );
}

/** Compact pipeline visual inside each Home tool card, animated with Anime.js. */
export function ToolDiagram({ toolId }: ToolDiagramProps) {
  if (toolId === "video_compress") {
    return (
      <div className="bg-studio-inset flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1">
          <Video size={12} className="text-ink-2" />
          <span className="mono-num text-[11px] font-medium text-ink-2">
            120 MB
          </span>
        </div>
        <PulseTrack />
        <div className="flex items-center gap-1.5 rounded-lg border border-ok/30 bg-ok-soft px-2 py-1">
          <span className="mono-num text-[11px] font-semibold text-ok">
            28 MB
          </span>
          <span className="mono-num rounded bg-ok/20 px-1 text-[10px] font-bold text-ok">
            -76%
          </span>
        </div>
      </div>
    );
  }

  if (toolId === "video_convert") {
    return (
      <div className="bg-studio-inset flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
        <span className="mono-num rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink-2">
          MKV · MOV
        </span>
        <PulseTrack />
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-accent/30 bg-accent-soft text-accent">
          <Cpu size={12} />
        </span>
        <PulseTrack />
        <span className="mono-num rounded-lg border border-accent/30 bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent">
          MP4 · MP3
        </span>
      </div>
    );
  }

  if (toolId === "image_compress") {
    return (
      <div className="bg-studio-inset flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1">
          <Image size={12} className="text-ink-2" />
          <span className="mono-num text-[11px] font-medium text-ink-2">
            4.8 MB
          </span>
        </div>
        <PulseTrack />
        <div className="flex items-center gap-1.5 rounded-lg border border-ok/30 bg-ok-soft px-2 py-1">
          <span className="mono-num text-[11px] font-semibold text-ok">
            680 KB
          </span>
        </div>
      </div>
    );
  }

  if (toolId === "image_convert") {
    return (
      <div className="bg-studio-inset flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
        <span className="mono-num rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink-2">
          HEIC · PNG
        </span>
        <PulseTrack />
        <ArrowRight size={12} className="shrink-0 text-ink-3" />
        <PulseTrack />
        <span className="mono-num rounded-lg border border-accent/30 bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent">
          JPG · WebP
        </span>
      </div>
    );
  }

  return (
    <div className="bg-studio-inset flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
      <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1">
        <Globe size={12} className="text-ink-2" />
        <span className="mono-num text-[11px] font-medium text-ink-2">URL</span>
      </div>
      <PulseTrack />
      <div className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-soft px-2 py-1 text-accent">
        <FolderCheck size={12} />
        <span className="mono-num text-[11px] font-semibold">MP4 / MP3</span>
      </div>
    </div>
  );
}
