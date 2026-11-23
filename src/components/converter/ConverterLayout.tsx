import { Loader2, Play } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { useT } from "../../hooks/useLocale";
import { animatePageEnter } from "../../lib/motion";
import type { Job } from "../../types/job";
import { ErrorBanner } from "../ErrorBanner";
import { FieldHint } from "../FieldHint";
import { JobQueue } from "../JobQueue";
import { QueueSidebar } from "../QueueSidebar";
import { StepProgressBar } from "../StepProgressBar";

interface ConverterLayoutProps {
  title: string;
  detail: string;
  error: string | null;
  onBack?: () => void;
  dropSection: ReactNode;
  presetSection: ReactNode;
  settingsSection: ReactNode;
  busy: boolean;
  canStart: boolean;
  startLabel: string;
  startHint: string;
  summary?: string | null;
  onStart: () => void;
  queueTitle: string;
  queueEmpty: string;
  jobs: Job[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

export function ConverterLayout({
  title,
  detail,
  error,
  dropSection,
  presetSection,
  settingsSection,
  busy,
  canStart,
  startLabel,
  startHint,
  summary,
  onStart,
  queueTitle,
  queueEmpty,
  jobs,
  onCancel,
  onRetry,
}: ConverterLayoutProps) {
  const t = useT();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    return animatePageEnter(mainRef.current);
  }, []);

  return (
    <main
      ref={mainRef}
      className="bg-studio-canvas flex h-full min-h-0 flex-col text-ink"
    >
      <header className="shrink-0 border-b border-line bg-surface px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink">
              {title}
            </h1>
            <p className="mt-0.5 text-sm text-ink-2">{detail}</p>
          </div>

          <StepProgressBar
            ariaLabel={t.converter.stepsAriaLabel}
            steps={[
              t.converter.stepFiles,
              t.converter.stepGoal,
              t.converter.stepStart,
            ]}
            firstStepDone={canStart}
          />
        </div>
      </header>

      <ErrorBanner message={error} />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(310px,36%)]">
        <div className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="mx-auto flex max-w-4xl flex-col gap-6">
              {dropSection}
              {presetSection}
              {settingsSection}
            </div>
          </div>

          <div className="shrink-0 border-t border-line bg-surface px-6 py-3.5">
            <div className="mx-auto flex max-w-4xl flex-col gap-1.5">
              {summary && canStart && (
                <p className="mono-num text-xs font-medium text-ink-2">
                  {summary}
                </p>
              )}
              <button
                type="button"
                disabled={busy || !canStart}
                onClick={onStart}
                className="ui-btn flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-ink shadow-sm hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-elevated disabled:text-ink-3 disabled:shadow-none"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Play size={16} fill="currentColor" />
                )}
                <span>{startLabel}</span>
              </button>
              {!canStart && <FieldHint>{startHint}</FieldHint>}
            </div>
          </div>
        </div>

        <QueueSidebar title={queueTitle} count={jobs.length}>
          <JobQueue
            fill
            jobs={jobs}
            onCancel={onCancel}
            onRetry={onRetry}
            emptyDetail={queueEmpty || t.common.emptyQueue}
          />
        </QueueSidebar>
      </div>
    </main>
  );
}
