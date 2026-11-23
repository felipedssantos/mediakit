import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  Camera,
  CheckCircle2,
  Cpu,
  Download,
  FileVideo,
  ImageDown,
  Layers,
  Lock,
  Minimize2,
  Settings,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useEffect, useRef, type ComponentType } from "react";

import { ToolDiagram } from "../components/home/ToolDiagram";
import { useT } from "../hooks/useLocale";
import { SCREENSHOT_ENABLED } from "../lib/features";
import { animateDiagramPulses, animateStaggerIn } from "../lib/motion";
import { gpuVendorName, type GpuVendor } from "../types/job";
import type { AppScreen } from "../types/navigation";

const TOOL_ICONS: Record<
  AppScreen,
  ComponentType<{ size?: number; className?: string }>
> = {
  home: Minimize2,
  video_compress: Minimize2,
  video_convert: FileVideo,
  image_compress: ImageDown,
  image_convert: ArrowLeftRight,
  youtube: Download,
  screenshot: Camera,
  settings: Settings,
};

interface HomePageProps {
  onSelect: (screen: AppScreen) => void;
  nvencAvailable?: boolean;
  gpuVendor?: GpuVendor | null;
  activeJobCount?: number;
}

export function HomePage({
  onSelect,
  nvencAvailable = false,
  gpuVendor = null,
  activeJobCount = 0,
}: HomePageProps) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);

  const tools = t.home.tools.filter(
    (item) => item.id !== "screenshot" || SCREENSHOT_ENABLED,
  );

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const stopStagger = animateStaggerIn(
      root.querySelectorAll("[data-home-animate]"),
      { y: 16, scale: 0.985, duration: 480, staggerMs: 45 },
    );
    const stopPulses = animateDiagramPulses(root);
    return () => {
      stopStagger();
      stopPulses();
    };
  }, []);

  return (
    <main className="bg-studio-canvas h-full min-h-0 overflow-y-auto px-6 py-7 lg:px-9 lg:py-8">
      <div ref={containerRef} className="mx-auto flex max-w-5xl flex-col gap-7">
        <header
          data-home-animate
          className="surface-card relative overflow-hidden rounded-2xl p-6"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-ok/25 bg-ok-soft px-3 py-1 text-xs font-semibold text-ok">
                <span className="h-1.5 w-1.5 rounded-full bg-ok status-pulse" />
                <span>{t.home.badge}</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                {t.home.greeting}
              </h1>
              <p className="mt-2 text-sm leading-6 text-ink-2">
                {t.home.subtitle}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:min-w-80">
              <div className="rounded-xl border border-line bg-inset px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-3">
                  <ShieldCheck size={13} className="text-ok" />
                  <span>{t.home.privacyLabel}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-ink">
                  {t.home.privacyValue}
                </p>
              </div>

              <div className="rounded-xl border border-line bg-inset px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-3">
                  {nvencAvailable ? (
                    <Zap size={13} className="text-accent" />
                  ) : (
                    <Cpu size={13} className="text-ink-2" />
                  )}
                  <span>{t.home.engineLabel}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-ink">
                  {nvencAvailable
                    ? gpuVendor
                      ? `GPU ${gpuVendorName(gpuVendor)}`
                      : t.home.engineGpu
                    : t.home.engineCpu}
                </p>
              </div>

              <div className="rounded-xl border border-line bg-inset px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-3">
                  <Activity
                    size={13}
                    className={
                      activeJobCount > 0 ? "text-accent" : "text-ink-2"
                    }
                  />
                  <span>{t.home.queueLabel}</span>
                </div>
                <p className="mono-num mt-1 text-xs font-semibold text-ink">
                  {activeJobCount > 0
                    ? t.home.queueActive(activeJobCount)
                    : t.home.queueIdle}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section aria-label={t.home.toolsAriaLabel}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tools.map((item) => {
              const Icon = TOOL_ICONS[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  data-home-animate
                  onClick={() => onSelect(item.id)}
                  className="ui-card surface-card group flex min-h-60 flex-col rounded-2xl p-5 text-left hover:border-accent/50"
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/20 bg-accent-soft text-accent shadow-sm">
                      <Icon size={19} />
                    </span>
                    <span className="mono-num rounded-md border border-line bg-elevated px-2 py-0.5 text-[11px] font-medium text-ink-2">
                      {item.tag}
                    </span>
                  </div>

                  <h2 className="mt-4 text-base font-bold tracking-tight text-ink group-hover:text-accent">
                    {item.name}
                  </h2>
                  <p className="mt-1 flex-1 text-xs leading-5 text-ink-2">
                    {item.detail}
                  </p>

                  <div className="mt-4 w-full">
                    <ToolDiagram toolId={item.id} />
                  </div>

                  <div className="mt-3.5 flex w-full items-center justify-between border-t border-line pt-3">
                    <span className="text-xs font-semibold text-accent">
                      {t.home.openTool}
                    </span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-elevated text-ink-2 ui-control group-hover:translate-x-0.5 group-hover:bg-accent group-hover:text-accent-ink">
                      <ArrowRight size={12} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <footer
          data-home-animate
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/80 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-elevated text-accent">
              <Layers size={15} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink">
                {t.home.featureBatchTitle}
              </p>
              <p className="text-[11px] text-ink-2">
                {t.home.featureBatchDetail}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/80 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-elevated text-ok">
              <CheckCircle2 size={15} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink">
                {t.home.featureSafeTitle}
              </p>
              <p className="text-[11px] text-ink-2">
                {t.home.featureSafeDetail}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/80 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-elevated text-ink-2">
              <Lock size={15} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink">
                {t.home.featureLimitsTitle}
              </p>
              <p className="text-[11px] text-ink-2">
                {t.home.featureLimitsDetail}
              </p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
