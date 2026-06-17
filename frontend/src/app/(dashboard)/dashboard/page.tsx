"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  BedDoubleIcon,
  BuildingIcon,
  CalendarArrowDownIcon,
  CalendarArrowUpIcon,
  CalendarPlusIcon,
  CircleDollarSignIcon,
  HotelIcon,
  LogInIcon,
  LogOutIcon,
  ReceiptIcon,
  RefreshCwIcon,
  SparklesIcon,
  StoreIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletCardsIcon,
  WalletIcon,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { useActiveBusiness } from "@/components/app/business-provider"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Booking, BookingStatus } from "@/lib/bookings"
import {
  dashboardService,
  getDashboardErrorMessage,
  type DashboardSummary,
} from "@/lib/dashboard"
import {
  financeService,
  getFinanceErrorMessage,
  type AllBusinessesFinanceSummary,
  type BusinessFinanceSummary,
  type FinanceSummary,
} from "@/lib/finance"
import type { Payment, PaymentStatus } from "@/lib/payments"
import { cn } from "@/lib/utils"

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
  const { activeBusiness } = useActiveBusiness()
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
        // Mobile: lower priority — appears 7th on small screens, DOM order on sm+
        mobileClass: "order-7 sm:order-none",
      },
      {
        label: t("availableRooms"),
        value: formatPreferenceNumber(summary.availableRooms, preferences),
        detail: t("bookedCount", { count: summary.bookedRooms }),
        icon: SparklesIcon,
        mobileClass: "order-4 sm:order-none",
      },
      {
        label: t("occupiedRooms"),
        value: formatPreferenceNumber(summary.occupiedRooms, preferences),
        detail: t("currentlyCheckedIn"),
        icon: BedDoubleIcon,
        mobileClass: "order-6 sm:order-none",
      },
      {
        label: t("totalGuests"),
        value: formatPreferenceNumber(summary.totalGuests, preferences),
        detail: t("guestDirectory"),
        icon: UsersIcon,
        mobileClass: "order-8 sm:order-none",
      },
      {
        label: t("todayCheckIns"),
        value: formatPreferenceNumber(summary.todayCheckIns, preferences),
        detail: t("arrivalsScheduledToday"),
        icon: CalendarArrowDownIcon,
        mobileClass: "order-1 sm:order-none",
      },
      {
        label: t("todayCheckOuts"),
        value: formatPreferenceNumber(summary.todayCheckOuts, preferences),
        detail: t("departuresScheduledToday"),
        icon: CalendarArrowUpIcon,
        mobileClass: "order-2 sm:order-none",
      },
      {
        label: t("totalRevenue"),
        value: formatPreferenceCurrency(summary.totalRevenue, preferences),
        detail: t("paidPayments"),
        icon: CircleDollarSignIcon,
        mobileClass: "order-3 sm:order-none",
      },
      {
        label: t("monthlyRevenue"),
        value: formatPreferenceCurrency(summary.monthlyRevenue, preferences),
        detail: t("paidThisMonth"),
        icon: WalletCardsIcon,
        mobileClass: "order-5 sm:order-none",
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
  // Re-fetch whenever the active business changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusiness?.businessId])

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

      <QuickActionsSection />

      <FinanceSummarySection />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <MetricCard
            className={stat.mobileClass}
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
  className,
  detail,
  icon: Icon,
  isLoading,
  label,
  value,
}: {
  className?: string
  detail: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  isLoading: boolean
  label: string
  value: string
}) {
  return (
    <Card className={className} size="sm">
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
    <>
      {/* Mobile card list */}
      <div className="flex flex-col divide-y sm:hidden">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("loadingBookings")}</p>
        ) : bookings.length ? (
          bookings.map((booking) => (
            <div className="flex items-start justify-between gap-2 py-3 first:pt-0 last:pb-0" key={booking.id}>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium leading-tight">{booking.guest.fullName}</span>
                <span className="text-sm text-muted-foreground">
                  {t("roomNumber")} {booking.room.roomNumber}
                  {" · "}{booking.coolingOption === "AIR_CONDITIONER" ? t("coolingAC") : t("coolingFan")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatPreferenceDateRange(booking.checkInDate, booking.checkOutDate, preferences)}
                </span>
              </div>
              <BookingStatusBadge status={booking.status} t={t} />
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("noRecentBookings")}</p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
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
                  <TableCell>
                    <div className="flex min-w-0 flex-col">
                      <span>{booking.room.roomNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {booking.coolingOption === "AIR_CONDITIONER" ? t("coolingAC") : t("coolingFan")}
                      </span>
                    </div>
                  </TableCell>
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
      </div>
    </>
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
    <>
      {/* Mobile card list */}
      <div className="flex flex-col divide-y sm:hidden">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("loadingPayments")}</p>
        ) : payments.length ? (
          payments.map((payment) => (
            <div className="flex items-start justify-between gap-2 py-3 first:pt-0 last:pb-0" key={payment.id}>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium leading-tight">{payment.booking.guest.fullName}</span>
                <span className="text-sm text-muted-foreground">
                  {t("roomNumber")} {payment.booking.room.roomNumber}
                </span>
                <span className="font-mono font-medium">
                  {formatPreferenceCurrency(payment.amount, preferences)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {payment.paidAt ? formatPreferenceDate(payment.paidAt, preferences) : t("notPaid")}
                </span>
              </div>
              <PaymentStatusBadge status={payment.status} t={t} />
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("noRecentPayments")}</p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
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
      </div>
    </>
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

function QuickActionsSection() {
  const t = useTranslations("dashboardPage")

  const actions = [
    { href: "/bookings", icon: CalendarPlusIcon, label: t("quickNewBooking"), variant: "default" as const },
    { href: "/bookings", icon: LogInIcon, label: t("quickCheckIn"), variant: "outline" as const },
    { href: "/bookings", icon: LogOutIcon, label: t("quickCheckOut"), variant: "outline" as const },
    { href: "/payments", icon: ReceiptIcon, label: t("quickAddPayment"), variant: "outline" as const },
    { href: "/expenses", icon: WalletIcon, label: t("quickAddExpense"), variant: "outline" as const },
  ]

  return (
    <section aria-label={t("quickActions")} className="lg:hidden">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("quickActions")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {actions.map(({ href, icon: Icon, label, variant }, index) => (
          <Button
            className={cn(
              "h-auto flex-col gap-1.5 py-3",
              index === actions.length - 1 && actions.length % 2 !== 0 && "col-span-2"
            )}
            key={href + label}
            render={<Link href={href} />}
            variant={variant}
          >
            <Icon className="size-5" />
            <span className="text-xs font-medium">{label}</span>
          </Button>
        ))}
      </div>
    </section>
  )
}

type FinanceView = "current" | "all"

type FinanceSummaryData = (FinanceSummary | AllBusinessesFinanceSummary) & {
  businesses?: BusinessFinanceSummary[]
}

function FinanceSummarySection() {
  const t = useTranslations("dashboardPage")
  const { preferences } = useSystemPreferences()
  const { activeBusiness } = useActiveBusiness()

  const [view, setView] = useState<FinanceView>("current")
  const [selectedPreset, setSelectedPreset] = useState("this_month")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [activeCustomStart, setActiveCustomStart] = useState("")
  const [activeCustomEnd, setActiveCustomEnd] = useState("")
  const [financeSummary, setFinanceSummary] =
    useState<FinanceSummaryData | null>(null)
  const [isFinanceLoading, setIsFinanceLoading] = useState(true)
  const [financeError, setFinanceError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function fetchFinance() {
      if (
        selectedPreset === "custom" &&
        (!activeCustomStart || !activeCustomEnd)
      ) {
        setIsFinanceLoading(false)
        return
      }

      setIsFinanceLoading(true)
      setFinanceError(null)

      try {
        const params =
          selectedPreset === "custom"
            ? {
                rangePreset: "custom",
                startDate: activeCustomStart,
                endDate: activeCustomEnd,
              }
            : { rangePreset: selectedPreset }

        const data =
          view === "all"
            ? await financeService.getAllBusinessesSummary(params)
            : await financeService.getSummary(params)

        if (!ignore) setFinanceSummary(data as FinanceSummaryData)
      } catch (error) {
        if (!ignore) setFinanceError(getFinanceErrorMessage(error))
      } finally {
        if (!ignore) setIsFinanceLoading(false)
      }
    }

    void fetchFinance()

    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    view,
    selectedPreset,
    activeCustomStart,
    activeCustomEnd,
    activeBusiness?.businessId,
  ])

  const isLoss = (financeSummary?.netProfit ?? 0) < 0
  const businesses =
    view === "all"
      ? (financeSummary as AllBusinessesFinanceSummary | null)?.businesses
      : undefined

  return (
    <section className="flex flex-col gap-3">
      {/* Header row: title/description + controls */}
      <div className="flex flex-wrap items-start gap-3 sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold">
            {t("financeSummaryTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("financeSummaryDescription")}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <Tabs
            value={view}
            onValueChange={(v) => {
              if (v) setView(v as FinanceView)
            }}
          >
            <TabsList>
              <TabsTrigger value="current">
                {t("financeViewCurrent")}
              </TabsTrigger>
              <TabsTrigger value="all">{t("financeViewAll")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select
            value={selectedPreset}
            onValueChange={(v) => {
              if (v) setSelectedPreset(v)
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="today">{t("periodToday")}</SelectItem>
                <SelectItem value="this_week">
                  {t("periodThisWeek")}
                </SelectItem>
                <SelectItem value="this_month">
                  {t("periodThisMonth")}
                </SelectItem>
                <SelectItem value="last_month">
                  {t("periodLastMonth")}
                </SelectItem>
                <SelectItem value="last_3_months">
                  {t("periodLast3Months")}
                </SelectItem>
                <SelectItem value="this_year">
                  {t("periodThisYear")}
                </SelectItem>
                <SelectItem value="custom">{t("periodCustom")}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Custom date range */}
      {selectedPreset === "custom" && (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end sm:gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="finance-start-date">
              {t("financeStartDate")}
            </Label>
            <Input
              className="w-full sm:w-40"
              id="finance-start-date"
              onChange={(e) => setCustomStartDate(e.target.value)}
              type="date"
              value={customStartDate}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="finance-end-date">{t("financeEndDate")}</Label>
            <Input
              className="w-full sm:w-40"
              id="finance-end-date"
              onChange={(e) => setCustomEndDate(e.target.value)}
              type="date"
              value={customEndDate}
            />
          </div>
          <Button
            className="col-span-2 sm:col-auto"
            disabled={!customStartDate || !customEndDate}
            onClick={() => {
              setActiveCustomStart(customStartDate)
              setActiveCustomEnd(customEndDate)
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("applyCustomRange")}
          </Button>
        </div>
      )}

      {/* Error */}
      {financeError && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("financeLoadError")}</AlertTitle>
          <AlertDescription>{financeError}</AlertDescription>
        </Alert>
      )}

      {/* Metric cards */}
      {!financeError && (
        <div className="grid gap-4 sm:grid-cols-3">
          <FinanceMetricCard
            detail={t("financeForPeriod")}
            icon={TrendingUpIcon}
            isLoading={isFinanceLoading}
            label={t("financeTotalRevenue")}
            value={formatPreferenceCurrency(
              financeSummary?.totalRevenue ?? 0,
              preferences
            )}
          />
          <FinanceMetricCard
            detail={t("financeForPeriod")}
            icon={WalletIcon}
            isLoading={isFinanceLoading}
            label={t("financeTotalExpense")}
            value={formatPreferenceCurrency(
              financeSummary?.totalExpense ?? 0,
              preferences
            )}
          />
          <FinanceMetricCard
            detail={t("financeNetFormula")}
            icon={isLoss ? TrendingDownIcon : TrendingUpIcon}
            isDestructive={isLoss}
            isLoading={isFinanceLoading}
            label={isLoss ? t("financeNetLoss") : t("financeNetProfit")}
            value={formatPreferenceCurrency(
              Math.abs(financeSummary?.netProfit ?? 0),
              preferences
            )}
          />
        </div>
      )}

      {/* All-businesses breakdown */}
      {view === "all" && !financeError && !isFinanceLoading && businesses && businesses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {t("financeByBusiness")}
          </p>
          <div className="flex flex-col divide-y rounded-lg border text-sm">
            {businesses.map((b) => {
              const bLoss = b.netProfit < 0
              return (
                <div
                  className="flex items-center gap-2 px-3 py-2.5"
                  key={b.businessId}
                >
                  {b.businessType === "STORE" ? (
                    <StoreIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <BuildingIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 truncate font-medium">
                    {b.businessName}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                    {formatPreferenceCurrency(b.revenue, preferences)}
                  </span>
                  <span
                    className={cn(
                      "w-24 shrink-0 text-right font-mono text-xs font-semibold",
                      bLoss ? "text-destructive" : "text-foreground"
                    )}
                  >
                    {bLoss ? "−" : "+"}
                    {formatPreferenceCurrency(
                      Math.abs(b.netProfit),
                      preferences
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

function FinanceMetricCard({
  detail,
  icon: Icon,
  isDestructive = false,
  isLoading,
  label,
  value,
}: {
  detail: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  isDestructive?: boolean
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
          <Icon className={cn(isDestructive && "text-destructive")} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "font-mono text-3xl font-semibold",
            isDestructive && "text-destructive"
          )}
        >
          {isLoading ? "..." : value}
        </div>
      </CardContent>
    </Card>
  )
}
