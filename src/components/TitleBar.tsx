import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const window = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    void window.isMaximized().then(setMaximized);
    void window
      .onResized(() => {
        void window.isMaximized().then(setMaximized);
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => unlisten?.();
  }, []);

  async function minimize() {
    await getCurrentWindow().minimize();
  }

  async function toggleMaximize() {
    await getCurrentWindow().toggleMaximize();
  }

  async function close() {
    await getCurrentWindow().close();
  }

  return (
    <header className="steel flex h-9 shrink-0 items-center">
      <div
        data-tauri-drag-region
        className="flex h-full min-w-0 flex-1 items-center gap-2.5 px-3"
      >
        <span className="h-1.5 w-1.5 bg-lamp" />
        <span className="stamp text-paint-dim">Conversor</span>
      </div>

      <div className="flex h-full">
        <button
          type="button"
          onClick={() => void minimize()}
          className="ink flex h-full w-11 items-center justify-center text-paint-dim hover:bg-void hover:text-paint"
          aria-label="Minimizar"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={() => void toggleMaximize()}
          className="ink flex h-full w-11 items-center justify-center text-paint-dim hover:bg-void hover:text-paint"
          aria-label={maximized ? "Restaurar" : "Maximizar"}
        >
          {maximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          type="button"
          onClick={() => void close()}
          className="ink flex h-full w-11 items-center justify-center text-paint-dim hover:bg-fault hover:text-paint"
          aria-label="Minimizar para a bandeja"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
