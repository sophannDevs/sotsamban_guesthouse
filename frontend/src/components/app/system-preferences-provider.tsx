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

import { useAuth } from "@/components/app/auth-provider"
import { useI18n } from "@/components/app/i18n-provider"
import {
  settingsService,
  type SystemPreferencesPayload,
} from "@/lib/settings"

export type SystemPreferences = SystemPreferencesPayload

type SystemPreferencesContextValue = {
  preferences: SystemPreferences
  isLoading: boolean
  refreshPreferences: () => Promise<SystemPreferences | null>
}

const defaultPreferences: SystemPreferences = {
  currency: "USD",
  timezone: "Asia/Phnom_Penh",
  dateFormat: "YYYY-MM-DD",
  language: "en",
}

const SystemPreferencesContext =
  createContext<SystemPreferencesContextValue | null>(null)

export function SystemPreferencesProvider({
  children,
}: {
  children: ReactNode
}) {
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth()
  const { setLocale } = useI18n()
  const [preferences, setPreferences] =
    useState<SystemPreferences>(defaultPreferences)
  const [isLoading, setIsLoading] = useState(false)

  const refreshPreferences = useCallback(async () => {
    setIsLoading(true)

    try {
      const settings = await settingsService.list()
      const nextPreferences = normalizePreferences(
        Object.fromEntries(
          settings.map((setting) => [setting.key, setting.value])
        )
      )

      setPreferences(nextPreferences)

      if (!user) {
        setLocale(nextPreferences.language)
      }

      return nextPreferences
    } catch {
      return null
    } finally {
      setIsLoading(false)
    }
  }, [setLocale, user])

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void refreshPreferences()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [isAuthenticated, isAuthLoading, refreshPreferences])

  const value = useMemo(
    () => ({
      preferences,
      isLoading,
      refreshPreferences,
    }),
    [isLoading, preferences, refreshPreferences]
  )

  return (
    <SystemPreferencesContext.Provider value={value}>
      {children}
    </SystemPreferencesContext.Provider>
  )
}

export function useSystemPreferences() {
  const context = useContext(SystemPreferencesContext)

  if (!context) {
    throw new Error(
      "useSystemPreferences must be used inside SystemPreferencesProvider"
    )
  }

  return context
}

export function normalizePreferences(
  values: Record<string, string | undefined>
): SystemPreferences {
  return {
    currency: values.currency === "KHR" ? "KHR" : "USD",
    timezone: "Asia/Phnom_Penh",
    dateFormat:
      values.dateFormat === "DD/MM/YYYY" ? "DD/MM/YYYY" : "YYYY-MM-DD",
    language: values.language === "km" ? "km" : "en",
  }
}

export function formatPreferenceCurrency(
  value: number,
  preferences: SystemPreferences
) {
  return new Intl.NumberFormat(getLocale(preferences), {
    currency: preferences.currency,
    maximumFractionDigits: preferences.currency === "KHR" ? 0 : 2,
    style: "currency",
  }).format(value)
}

export function formatPreferenceNumber(
  value: number,
  preferences: SystemPreferences
) {
  return new Intl.NumberFormat(getLocale(preferences), {
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPreferenceDate(
  value: string | Date,
  preferences: SystemPreferences
) {
  const date = typeof value === "string" ? new Date(value) : value

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  const parts = getDateParts(date, preferences)

  if (preferences.dateFormat === "DD/MM/YYYY") {
    return `${parts.day}/${parts.month}/${parts.year}`
  }

  return `${parts.year}-${parts.month}-${parts.day}`
}

export function formatPreferenceDateTime(
  value: string | Date,
  preferences: SystemPreferences
) {
  const date = typeof value === "string" ? new Date(value) : value

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  return `${formatPreferenceDate(date, preferences)} ${new Intl.DateTimeFormat(
    getLocale(preferences),
    {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: preferences.timezone,
    }
  ).format(date)}`
}

export function formatPreferenceDateRange(
  startDate: string,
  endDate: string,
  preferences: SystemPreferences
) {
  return `${formatPreferenceDate(startDate, preferences)} - ${formatPreferenceDate(endDate, preferences)}`
}

function getDateParts(date: Date, preferences: SystemPreferences) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: preferences.timezone,
    year: "numeric",
  }).formatToParts(date)
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  )

  return {
    day: values.day ?? "01",
    month: values.month ?? "01",
    year: values.year ?? "1970",
  }
}

function getLocale(preferences: SystemPreferences) {
  return preferences.language === "km" ? "km-KH" : "en-US"
}
