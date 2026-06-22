"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import { MobileFilterDrawer } from "@/components/app/mobile-filter-drawer"
import { PaymentCreateDialog } from "@/components/app/payment-create-dialog"
import { defaultPaginationMeta, type PaginatedResponse } from "@/lib/api"
import {
  downloadInvoiceFile,
  getInvoiceErrorMessage,
  invoiceService,
} from "@/lib/invoices"
import {
  getPaymentErrorMessage,
  paymentService,
  paymentStatuses,
  type Payment,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/payments"

type StatusFilter = "ALL" | PaymentStatus

type Option<T extends string> = {
  value: T
  label: string
}

type TranslationFn = ReturnType<typeof useTranslations>

export default function PaymentsPage() {
  const t = useTranslations()
  const { preferences } = useSystemPreferences()
  const [payments, setPayments] = useState<Payment[]>([])
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<Payment>["meta"]>(defaultPaginationMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
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

  function handlePaymentCreated(createdPayment: Payment) {
    setPayments((currentPayments) =>
      statusFilter === "ALL" || statusFilter === createdPayment.status
        ? [createdPayment, ...currentPayments]
        : currentPayments
    )
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
            <MobileFilterDrawer
              activeCount={statusFilter !== "ALL" ? 1 : 0}
              onClear={() => {
                setStatusFilter("ALL")
                setPage(1)
              }}
              triggerClassName="md:hidden"
            >
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">{t("status")}</p>
                <Select
                  items={filterOptions}
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value as StatusFilter)
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {filterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </MobileFilterDrawer>
            <div className="hidden md:flex">
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
            </div>
            <Button onClick={() => setIsCreateOpen(true)}>
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

          {/* Mobile card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("loadingPayments")}
              </p>
            ) : payments.length ? (
              payments.map((payment) => (
                <div className="flex flex-col gap-3 rounded-lg border p-4" key={payment.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium leading-tight">{payment.booking.guest.fullName}</span>
                      <span className="text-sm text-muted-foreground">
                        {t("roomLabel", { roomNumber: payment.booking.room.roomNumber })}
                        {" · "}{payment.booking.coolingOption === "AIR_CONDITIONER" ? t("coolingAC") : t("coolingFan")}
                      </span>
                      <span className="font-mono font-medium">
                        {formatCurrency(payment.amount, preferences)}
                        {" · "}{getPaymentMethodLabel(payment.method, t)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {payment.paidAt ? formatDate(payment.paidAt, preferences) : t("notPaid")}
                      </span>
                    </div>
                    <PaymentStatusBadge status={payment.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      disabled={downloadingInvoiceBookingId === payment.bookingId}
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
                        void updatePaymentStatus(payment, value as PaymentStatus)
                      }
                    >
                      <SelectTrigger
                        aria-label={t("updatePaymentStatusAria", { paymentId: payment.id })}
                        disabled={updatingPaymentId === payment.id}
                        size="sm"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectGroup>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {statusFilter === "ALL"
                  ? t("noPaymentsFound")
                  : t("noPaymentsByStatusFound", {
                      status: getPaymentStatusLabel(statusFilter, t).toLowerCase(),
                    })}
              </p>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
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
                        <div className="flex min-w-0 flex-col">
                          <span>{t("roomLabel", { roomNumber: payment.booking.room.roomNumber })}</span>
                          <span className="text-xs text-muted-foreground">
                            {payment.booking.coolingOption === "AIR_CONDITIONER" ? t("coolingAC") : t("coolingFan")}
                          </span>
                        </div>
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
          </div>
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

      <PaymentCreateDialog
        onCreated={handlePaymentCreated}
        onOpenChange={setIsCreateOpen}
        open={isCreateOpen}
      />
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
