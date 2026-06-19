"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  BedDoubleIcon,
  BrushIcon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
  SearchIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  roomService,
  type RoomAvailability,
  type RoomAvailabilityStatus,
  type RoomType,
} from "@/lib/rooms"

type StatusConfig = {
  cellBg: string
  pillBg: string
  pillBorder: string
  icon: LucideIcon
  isBookable: boolean
}

const STATUS_CONFIG: Record<RoomAvailabilityStatus, StatusConfig> = {
  AVAILABLE: {
    cellBg: "bg-emerald-500/10",
    pillBg: "bg-emerald-500/20",
    pillBorder: "ring-1 ring-emerald-500/30",
    icon: CheckCircle2Icon,
    isBookable: true,
  },
  BOOKED: {
    cellBg: "bg-sky-500/10",
    pillBg: "bg-sky-500/20",
    pillBorder: "ring-1 ring-sky-500/30",
    icon: CalendarCheckIcon,
    isBookable: false,
  },
  OCCUPIED: {
    cellBg: "bg-violet-500/10",
    pillBg: "bg-violet-500/20",
    pillBorder: "ring-1 ring-violet-500/30",
    icon: BedDoubleIcon,
    isBookable: false,
  },
  MAINTENANCE: {
    cellBg: "bg-rose-500/10",
    pillBg: "bg-rose-500/20",
    pillBorder: "ring-1 ring-rose-500/30",
    icon: WrenchIcon,
    isBookable: false,
  },
  NEEDS_CLEANING: {
    cellBg: "bg-amber-500/10",
    pillBg: "bg-amber-500/20",
    pillBorder: "ring-1 ring-amber-500/30",
    icon: BrushIcon,
    isBookable: false,
  },
  CLEANING_IN_PROGRESS: {
    cellBg: "bg-orange-500/10",
    pillBg: "bg-orange-500/20",
    pillBorder: "ring-1 ring-orange-500/30",
    icon: RefreshCwIcon,
    isBookable: false,
  },
}

const LEGEND_ORDER = [
  "AVAILABLE",
  "BOOKED",
  "OCCUPIED",
  "MAINTENANCE",
  "NEEDS_CLEANING",
  "CLEANING_IN_PROGRESS",
] as const satisfies readonly RoomAvailabilityStatus[]

