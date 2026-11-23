import type { CSSProperties } from "react";

import { SCREENSHOT_ENABLED } from "../lib/features";
import type { AppScreen } from "../types/navigation";

const TOOLS = [
  {
    id: "video_compress" as const,
    name: "Comprimir vídeo",
    detail:
      "Diminua o tamanho do arquivo, com qualidade ou GPU. Vários vídeos de uma vez, na mesma fila.",
  },
  {
    id: "video_convert" as const,
    name: "Converter vídeo",
    detail:
      "Troque o tipo do arquivo: MP4, MKV, MOV, WebM ou AVI, ou tire só o áudio. Vários arquivos de uma vez.",
  },
  {
    id: "image_compress" as const,
    name: "Comprimir imagens",
    detail:
      "Diminua o tamanho das fotos, para enviar ou para guardar. Várias imagens de uma vez, na mesma fila.",
  },
  {
    id: "image_convert" as const,
    name: "Converter imagens",
    detail:
      "Troque o tipo da imagem: JPEG, PNG, WebP, BMP ou TIFF. Várias imagens de uma vez, na mesma fila.",
  },
  {
    id: "youtube" as const,
    name: "Baixar vídeo",
    detail:
      "Cole o link de YouTube, Vimeo e outros sites suportados. Vídeo ou só o áudio, na pasta que você escolher.",
  },
  {
    id: "screenshot" as const,
    name: "Print screen",
    detail:
      "Pressione Print Screen em qualquer lugar. Os prints ficam no menu Print screen. No overlay dá para anotar, copiar ou salvar.",
  },
];

export function HomePage({
  onSelect,
}: {
  onSelect: (screen: AppScreen) => void;
}) {
  return (
    <main className="board-shutter flex h-full min-h-0 flex-col overflow-y-auto bg-void">
      <div className="grid min-h-0 grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.filter(
          (item) => item.id !== "screenshot" || SCREENSHOT_ENABLED,
        ).map((item, index) => (
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
