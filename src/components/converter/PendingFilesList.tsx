import { File, Trash2, X } from "lucide-react";
import type { CSSProperties } from "react";

import { useT } from "../../hooks/useLocale";
import { formatBytes } from "../../lib/presets";
import type { PendingFile } from "../../types/job";

interface PendingFilesListProps {
  files: PendingFile[];
  emptyMessage: string;
  validCount: number;
  totalBytes: number;
  formatMeta: (file: PendingFile) => string;
  onRemove: (path: string) => void;
  onClearAll?: () => void;
}

export function PendingFilesList({
  files,
  emptyMessage,
  validCount,
  totalBytes,
  formatMeta,
  onRemove,
  onClearAll,
}: PendingFilesListProps) {
  const t = useT();
  if (files.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line bg-inset px-4 py-6 text-center text-xs text-ink-3">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="surface-card max-h-56 divide-y divide-line overflow-y-auto rounded-2xl">
        {files.map((file, index) => (
          <li
            key={file.path}
            className="ui-enter flex items-center justify-between gap-3 px-3.5 py-2.5"
            style={
              {
                "--stagger": `${Math.min(index, 5) * 20}ms`,
              } as CSSProperties
            }
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-elevated text-ink-2">
                <File size={15} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {file.name}
                </p>
                <p
                  className={`mono-num truncate text-[11px] ${
                    file.error ? "text-danger" : "text-ink-2"
                  }`}
                >
                  {file.error ? file.error : formatMeta(file)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRemove(file.path)}
              className="ui-control shrink-0 rounded-lg p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger"
              aria-label={t.common.removeItem(file.name)}
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-2 px-1">
        <p className="mono-num text-xs text-ink-2">
          {t.common.filesCount(validCount)} · {formatBytes(totalBytes)}{" "}
          {t.converter.totalSizeSuffix}
        </p>
        {onClearAll && files.length > 1 && (
          <button
            type="button"
            onClick={onClearAll}
            className="ui-control inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-danger"
          >
            <Trash2 size={12} />
            <span>{t.common.clearAll}</span>
          </button>
        )}
      </div>
    </div>
  );
}
