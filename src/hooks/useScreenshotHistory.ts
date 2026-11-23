import { create } from "zustand";

import {
  deleteScreenshotHistory,
  listScreenshotHistory,
} from "../lib/api/screenshot";
import type { ScreenshotHistoryItem } from "../types/screenshot";

interface ScreenshotHistoryState {
  items: ScreenshotHistoryItem[];
  hydrate: () => Promise<void>;
  prepend: (item: ScreenshotHistoryItem) => void;
  remove: (id: string) => Promise<void>;
}

export const useScreenshotHistory = create<ScreenshotHistoryState>((set) => ({
  items: [],
  hydrate: async () => {
    const items = await listScreenshotHistory();
    set({ items });
  },
  prepend: (item) =>
    set((state) => ({
      items: [item, ...state.items.filter((current) => current.id !== item.id)],
    })),
  remove: async (id) => {
    const items = await deleteScreenshotHistory(id);
    set({ items });
  },
}));
