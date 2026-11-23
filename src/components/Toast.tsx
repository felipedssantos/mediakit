import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

import { useToast } from "../hooks/useToast";

export function Toast() {
  const message = useToast((state) => state.message);
  const hide = useToast((state) => state.hide);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => hide(), 2800);
    return () => window.clearTimeout(id);
  }, [hide, message]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="ui-toast pointer-events-none absolute bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-ok/30 bg-surface px-4 py-2 shadow-lg"
    >
      <p className="flex items-center gap-2 text-xs font-semibold text-ok">
        <CheckCircle2 size={15} />
        <span>{message}</span>
      </p>
    </div>
  );
}
