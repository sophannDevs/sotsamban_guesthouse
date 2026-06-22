"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  formatPreferenceCurrency,
  useSystemPreferences,
} from "@/components/app/system-preferences-provider"
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
import { bookingService, type Booking } from "@/lib/bookings"
import {
  getPaymentErrorMessage,
  paymentMethods,
  paymentService,
  paymentStatuses,
  type Payment,
  type PaymentMethod,
  type PaymentPayload,
  type PaymentStatus,
} from "@/lib/payments"

type PaymentFormInput = Omit<PaymentPayload, "amount"> & {
  amount: unknown
  status: PaymentStatus
}
type PaymentForm = PaymentPayload & { status: PaymentStatus }

const defaultFormValues: PaymentFormInput = {
  bookingId: "",
  amount: 0,
  method: "CASH",
  status: "PENDING",
}

export function PaymentCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (payment: Payment) => void
}) {
  const t = useTranslations()
  const { preferences } = useSystemPreferences()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isOptionsLoading, setIsOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const paymentSchema = z.object({
    bookingId: z.string().min(1, t("selectBooking")),
    amount: z.coerce
      .number({ message: t("enterAmount") })
      .positive(t("amountMustBePositive")),
    method: z.enum(paymentMethods, { message: t("selectPaymentMethod") }),
    status: z.enum(paymentStatuses, { message: t("selectPaymentStatus") }),
  }) satisfies z.ZodType<PaymentForm>

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<PaymentFormInput, unknown, PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: defaultFormValues,
  })

  const selectedBookingId = useWatch({ control, name: "bookingId" })
  const selectedMethod = useWatch({ control, name: "method" })
  const selectedStatus = useWatch({ control, name: "status" })

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedBookingId),
    [bookings, selectedBookingId]
  )

  const bookingOptions = useMemo(
    () =>
      bookings.map((booking) => ({
        value: booking.id,
        label: `${booking.id} - ${booking.guest.fullName} - ${t("roomLabel", { roomNumber: booking.room.roomNumber })}`,
      })),
    [bookings, t]
  )

  const statusOptions = useMemo(
    () =>
      paymentStatuses.map((status) => ({
        value: status,
        label: getPaymentStatusLabel(status, t),
      })),
    [t]
  )

  const methodOptions = useMemo(
    () =>
      paymentMethods.map((method) => ({
        value: method,
        label: getPaymentMethodLabel(method, t),
      })),
    [t]
  )

  async function loadBookings() {
    setIsOptionsLoading(true)
    setOptionsError(null)

    try {
      const data = await bookingService.list()
      setBookings(data)
    } catch (error) {
      setOptionsError(getPaymentErrorMessage(error))
    } finally {
      setIsOptionsLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return

    async function run() {
      setFormError(null)
      reset(defaultFormValues)
      await loadBookings()
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onSubmit(values: PaymentForm) {
    setFormError(null)

    try {
      const createdPayment = await paymentService.create(values)
      onCreated?.(createdPayment)
      onOpenChange(false)
      reset(defaultFormValues)
    } catch (error) {
      setFormError(getPaymentErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("createPayment")}</DialogTitle>
          <DialogDescription>{t("createPaymentDescription")}</DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            {optionsError ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>{t("couldNotLoadBookingOptions")}</AlertTitle>
                <AlertDescription>{optionsError}</AlertDescription>
                <Button
                  className="mt-3 w-fit"
                  onClick={() => void loadBookings()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCwIcon data-icon="inline-start" />
                  {t("retry")}
                </Button>
              </Alert>
            ) : null}

            {formError ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>{t("paymentCouldNotBeSaved")}</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <Field data-invalid={Boolean(errors.bookingId)}>
              <FieldLabel htmlFor="qa-payment-bookingId">{t("booking")}</FieldLabel>
              <Select
                items={bookingOptions}
                value={selectedBookingId}
                onValueChange={(value) => {
                  const nextBookingId = value as string
                  const booking = bookings.find(
                    (bookingItem) => bookingItem.id === nextBookingId
                  )

                  setValue("bookingId", nextBookingId, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })

                  if (booking) {
                    setValue("amount", booking.totalPrice, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                }}
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.bookingId)}
                  disabled={isOptionsLoading}
                  id="qa-payment-bookingId"
                >
                  <SelectValue placeholder={t("selectBooking")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {bookingOptions.map((booking) => (
                      <SelectItem key={booking.value} value={booking.value}>
                        {booking.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{errors.bookingId?.message}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.amount)}>
              <FieldLabel htmlFor="qa-payment-amount">{t("amount")}</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.amount)}
                id="qa-payment-amount"
                min="0.01"
                step="0.01"
                type="number"
                {...register("amount")}
              />
              <FieldDescription>
                {selectedBooking ? (
                  <>
                    {t("bookingTotalIs", {
                      amount: formatPreferenceCurrency(selectedBooking.totalPrice, preferences),
                    })}
                    <span className="block text-xs">
                      {t("paidAmount")}: {formatPreferenceCurrency(selectedBooking.paidAmount, preferences)}
                      {" · "}
                      {t("balanceDue")}: {formatPreferenceCurrency(selectedBooking.balanceDue, preferences)}
                    </span>
                  </>
                ) : (
                  t("selectingBookingFillsAmount")
                )}
              </FieldDescription>
              <FieldError>{errors.amount?.message}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.method)}>
              <FieldLabel htmlFor="qa-payment-method">{t("method")}</FieldLabel>
              <Select
                items={methodOptions}
                value={selectedMethod}
                onValueChange={(value) =>
                  setValue("method", value as PaymentMethod, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.method)}
                  id="qa-payment-method"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {methodOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{errors.method?.message}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.status)}>
              <FieldLabel htmlFor="qa-payment-status">{t("status")}</FieldLabel>
              <Select
                items={statusOptions}
                value={selectedStatus}
                onValueChange={(value) =>
                  setValue("status", value as PaymentStatus, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.status)}
                  id="qa-payment-status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{errors.status?.message}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button disabled={isSubmitting || isOptionsLoading} type="submit">
              {isSubmitting ? t("saving") : t("savePayment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getPaymentStatusLabel(
  status: PaymentStatus,
  t: ReturnType<typeof useTranslations>
) {
  const labels: Record<PaymentStatus, string> = {
    PENDING: t("pending"),
    PAID: t("paid"),
    FAILED: t("failed"),
    REFUNDED: t("refunded"),
  }

  return labels[status]
}

function getPaymentMethodLabel(
  method: PaymentMethod,
  t: ReturnType<typeof useTranslations>
) {
  const labels: Record<PaymentMethod, string> = {
    CASH: t("cash"),
    CARD: t("card"),
    QR: t("qr"),
  }

  return labels[method]
}
