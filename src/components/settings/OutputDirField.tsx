import { FolderOpen } from "lucide-react";

import { ptBR } from "../../i18n/pt-BR";

interface OutputDirFieldProps {
  label?: string;
  value: string | null;
  placeholder?: string;
  onPick: () => void;
  className?: string;
}

export function OutputDirField({
  label = ptBR.common.outputDirLabel,
  value,
  placeholder = ptBR.common.sameAsInputDir,
  onPick,
  className,
}: OutputDirFieldProps) {
  return (
    <div className={className}>
      <label className="stamp block text-paint-dim">{label}</label>
      <div className="mt-1 flex gap-2">
        <p className="cell min-w-0 flex-1 truncate border border-steel-dim bg-flap px-2.5 py-1.5 text-xs text-paint-dim">
          {value || placeholder}
        </p>
        <button
          type="button"
          onClick={onPick}
          className="stamp ink inline-flex shrink-0 items-center gap-1.5 border border-steel-dim px-2.5 py-1.5 text-paint-dim hover:border-lamp hover:text-lamp"
        >
          <FolderOpen size={13} />
          {ptBR.common.choose}
        </button>
      </div>
    </div>
  );
}
