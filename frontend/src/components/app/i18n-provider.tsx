"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { NextIntlClientProvider } from "next-intl"

import {
  defaultLocale,
  isLocale,
  type Locale,
  messages,
} from "@/i18n/config"

const localeStorageKey = "guesthouse.locale"

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedLocale = window.localStorage.getItem(localeStorageKey)

      if (storedLocale && isLocale(storedLocale)) {
        setLocaleState(storedLocale)
      }
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)
    window.localStorage.setItem(localeStorageKey, nextLocale)
  }, [])

  const value = useMemo(
    () => ({
      locale,
      setLocale,
    }),
    [locale, setLocale]
  )

  return (
    <I18nContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={messages[locale]}>
        {children}
      </NextIntlClientProvider>
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider")
  }

  return context
}
