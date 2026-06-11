import en from "../../messages/en.json"
import km from "../../messages/km.json"

export const locales = ["en", "km"] as const
export type Locale = (typeof locales)[number]
export const defaultLocale = "en" satisfies Locale

export const localeLabels: Record<Locale, string> = {
  en: "English",
  km: "ខ្មែរ",
}

export const messages = {
  en,
  km,
} satisfies Record<Locale, typeof en>

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale)
}
