"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircleIcon, SaveIcon, UserRoundIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { useAuth } from "@/components/app/auth-provider"
import { useI18n } from "@/components/app/i18n-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  type ProfileSettingsPayload,
} from "@/lib/settings"
import type { PreferredLanguage } from "@/lib/users"

const languageOptions: Array<{
  value: PreferredLanguage
  translationKey: "english" | "khmer"
}> = [
  { value: "EN", translationKey: "english" },
  { value: "KM", translationKey: "khmer" },
]

const defaultFormValues: ProfileSettingsPayload = {
  name: "",
  phone: "",
  preferredLanguage: "EN",
}

export default function ProfileSettingsPage() {
  const t = useTranslations("profileSettingsPage")
  const rootT = useTranslations()
  const { refreshUser } = useAuth()
  const { setLocale } = useI18n()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const profileSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("nameRequired")),
        phone: z.string().trim().optional(),
        preferredLanguage: z.enum(["EN", "KM"], {
          message: t("preferredLanguageRequired"),
        }),
      }) satisfies z.ZodType<ProfileSettingsPayload>,
    [t]
  )

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<ProfileSettingsPayload>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaultFormValues,
  })
  const preferredLanguage = useWatch({
    control,
    name: "preferredLanguage",
  })

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const profile = await settingsService.getProfile()

        if (!isMounted) {
          return
        }

        setEmail(profile.email)
        reset({
          name: profile.name,
          phone: profile.phone ?? "",
          preferredLanguage: profile.preferredLanguage,
        })
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

    void loadProfile()

    return () => {
      isMounted = false
    }
  }, [reset])

  async function onSubmit(values: ProfileSettingsPayload) {
    try {
      const profile = await settingsService.updateProfile({
        name: values.name.trim(),
        phone: values.phone?.trim() ?? "",
        preferredLanguage: values.preferredLanguage,
      })

      setLocale(profile.preferredLanguage === "KM" ? "km" : "en")
      await refreshUser()
      reset({
        name: profile.name,
        phone: profile.phone ?? "",
        preferredLanguage: profile.preferredLanguage,
      })
      toast.success(t("savedSuccessfully"))
    } catch (error) {
      toast.error(getSettingsErrorMessage(error))
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex size-11 items-center justify-center rounded-lg border bg-muted/40">
          <UserRoundIcon />
        </div>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {errorMessage ? (
          <Alert className="mb-4" variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>{t("failedToLoad")}</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <form className="max-w-2xl" onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.name)}
                disabled={isLoading}
                id="name"
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
              <Input id="email" readOnly value={email} />
              <FieldDescription>{t("emailReadonly")}</FieldDescription>
            </Field>

            <Field data-invalid={Boolean(errors.phone)}>
              <FieldLabel htmlFor="phone">{t("phone")}</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.phone)}
                disabled={isLoading}
                id="phone"
                type="tel"
                {...register("phone")}
              />
              <FieldError errors={[errors.phone]} />
            </Field>

            <Field data-invalid={Boolean(errors.preferredLanguage)}>
              <FieldLabel htmlFor="preferredLanguage">
                {t("preferredLanguage")}
              </FieldLabel>
              <Select
                disabled={isLoading}
                value={preferredLanguage}
                onValueChange={(value) => {
                  if (value === "EN" || value === "KM") {
                    setValue("preferredLanguage", value, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    })
                  }
                }}
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.preferredLanguage)}
                  id="preferredLanguage"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {languageOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {rootT(option.translationKey)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError errors={[errors.preferredLanguage]} />
            </Field>

            <Button disabled={isLoading || isSubmitting} type="submit">
              <SaveIcon data-icon="inline-start" />
              {isSubmitting ? t("saving") : t("save")}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
