import type { Job } from "../types/job";

export type BoardTone = "idle" | "running" | "cleared" | "fault";

export interface BoardStatus {
  label: string;
  tone: BoardTone;
}

/** Vocabulário do painel: cada estado é uma palavra estampada, não uma cor. */
export const BOARD_STATUS: Record<Job["status"], BoardStatus> = {
  queued: { label: "Na fila", tone: "idle" },
  running: { label: "Em andamento", tone: "running" },
  finalizing: { label: "Juntando", tone: "running" },
  completed: { label: "Concluído", tone: "cleared" },
  failed: { label: "Falhou", tone: "fault" },
  cancelled: { label: "Cancelado", tone: "idle" },
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
