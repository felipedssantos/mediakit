import { animate } from "animejs";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useT } from "../../hooks/useLocale";

interface AdvancedOptionsDisclosureProps {
  children: ReactNode;
}

export function AdvancedOptionsDisclosure({
  children,
}: AdvancedOptionsDisclosureProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!open) {
      setRendered(true);
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  useEffect(() => {
    const el = contentRef.current;
    if (!rendered || !el) return;

    if (open) {
      animate(el, {
        height: [0, el.scrollHeight],
        opacity: [0, 1],
        duration: 250,
        ease: "outQuad",
        onComplete: () => {
          el.style.height = "auto";
        },
      });
    } else {
      animate(el, {
        height: [el.scrollHeight, 0],
        opacity: [1, 0],
        duration: 200,
        ease: "inQuad",
        onComplete: () => {
          setRendered(false);
        },
      });
    }
  }, [open, rendered]);

  return (
    <div className="border-t border-line pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="ui-control flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left hover:text-accent"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-ink-2" />
          <span className="text-xs font-semibold text-ink">
            {t.common.advancedOptions}
          </span>
          <span className="hidden text-xs text-ink-3 sm:inline">
            · {t.common.advancedHint}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={`text-ink-2 ui-control transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {rendered && (
        <div ref={contentRef} className="overflow-hidden">
          <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3.5 border-t border-line pt-3.5 sm:grid-cols-2">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
