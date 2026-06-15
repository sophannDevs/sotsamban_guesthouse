"use client"

import { useState } from "react"
import { CheckIcon, LanguagesIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { useAuth } from "@/components/app/auth-provider"
import { useI18n } from "@/components/app/i18n-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { isLocale, locales } from "@/i18n/config"
import { cn } from "@/lib/utils"

const localeOptions = locales.map((locale) => ({
  value: locale,
  label: locale === "en" ? "🇺🇸 English" : "🇰🇭 ខ្មែរ",
}))

export function LanguageSwitcher() {
  const t = useTranslations()
  const { locale, setLocale } = useI18n()
  const { isAuthenticated, updatePreferredLanguage } = useAuth()
  const [isUpdating, setIsUpdating] = useState(false)

  function handleChange(value: string) {
    if (!value || !isLocale(value) || value === locale) return
    if (!isAuthenticated) {
      setLocale(value)
      return
    }
    setIsUpdating(true)
    void updatePreferredLanguage(value).finally(() => setIsUpdating(false))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isUpdating}
        render={
          <Button aria-label={t("language")} size="icon" variant="ghost" />
        }
      >
        <LanguagesIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {localeOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleChange(option.value)}
            >
              <CheckIcon
                className={cn(
                  "shrink-0",
                  locale !== option.value && "invisible",
                )}
              />
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
