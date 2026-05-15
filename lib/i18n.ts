import de from "@/i18n/de.json";
import en from "@/i18n/en.json";
import { getSettings } from "@/lib/settings";

const dictionaries = {
  de,
  en,
} as const;

export type Locale = keyof typeof dictionaries;
export type TranslationKey = keyof typeof de;

export const languageOptions: Array<{ value: Locale; labelKey: TranslationKey }> = [
  { value: "de", labelKey: "settings.german" },
  { value: "en", labelKey: "settings.english" },
];

export function parseLocale(value: string): Locale {
  return value === "en" ? "en" : "de";
}

export function createTranslator(locale: string) {
  const dictionary = dictionaries[parseLocale(locale)];

  return function t(key: TranslationKey, replacements?: Record<string, string | number>) {
    let value = dictionary[key] || dictionaries.de[key] || key;

    for (const [name, replacement] of Object.entries(replacements || {})) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }

    return value;
  };
}

export async function getTranslator() {
  const settings = await getSettings();
  return createTranslator(settings.language);
}
