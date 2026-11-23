import type { CSSProperties } from "react";

import { ptBR } from "../i18n/pt-BR";
import { SCREENSHOT_ENABLED } from "../lib/features";
import type { AppScreen } from "../types/navigation";

export function HomePage({
  onSelect,
}: {
  onSelect: (screen: AppScreen) => void;
}) {
  return (
    <main className="board-shutter flex h-full min-h-0 flex-col overflow-y-auto bg-void">
      <div className="grid min-h-0 grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {ptBR.home.tools
          .filter((item) => item.id !== "screenshot" || SCREENSHOT_ENABLED)
          .map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="board-row-in group flex min-h-44 flex-col border border-rule bg-flap p-4 text-left ink hover:border-lamp hover:bg-flap-top"
              style={{ "--stagger": `${index * 40}ms` } as CSSProperties}
            >
              <span className="text-2xl font-medium tracking-tight text-paint ink group-hover:text-lamp">
                {item.name}
              </span>
              <span className="mt-3 flex-1 text-sm leading-6 text-paint-dim">
                {item.detail}
              </span>
            </button>
          ))}
      </div>
    </main>
  );
}
