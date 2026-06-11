"use client"

import { useMemo } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRoundIcon, SaveIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

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
  type ChangePasswordPayload,
} from "@/lib/settings"

const defaultFormValues: ChangePasswordPayload = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
}

export default function SecuritySettingsPage() {
  const t = useTranslations("securitySettingsPage")
  const schema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, t("currentPasswordRequired")),
          newPassword: z.string().min(6, t("newPasswordMinLength")),
          confirmPassword: z.string().min(1, t("confirmPasswordRequired")),
        })
        .refine((values) => values.newPassword === values.confirmPassword, {
          message: t("passwordsMustMatch"),
          path: ["confirmPassword"],
        }) satisfies z.ZodType<ChangePasswordPayload>,
    [t]
  )

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<ChangePasswordPayload>({
    resolver: zodResolver(schema),
    defaultValues: defaultFormValues,
  })

  async function onSubmit(values: ChangePasswordPayload) {
    try {
      const response = await settingsService.changePassword(values)

      reset(defaultFormValues)
      toast.success(response.message || t("savedSuccessfully"))
    } catch (error) {
      toast.error(getSettingsErrorMessage(error))
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex size-11 items-center justify-center rounded-lg border bg-muted/40">
          <KeyRoundIcon />
        </div>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="max-w-2xl" onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.currentPassword)}>
              <FieldLabel htmlFor="currentPassword">
                {t("currentPassword")}
              </FieldLabel>
              <Input
                aria-invalid={Boolean(errors.currentPassword)}
                autoComplete="current-password"
                id="currentPassword"
                type="password"
                {...register("currentPassword")}
              />
              <FieldError errors={[errors.currentPassword]} />
            </Field>

            <Field data-invalid={Boolean(errors.newPassword)}>
              <FieldLabel htmlFor="newPassword">{t("newPassword")}</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.newPassword)}
                autoComplete="new-password"
                id="newPassword"
                type="password"
                {...register("newPassword")}
              />
              <FieldDescription>{t("newPasswordHelp")}</FieldDescription>
              <FieldError errors={[errors.newPassword]} />
            </Field>

            <Field data-invalid={Boolean(errors.confirmPassword)}>
              <FieldLabel htmlFor="confirmPassword">
                {t("confirmPassword")}
              </FieldLabel>
              <Input
                aria-invalid={Boolean(errors.confirmPassword)}
                autoComplete="new-password"
                id="confirmPassword"
                type="password"
                {...register("confirmPassword")}
              />
              <FieldError errors={[errors.confirmPassword]} />
            </Field>

            <Button disabled={isSubmitting} type="submit">
              <SaveIcon data-icon="inline-start" />
              {isSubmitting ? t("saving") : t("save")}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
