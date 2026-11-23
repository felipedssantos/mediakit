import { useEffect } from "react";
import { Check } from "lucide-react";

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
      className="board-toast pointer-events-none absolute bottom-5 left-1/2 z-50 -translate-x-1/2 border border-cleared bg-void px-3.5 py-2.5 shadow-none"
    >
      <p className="flex items-center gap-2 text-sm text-cleared">
        <Check size={14} />
        <span className="stamp text-cleared">{message}</span>
      </p>
    </div>
  );
}
