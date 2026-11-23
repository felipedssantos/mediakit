import {
  Copy,
  Minus,
  Moon,
  Settings,
  Square,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useT } from "../hooks/useLocale";
import { useTheme } from "../hooks/useTheme";
import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  onWindowResized,
  toggleWindowMaximize,
} from "../lib/api/window";
import { animateThemeIcon } from "../lib/motion";

interface TitleBarProps {
  currentTitle?: string;
  onOpenSettings?: () => void;
  settingsActive?: boolean;
}

export function TitleBar({
  currentTitle,
  onOpenSettings,
  settingsActive = false,
}: TitleBarProps) {
  const t = useT();
  const [maximized, setMaximized] = useState(false);
  const theme = useTheme((state) => state.theme);
  const toggleTheme = useTheme((state) => state.toggleTheme);
  const iconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void isWindowMaximized().then(setMaximized);
    void onWindowResized(() => {
      void isWindowMaximized().then(setMaximized);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, []);

  function handleToggleTheme() {
    toggleTheme();
    animateThemeIcon(iconRef.current);
  }

  const isDark = theme === "dark";

  return (
    <header className="flex h-11 shrink-0 items-center border-b border-line bg-surface">
      <div
        data-tauri-drag-region
        className="flex h-full min-w-0 flex-1 items-center gap-2.5 px-3.5"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 1024 1024"
          fill="none"
          className="h-6 w-6 shrink-0"
        >
          <rect width="1024" height="1024" rx="228" fill="#171c28" />
          <rect
            x="16"
            y="16"
            width="992"
            height="992"
            rx="212"
            stroke="#ffffff"
            strokeOpacity="0.12"
            strokeWidth="16"
          />
          <path
            d="M 80 228 A 148 148 0 0 1 228 80 H 796 A 148 148 0 0 1 944 228 V 500 H 80 Z"
            fill="#131823"
          />
          <path
            d="M 80 524 H 944 V 796 A 148 148 0 0 1 796 944 H 228 A 148 148 0 0 1 80 796 Z"
            fill="#090b10"
          />
          <rect x="144" y="148" width="164" height="64" rx="32" fill="#3b82f6" />
          <path
            d="M 264 736 V 288 H 366 L 512 496 L 658 288 H 760 V 736 H 660 V 448 L 512 652 L 364 448 V 736 Z"
            fill="#f1f5f9"
          />
          <rect x="72" y="492" width="880" height="40" fill="#05070a" />
        </svg>
        <span className="text-xs font-bold tracking-tight text-ink">
          {t.common.appName}
        </span>
        <span className="rounded-md border border-accent/25 bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent leading-none">
          Beta
        </span>
        {currentTitle && (
          <>
            <span className="text-xs text-ink-3">/</span>
            <span className="truncate rounded-md bg-elevated px-2 py-0.5 text-xs font-medium text-ink-2">
              {currentTitle}
            </span>
          </>
        )}
      </div>

      <div className="flex h-full items-center">
        <button
          type="button"
          onClick={handleToggleTheme}
          aria-label={
            isDark ? t.theme.toggleToLight : t.theme.toggleToDark
          }
          title={isDark ? t.theme.lightLabel : t.theme.darkLabel}
          className="ui-btn mr-2 flex h-7 items-center gap-1.5 rounded-lg border border-line bg-elevated px-2.5 text-xs font-medium text-ink-2 hover:border-accent/40 hover:text-ink"
        >
          <span ref={iconRef} className="inline-flex">
            {isDark ? <Sun size={13} /> : <Moon size={13} />}
          </span>
          <span className="hidden sm:inline">
            {isDark ? t.theme.lightLabel : t.theme.darkLabel}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={t.titleBar.settings}
          aria-current={settingsActive ? "page" : undefined}
          title={t.titleBar.settings}
          className={`ui-btn mr-2 flex h-7 w-7 items-center justify-center rounded-lg border ${
            settingsActive
              ? "border-accent/40 bg-accent-soft text-accent"
              : "border-line bg-elevated text-ink-2 hover:border-accent/40 hover:text-ink"
          }`}
        >
          <Settings size={13} />
        </button>

        <button
          type="button"
          onClick={() => void minimizeWindow()}
          className="ui-control flex h-full w-11 items-center justify-center text-ink-2 hover:bg-elevated hover:text-ink"
          aria-label={t.titleBar.minimize}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={() => void toggleWindowMaximize()}
          className="ui-control flex h-full w-11 items-center justify-center text-ink-2 hover:bg-elevated hover:text-ink"
          aria-label={
            maximized ? t.titleBar.restore : t.titleBar.maximize
          }
        >
          {maximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          type="button"
          onClick={() => void closeWindow()}
          className="ui-control flex h-full w-11 items-center justify-center text-ink-2 hover:bg-danger hover:text-accent-ink"
          aria-label={t.titleBar.closeToTray}
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
