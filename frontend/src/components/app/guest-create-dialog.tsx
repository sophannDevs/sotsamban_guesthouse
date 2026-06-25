"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  getGuestErrorMessage,
  guestService,
  type Guest,
  type GuestPayload,
} from "@/lib/guests"

type GuestForm = GuestPayload

const defaultFormValues: GuestForm = {
  fullName: "",
  phone: "",
  email: "",
  idCardNumber: "",
  address: "",
}

export function GuestCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (guest: Guest) => void
}) {
  const t = useTranslations()

  const optionalText = z
    .string()
    .trim()
    .transform((value) => (value ? value : undefined))
    .optional()
  const optionalEmail = z
    .union([z.string().trim().email(t("emailValidation")), z.literal("")])
    .transform((value) => (value ? value : undefined))
    .optional()
  const guestSchema = z.object({
    fullName: z.string().trim().min(1, t("fullNameRequired")),
    phone: z.string().trim().min(1, t("phoneRequired")),
    email: optionalEmail,
    idCardNumber: optionalText,
    address: optionalText,
  }) satisfies z.ZodType<GuestPayload>

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<GuestForm>({
    resolver: zodResolver(guestSchema),
    defaultValues: defaultFormValues,
  })

  useEffect(() => {
    if (!open) return

    function run() {
      reset(defaultFormValues)
    }
    void run()
  }, [open, reset])

  async function onSubmit(values: GuestForm) {
    try {
      const created = await guestService.create(normalizeGuestPayload(values))
      onCreated?.(created)
      onOpenChange(false)
    } catch (error) {
      setError("root", { message: getGuestErrorMessage(error) })
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("createGuest")}</DialogTitle>
          <DialogDescription>{t("createGuestDescription")}</DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            {errors.root?.message ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>{t("guestCouldNotBeSaved")}</AlertTitle>
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            ) : null}

            <Field data-invalid={Boolean(errors.fullName)}>
              <FieldLabel htmlFor="qa-guest-fullName">{t("fullName")}</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.fullName)}
                autoComplete="name"
                id="qa-guest-fullName"
                placeholder="Sok Dara"
                {...register("fullName")}
              />
              <FieldError>{errors.fullName?.message}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.phone)}>
              <FieldLabel htmlFor="qa-guest-phone">{t("phone")}</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.phone)}
                autoComplete="tel"
                id="qa-guest-phone"
                placeholder="+855 12 345 678"
                type="tel"
                {...register("phone")}
              />
              <FieldError>{errors.phone?.message}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="qa-guest-email">{t("email")}</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.email)}
                autoComplete="email"
                id="qa-guest-email"
                placeholder="guest@example.com"
                type="email"
                {...register("email")}
              />
              <FieldError>{errors.email?.message}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.idCardNumber)}>
              <FieldLabel htmlFor="qa-guest-idCardNumber">
                {t("idCardNumber")}
              </FieldLabel>
              <Input
                aria-invalid={Boolean(errors.idCardNumber)}
                id="qa-guest-idCardNumber"
                placeholder="A123456789"
                {...register("idCardNumber")}
              />
              <FieldError>{errors.idCardNumber?.message}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.address)}>
              <FieldLabel htmlFor="qa-guest-address">{t("address")}</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.address)}
                autoComplete="street-address"
                id="qa-guest-address"
                placeholder="Phnom Penh"
                {...register("address")}
              />
              <FieldError>{errors.address?.message}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? t("saving") : t("saveGuest")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function normalizeGuestPayload(values: GuestForm): GuestPayload {
  return {
    fullName: values.fullName.trim(),
    phone: values.phone.trim(),
    ...(values.email ? { email: values.email } : {}),
    ...(values.idCardNumber ? { idCardNumber: values.idCardNumber } : {}),
    ...(values.address ? { address: values.address } : {}),
  }
}