export default function AvailabilityPage() {
  const t = useTranslations("availability")
  const initialRange = useMemo(() => getInitialDateRange(), [])
  const [startDate, setStartDate] = useState(initialRange.startDate)
  const [endDate, setEndDate] = useState(initialRange.endDate)
  const [availability, setAvailability] = useState<RoomAvailability[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const calendarDates = useMemo(
    () => availability[0]?.dates.map((item) => item.date) ?? [],
    [availability]
  )

  const loadAvailability = useCallback(
    async (rangeStart: string, rangeEnd: string) => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const data = await roomService.availability({
          startDate: rangeStart,
          endDate: rangeEnd,
        })
        setAvailability(data)
      } catch {
        setErrorMessage(t("failedToLoad"))
        setAvailability([])
      } finally {
        setIsLoading(false)
      }
    },
    [t]
  )

  useEffect(() => {
    let isActive = true

    roomService
      .availability({
        startDate: initialRange.startDate,
        endDate: initialRange.endDate,
      })
      .then((data) => {
        if (isActive) {
          setAvailability(data)
        }
      })
      .catch(() => {
        if (isActive) {
          setErrorMessage(t("failedToLoad"))
          setAvailability([])
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [initialRange.endDate, initialRange.startDate, t])

  function applyFilters() {
    void loadAvailability(startDate, endDate)
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        <CardAction>
          <Button
            disabled={isLoading}
            onClick={() => void loadAvailability(startDate, endDate)}
            type="button"
            variant="outline"
          >
            <RefreshCwIcon data-icon="inline-start" />
            {t("refresh")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="rounded-lg border bg-muted/20 p-4">
          <h2 className="mb-4 text-sm font-medium">{t("selectDateRange")}</h2>
          <FieldGroup className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <Field>
              <FieldLabel htmlFor="availabilityStartDate">
                {t("startDate")}
              </FieldLabel>
              <Input
                id="availabilityStartDate"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="availabilityEndDate">
                {t("endDate")}
              </FieldLabel>
              <Input
                id="availabilityEndDate"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Field>
            <Field className="justify-end">
              <FieldLabel className="sr-only">
                {t("generateCalendar")}
              </FieldLabel>
              <Button
                disabled={isLoading}
                onClick={applyFilters}
                type="button"
              >
                <SearchIcon data-icon="inline-start" />
                {t("applyFilter")}
              </Button>
            </Field>
          </FieldGroup>
        </div>

        <StatusLegend t={t} />

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>{t("errorLoadingData")}</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
            <Button
              className="mt-3 w-fit"
              onClick={() => void loadAvailability(startDate, endDate)}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCwIcon data-icon="inline-start" />
              {t("refresh")}
            </Button>
          </Alert>
        ) : null}

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 min-w-40 bg-background">
                  {t("roomNumber")}
                </TableHead>
                <TableHead className="min-w-28">{t("roomType")}</TableHead>
                <TableHead className="min-w-28">{t("pricePerNight")}</TableHead>
                {calendarDates.map((date) => (
                  <TableHead className="min-w-36 text-center" key={date}>
                    <div className="flex flex-col gap-0.5">
                      <span>{formatDay(date)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(date)}
                      </span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableStateRow
                  colSpan={Math.max(calendarDates.length + 3, 4)}
                  message={t("loading")}
                />
              ) : availability.length ? (
                availability.map((room) => (
                  <TableRow key={room.roomId}>
                    <TableCell className="sticky left-0 bg-background">
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 items-center justify-center rounded-lg border bg-muted/40">
                          <CalendarDaysIcon />
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium">{room.roomNumber}</span>
                          <span className="text-xs text-muted-foreground">
                            {room.roomId}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoomTypeLabel(room.roomType, t)}</TableCell>
                    <TableCell>{formatCurrency(room.pricePerNight)}</TableCell>
                    {room.dates.map((date) => (
                      <StatusCell
                        key={date.date}
                        label={getStatusLabel(date.status, t)}
                        status={date.status}
                        unavailableLabel={t("unavailableNote")}
                      />
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableStateRow
                  colSpan={Math.max(calendarDates.length + 3, 4)}
                  message={t("noData")}
                />
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusCell({
  label,
  status,
  unavailableLabel,
}: {
  label: string
  status: RoomAvailabilityStatus
  unavailableLabel: string
}) {
  const config = STATUS_CONFIG[status]
  const StatusIcon = config.icon
  const tooltipTitle = config.isBookable
    ? label
    : `${label} — ${unavailableLabel}`

  return (
    <TableCell
      className={cn("p-1.5 text-center align-middle", config.cellBg)}
      title={tooltipTitle}
    >
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
          config.pillBg,
          config.pillBorder
        )}
      >
        <StatusIcon className="size-3 shrink-0" />
        <span>{label}</span>
      </div>
    </TableCell>
  )
}

function StatusLegend({
  t,
}: {
  t: ReturnType<typeof useTranslations<"availability">>
}) {
  return (
    <div
      aria-label={t("statusLegend")}
      className="rounded-lg border bg-muted/20 p-4"
    >
      <h3 className="mb-3 text-sm font-medium">{t("statusLegend")}</h3>
      <div className="flex flex-wrap gap-2">
        {LEGEND_ORDER.map((status) => {
          const config = STATUS_CONFIG[status]
          const StatusIcon = config.icon

          return (
            <div
              key={status}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                config.pillBg,
                config.pillBorder
              )}
            >
              <StatusIcon className="size-3 shrink-0" />
              <span>{getStatusLabel(status, t)}</span>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {t("cleaningBlockingNote")}
      </p>
    </div>
  )
}

function TableStateRow({
  colSpan,
  message,
}: {
  colSpan: number
  message: string
}) {
  return (
    <TableRow>
      <TableCell
        className="h-28 text-center text-muted-foreground"
        colSpan={colSpan}
      >
        {message}
      </TableCell>
    </TableRow>
  )
}

function getInitialDateRange() {
  const today = new Date()
  const end = new Date(today)
  end.setDate(today.getDate() + 6)

  return {
    startDate: formatDateInput(today),
    endDate: formatDateInput(end),
  }
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value)
}

function getStatusLabel(
  status: RoomAvailabilityStatus,
  t: ReturnType<typeof useTranslations<"availability">>
) {
  const labels: Record<RoomAvailabilityStatus, string> = {
    AVAILABLE: t("available"),
    BOOKED: t("booked"),
    OCCUPIED: t("occupied"),
    MAINTENANCE: t("maintenance"),
    NEEDS_CLEANING: t("needsCleaning"),
    CLEANING_IN_PROGRESS: t("cleaningInProgress"),
  }

  return labels[status]
}

function getRoomTypeLabel(
  type: RoomType,
  t: ReturnType<typeof useTranslations<"availability">>
) {
  const labels: Record<RoomType, string> = {
    SINGLE: t("single"),
    DOUBLE: t("double"),
  }

  return labels[type]
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`))
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`))
}
