"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircleIcon, SaveIcon, SlidersHorizontalIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { useAuth } from "@/components/app/auth-provider"
import { useI18n } from "@/components/app/i18n-provider"
import {
  normalizePreferences,
  useSystemPreferences,
} from "@/components/app/system-preferences-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getSettingsErrorMessage,
  settingsService,
  type SystemPreferencesPayload,
} from "@/lib/settings"

const preferenceKeys = [
  "currency",
  "timezone",
  "dateFormat",
  "language",
] as const satisfies Array<keyof SystemPreferencesPayload>

const defaultFormValues: SystemPreferencesPayload = {
  currency: "USD",
  timezone: "Asia/Phnom_Penh",
  dateFormat: "YYYY-MM-DD",
  language: "en",
}

export default function SystemPreferencesSettingsPage() {
  const t = useTranslations("preferencesSettingsPage")
  const { setLocale } = useI18n()
  const { user } = useAuth()
  const { refreshPreferences } = useSystemPreferences()
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const canEdit = user?.role === "ADMIN"

  const preferencesSchema = useMemo(
    () =>
      z.object({
        currency: z.enum(["USD", "KHR"], {
          message: t("currencyRequired"),
        }),
        timezone: z.enum(["Asia/Phnom_Penh"], {
          message: t("timezoneRequired"),
        }),
        dateFormat: z.enum(["DD/MM/YYYY", "YYYY-MM-DD"], {
          message: t("dateFormatRequired"),
        }),
        language: z.enum(["en", "km"], {
          message: t("languageRequired"),
        }),
      }) satisfies z.ZodType<SystemPreferencesPayload>,
    [t]
  )

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
    setValue,
  } = useForm<SystemPreferencesPayload>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: defaultFormValues,
  })

  const currency = useWatch({ control, name: "currency" })
  const timezone = useWatch({ control, name: "timezone" })
  const dateFormat = useWatch({ control, name: "dateFormat" })
  const language = useWatch({ control, name: "language" })

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const settings = await settingsService.list()
        const values = normalizePreferences(
          Object.fromEntries(
            settings.map((setting) => [setting.key, setting.value])
          )
        )

        if (isMounted) {
          reset(values)
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getSettingsErrorMessage(error))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadSettings()

    return () => {
      isMounted = false
    }
  }, [reset])

  async function onSubmit(values: SystemPreferencesPayload) {
    if (!canEdit) {
      return
    }

    try {
      await Promise.all(
        preferenceKeys.map((key) =>
          settingsService.updateSetting(key, values[key])
        )
      )
      setLocale(values.language)
      await refreshPreferences()
      toast.success(t("savedSuccessfully"))
    } catch (error) {
      toast.error(getSettingsErrorMessage(error))
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex size-11 items-center justify-center rounded-lg border bg-muted/40">
          <SlidersHorizontalIcon />
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          {!canEdit ? <Badge variant="secondary">{t("readonly")}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent>
        {errorMessage ? (
          <Alert className="mb-4" variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>{t("failedToLoad")}</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {!canEdit ? (
          <Alert className="mb-4">
            <AlertCircleIcon />
            <AlertTitle>{t("readonlyTitle")}</AlertTitle>
            <AlertDescription>{t("readonlyDescription")}</AlertDescription>
          </Alert>
        ) : null}

        <form className="max-w-2xl" onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.currency)}>
              <FieldLabel htmlFor="currency">{t("currency")}</FieldLabel>
              <Select
                disabled={isLoading || !canEdit}
                value={currency}
                onValueChange={(value) =>
                  setValue(
                    "currency",
                    value as SystemPreferencesPayload["currency"],
                    {
                      shouldDirty: true,
                      shouldValidate: true,
                    }
                  )
                }
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.currency)}
                  id="currency"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="USD">{t("usd")}</SelectItem>
                    <SelectItem value="KHR">{t("khr")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>{t("currencyDescription")}</FieldDescription>
              <FieldError>{errors.currency?.message}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.timezone)}>
              <FieldLabel htmlFor="timezone">{t("timezone")}</FieldLabel>
              <Select
                disabled={isLoading || !canEdit}
                value={timezone}
                onValueChange={(value) =>
                  setValue(
                    "timezone",
                    value as SystemPreferencesPayload["timezone"],
                    {
                      shouldDirty: true,
                      shouldValidate: true,
                    }
                  )
                }
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.timezone)}
                  id="timezone"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Asia/Phnom_Penh">
                      Asia/Phnom_Penh
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>{t("timezoneDescription")}</FieldDescription>
              <FieldError>{errors.timezone?.message}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.dateFormat)}>
              <FieldLabel htmlFor="dateFormat">{t("dateFormat")}</FieldLabel>
              <Select
                disabled={isLoading || !canEdit}
                value={dateFormat}
                onValueChange={(value) =>
                  setValue(
                    "dateFormat",
                    value as SystemPreferencesPayload["dateFormat"],
                    {
                      shouldDirty: true,
                      shouldValidate: true,
                    }
                  )
                }
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.dateFormat)}
                  id="dateFormat"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>{t("dateFormatDescription")}</FieldDescription>
              <FieldError>{errors.dateFormat?.message}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.language)}>
              <FieldLabel htmlFor="language">{t("language")}</FieldLabel>
              <Select
                disabled={isLoading || !canEdit}
                value={language}
                onValueChange={(value) =>
                  setValue(
                    "language",
                    value as SystemPreferencesPayload["language"],
                    {
                      shouldDirty: true,
                      shouldValidate: true,
                    }
                  )
                }
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.language)}
                  id="language"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="en">{t("english")}</SelectItem>
                    <SelectItem value="km">{t("khmer")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>{t("languageDescription")}</FieldDescription>
              <FieldError>{errors.language?.message}</FieldError>
            </Field>

            {canEdit ? (
              <div className="flex justify-end">
                <Button disabled={isLoading || isSubmitting} type="submit">
                  <SaveIcon data-icon="inline-start" />
                  {isSubmitting ? t("saving") : t("save")}
                </Button>
              </div>
            ) : null}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
