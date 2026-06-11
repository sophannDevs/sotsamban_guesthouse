"use client"

import { useState } from "react"
import { LanguagesIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { useAuth } from "@/components/app/auth-provider"
import { useI18n } from "@/components/app/i18n-provider"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isLocale, locales } from "@/i18n/config"

const localeOptions = locales.map((locale) => ({
  value: locale,
  label: locale === "en" ? "🇺🇸 English" : "🇰🇭 ខ្មែរ",
}))

export function LanguageSwitcher() {
  const t = useTranslations()
  const { locale, setLocale } = useI18n()
  const { isAuthenticated, updatePreferredLanguage } = useAuth()
  const [isUpdating, setIsUpdating] = useState(false)

  return (
    <Select
      disabled={isUpdating}
      items={localeOptions}
      value={locale}
      onValueChange={(value) => {
        if (!value || !isLocale(value) || value === locale) {
          return
        }

        if (!isAuthenticated) {
          setLocale(value)
          return
        }

        setIsUpdating(true)
        void updatePreferredLanguage(value).finally(() => {
          setIsUpdating(false)
        })
      }}
    >
      <SelectTrigger aria-label={t("language")} className="min-w-32" size="sm">
        <LanguagesIcon data-icon="inline-start" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {localeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
