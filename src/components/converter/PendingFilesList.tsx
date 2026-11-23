import type { CSSProperties } from "react";
import { X } from "lucide-react";

import { ptBR } from "../../i18n/pt-BR";
import { formatBytes } from "../../lib/presets";
import type { PendingFile } from "../../types/job";

interface PendingFilesListProps {
  files: PendingFile[];
  emptyMessage: string;
  validCount: number;
  totalBytes: number;
  formatMeta: (file: PendingFile) => string;
  onRemove: (path: string) => void;
}

export function PendingFilesList({
  files,
  emptyMessage,
  validCount,
  totalBytes,
  formatMeta,
  onRemove,
}: PendingFilesListProps) {
  if (files.length === 0) {
    return (
      <div className="flex flex-1 items-center border border-dashed border-steel-dim px-3 py-5 text-sm text-paint-faint">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <ul className="border border-rule">
        {files.map((file, index) => (
          <li
            key={file.path}
            className={`board-row-in flex items-center justify-between gap-3 px-2.5 py-1.5 ${
              index > 0 ? "border-t border-rule" : ""
            }`}
            style={
              {
                "--stagger": `${Math.min(index, 5) * 28}ms`,
              } as CSSProperties
            }
          >
            <div className="flex min-w-0 items-baseline gap-2.5">
              <span className="cell shrink-0 text-[11px] text-paint-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm text-paint">{file.name}</p>
                <p className="cell truncate text-[11px] text-paint-faint">
                  {file.error ? file.error : formatMeta(file)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRemove(file.path)}
              className="ink shrink-0 p-1 text-paint-faint hover:text-fault"
              aria-label={ptBR.common.removeItem(file.name)}
            >
              <X size={13} />
            </button>
          </li>
        ))}
      </ul>
      <p className="cell mt-1.5 text-[11px] text-paint-faint">
        {ptBR.common.filesCount(validCount)} · {formatBytes(totalBytes)}{" "}
        {ptBR.converter.totalSizeSuffix}
      </p>
    </>
  );
}
