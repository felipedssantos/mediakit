import { create } from "zustand";

import {
  DEFAULT_LOCALE,
  isLocale,
  TRANSLATIONS,
  type Locale,
  type Translations,
} from "../i18n";

const STORAGE_KEY = "mediakit.locale";

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Ignore storage access errors in restricted environments.
  }
  return DEFAULT_LOCALE;
}

function applyLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}

interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const initialLocale = detectInitialLocale();
applyLocale(initialLocale);

export const useLocale = create<LocaleStore>((set) => ({
  locale: initialLocale,
  setLocale: (locale) => {
    applyLocale(locale);
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Ignore storage write errors.
    }
    set({ locale });
  },
}));

/** Subscribes to the active locale and returns the matching translation dictionary. */
export function useT(): Translations {
  const locale = useLocale((state) => state.locale);
  return TRANSLATIONS[locale];
}

/** Reads the current translation dictionary outside of React components. */
export function getT(): Translations {
  return TRANSLATIONS[useLocale.getState().locale];
}
