import { UploadCloud } from "lucide-react";

import { BoardWait } from "./BoardWait";

interface DropZoneProps {
  disabled?: boolean;
  probing?: boolean;
  onBrowse: () => void;
  compact?: boolean;
  title?: string;
  hint?: string;
  probingTitle?: string;
  probingHint?: string;
}

export function DropZone({
  disabled,
  probing,
  onBrowse,
  compact,
  title = "Arraste seus vídeos para cá",
  hint = "Ou clique para escolher um ou vários arquivos do computador.",
  probingTitle = "Lendo os arquivos",
  probingHint = "A placa está conferindo duração e tamanho de cada vídeo.",
}: DropZoneProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onBrowse}
      className={`group ink flex w-full flex-col items-center justify-center border border-dashed border-steel-dim bg-flap px-6 text-center hover:border-lamp disabled:opacity-80 ${
        compact ? "min-h-24 py-4" : "min-h-32 flex-1 py-6"
      }`}
    >
      {probing ? (
        <BoardWait label="Lendo os arquivos" />
      ) : (
        <UploadCloud
          size={20}
          className="text-paint-faint ink group-hover:text-lamp"
        />
      )}
      <p className="mt-2.5 text-sm font-semibold text-paint">
        {probing ? probingTitle : title}
      </p>
      <p className="mt-1.5 max-w-md text-xs leading-5 text-paint-faint">
        {probing ? probingHint : hint}
      </p>
    </button>
  );
}
