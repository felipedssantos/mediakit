import { FolderOpen } from "lucide-react";

import { useT } from "../../hooks/useLocale";

interface OutputDirFieldProps {
  label?: string;
  value: string | null;
  placeholder?: string;
  onPick: () => void;
  className?: string;
}

export function OutputDirField({
  label,
  value,
  placeholder,
  onPick,
  className,
}: OutputDirFieldProps) {
  const t = useT();
  const resolvedLabel = label ?? t.common.outputDirLabel;
  const resolvedPlaceholder = placeholder ?? t.common.sameAsInputDir;
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-ink-2">
        {resolvedLabel}
      </label>
      <div className="mt-1.5 flex gap-2">
        <p className="mono-num min-w-0 flex-1 truncate rounded-lg border border-line bg-inset px-3 py-2 text-xs text-ink-2">
          {value || resolvedPlaceholder}
        </p>
        <button
          type="button"
          onClick={onPick}
          className="ui-btn inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line-strong bg-elevated px-3 py-2 text-xs font-medium text-ink hover:border-accent hover:text-accent"
        >
          <FolderOpen size={14} />
          {t.common.choose}
        </button>
      </div>
    </div>
  );
}
