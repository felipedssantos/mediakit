import {
  Activity,
  ArrowLeftRight,
  Camera,
  CheckCircle2,
  Cpu,
  Download,
  FileVideo,
  Home,
  ImageDown,
  Minimize2,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, type ComponentType } from "react";

import { useT } from "../hooks/useLocale";
import { useSidecars } from "../hooks/useSidecars";
import type { Translations } from "../i18n";
import { SCREENSHOT_ENABLED } from "../lib/features";
import { animateIndicatorTo } from "../lib/motion";
import { gpuVendorName, type GpuVendor } from "../types/job";
import type { AppScreen } from "../types/navigation";

interface SidebarProps {
  current: AppScreen;
  onSelect: (screen: AppScreen) => void;
  activeCounts?: Partial<Record<AppScreen, number>>;
  nvencAvailable?: boolean;
  gpuVendor?: GpuVendor | null;
}

interface NavItem {
  id: AppScreen;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

function getNavGroups(t: Translations): NavGroup[] {
  const groups: NavGroup[] = [
    {
      title: t.sidebar.groupVideos,
      items: [
        { id: "video_compress", label: t.converter.compressTitle, icon: Minimize2 },
        { id: "video_convert", label: t.converter.convertTitle, icon: FileVideo },
      ],
    },
    {
      title: t.sidebar.groupImages,
      items: [
        {
          id: "image_compress",
          label: t.imageConverter.compressTitle,
          icon: ImageDown,
        },
        {
          id: "image_convert",
          label: t.imageConverter.convertTitle,
          icon: ArrowLeftRight,
        },
      ],
    },
    {
      title: t.sidebar.groupInternet,
      items: [{ id: "youtube", label: t.youtube.title, icon: Download }],
    },
  ];
  if (SCREENSHOT_ENABLED) {
    groups.push({
      title: t.sidebar.groupCaptures,
      items: [{ id: "screenshot", label: t.screenshot.title, icon: Camera }],
    });
  }
  return groups;
}

export function Sidebar({
  current,
  onSelect,
  activeCounts = {},
  nvencAvailable = false,
  gpuVendor = null,
}: SidebarProps) {
  const t = useT();
  const navRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<Partial<Record<AppScreen, HTMLButtonElement | null>>>(
    {},
  );
  const mountedRef = useRef(false);

  const sidecarReport = useSidecars((state) => state.report);
  const sidecarItems = sidecarReport?.items ?? [
    { name: "ffmpeg", ok: true, source: "bundled" as const },
    { name: "ffprobe", ok: true, source: "bundled" as const },
    { name: "yt-dlp", ok: true, source: "bundled" as const },
  ];
  const sidecarsAllOk = sidecarReport ? sidecarReport.all_ok : true;

  const sourceLabels = {
    bundled: t.sidecars.sourceBundled,
    repaired: t.sidecars.sourceRepaired,
    custom: t.sidecars.sourceCustom,
    missing: t.sidecars.sourceMissing,
  } as const;

  const groups = getNavGroups(t);

  const totalActive = Object.values(activeCounts).reduce(
    (sum, value) => sum + (value ?? 0),
    0,
  );

  useLayoutEffect(() => {
    const container = navRef.current;
    const target = itemRefs.current[current];
    const indicator = indicatorRef.current;
    if (!container || !indicator) return;
    if (!target) {
      indicator.style.opacity = "0";
      return;
    }

    const top =
      target.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    animateIndicatorTo(indicator, top, target.offsetHeight, !mountedRef.current);
    mountedRef.current = true;
  }, [current]);

  useEffect(() => {
    function onResize() {
      const container = navRef.current;
      const target = itemRefs.current[current];
      const indicator = indicatorRef.current;
      if (!container || !target || !indicator) return;
      const top =
        target.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop;
      animateIndicatorTo(indicator, top, target.offsetHeight, true);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [current]);

  return (
    <aside
      aria-label={t.sidebar.ariaLabel}
      className="flex w-56 shrink-0 flex-col border-r border-line bg-surface lg:w-60"
    >
      <div
        ref={navRef}
        className="relative flex flex-1 flex-col overflow-y-auto p-3"
      >
        <span
          ref={indicatorRef}
          aria-hidden
          className="pointer-events-none absolute top-0 right-3 left-3 rounded-xl border border-accent/25 bg-accent-soft opacity-0"
        />

        <button
          ref={(el) => {
            itemRefs.current.home = el;
          }}
          type="button"
          onClick={() => onSelect("home")}
          aria-current={current === "home" ? "page" : undefined}
          className={`ui-control relative z-10 flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium ${
            current === "home"
              ? "text-accent"
              : "text-ink-2 hover:bg-elevated/70 hover:text-ink"
          }`}
        >
          <Home size={16} />
          <span>{t.sidebar.home}</span>
        </button>

        <nav className="relative z-10 mt-4 flex flex-1 flex-col gap-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-ink-3">
                {group.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = current === item.id;
                  const count = activeCounts[item.id] ?? 0;

                  return (
                    <li key={item.id}>
                      <button
                        ref={(el) => {
                          itemRefs.current[item.id] = el;
                        }}
                        type="button"
                        onClick={() => onSelect(item.id)}
                        aria-current={active ? "page" : undefined}
                        className={`ui-control flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium ${
                          active
                            ? "text-accent"
                            : "text-ink-2 hover:bg-elevated/70 hover:text-ink"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Icon size={16} className="shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {count > 0 && (
                          <span
                            aria-label={t.sidebar.activeJobs(count)}
                            className="mono-num shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-accent-ink shadow-xs"
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-line p-3">
        <div className="group relative">
          <div
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-0 right-0 z-30 mb-2 translate-y-1 rounded-xl border border-line bg-surface p-2.5 opacity-0 shadow-xl transition-all duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100"
          >
            <div className="mb-2 flex items-center justify-between border-b border-line pb-1.5 text-[11px] font-semibold text-ink">
              <span>{t.sidecars.sectionTitle}</span>
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  sidecarsAllOk ? "bg-emerald-400" : "bg-rose-400"
                }`}
              />
            </div>

            <div className="space-y-1.5 text-[11px]">
              {sidecarItems.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    {item.ok ? (
                      <CheckCircle2
                        size={12}
                        className="shrink-0 text-emerald-400"
                      />
                    ) : (
                      <XCircle size={12} className="shrink-0 text-rose-400" />
                    )}
                    <span className="font-mono text-ink">{item.name}</span>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.2 text-[10px] font-medium ${
                      item.ok
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-rose-500/15 text-rose-400"
                    }`}
                  >
                    {sourceLabels[item.source]}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-2 border-t border-line pt-1.5 text-[10px] text-ink-3">
              Clique para abrir configurações
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelect("settings")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect("settings");
              }
            }}
            className="ui-control w-full cursor-pointer rounded-xl border border-line bg-inset p-3 text-left transition-colors hover:border-accent/40 hover:bg-elevated/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <Activity
                  size={13}
                  className={
                    totalActive > 0 ? "text-accent status-pulse" : "text-ok"
                  }
                />
                <span>
                  {totalActive > 0
                    ? t.sidebar.activeJobs(totalActive)
                    : t.sidebar.allReady}
                </span>
              </span>
              <span className="mono-num text-[10px] font-medium text-ink-3">
                v0.1 Beta
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between gap-1.5 border-t border-line pt-2 text-[11px] text-ink-2">
              <div className="flex items-center gap-1.5">
                {nvencAvailable ? (
                  <>
                    <Zap size={12} className="text-accent" />
                    <span>
                      {gpuVendor
                        ? `GPU ${gpuVendorName(gpuVendor)}`
                        : t.sidebar.gpuActive}
                    </span>
                  </>
                ) : (
                  <>
                    <Cpu size={12} className="text-ink-3" />
                    <span>{t.sidebar.cpuMode}</span>
                  </>
                )}
              </div>

              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  sidecarsAllOk ? "bg-emerald-400" : "bg-rose-400"
                }`}
                title={
                  sidecarsAllOk
                    ? "FFmpeg, FFprobe e yt-dlp OK"
                    : "Problema com componentes de mídia"
                }
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
