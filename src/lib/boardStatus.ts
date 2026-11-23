import type { Translations } from "../i18n";
import type { Job } from "../types/job";

export type BoardTone = "idle" | "running" | "cleared" | "fault";

export interface BoardStatus {
  label: string;
  tone: BoardTone;
}

export function getBoardStatus(
  status: Job["status"],
  t: Translations,
): BoardStatus {
  switch (status) {
    case "queued":
      return { label: t.boardStatus.queued, tone: "idle" };
    case "running":
      return { label: t.boardStatus.running, tone: "running" };
    case "finalizing":
      return { label: t.boardStatus.finalizing, tone: "running" };
    case "completed":
      return { label: t.boardStatus.completed, tone: "cleared" };
    case "failed":
      return { label: t.boardStatus.failed, tone: "fault" };
    case "cancelled":
      return { label: t.boardStatus.cancelled, tone: "idle" };
  }
}

export const TONE_TEXT: Record<BoardTone, string> = {
  idle: "text-ink-3",
  running: "text-accent",
  cleared: "text-ok",
  fault: "text-danger",
};

export const TONE_BADGE: Record<BoardTone, string> = {
  idle: "bg-elevated text-ink-2 border-line",
  running: "bg-accent-soft text-accent border-accent/25",
  cleared: "bg-ok-soft text-ok border-ok/25",
  fault: "bg-danger-soft text-danger border-danger/25",
};

export const TONE_EDGE: Record<BoardTone, string> = {
  idle: "bg-ink-3",
  running: "bg-accent",
  cleared: "bg-ok",
  fault: "bg-danger",
};
