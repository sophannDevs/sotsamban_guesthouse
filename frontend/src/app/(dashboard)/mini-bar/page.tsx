"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  BanIcon,
  CalendarIcon,
  CreditCardIcon,
  MartiniIcon,
  PlusIcon,
  ReceiptIcon,
  RefreshCwIcon,
  RotateCcwIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { Pagination } from "@/components/Pagination"
import { ActionMenu } from "@/components/app/action-menu"
import { useActiveBusiness } from "@/components/app/business-provider"
import {
  MiniBarActionConfirmDialog,
  type MiniBarConfirmAction,
} from "@/components/app/mini-bar-action-confirm-dialog"
import { MiniBarConsumptionDetailDialog } from "@/components/app/mini-bar-consumption-detail-dialog"
import { MiniBarCreateSheet } from "@/components/app/mini-bar-create-sheet"
import { MiniBarStatusBadge } from "@/components/app/mini-bar-status-badge"
import { MobileFilterDrawer } from "@/components/app/mobile-filter-drawer"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { defaultPaginationMeta, type PaginatedResponse } from "@/lib/api"
import { bookingService, type Booking } from "@/lib/bookings"
import {
  getMiniBarErrorMessage,
  miniBarConsumptionService,
  type MiniBarConsumption,
  type MiniBarConsumptionStatus,
} from "@/lib/mini-bar-consumption"

type StatusFilter = "ALL" | MiniBarConsumptionStatus
type BookingFilter = "ALL" | string

