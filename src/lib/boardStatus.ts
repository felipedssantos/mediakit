import { ptBR } from "../i18n/pt-BR";
import type { Job } from "../types/job";

export type BoardTone = "idle" | "running" | "cleared" | "fault";

export interface BoardStatus {
  label: string;
  tone: BoardTone;
}

/** Vocabulário do painel: cada estado é uma palavra estampada, não uma cor. */
export const BOARD_STATUS: Record<Job["status"], BoardStatus> = {
  queued: { label: ptBR.boardStatus.queued, tone: "idle" },
  running: { label: ptBR.boardStatus.running, tone: "running" },
  finalizing: { label: ptBR.boardStatus.finalizing, tone: "running" },
  completed: { label: ptBR.boardStatus.completed, tone: "cleared" },
  failed: { label: ptBR.boardStatus.failed, tone: "fault" },
  cancelled: { label: ptBR.boardStatus.cancelled, tone: "idle" },
};

export const TONE_TEXT: Record<BoardTone, string> = {
  idle: "text-paint-faint",
  running: "text-lamp",
  cleared: "text-cleared",
  fault: "text-fault",
};

export const TONE_EDGE: Record<BoardTone, string> = {
  idle: "bg-steel-dim",
  running: "bg-lamp",
  cleared: "bg-cleared",
  fault: "bg-fault",
};
