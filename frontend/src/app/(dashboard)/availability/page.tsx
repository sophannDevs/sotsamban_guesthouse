"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  CalendarDaysIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

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

const statusVariants: Record<
  RoomAvailabilityStatus,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  AVAILABLE: "default",
  BOOKED: "secondary",
  OCCUPIED: "outline",
  MAINTENANCE: "destructive",
  CLEANING: "secondary",
}

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
          <CardDescription>
            {t("description")}
          </CardDescription>
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

        <div className="flex flex-wrap gap-2" aria-label={t("statusLegend")}>
          {(["AVAILABLE", "BOOKED", "OCCUPIED", "MAINTENANCE", "CLEANING"] as const).map((status) => (
            <StatusBadge
              key={status}
              status={status}
            >
              {getStatusLabel(status, t)}
            </StatusBadge>
          ))}
        </div>

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

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 min-w-40 bg-background">
                {t("roomNumber")}
              </TableHead>
              <TableHead className="min-w-28">{t("roomType")}</TableHead>
              <TableHead className="min-w-28">{t("pricePerNight")}</TableHead>
              {calendarDates.map((date) => (
                <TableHead className="min-w-32 text-center" key={date}>
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
                        <span className="font-medium">
                          {room.roomNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {room.roomId}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getRoomTypeLabel(room.roomType, t)}</TableCell>
                  <TableCell>{formatCurrency(room.pricePerNight)}</TableCell>
                  {room.dates.map((date) => (
                    <TableCell className="text-center" key={date.date}>
                      <StatusBadge status={date.status}>
                        {getStatusLabel(date.status, t)}
                      </StatusBadge>
                    </TableCell>
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
      </CardContent>
    </Card>
  )
}

function StatusBadge({
  children,
  status,
}: {
  children: React.ReactNode
  status: RoomAvailabilityStatus
}) {
  return <Badge variant={statusVariants[status]}>{children}</Badge>
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
    CLEANING: t("cleaning"),
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
