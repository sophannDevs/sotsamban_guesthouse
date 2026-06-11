"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircleIcon,
  CheckCircleIcon,
  FileDownIcon,
  ReceiptIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  XCircleIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Pagination } from "@/components/Pagination"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  formatPreferenceCurrency,
  formatPreferenceDate,
  type SystemPreferences,
  useSystemPreferences,
} from "@/components/app/system-preferences-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  bookingService,
  type Booking,
} from "@/lib/bookings"
import { defaultPaginationMeta, type PaginatedResponse } from "@/lib/api"
import {
  downloadInvoiceFile,
  getInvoiceErrorMessage,
  invoiceService,
} from "@/lib/invoices"
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

type StatusFilter = "ALL" | PaymentStatus

type Option<T extends string> = {
  value: T
  label: string
}

type TranslationFn = ReturnType<typeof useTranslations>
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

export default function PaymentsPage() {
  const t = useTranslations()
  const { preferences } = useSystemPreferences()
  const [payments, setPayments] = useState<Payment[]>([])
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<Payment>["meta"]>(defaultPaginationMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [isLoading, setIsLoading] = useState(true)
  const [isOptionsLoading, setIsOptionsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(
    null
  )
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [downloadingInvoiceBookingId, setDownloadingInvoiceBookingId] =
    useState<string | null>(null)
  const statusOptions: Option<PaymentStatus>[] = useMemo(
    () =>
      paymentStatuses.map((status) => ({
        value: status,
        label: getPaymentStatusLabel(status, t),
      })),
    [t]
  )
  const filterOptions: Option<StatusFilter>[] = useMemo(
    () => [{ value: "ALL", label: t("allStatuses") }, ...statusOptions],
    [statusOptions, t]
  )
  const methodOptions: Option<PaymentMethod>[] = useMemo(
    () =>
      paymentMethods.map((method) => ({
        value: method,
        label: getPaymentMethodLabel(method, t),
      })),
    [t]
  )
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

  const loadPayments = useCallback(async (filter: StatusFilter, nextPage = page) => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await paymentService.listPaginated({
        page: nextPage,
        limit,
        ...(filter === "ALL" ? {} : { status: filter }),
      })
      setPayments(response.data)
      setPaginationMeta(response.meta)
    } catch (error) {
      setErrorMessage(getPaymentErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [limit, page])

  const loadBookings = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    let ignore = false

    async function fetchPayments() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await paymentService.listPaginated({
          page,
          limit,
          ...(statusFilter === "ALL" ? {} : { status: statusFilter }),
        })

        if (!ignore) {
          setPayments(response.data)
          setPaginationMeta(response.meta)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(getPaymentErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void fetchPayments()

    return () => {
      ignore = true
    }
  }, [limit, page, statusFilter])

  useEffect(() => {
    let ignore = false

    async function fetchBookings() {
      try {
        const data = await bookingService.list()

        if (!ignore) {
          setBookings(data)
        }
      } catch (error) {
        if (!ignore) {
          setOptionsError(getPaymentErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setIsOptionsLoading(false)
        }
      }
    }

    void fetchBookings()

    return () => {
      ignore = true
    }
  }, [])

  function openCreateDialog() {
    setFormError(null)
    reset(defaultFormValues)
    setIsCreateOpen(true)
  }

  async function onSubmit(values: PaymentForm) {
    setFormError(null)

    try {
      const createdPayment = await paymentService.create(values)
      setPayments((currentPayments) =>
        statusFilter === "ALL" || statusFilter === createdPayment.status
          ? [createdPayment, ...currentPayments]
          : currentPayments
      )
      setIsCreateOpen(false)
      reset(defaultFormValues)
    } catch (error) {
      setFormError(getPaymentErrorMessage(error))
    }
  }

  async function updatePaymentStatus(
    payment: Payment,
    nextStatus: PaymentStatus
  ) {
    if (payment.status === nextStatus) {
      return
    }

    setStatusError(null)
    setUpdatingPaymentId(payment.id)

    try {
      const updatedPayment = await paymentService.updateStatus(
        payment.id,
        nextStatus
      )
      setPayments((currentPayments) =>
        currentPayments
          .map((currentPayment) =>
            currentPayment.id === updatedPayment.id
              ? updatedPayment
              : currentPayment
          )
          .filter(
            (currentPayment) =>
              statusFilter === "ALL" || currentPayment.status === statusFilter
          )
      )
    } catch (error) {
      setStatusError(getPaymentErrorMessage(error))
    } finally {
      setUpdatingPaymentId(null)
    }
  }

  async function downloadInvoice(bookingId: string) {
    setInvoiceError(null)
    setDownloadingInvoiceBookingId(bookingId)

    try {
      const blob = await invoiceService.downloadBookingInvoice(bookingId)
      downloadInvoiceFile(bookingId, blob)
    } catch (error) {
      setInvoiceError(await getInvoiceErrorMessage(error))
    } finally {
      setDownloadingInvoiceBookingId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{t("paymentPageTitle")}</CardTitle>
            <CardDescription>
              {t("paymentPageDescription")}
            </CardDescription>
          </div>
          <CardAction className="flex flex-wrap justify-end gap-2">
            <Select
              items={filterOptions}
              value={statusFilter}
              onValueChange={(value) => {
                const nextStatus = value as StatusFilter
                setStatusFilter(nextStatus)
                setPage(1)
              }}
            >
              <SelectTrigger aria-label={t("filterPaymentsByStatus")} size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {filterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button onClick={openCreateDialog}>
              <ReceiptIcon data-icon="inline-start" />
              {t("recordPayment")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("couldNotLoadPayments")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
              <Button
                className="mt-3 w-fit"
                onClick={() => void loadPayments(statusFilter, page)}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCwIcon data-icon="inline-start" />
                {t("retry")}
              </Button>
            </Alert>
          ) : null}

          {statusError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("paymentStatusCouldNotBeUpdated")}</AlertTitle>
              <AlertDescription>{statusError}</AlertDescription>
            </Alert>
          ) : null}

          {invoiceError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("invoiceDownloadFailed")}</AlertTitle>
              <AlertDescription>{invoiceError}</AlertDescription>
            </Alert>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("booking")}</TableHead>
                <TableHead>{t("guest")}</TableHead>
                <TableHead>{t("room")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead>{t("method")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("paidAt")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableStateRow message={t("loadingPayments")} />
              ) : payments.length ? (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium">
                          {payment.booking.id}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t("payment")} {payment.id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{payment.booking.guest.fullName}</TableCell>
                    <TableCell>
                      {t("roomLabel", { roomNumber: payment.booking.room.roomNumber })}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(payment.amount, preferences)}
                    </TableCell>
                    <TableCell>{getPaymentMethodLabel(payment.method, t)}</TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={payment.status} />
                    </TableCell>
                    <TableCell>
                      {payment.paidAt
                        ? formatDate(payment.paidAt, preferences)
                        : t("notPaid")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          disabled={
                            downloadingInvoiceBookingId === payment.bookingId
                          }
                          onClick={() => void downloadInvoice(payment.bookingId)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <FileDownIcon data-icon="inline-start" />
                          {downloadingInvoiceBookingId === payment.bookingId
                            ? t("downloading")
                            : t("downloadInvoice")}
                        </Button>
                        <Select
                          items={statusOptions}
                          value={payment.status}
                          onValueChange={(value) =>
                            void updatePaymentStatus(
                              payment,
                              value as PaymentStatus
                            )
                          }
                        >
                          <SelectTrigger
                            aria-label={t("updatePaymentStatusAria", {
                              paymentId: payment.id,
                            })}
                            disabled={updatingPaymentId === payment.id}
                            size="sm"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent align="end">
                            <SelectGroup>
                              {statusOptions.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableStateRow
                  message={
                    statusFilter === "ALL"
                      ? t("noPaymentsFound")
                      : t("noPaymentsByStatusFound", {
                          status: getPaymentStatusLabel(statusFilter, t).toLowerCase(),
                        })
                  }
                />
              )}
            </TableBody>
          </Table>
          <Pagination
            limit={paginationMeta.limit}
            page={paginationMeta.page}
            total={paginationMeta.total}
            totalPages={paginationMeta.totalPages}
            onLimitChange={(nextLimit) => {
              setLimit(nextLimit)
              setPage(1)
            }}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("createPayment")}</DialogTitle>
            <DialogDescription>
              {t("createPaymentDescription")}
            </DialogDescription>
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
                <FieldLabel htmlFor="bookingId">{t("booking")}</FieldLabel>
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
                    id="bookingId"
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
                <FieldLabel htmlFor="amount">{t("amount")}</FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.amount)}
                  id="amount"
                  min="0.01"
                  step="0.01"
                  type="number"
                  {...register("amount")}
                />
                <FieldDescription>
                  {selectedBooking
                    ? t("bookingTotalIs", {
                        amount: formatCurrency(
                          selectedBooking.totalPrice,
                          preferences
                        ),
                      })
                    : t("selectingBookingFillsAmount")}
                </FieldDescription>
                <FieldError>{errors.amount?.message}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.method)}>
                <FieldLabel htmlFor="method">{t("method")}</FieldLabel>
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
                    id="method"
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
                <FieldLabel htmlFor="status">{t("status")}</FieldLabel>
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
                    id="status"
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
              <Button
                disabled={isSubmitting || isOptionsLoading}
                type="submit"
              >
                {isSubmitting ? t("saving") : t("savePayment")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations()
  const variant =
    status === "PAID"
      ? "default"
      : status === "PENDING"
        ? "secondary"
        : status === "FAILED"
          ? "destructive"
          : "outline"

  const Icon =
    status === "PAID"
      ? CheckCircleIcon
      : status === "FAILED"
        ? XCircleIcon
        : status === "REFUNDED"
          ? RotateCcwIcon
          : ReceiptIcon

  return (
    <Badge variant={variant}>
      <Icon data-icon="inline-start" />
      {getPaymentStatusLabel(status, t)}
    </Badge>
  )
}

function getPaymentStatusLabel(status: PaymentStatus, t: TranslationFn) {
  const labels: Record<PaymentStatus, string> = {
    PENDING: t("pending"),
    PAID: t("paid"),
    FAILED: t("failed"),
    REFUNDED: t("refunded"),
  }

  return labels[status]
}

function getPaymentMethodLabel(method: PaymentMethod, t: TranslationFn) {
  const labels: Record<PaymentMethod, string> = {
    CASH: t("cash"),
    CARD: t("card"),
    QR: t("qr"),
  }

  return labels[method]
}

function TableStateRow({ message }: { message: string }) {
  return (
    <TableRow>
      <TableCell
        className="h-28 text-center text-sm text-muted-foreground"
        colSpan={8}
      >
        {message}
      </TableCell>
    </TableRow>
  )
}

function formatDate(value: string, preferences: SystemPreferences) {
  return formatPreferenceDate(value, preferences)
}

function formatCurrency(value: number, preferences: SystemPreferences) {
  return formatPreferenceCurrency(value, preferences)
}