export default function MiniBarPage() {
  const t = useTranslations()
  const { activeBusiness, isLoading: isBusinessLoading } = useActiveBusiness()
  const isGuesthouse = activeBusiness?.businessType === "GUESTHOUSE"

  // --- List state ---
  const [consumptions, setConsumptions] = useState<MiniBarConsumption[]>([])
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<MiniBarConsumption>["meta"]>(defaultPaginationMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("ALL")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [activeDateFrom, setActiveDateFrom] = useState("")
  const [activeDateTo, setActiveDateTo] = useState("")
  const [filterableBookings, setFilterableBookings] = useState<Booking[]>([])

  // --- Detail / row-action state ---
  const [viewingConsumption, setViewingConsumption] =
    useState<MiniBarConsumption | null>(null)
  const [confirmAction, setConfirmAction] = useState<MiniBarConfirmAction | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const statusOptions = useMemo(
    () => [
      { value: "ALL" as const, label: t("allStatuses") },
      { value: "DRAFT" as const, label: t("miniBar.statusDraft") },
      { value: "CHARGED" as const, label: t("miniBar.statusCharged") },
      { value: "CANCELLED" as const, label: t("miniBar.statusCancelled") },
      { value: "REFUNDED" as const, label: t("miniBar.statusRefunded") },
    ],
    [t],
  )

  const bookingFilterOptions = useMemo(
    () => [
      { value: "ALL" as const, label: t("miniBar.allBookings") },
      ...filterableBookings.map((b) => ({
        value: b.id,
        label: `${b.guest.fullName} — ${t("miniBar.roomLabel", { roomNumber: b.room.roomNumber })}`,
      })),
    ],
    [filterableBookings, t],
  )

  // --- Load consumptions list ---
  useEffect(() => {
    if (!isGuesthouse) {
      return
    }

    let ignore = false

    async function fetchConsumptions() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await miniBarConsumptionService.listPaginated({
          page,
          limit,
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
          ...(bookingFilter !== "ALL" ? { bookingId: bookingFilter } : {}),
          ...(activeDateFrom ? { from: activeDateFrom } : {}),
          ...(activeDateTo ? { to: activeDateTo } : {}),
        })

        if (!ignore) {
          setConsumptions(response.data)
          setPaginationMeta(response.meta)
        }
      } catch (error) {
        if (!ignore) setErrorMessage(getMiniBarErrorMessage(error))
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    void fetchConsumptions()
    return () => {
      ignore = true
    }
  }, [isGuesthouse, limit, page, statusFilter, bookingFilter, activeDateFrom, activeDateTo])

  // --- Load bookings for the filter dropdown ---
  useEffect(() => {
    if (!isGuesthouse) return

    let ignore = false

    async function fetchBookings() {
      try {
        const bookings = await bookingService.list()
        if (!ignore) setFilterableBookings(bookings)
      } catch {
        // Filter list is a convenience; ignore failures silently.
      }
    }

    void fetchBookings()
    return () => {
      ignore = true
    }
  }, [isGuesthouse])

  async function loadConsumptions() {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await miniBarConsumptionService.listPaginated({
        page,
        limit,
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        ...(bookingFilter !== "ALL" ? { bookingId: bookingFilter } : {}),
        ...(activeDateFrom ? { from: activeDateFrom } : {}),
        ...(activeDateTo ? { to: activeDateTo } : {}),
      })
      setConsumptions(response.data)
      setPaginationMeta(response.meta)
    } catch (error) {
      setErrorMessage(getMiniBarErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  function handleApplyFilters() {
    setActiveDateFrom(dateFrom)
    setActiveDateTo(dateTo)
    setPage(1)
  }

  function handleClearFilters() {
    setStatusFilter("ALL")
    setBookingFilter("ALL")
    setDateFrom("")
    setDateTo("")
    setActiveDateFrom("")
    setActiveDateTo("")
    setPage(1)
  }

  function applyUpdatedConsumption(updated: MiniBarConsumption) {
    setConsumptions((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setViewingConsumption((current) => (current?.id === updated.id ? updated : current))
  }

  if (isBusinessLoading) {
    return null
  }

  if (!isGuesthouse) {
    return (
      <Card>
        <CardHeader>
          <div className="flex size-11 items-center justify-center rounded-lg border bg-muted/40">
            <MartiniIcon />
          </div>
          <CardTitle>{t("miniBar.title")}</CardTitle>
          <CardDescription>{t("miniBar.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircleIcon />
            <AlertTitle>{t("miniBar.guesthouseOnlyTitle")}</AlertTitle>
            <AlertDescription>{t("miniBar.guesthouseOnlyDescription")}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{t("miniBar.title")}</CardTitle>
            <CardDescription>{t("miniBar.description")}</CardDescription>
          </div>
          <CardAction className="flex items-center gap-2">
            <MobileFilterDrawer
              activeCount={
                (statusFilter !== "ALL" ? 1 : 0) +
                (bookingFilter !== "ALL" ? 1 : 0) +
                (activeDateFrom || activeDateTo ? 1 : 0)
              }
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
              triggerClassName="md:hidden"
            >
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">{t("status")}</p>
                <Select
                  items={statusOptions}
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter((v ?? "ALL") as StatusFilter)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">{t("miniBar.booking")}</p>
                <Select
                  items={bookingFilterOptions}
                  value={bookingFilter}
                  onValueChange={(v) => setBookingFilter((v ?? "ALL") as BookingFilter)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {bookingFilterOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">{t("miniBar.dateRange")}</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </MobileFilterDrawer>
            <Button onClick={() => setIsCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              {t("miniBar.newConsumption")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Filters (desktop only) */}
          <div className="hidden flex-wrap items-end gap-2 md:flex">
            <Select
              items={statusOptions}
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter((v ?? "ALL") as StatusFilter)
                setPage(1)
              }}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select
              items={bookingFilterOptions}
              value={bookingFilter}
              onValueChange={(v) => {
                setBookingFilter((v ?? "ALL") as BookingFilter)
                setPage(1)
              }}
            >
              <SelectTrigger size="sm" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {bookingFilterOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <CalendarIcon className="size-4 text-muted-foreground" />
              <Input
                className="h-9 w-36"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                onBlur={handleApplyFilters}
              />
              <span className="text-muted-foreground">—</span>
              <Input
                className="h-9 w-36"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                onBlur={handleApplyFilters}
              />
            </div>
          </div>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("miniBar.couldNotLoadConsumptions")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
              <Button
                className="mt-3 w-fit"
                onClick={() => void loadConsumptions()}
                size="sm"
                variant="outline"
              >
                <RefreshCwIcon data-icon="inline-start" />
                {t("retry")}
              </Button>
            </Alert>
          ) : null}

          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("miniBar.booking")}</TableHead>
                  <TableHead>{t("store.items")}</TableHead>
                  <TableHead>{t("store.total")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("miniBar.createdBy")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <ConsumptionTableStateRow colSpan={6} message={t("miniBar.loadingConsumptions")} />
                ) : consumptions.length ? (
                  consumptions.map((consumption) => (
                    <TableRow key={consumption.id}>
                      <TableCell>
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium">{consumption.guest.fullName}</span>
                          <span className="text-xs text-muted-foreground">
                            {t("miniBar.roomLabel", { roomNumber: consumption.room.roomNumber })} ·{" "}
                            {formatDateTime(consumption.createdAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{consumption.items.length}</Badge>
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {formatCurrency(consumption.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <MiniBarStatusBadge status={consumption.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {consumption.createdBy.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            aria-label={t("miniBar.viewConsumptionAria")}
                            onClick={() => setViewingConsumption(consumption)}
                            size="icon-sm"
                            type="button"
                            variant="outline"
                          >
                            <ReceiptIcon />
                          </Button>
                          {consumption.status === "DRAFT" ? (
                            <>
                              <Button
                                aria-label={t("miniBar.chargeConsumption")}
                                onClick={() => setConfirmAction({ type: "charge", consumption })}
                                size="icon-sm"
                                type="button"
                                variant="outline"
                              >
                                <CreditCardIcon />
                              </Button>
                              <Button
                                aria-label={t("miniBar.cancelConsumption")}
                                onClick={() => setConfirmAction({ type: "cancel", consumption })}
                                size="icon-sm"
                                type="button"
                                variant="outline"
                              >
                                <BanIcon />
                              </Button>
                            </>
                          ) : null}
                          {consumption.status === "CHARGED" ? (
                            <Button
                              aria-label={t("miniBar.refundConsumption")}
                              onClick={() => setConfirmAction({ type: "refund", consumption })}
                              size="icon-sm"
                              type="button"
                              variant="destructive"
                            >
                              <RotateCcwIcon />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <ConsumptionTableStateRow colSpan={6} message={t("miniBar.noConsumptionsFound")} />
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("miniBar.loadingConsumptions")}
              </p>
            ) : consumptions.length ? (
              consumptions.map((consumption) => (
                <div key={consumption.id} className="flex flex-col gap-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium">{consumption.guest.fullName}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("miniBar.roomLabel", { roomNumber: consumption.room.roomNumber })} ·{" "}
                        {formatDateTime(consumption.createdAt)}
                      </span>
                    </div>
                    <MiniBarStatusBadge status={consumption.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>
                      {t("store.items")}: <Badge variant="secondary">{consumption.items.length}</Badge>
                    </span>
                    <span>·</span>
                    <span className="font-mono font-semibold">
                      {formatCurrency(consumption.totalAmount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => setViewingConsumption(consumption)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <ReceiptIcon data-icon="inline-start" />
                      {t("store.viewDetail")}
                    </Button>
                    <ActionMenu
                      items={[
                        consumption.status === "DRAFT" && {
                          label: t("miniBar.chargeConsumption"),
                          icon: <CreditCardIcon />,
                          onClick: () => setConfirmAction({ type: "charge", consumption }),
                        },
                        consumption.status === "DRAFT" && {
                          label: t("miniBar.cancelConsumption"),
                          icon: <BanIcon />,
                          onClick: () => setConfirmAction({ type: "cancel", consumption }),
                        },
                        consumption.status === "CHARGED" && {
                          label: t("miniBar.refundConsumption"),
                          icon: <RotateCcwIcon />,
                          onClick: () => setConfirmAction({ type: "refund", consumption }),
                          variant: "destructive" as const,
                        },
                      ]}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("miniBar.noConsumptionsFound")}
              </p>
            )}
          </div>

          <Pagination
            limit={paginationMeta.limit}
            page={paginationMeta.page}
            total={paginationMeta.total}
            totalPages={paginationMeta.totalPages}
            onLimitChange={(next) => {
              setLimit(next)
              setPage(1)
            }}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <MiniBarCreateSheet
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={(created) => setConsumptions((prev) => [created, ...prev])}
      />

      <MiniBarConsumptionDetailDialog
        consumption={viewingConsumption}
        onOpenChange={(open) => {
          if (!open) setViewingConsumption(null)
        }}
        onUpdated={applyUpdatedConsumption}
      />

      <MiniBarActionConfirmDialog
        action={confirmAction}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null)
        }}
        onConfirmed={(updated) => {
          applyUpdatedConsumption(updated)
          setConfirmAction(null)
        }}
      />
    </>
  )
}

// ── Helpers ──

function ConsumptionTableStateRow({
  colSpan,
  message,
}: {
  colSpan: number
  message: string
}) {
  return (
    <TableRow>
      <TableCell className="h-28 text-center text-sm text-muted-foreground" colSpan={colSpan}>
        {message}
      </TableCell>
    </TableRow>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}
