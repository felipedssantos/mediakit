import type { ReactNode } from "react";
import { PlayCircle } from "lucide-react";

import { ptBR } from "../../i18n/pt-BR";
import type { Job } from "../../types/job";
import { BoardHeader } from "../BoardHeader";
import { BoardWait } from "../BoardWait";
import { FieldHint } from "../FieldHint";
import { JobQueue } from "../JobQueue";

interface ConverterLayoutProps {
  title: string;
  detail: string;
  error: string | null;
  onBack: () => void;
  dropSection: ReactNode;
  presetSection: ReactNode;
  settingsSection: ReactNode;
  busy: boolean;
  canStart: boolean;
  startLabel: string;
  startHint: string;
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
  onBack,
  dropSection,
  presetSection,
  settingsSection,
  busy,
  canStart,
  startLabel,
  startHint,
  onStart,
  queueTitle,
  queueEmpty,
  jobs,
  onCancel,
  onRetry,
}: ConverterLayoutProps) {
  return (
    <main className="board-shutter flex h-full min-h-0 flex-col bg-void text-paint">
      <BoardHeader title={title} detail={detail} onBack={onBack} />

      {error && (
        <p className="shrink-0 border-b border-rule bg-flap px-4 py-2 text-sm text-fault">
          <span className="stamp mr-2 text-fault">
            {ptBR.common.errorStamp}
          </span>
          {error}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,34%)]">
        <div className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-5">
              {dropSection}
              {presetSection}
              {settingsSection}
            </div>
          </div>
          <div className="shrink-0 border-t border-rule bg-void px-4 py-3">
            <button
              type="button"
              disabled={busy || !canStart}
              onClick={onStart}
              className="stamp ink flex w-full items-center justify-center gap-2 border border-lamp bg-lamp px-3.5 py-2.5 text-void hover:bg-void hover:text-lamp disabled:cursor-not-allowed disabled:border-steel-dim disabled:bg-transparent disabled:text-paint-faint"
            >
              {busy ? (
                <BoardWait compact label={ptBR.common.queuing} />
              ) : (
                <PlayCircle size={14} />
              )}
              {startLabel}
            </button>
            {!canStart && <FieldHint>{startHint}</FieldHint>}
          </div>
        </div>

        <aside className="flex min-h-0 flex-col border-t border-rule lg:border-l lg:border-t-0">
          <div className="steel flex shrink-0 items-center justify-between gap-2 px-3 py-2">
            <h2 className="stamp text-paint">{queueTitle}</h2>
            <span className="cell text-xs text-paint-dim">
              {String(jobs.length).padStart(2, "0")}
            </span>
          </div>
          <JobQueue
            fill
            jobs={jobs}
            onCancel={onCancel}
            onRetry={onRetry}
            emptyDetail={queueEmpty}
          />
        </aside>
      </div>
    </main>
  );
}
