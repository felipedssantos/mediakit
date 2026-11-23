import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import { IMAGE_EXTENSIONS } from "../imagePresets";
import { VIDEO_EXTENSIONS } from "../presets";

/** Opens a multi-select file dialog filtered to supported video extensions. */
export async function pickVideoFiles(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "Vídeo", extensions: VIDEO_EXTENSIONS }],
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

/** Opens a multi-select file dialog filtered to supported image extensions. */
export async function pickImageFiles(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "Imagem", extensions: IMAGE_EXTENSIONS }],
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

/** Opens a folder picker dialog and returns the selected directory path, if any. */
export async function pickOutputDirectory(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
  });
  if (!selected || Array.isArray(selected)) return null;
  return selected;
}

/** Reveals a file or its parent directory in Windows Explorer. */
export async function revealPath(path: string): Promise<void> {
  const target = path.trim();
  if (!target) return;
  try {
    await revealItemInDir(target);
  } catch {
    const folder = target.replace(/[/\\][^/\\]+$/, "");
    await revealItemInDir(folder || target);
  }
}
