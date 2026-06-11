"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  BedDoubleIcon,
  CalendarArrowDownIcon,
  CalendarArrowUpIcon,
  CircleDollarSignIcon,
  HotelIcon,
  RefreshCwIcon,
  SparklesIcon,
  UsersIcon,
  WalletCardsIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  formatPreferenceCurrency,
  formatPreferenceDate,
  formatPreferenceDateRange,
  formatPreferenceNumber,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Booking, BookingStatus } from "@/lib/bookings"
import {
  dashboardService,
  getDashboardErrorMessage,
  type DashboardSummary,
} from "@/lib/dashboard"
import type { Payment, PaymentStatus } from "@/lib/payments"

type DashboardTranslation = ReturnType<typeof useTranslations<"dashboardPage">>

const emptySummary: DashboardSummary = {
  totalRooms: 0,
  availableRooms: 0,
  bookedRooms: 0,
  occupiedRooms: 0,
  maintenanceRooms: 0,
  totalGuests: 0,
  todayCheckIns: 0,
  todayCheckOuts: 0,
  totalRevenue: 0,
  monthlyRevenue: 0,
}

export default function DashboardPage() {
  const t = useTranslations("dashboardPage")
  const { preferences } = useSystemPreferences()
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary)
  const [recentBookings, setRecentBookings] = useState<Booking[]>([])
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const statCards = useMemo(
    () => [
      {
        label: t("totalRooms"),
        value: formatPreferenceNumber(summary.totalRooms, preferences),
        detail: t("inMaintenance", { count: summary.maintenanceRooms }),
        icon: HotelIcon,
      },
      {
        label: t("availableRooms"),
        value: formatPreferenceNumber(summary.availableRooms, preferences),
        detail: t("bookedCount", { count: summary.bookedRooms }),
        icon: SparklesIcon,
      },
      {
        label: t("occupiedRooms"),
        value: formatPreferenceNumber(summary.occupiedRooms, preferences),
        detail: t("currentlyCheckedIn"),
        icon: BedDoubleIcon,
      },
      {
        label: t("totalGuests"),
        value: formatPreferenceNumber(summary.totalGuests, preferences),
        detail: t("guestDirectory"),
        icon: UsersIcon,
      },
      {
        label: t("todayCheckIns"),
        value: formatPreferenceNumber(summary.todayCheckIns, preferences),
        detail: t("arrivalsScheduledToday"),
        icon: CalendarArrowDownIcon,
      },
      {
        label: t("todayCheckOuts"),
        value: formatPreferenceNumber(summary.todayCheckOuts, preferences),
        detail: t("departuresScheduledToday"),
        icon: CalendarArrowUpIcon,
      },
      {
        label: t("totalRevenue"),
        value: formatPreferenceCurrency(summary.totalRevenue, preferences),
        detail: t("paidPayments"),
        icon: CircleDollarSignIcon,
      },
      {
        label: t("monthlyRevenue"),
        value: formatPreferenceCurrency(summary.monthlyRevenue, preferences),
        detail: t("paidThisMonth"),
        icon: WalletCardsIcon,
      },
    ],
    [preferences, summary, t]
  )

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [summaryData, bookingData, paymentData] = await Promise.all([
        dashboardService.getSummary(),
        dashboardService.getRecentBookings(),
        dashboardService.getRecentPayments(),
      ])
      setSummary(summaryData)
      setRecentBookings(bookingData)
      setRecentPayments(paymentData)
    } catch (error) {
      setErrorMessage(getDashboardErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let ignore = false

    async function fetchDashboard() {
      try {
        const [summaryData, bookingData, paymentData] = await Promise.all([
          dashboardService.getSummary(),
          dashboardService.getRecentBookings(),
          dashboardService.getRecentPayments(),
        ])

        if (!ignore) {
          setSummary(summaryData)
          setRecentBookings(bookingData)
          setRecentPayments(paymentData)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(getDashboardErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void fetchDashboard()

    return () => {
      ignore = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-semibold leading-tight">
            {t("welcomeBack")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Button
          disabled={isLoading}
          onClick={() => void loadDashboard()}
          type="button"
          variant="outline"
        >
          <RefreshCwIcon data-icon="inline-start" />
          {t("refresh")}
        </Button>
      </section>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("failedToLoad")}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <MetricCard
            detail={stat.detail}
            icon={stat.icon}
            isLoading={isLoading}
            key={stat.label}
            label={stat.label}
            value={stat.value}
          />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("recentBookings")}</CardTitle>
            <CardDescription>
              {t("recentBookingsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentBookingsTable
              bookings={recentBookings}
              isLoading={isLoading}
              preferences={preferences}
              t={t}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("recentPayments")}</CardTitle>
            <CardDescription>
              {t("recentPaymentsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentPaymentsTable
              isLoading={isLoading}
              payments={recentPayments}
              preferences={preferences}
              t={t}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function MetricCard({
  detail,
  icon: Icon,
  isLoading,
  label,
  value,
}: {
  detail: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  isLoading: boolean
  label: string
  value: string
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <CardDescription>{detail}</CardDescription>
        <CardAction>
          <Icon />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="font-mono text-3xl font-semibold">
          {isLoading ? "..." : value}
        </div>
      </CardContent>
    </Card>
  )
}

function RecentBookingsTable({
  bookings,
  isLoading,
  preferences,
  t,
}: {
  bookings: Booking[]
  isLoading: boolean
  preferences: SystemPreferences
  t: DashboardTranslation
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("bookingId")}</TableHead>
          <TableHead>{t("guestName")}</TableHead>
          <TableHead>{t("roomNumber")}</TableHead>
          <TableHead>{t("checkInDate")}</TableHead>
          <TableHead>{t("status")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableStateRow colSpan={5} message={t("loadingBookings")} />
        ) : bookings.length ? (
          bookings.map((booking) => (
            <TableRow key={booking.id}>
              <TableCell>
                <div className="flex min-w-0 flex-col">
                  <span className="max-w-36 truncate font-medium">
                    {booking.id}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatPreferenceDate(booking.createdAt, preferences)}
                  </span>
                </div>
              </TableCell>
              <TableCell>{booking.guest.fullName}</TableCell>
              <TableCell>{booking.room.roomNumber}</TableCell>
              <TableCell>
                {formatPreferenceDateRange(
                  booking.checkInDate,
                  booking.checkOutDate,
                  preferences
                )}
              </TableCell>
              <TableCell>
                <BookingStatusBadge status={booking.status} t={t} />
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableStateRow colSpan={5} message={t("noRecentBookings")} />
        )}
      </TableBody>
    </Table>
  )
}

function RecentPaymentsTable({
  isLoading,
  payments,
  preferences,
  t,
}: {
  isLoading: boolean
  payments: Payment[]
  preferences: SystemPreferences
  t: DashboardTranslation
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("bookingId")}</TableHead>
          <TableHead>{t("guestName")}</TableHead>
          <TableHead>{t("roomNumber")}</TableHead>
          <TableHead>{t("amount")}</TableHead>
          <TableHead>{t("status")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableStateRow colSpan={5} message={t("loadingPayments")} />
        ) : payments.length ? (
          payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>
                <div className="flex min-w-0 flex-col">
                  <span className="max-w-36 truncate font-medium">
                    {payment.booking.id}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {payment.paidAt
                      ? formatPreferenceDate(payment.paidAt, preferences)
                      : t("notPaid")}
                  </span>
                </div>
              </TableCell>
              <TableCell>{payment.booking.guest.fullName}</TableCell>
              <TableCell>{payment.booking.room.roomNumber}</TableCell>
              <TableCell className="font-mono">
                {formatPreferenceCurrency(payment.amount, preferences)}
              </TableCell>
              <TableCell>
                <PaymentStatusBadge status={payment.status} t={t} />
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableStateRow colSpan={5} message={t("noRecentPayments")} />
        )}
      </TableBody>
    </Table>
  )
}

function BookingStatusBadge({
  status,
  t,
}: {
  status: BookingStatus
  t: DashboardTranslation
}) {
  const variant =
    status === "CONFIRMED"
      ? "default"
      : status === "CHECKED_IN"
        ? "secondary"
        : status === "CANCELLED"
          ? "destructive"
          : "outline"

  return <Badge variant={variant}>{getBookingStatusLabel(status, t)}</Badge>
}

function PaymentStatusBadge({
  status,
  t,
}: {
  status: PaymentStatus
  t: DashboardTranslation
}) {
  const variant =
    status === "PAID"
      ? "default"
      : status === "PENDING"
        ? "secondary"
        : status === "FAILED"
          ? "destructive"
          : "outline"

  return <Badge variant={variant}>{getPaymentStatusLabel(status, t)}</Badge>
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
        className="h-28 text-center text-sm text-muted-foreground"
        colSpan={colSpan}
      >
        {message}
      </TableCell>
    </TableRow>
  )
}

function getBookingStatusLabel(status: BookingStatus, t: DashboardTranslation) {
  const labels: Record<BookingStatus, string> = {
    PENDING: t("pending"),
    CONFIRMED: t("confirmed"),
    CHECKED_IN: t("checkedIn"),
    CHECKED_OUT: t("checkedOut"),
    CANCELLED: t("cancelled"),
  }

  return labels[status]
}

function getPaymentStatusLabel(status: PaymentStatus, t: DashboardTranslation) {
  const labels: Record<PaymentStatus, string> = {
    PENDING: t("pending"),
    PAID: t("paid"),
    FAILED: t("failed"),
    REFUNDED: t("refunded"),
  }

  return labels[status]
}
