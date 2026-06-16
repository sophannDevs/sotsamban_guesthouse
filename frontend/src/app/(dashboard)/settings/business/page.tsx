"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircleIcon, Building2Icon, SaveIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { useAuth } from "@/components/app/auth-provider"
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
import { Input } from "@/components/ui/input"
import {
  getSettingsErrorMessage,
  settingsService,
  type BusinessSettingsPayload,
} from "@/lib/settings"

const businessSettingKeys = [
  "guesthouseName",
  "guesthouseAddress",
  "guesthousePhone",
  "guesthouseEmail",
  "logoUrl",
] as const satisfies Array<keyof BusinessSettingsPayload>

const defaultFormValues: BusinessSettingsPayload = {
  guesthouseName: "",
  guesthouseAddress: "",
  guesthousePhone: "",
  guesthouseEmail: "",
  logoUrl: "",
}

export default function BusinessSettingsPage() {
  const t = useTranslations("businessSettingsPage")
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const canEdit = user?.role === "ADMIN"

  const businessSettingsSchema = useMemo(
    () =>
      z.object({
        guesthouseName: z.string().trim().min(1, t("guesthouseNameRequired")),
        guesthouseAddress: z.string().trim(),
        guesthousePhone: z.string().trim(),
        guesthouseEmail: z
          .string()
          .trim()
          .refine(
            (value) => !value || z.string().email().safeParse(value).success,
            t("invalidEmailAddress")
          ),
        logoUrl: z.string().trim(),
      }) satisfies z.ZodType<BusinessSettingsPayload>,
    [t]
  )

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<BusinessSettingsPayload>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: defaultFormValues,
  })

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const settings = await settingsService.list()
        const values = { ...defaultFormValues }

        for (const key of businessSettingKeys) {
          values[key] =
            settings.find((setting) => setting.key === key)?.value ?? ""
        }

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

  async function onSubmit(values: BusinessSettingsPayload) {
    if (!canEdit) {
      return
    }

    try {
      await Promise.all(
        businessSettingKeys.map((key) =>
          settingsService.updateSetting(key, values[key].trim())
        )
      )
      toast.success(t("savedSuccessfully"))
    } catch (error) {
      toast.error(getSettingsErrorMessage(error))
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex size-11 items-center justify-center rounded-lg border bg-muted/40">
          <Building2Icon />
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

        <form className="max-w-2xl pb-24 sm:pb-0" onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.guesthouseName)}>
              <FieldLabel htmlFor="guesthouseName">
                {t("guesthouseName")}
              </FieldLabel>
              <Input
                aria-invalid={Boolean(errors.guesthouseName)}
                disabled={isLoading || !canEdit}
                id="guesthouseName"
                {...register("guesthouseName")}
              />
              <FieldError errors={[errors.guesthouseName]} />
            </Field>

            <Field data-invalid={Boolean(errors.guesthouseAddress)}>
              <FieldLabel htmlFor="guesthouseAddress">{t("address")}</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.guesthouseAddress)}
                disabled={isLoading || !canEdit}
                id="guesthouseAddress"
                {...register("guesthouseAddress")}
              />
              <FieldError errors={[errors.guesthouseAddress]} />
            </Field>

            <Field data-invalid={Boolean(errors.guesthousePhone)}>
              <FieldLabel htmlFor="guesthousePhone">{t("phone")}</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.guesthousePhone)}
                disabled={isLoading || !canEdit}
                id="guesthousePhone"
                type="tel"
                {...register("guesthousePhone")}
              />
              <FieldError errors={[errors.guesthousePhone]} />
            </Field>

            <Field data-invalid={Boolean(errors.guesthouseEmail)}>
              <FieldLabel htmlFor="guesthouseEmail">{t("email")}</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.guesthouseEmail)}
                disabled={isLoading || !canEdit}
                id="guesthouseEmail"
                type="email"
                {...register("guesthouseEmail")}
              />
              <FieldError errors={[errors.guesthouseEmail]} />
            </Field>

            <Field data-invalid={Boolean(errors.logoUrl)}>
              <FieldLabel htmlFor="logoUrl">{t("logo")}</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.logoUrl)}
                disabled={isLoading || !canEdit}
                id="logoUrl"
                {...register("logoUrl")}
              />
              <FieldDescription>{t("logoDescription")}</FieldDescription>
              <FieldError errors={[errors.logoUrl]} />
            </Field>
          </FieldGroup>

          {canEdit ? (
            <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background px-4 pb-4 pt-3 sm:static sm:mt-4 sm:border-0 sm:bg-transparent sm:p-0">
              <Button
                className="w-full sm:w-auto"
                disabled={isLoading || isSubmitting}
                type="submit"
              >
                <SaveIcon data-icon="inline-start" />
                {isSubmitting ? t("saving") : t("save")}
              </Button>
            </div>
          ) : (
            <Alert className="mt-4">
              <AlertCircleIcon />
              <AlertTitle>{t("readonlyTitle")}</AlertTitle>
              <AlertDescription>{t("readonlyDescription")}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
