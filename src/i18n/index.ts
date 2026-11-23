import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { ptBR, type Translations } from "./pt-BR";
import { ptPT } from "./pt-PT";

export type Locale = "pt-BR" | "pt-PT" | "en" | "es" | "fr";

export type { Translations };

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_OPTIONS: { value: Locale; label: string }[] = [
  { value: "pt-BR", label: "Português (BR)" },
  { value: "pt-PT", label: "Português (PT)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
];

export const TRANSLATIONS: Record<Locale, Translations> = {
  "pt-BR": ptBR,
  "pt-PT": ptPT,
  en,
  es,
  fr,
};

/** Returns `true` when `value` is a supported UI locale code. */
export function isLocale(value: unknown): value is Locale {
  return (
    value === "pt-BR" ||
    value === "pt-PT" ||
    value === "en" ||
    value === "es" ||
    value === "fr"
  );
}
