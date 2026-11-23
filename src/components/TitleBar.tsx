import { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";

import { ptBR } from "../i18n/pt-BR";
import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  onWindowResized,
  toggleWindowMaximize,
} from "../lib/api/window";

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void isWindowMaximized().then(setMaximized);
    void onWindowResized(() => {
      void isWindowMaximized().then(setMaximized);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, []);

  return (
    <header className="steel flex h-9 shrink-0 items-center">
      <div
        data-tauri-drag-region
        className="flex h-full min-w-0 flex-1 items-center gap-2.5 px-3"
      >
        <span className="h-1.5 w-1.5 bg-lamp" />
        <span className="stamp text-paint-dim">{ptBR.common.appName}</span>
      </div>

      <div className="flex h-full">
        <button
          type="button"
          onClick={() => void minimizeWindow()}
          className="ink flex h-full w-11 items-center justify-center text-paint-dim hover:bg-void hover:text-paint"
          aria-label={ptBR.titleBar.minimize}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={() => void toggleWindowMaximize()}
          className="ink flex h-full w-11 items-center justify-center text-paint-dim hover:bg-void hover:text-paint"
          aria-label={
            maximized ? ptBR.titleBar.restore : ptBR.titleBar.maximize
          }
        >
          {maximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          type="button"
          onClick={() => void closeWindow()}
          className="ink flex h-full w-11 items-center justify-center text-paint-dim hover:bg-fault hover:text-paint"
          aria-label={ptBR.titleBar.closeToTray}
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
