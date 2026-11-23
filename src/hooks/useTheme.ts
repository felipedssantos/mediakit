import { useEffect } from "react";
import { create } from "zustand";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "mediakit.theme";

function detectInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: light)").matches
    ) {
      return "light";
    }
  } catch {
    // Ignore storage access errors in restricted environments.
  }
  return "dark";
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

interface ThemeStore {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const initialTheme = detectInitialTheme();
applyTheme(initialTheme);

export const useTheme = create<ThemeStore>((set, get) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage write errors.
    }
    set({ theme });
  },
  toggleTheme: () => {
    const next: ThemeMode = get().theme === "dark" ? "light" : "dark";
    get().setTheme(next);
  },
}));

/** Synchronizes the `data-theme` attribute on `<html>` with the theme store. */
export function useThemeSync() {
  const theme = useTheme((state) => state.theme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
}
