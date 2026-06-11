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

import { useI18n } from "@/components/app/i18n-provider"
import type { Locale } from "@/i18n/config"
import { authService, type AuthUser, type LoginPayload } from "@/lib/auth"
import { getAccessToken, removeAccessToken } from "@/lib/auth-token"
import { userService, type PreferredLanguage } from "@/lib/users"

type AuthContextValue = {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (payload: LoginPayload) => Promise<AuthUser>
  logout: () => void
  updatePreferredLanguage: (locale: Locale) => Promise<AuthUser | null>
  refreshUser: () => Promise<AuthUser | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setLocale } = useI18n()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    authService.logout()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const token = getAccessToken()

    if (!token) {
      setUser(null)
      setIsLoading(false)
      return null
    }

    try {
      const currentUser = await authService.getMe()
      setUser(currentUser)
      setLocale(preferredLanguageToLocale(currentUser.preferredLanguage))
      return currentUser
    } catch {
      removeAccessToken()
      setUser(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [setLocale])

  const login = useCallback(async (payload: LoginPayload) => {
    const authenticatedUser = await authService.login(payload)
    setUser(authenticatedUser)
    setLocale(preferredLanguageToLocale(authenticatedUser.preferredLanguage))

    return authenticatedUser
  }, [setLocale])

  const updatePreferredLanguage = useCallback(
    async (locale: Locale) => {
      setLocale(locale)

      if (!user) {
        return null
      }

      const updatedUser = await userService.updatePreferences({
        preferredLanguage: localeToPreferredLanguage(locale),
      })
      setUser(updatedUser)

      return updatedUser
    },
    [setLocale, user]
  )

  useEffect(() => {
    const token = getAccessToken()
    let isMounted = true

    if (!token) {
      const timeoutId = window.setTimeout(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      }, 0)

      return () => {
        isMounted = false
        window.clearTimeout(timeoutId)
      }
    }

    async function loadUser() {
      try {
        const currentUser = await authService.getMe()

        if (isMounted) {
          setUser(currentUser)
          setLocale(preferredLanguageToLocale(currentUser.preferredLanguage))
        }
      } catch {
        removeAccessToken()

        if (isMounted) {
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadUser()

    return () => {
      isMounted = false
    }
  }, [setLocale])

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      updatePreferredLanguage,
      refreshUser,
    }),
    [isLoading, login, logout, refreshUser, updatePreferredLanguage, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function preferredLanguageToLocale(language: PreferredLanguage): Locale {
  return language === "KM" ? "km" : "en"
}

function localeToPreferredLanguage(locale: Locale): PreferredLanguage {
  return locale === "km" ? "KM" : "EN"
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider")
  }

  return context
}
