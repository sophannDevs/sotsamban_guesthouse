"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  AlertCircleIcon,
  BedDoubleIcon,
  BrushIcon,
  BuildingIcon,
  CalendarArrowDownIcon,
  CalendarArrowUpIcon,
  CalendarPlusIcon,
  CheckCheckIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  LogInIcon,
  LogOutIcon,
  PlusIcon,
  UserPlusIcon,
  ReceiptIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StoreIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  formatPreferenceCurrency,
  formatPreferenceDate,
  formatPreferenceDateRange,
  type SystemPreferences,
  useSystemPreferences,
} from "@/components/app/system-preferences-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
import { Skeleton } from "@/components/ui/skeleton"
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
  type DashboardTodayCheckIn,
  type DashboardTodayCheckOut,
  type DashboardWalkInGuest,
  type HousekeepingDashboardSummary,
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

// ---------------------------------------------------------------------------
// Lazy-loaded heavy dialogs — code-split, only fetched on first open
// ---------------------------------------------------------------------------
const CheckInOutSheet = dynamic(
  () =>
    import("@/components/app/check-in-out-sheet").then((m) => ({
      default: m.CheckInOutSheet,
    })),
  { ssr: false }
)
const ExpenseCreateDialog = dynamic(
  () =>
    import("@/components/app/expense-create-dialog").then((m) => ({
      default: m.ExpenseCreateDialog,
    })),
  { ssr: false }
)
const PaymentCreateDialog = dynamic(
  () =>
    import("@/components/app/payment-create-dialog").then((m) => ({
      default: m.PaymentCreateDialog,
    })),
  { ssr: false }
)
const QuickBookingDialog = dynamic(
  () =>
    import("@/components/app/quick-booking-dialog").then((m) => ({
      default: m.QuickBookingDialog,
    })),
  { ssr: false }
)
const BookingDetailSheet = dynamic(
  () =>
    import("@/components/app/booking-detail-sheet").then((m) => ({
      default: m.BookingDetailSheet,
    })),
  { ssr: false }
)
const WalkInCheckInSheet = dynamic(
  () =>
    import("@/components/app/walk-in-check-in-sheet").then((m) => ({
      default: m.WalkInCheckInSheet,
    })),
  { ssr: false }
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DashboardTranslation = ReturnType<typeof useTranslations<"dashboardPage">>
type QuickAction = "newBooking" | "walkIn" | "checkIn" | "checkOut" | "addPayment" | "addExpense"

const emptySummary: DashboardSummary = {
  todayCheckIns: [],
  todayCheckOuts: [],
  availableRooms: 0,
  occupiedRooms: 0,
  needsCleaningRooms: 0,
  totalRevenueToday: 0,
  walkInGuests: [],
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const t = useTranslations("dashboardPage")
  const { preferences } = useSystemPreferences()
  const { activeBusiness } = useActiveBusiness()
  const isGuesthouse = activeBusiness?.businessType === "GUESTHOUSE"

  const [summary, setSummary] = useState<DashboardSummary>(emptySummary)
  const [recentBookings, setRecentBookings] = useState<Booking[]>([])
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [housekeeping, setHousekeeping] = useState<HousekeepingDashboardSummary | null>(null)
  const [activeQuickAction, setActiveQuickAction] = useState<QuickAction | null>(null)
  const [bookingSheet, setBookingSheet] = useState<{
    id: string
    mode: "checkIn" | "checkOut"
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // ------------------------------------------------------------------
  // Single fetch function — used both on mount and by the refresh button.
  // fetchCountRef ensures that only the latest in-flight response updates state.
  // ------------------------------------------------------------------
  const fetchCountRef = useRef(0)

  // silent=true skips the loading spinner — used for background refreshes after
  // optimistic updates so the UI doesn't flicker.
  const loadDashboard = (guesthouse: boolean, silent = false) => {
    const myCount = ++fetchCountRef.current
    if (!silent) {
      setIsLoading(true)
      setErrorMessage(null)
    }

    Promise.all([
      dashboardService.getSummary(),
      dashboardService.getRecentBookings(),
      dashboardService.getRecentPayments(),
      guesthouse
        ? dashboardService.getHousekeepingSummary()
        : Promise.resolve(null),
    ])
      .then(([summaryData, bookingData, paymentData, hkData]) => {
        if (fetchCountRef.current !== myCount) return
        setSummary(summaryData)
        setRecentBookings(bookingData)
        setRecentPayments(paymentData)
        setHousekeeping(hkData)
      })
      .catch((error) => {
        if (fetchCountRef.current === myCount && !silent) {
          setErrorMessage(getDashboardErrorMessage(error))
        }
      })
      .finally(() => {
        if (fetchCountRef.current === myCount && !silent) setIsLoading(false)
      })
  }

  const handleWalkInComplete = () => {
    setSummary((prev) => ({
      ...prev,
      availableRooms: Math.max(0, prev.availableRooms - 1),
      occupiedRooms: prev.occupiedRooms + 1,
    }))
    loadDashboard(isGuesthouse, true)
  }

  // Applies an instant optimistic update to the summary counters and kicks off
  // a silent background refresh so real data eventually converges.
  const handleActionComplete = (
    completedBookingId: string,
    completedMode: "checkIn" | "checkOut",
  ) => {
    setSummary((prev) => {
      if (completedMode === "checkIn") {
        return {
          ...prev,
          todayCheckIns: prev.todayCheckIns.filter(
            (b) => b.bookingId !== completedBookingId,
          ),
          occupiedRooms: prev.occupiedRooms + 1,
        }
      }
      return {
        ...prev,
        todayCheckOuts: prev.todayCheckOuts.filter(
          (b) => b.bookingId !== completedBookingId,
        ),
        occupiedRooms: Math.max(0, prev.occupiedRooms - 1),
        needsCleaningRooms: prev.needsCleaningRooms + 1,
      }
    })
    loadDashboard(isGuesthouse, true)
  }

  useEffect(() => {
    loadDashboard(isGuesthouse)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusiness?.businessId, isGuesthouse])

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <section className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-semibold leading-tight">
            {t("welcomeBack")}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Button
          className="shrink-0"
          disabled={isLoading}
          onClick={() => loadDashboard(isGuesthouse)}
          size="sm"
          type="button"
          variant="outline"
        >
          <RefreshCwIcon data-icon="inline-start" />
          <span className="hidden sm:inline">{t("refresh")}</span>
        </Button>
      </section>

      {/* ── Error alert ── */}
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("failedToLoad")}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {/* ── 1. Today Summary Cards ── */}
      <GuestHouseSummaryCards
        isLoading={isLoading}
        onCheckIn={(id) => setBookingSheet({ id, mode: "checkIn" })}
        onCheckOut={(id) => setBookingSheet({ id, mode: "checkOut" })}
        preferences={preferences}
        summary={summary}
        t={t}
      />

      {/* ── 1b. Today Walk-in Guests (guesthouse only, hidden when empty) ── */}
      {isGuesthouse && (
        <WalkInGuestsSection
          isLoading={isLoading}
          walkInGuests={summary.walkInGuests}
          t={t}
        />
      )}

      {/* ── 2. Quick Actions (mobile only) ── */}
      <QuickActionsSection isGuesthouse={isGuesthouse} onAction={setActiveQuickAction} />

      {/* Lazy-loaded dialogs — mounted only when first triggered */}
      {activeQuickAction === "newBooking" && (
        <QuickBookingDialog
          onCreated={() => loadDashboard(isGuesthouse)}
          onOpenChange={(open) => setActiveQuickAction(open ? "newBooking" : null)}
          open
        />
      )}
      {activeQuickAction === "walkIn" && (
        <WalkInCheckInSheet
          onComplete={handleWalkInComplete}
          onOpenChange={(open) => setActiveQuickAction(open ? "walkIn" : null)}
          open
        />
      )}
      {activeQuickAction === "checkIn" && (
        <CheckInOutSheet
          mode="checkIn"
          onActionComplete={() => loadDashboard(isGuesthouse)}
          onOpenChange={(open) => setActiveQuickAction(open ? "checkIn" : null)}
          open
        />
      )}
      {activeQuickAction === "checkOut" && (
        <CheckInOutSheet
          mode="checkOut"
          onActionComplete={() => loadDashboard(isGuesthouse)}
          onOpenChange={(open) => setActiveQuickAction(open ? "checkOut" : null)}
          open
        />
      )}
      {activeQuickAction === "addPayment" && (
        <PaymentCreateDialog
          onCreated={() => loadDashboard(isGuesthouse)}
          onOpenChange={(open) => setActiveQuickAction(open ? "addPayment" : null)}
          open
        />
      )}
      {activeQuickAction === "addExpense" && (
        <ExpenseCreateDialog
          onCreated={() => loadDashboard(isGuesthouse)}
          onOpenChange={(open) => setActiveQuickAction(open ? "addExpense" : null)}
          open
        />
      )}

      {/* Booking detail bottom sheet */}
      {bookingSheet && (
        <BookingDetailSheet
          bookingId={bookingSheet.id}
          mode={bookingSheet.mode}
          onActionComplete={handleActionComplete}
          onOpenChange={(open) => {
            if (!open) setBookingSheet(null)
          }}
          open
        />
      )}

      {/* ── 3. Recent Bookings ── */}
      <RecentBookingsSection
        bookings={recentBookings}
        isLoading={isLoading}
        preferences={preferences}
        t={t}
      />

      {/* ── 4. Housekeeping Alerts (GUESTHOUSE only) ── */}
      {isGuesthouse && (
        <HousekeepingAlertsSection
          housekeeping={housekeeping}
          isLoading={isLoading}
          t={t}
        />
      )}

      {/* ── 5. Finance Toggle ── */}
      <FinanceSummarySection />

      {/* ── Desktop-only: HK task tables ── */}
      {isGuesthouse && (
        <section className="hidden gap-5 sm:grid sm:grid-cols-2">
          <HousekeepingTasksCard
            description={t("hkTodayDescription")}
            emptyMessage={t("hkTodayEmpty")}
            isLoading={isLoading}
            t={t}
            tasks={housekeeping?.todaysTasks ?? []}
            title={t("hkTodayTitle")}
          />
          <HousekeepingTasksCard
            description={t("hkUrgentDescription")}
            emptyMessage={t("hkUrgentEmpty")}
            isLoading={isLoading}
            t={t}
            tasks={housekeeping?.urgentTasks ?? []}
            title={t("hkUrgentTitle")}
          />
        </section>
      )}

      {/* ── Desktop-only: Recent Payments ── */}
      <Card className="hidden sm:block">
        <CardHeader>
          <CardTitle>{t("recentPayments")}</CardTitle>
          <CardDescription>{t("recentPaymentsDescription")}</CardDescription>
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1. Today Summary Cards
// ---------------------------------------------------------------------------

function GuestHouseSummaryCards({
  isLoading,
  onCheckIn,
  onCheckOut,
  preferences,
  summary,
  t,
}: {
  isLoading: boolean
  onCheckIn: (bookingId: string) => void
  onCheckOut: (bookingId: string) => void
  preferences: SystemPreferences
  summary: DashboardSummary
  t: DashboardTranslation
}) {
  return (
    <section aria-label={t("overview")}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <BookingListCard
          bookings={summary.todayCheckIns}
          emptyMessage={t("noCheckInsToday")}
          icon={CalendarArrowDownIcon}
          isLoading={isLoading}
          label={t("todayCheckIns")}
          mode="checkIn"
          onAction={onCheckIn}
          t={t}
        />
        <BookingListCard
          bookings={summary.todayCheckOuts}
          emptyMessage={t("noCheckOutsToday")}
          icon={CalendarArrowUpIcon}
          isLoading={isLoading}
          label={t("todayCheckOuts")}
          mode="checkOut"
          onAction={onCheckOut}
          t={t}
        />
        <StatSummaryCard
          className="border-emerald-500/20 bg-emerald-500/5"
          icon={SparklesIcon}
          isLoading={isLoading}
          label={t("availableRooms")}
          value={String(summary.availableRooms)}
        />
        <StatSummaryCard
          className="border-blue-500/20 bg-blue-500/5"
          icon={BedDoubleIcon}
          isLoading={isLoading}
          label={t("occupiedRooms")}
          value={String(summary.occupiedRooms)}
        />
        <StatSummaryCard
          className={summary.needsCleaningRooms > 0 ? "border-amber-500/20 bg-amber-500/5" : ""}
          icon={BrushIcon}
          isLoading={isLoading}
          label={t("needsCleaningRooms")}
          urgent={summary.needsCleaningRooms > 0}
          value={String(summary.needsCleaningRooms)}
        />
        <StatSummaryCard
          icon={CircleDollarSignIcon}
          isLoading={isLoading}
          label={t("totalRevenueToday")}
          value={formatPreferenceCurrency(summary.totalRevenueToday, preferences)}
        />
      </div>
    </section>
  )
}

function BookingListCard({
  bookings,
  emptyMessage,
  icon: Icon,
  isLoading,
  label,
  mode,
  onAction,
  t,
}: {
  bookings: DashboardTodayCheckIn[] | DashboardTodayCheckOut[]
  emptyMessage: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  isLoading: boolean
  label: string
  mode: "checkIn" | "checkOut"
  onAction: (bookingId: string) => void
  t: DashboardTranslation
}) {
  const ActionIcon = mode === "checkIn" ? LogInIcon : LogOutIcon
  const actionLabel = mode === "checkIn" ? t("checkIn") : t("checkOut")

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">{label}</CardTitle>
          </div>
          {isLoading ? (
            <Skeleton className="h-5 w-8 rounded-full" />
          ) : (
            <Badge variant="secondary">{bookings.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div className="flex items-center justify-between gap-3" key={i}>
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-8 w-20 shrink-0" />
              </div>
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <p className="py-1 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="flex flex-col divide-y">
            {bookings.map((item) => {
              const alreadyDone = mode === "checkIn"
                ? (item as DashboardTodayCheckIn).checkInTime !== null
                : false
              return (
                <div
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  key={item.bookingId}
                >
                  <div className="min-w-0 flex-1 flex flex-col">
                    <span className="truncate text-sm font-medium leading-tight">
                      {item.guestName}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{t("roomNumberShort")} {item.roomNumber}</span>
                      {(item as DashboardTodayCheckIn).source === "WALK_IN" && (
                        <Badge variant="info" className="h-4 px-1 text-[10px]">
                          Walk-in
                        </Badge>
                      )}
                    </div>
                  </div>
                  {alreadyDone ? (
                    <Badge variant="success" className="shrink-0 h-7 px-2.5 text-xs">
                      {t("checkedIn")}
                    </Badge>
                  ) : (
                    <Button
                      className="shrink-0 gap-1.5"
                      onClick={() => onAction(item.bookingId)}
                      size="sm"
                      variant="outline"
                    >
                      <ActionIcon className="size-3.5" />
                      {actionLabel}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatSummaryCard({
  className,
  icon: Icon,
  isLoading,
  label,
  urgent = false,
  value,
}: {
  className?: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  isLoading: boolean
  label: string
  urgent?: boolean
  value: string
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle
            className={cn(
              "text-sm font-medium text-muted-foreground",
              urgent && "text-amber-700 dark:text-amber-400",
            )}
          >
            {label}
          </CardTitle>
          <Icon
            className={cn(
              "size-4 shrink-0 text-muted-foreground",
              urgent && "text-amber-600 dark:text-amber-400",
            )}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <p
            className={cn(
              "font-mono text-3xl font-bold leading-none",
              urgent && "text-amber-700 dark:text-amber-400",
            )}
          >
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 1b. Today Walk-in Guests
// ---------------------------------------------------------------------------

function WalkInGuestsSection({
  isLoading,
  walkInGuests,
  t,
}: {
  isLoading: boolean
  walkInGuests: DashboardWalkInGuest[]
  t: DashboardTranslation
}) {
  if (!isLoading && walkInGuests.length === 0) return null

  return (
    <section aria-label={t("walkInGuestsTitle")}>
      <Card className="border-sky-500/20 bg-sky-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserPlusIcon className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <CardTitle className="text-sm font-medium text-sky-700 dark:text-sky-300">
                {t("walkInGuestsTitle")}
              </CardTitle>
            </div>
            {isLoading ? (
              <Skeleton className="h-5 w-8 rounded-full" />
            ) : (
              <Badge variant="info">{walkInGuests.length}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div className="flex items-center justify-between gap-3" key={i}>
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col divide-y">
              {walkInGuests.map((guest) => (
                <div
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  key={guest.bookingId}
                >
                  <div className="min-w-0 flex-1 flex flex-col">
                    <span className="truncate text-sm font-medium leading-tight">
                      {guest.guestName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("roomNumberShort")} {guest.roomNumber}
                      {guest.checkInAt && (
                        <> · {new Date(guest.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
                      )}
                    </span>
                  </div>
                  <Badge variant="success" className="h-6 shrink-0 px-2 text-xs">
                    {t("checkedIn")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 2. Quick Actions
// ---------------------------------------------------------------------------

function QuickActionsSection({
  isGuesthouse,
  onAction,
}: {
  isGuesthouse: boolean
  onAction: (action: QuickAction) => void
}) {
  const t = useTranslations("dashboardPage")

  const actions = [
    {
      action: "newBooking" as const,
      icon: CalendarPlusIcon,
      label: t("quickNewBooking"),
      variant: "default" as const,
    },
    {
      action: "walkIn" as const,
      icon: UserPlusIcon,
      label: t("quickWalkIn"),
      variant: "outline" as const,
    },
    {
      action: "checkIn" as const,
      icon: LogInIcon,
      label: t("quickCheckIn"),
      variant: "outline" as const,
    },
    {
      action: "checkOut" as const,
      icon: LogOutIcon,
      label: t("quickCheckOut"),
      variant: "outline" as const,
    },
    {
      action: "addPayment" as const,
      icon: ReceiptIcon,
      label: t("quickAddPayment"),
      variant: "outline" as const,
    },
    {
      action: "addExpense" as const,
      icon: WalletIcon,
      label: t("quickAddExpense"),
      variant: "outline" as const,
    },
  ]

  const links = isGuesthouse
    ? [
        { href: "/housekeeping", icon: BrushIcon, label: t("quickViewHousekeeping") },
        { href: "/housekeeping", icon: PlusIcon, label: t("quickCreateCleaningTask") },
      ]
    : []

  const totalItems = actions.length + links.length

  return (
    <section aria-label={t("quickActions")} className="md:hidden">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("quickActions")}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {actions.map(({ action, icon: Icon, label, variant }, index) => {
          const isLastAndOdd =
            index === actions.length - 1 &&
            links.length === 0 &&
            totalItems % 2 !== 0
          return (
            <button
              className={cn(
                buttonVariants({ variant }),
                "h-auto flex-col gap-2 py-5",
                isLastAndOdd && "col-span-2"
              )}
              key={action}
              onClick={() => onAction(action)}
              type="button"
            >
              <Icon className="size-6" />
              <span className="text-sm font-semibold">{label}</span>
            </button>
          )
        })}
        {links.map(({ href, icon: Icon, label }, index) => {
          const isLastAndOdd =
            actions.length + index + 1 === totalItems && totalItems % 2 !== 0
          return (
            <Link
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-auto flex-col gap-2 py-5",
                isLastAndOdd && "col-span-2"
              )}
              href={href}
              key={href + label}
            >
              <Icon className="size-6" />
              <span className="text-sm font-semibold">{label}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 3. Recent Bookings
// ---------------------------------------------------------------------------

function RecentBookingsSection({
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
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold">{t("recentBookings")}</h2>
          <p className="text-sm text-muted-foreground">{t("recentBookingsDescription")}</p>
        </div>
        <Link
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "shrink-0 gap-1"
          )}
          href="/bookings"
        >
          {t("viewAll")}
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>

      {/* Mobile card list with skeleton loading */}
      <div className="flex flex-col gap-2 sm:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4"
              key={i}
            >
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-44" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-7 w-20 shrink-0" />
            </div>
          ))
        ) : bookings.length ? (
          bookings.map((booking) => (
            <div
              className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4"
              key={booking.id}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium leading-tight">
                  {booking.guest.fullName}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t("roomNumber")} {booking.room.roomNumber}
                  {" · "}
                  {booking.coolingOption === "AIR_CONDITIONER"
                    ? t("coolingAC")
                    : t("coolingFan")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatPreferenceDateRange(
                    booking.checkInDate,
                    booking.checkOutDate,
                    preferences
                  )}
                </span>
              </div>
              <BookingStatusBadge status={booking.status} t={t} />
            </div>
          ))
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("noRecentBookings")}
          </p>
        )}
      </div>

      {/* Desktop card with table */}
      <Card className="hidden sm:block">
        <CardContent>
          <RecentBookingsTable
            bookings={bookings}
            isLoading={isLoading}
            preferences={preferences}
            t={t}
          />
        </CardContent>
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 4. Housekeeping Alerts
// ---------------------------------------------------------------------------

function HousekeepingAlertsSection({
  housekeeping,
  isLoading,
  t,
}: {
  housekeeping: HousekeepingDashboardSummary | null
  isLoading: boolean
  t: DashboardTranslation
}) {
  const hk = housekeeping ?? {
    needsCleaning: 0,
    cleaningInProgress: 0,
    cleanedWaitingInspection: 0,
    completedToday: 0,
  }
  const urgentCount = housekeeping?.urgentTasks?.length ?? 0

  const stats = [
    { label: t("hkNeedsCleaning"), value: hk.needsCleaning, icon: BrushIcon, urgent: hk.needsCleaning > 0 },
    { label: t("hkCleaningInProgress"), value: hk.cleaningInProgress, icon: RefreshCwIcon, urgent: false },
    { label: t("hkCleanedWaiting"), value: hk.cleanedWaitingInspection, icon: ShieldCheckIcon, urgent: false },
    { label: t("hkCompletedToday"), value: hk.completedToday, icon: CheckCheckIcon, urgent: false },
  ]

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
          <BrushIcon className="size-4 text-muted-foreground" />
          {t("hkSectionTitle")}
        </h2>
        <Link
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
          href="/housekeeping"
        >
          {t("hkViewAll")}
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            className={cn(
              "flex flex-col gap-2 rounded-xl border bg-card p-4",
              stat.urgent && "border-destructive/30 bg-destructive/10"
            )}
            key={stat.label}
          >
            <div className="flex items-start justify-between gap-1">
              <p className={cn("text-xs font-medium leading-tight text-muted-foreground", stat.urgent && "text-destructive")}>
                {stat.label}
              </p>
              <stat.icon className={cn("size-4 shrink-0 text-muted-foreground", stat.urgent && "text-destructive")} />
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-10" />
            ) : (
              <p className={cn("font-mono text-2xl font-bold leading-none", stat.urgent && "text-destructive")}>
                {String(stat.value)}
              </p>
            )}
          </div>
        ))}
      </div>

      {!isLoading && urgentCount > 0 ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("hkUrgentTitle")}</AlertTitle>
          <AlertDescription>{t("hkUrgentDescription")}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}

// ---------------------------------------------------------------------------
// 5. Finance Summary
// ---------------------------------------------------------------------------

type FinanceView = "current" | "all"
type FinancePeriodPreset =
  | "today"
  | "this_week"
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "this_year"
  | "custom"

type FinanceSummaryData = (FinanceSummary | AllBusinessesFinanceSummary) & {
  businesses?: BusinessFinanceSummary[]
}

function getFinancePeriodLabel(t: DashboardTranslation, preset: string): string {
  const labels: Record<FinancePeriodPreset, string> = {
    today: t("periodToday"),
    this_week: t("periodThisWeek"),
    this_month: t("periodThisMonth"),
    last_month: t("periodLastMonth"),
    last_3_months: t("periodLast3Months"),
    this_year: t("periodThisYear"),
    custom: t("periodCustom"),
  }
  return labels[preset as FinancePeriodPreset] ?? preset
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
  const [financeSummary, setFinanceSummary] = useState<FinanceSummaryData | null>(null)
  const [isFinanceLoading, setIsFinanceLoading] = useState(true)
  const [financeError, setFinanceError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function fetchFinance() {
      if (selectedPreset === "custom" && (!activeCustomStart || !activeCustomEnd)) {
        setIsFinanceLoading(false)
        return
      }

      setIsFinanceLoading(true)
      setFinanceError(null)

      try {
        const params =
          selectedPreset === "custom"
            ? { rangePreset: "custom", startDate: activeCustomStart, endDate: activeCustomEnd }
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
    return () => { ignore = true }
  }, [view, selectedPreset, activeCustomStart, activeCustomEnd, activeBusiness?.businessId])

  const isLoss = (financeSummary?.netProfit ?? 0) < 0
  const businesses =
    view === "all"
      ? (financeSummary as AllBusinessesFinanceSummary | null)?.businesses
      : undefined

  return (
    <section className="flex flex-col gap-3">
      <div className="min-w-0">
        <h2 className="font-heading text-base font-semibold">{t("financeSummaryTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("financeSummaryDescription")}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Tabs value={view} onValueChange={(v) => { if (v) setView(v as FinanceView) }}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger className="flex-1 sm:flex-none" value="current">{t("financeViewCurrent")}</TabsTrigger>
            <TabsTrigger className="flex-1 sm:flex-none" value="all">{t("financeViewAll")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={selectedPreset} onValueChange={(v) => { if (v) setSelectedPreset(v) }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue>{getFinancePeriodLabel(t, selectedPreset)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="today">{t("periodToday")}</SelectItem>
              <SelectItem value="this_week">{t("periodThisWeek")}</SelectItem>
              <SelectItem value="this_month">{t("periodThisMonth")}</SelectItem>
              <SelectItem value="last_month">{t("periodLastMonth")}</SelectItem>
              <SelectItem value="last_3_months">{t("periodLast3Months")}</SelectItem>
              <SelectItem value="this_year">{t("periodThisYear")}</SelectItem>
              <SelectItem value="custom">{t("periodCustom")}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {selectedPreset === "custom" && (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1">
            <Label htmlFor="finance-start-date">{t("financeStartDate")}</Label>
            <Input className="w-full sm:w-40" id="finance-start-date" onChange={(e) => setCustomStartDate(e.target.value)} type="date" value={customStartDate} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="finance-end-date">{t("financeEndDate")}</Label>
            <Input className="w-full sm:w-40" id="finance-end-date" onChange={(e) => setCustomEndDate(e.target.value)} type="date" value={customEndDate} />
          </div>
          <Button className="col-span-2 sm:col-auto" disabled={!customStartDate || !customEndDate} onClick={() => { setActiveCustomStart(customStartDate); setActiveCustomEnd(customEndDate) }} size="sm" type="button" variant="outline">
            {t("applyCustomRange")}
          </Button>
        </div>
      )}

      {financeError && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("financeLoadError")}</AlertTitle>
          <AlertDescription>{financeError}</AlertDescription>
        </Alert>
      )}

      {!financeError && (
        <div className="grid gap-3 sm:grid-cols-3">
          <FinanceMetricCard detail={t("financeForPeriod")} icon={TrendingUpIcon} isLoading={isFinanceLoading} label={t("financeTotalRevenue")} value={formatPreferenceCurrency(financeSummary?.totalRevenue ?? 0, preferences)} />
          <FinanceMetricCard detail={t("financeForPeriod")} icon={WalletIcon} isLoading={isFinanceLoading} label={t("financeTotalExpense")} value={formatPreferenceCurrency(financeSummary?.totalExpense ?? 0, preferences)} />
          <FinanceMetricCard detail={t("financeNetFormula")} icon={isLoss ? TrendingDownIcon : TrendingUpIcon} isDestructive={isLoss} isLoading={isFinanceLoading} label={isLoss ? t("financeNetLoss") : t("financeNetProfit")} value={formatPreferenceCurrency(Math.abs(financeSummary?.netProfit ?? 0), preferences)} />
        </div>
      )}

      {view === "all" && !financeError && !isFinanceLoading && businesses && businesses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t("financeByBusiness")}</p>
          <div className="flex flex-col divide-y rounded-xl border text-sm">
            {businesses.map((b) => {
              const bLoss = b.netProfit < 0
              return (
                <div className="flex items-center gap-2 px-3 py-3" key={b.businessId}>
                  {b.businessType === "STORE" ? (
                    <StoreIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <BuildingIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 truncate font-medium">{b.businessName}</span>
                  <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">{formatPreferenceCurrency(b.revenue, preferences)}</span>
                  <span className={cn("w-24 shrink-0 text-right font-mono text-xs font-semibold", bLoss ? "text-destructive" : "text-foreground")}>
                    {bLoss ? "−" : "+"}
                    {formatPreferenceCurrency(Math.abs(b.netProfit), preferences)}
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

// ---------------------------------------------------------------------------
// Shared: MetricCard
// ---------------------------------------------------------------------------

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
        <CardAction><Icon /></CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-9 w-28" /> : <div className="font-mono text-3xl font-semibold">{value}</div>}
      </CardContent>
    </Card>
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
        <CardAction><Icon className={cn(isDestructive && "text-destructive")} /></CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-28" />
        ) : (
          <div className={cn("font-mono text-3xl font-semibold", isDestructive && "text-destructive")}>{value}</div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Desktop: Recent Bookings Table
// ---------------------------------------------------------------------------

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
          <SkeletonTableRows colSpan={5} />
        ) : bookings.length ? (
          bookings.map((booking) => (
            <TableRow key={booking.id}>
              <TableCell>
                <div className="flex min-w-0 flex-col">
                  <span className="max-w-36 truncate font-medium">{booking.id}</span>
                  <span className="text-xs text-muted-foreground">{formatPreferenceDate(booking.createdAt, preferences)}</span>
                </div>
              </TableCell>
              <TableCell>{booking.guest.fullName}</TableCell>
              <TableCell>
                <div className="flex min-w-0 flex-col">
                  <span>{booking.room.roomNumber}</span>
                  <span className="text-xs text-muted-foreground">{booking.coolingOption === "AIR_CONDITIONER" ? t("coolingAC") : t("coolingFan")}</span>
                </div>
              </TableCell>
              <TableCell>{formatPreferenceDateRange(booking.checkInDate, booking.checkOutDate, preferences)}</TableCell>
              <TableCell><BookingStatusBadge status={booking.status} t={t} /></TableCell>
            </TableRow>
          ))
        ) : (
          <TableStateRow colSpan={5} message={t("noRecentBookings")} />
        )}
      </TableBody>
    </Table>
  )
}

// ---------------------------------------------------------------------------
// Desktop: Recent Payments Table
// ---------------------------------------------------------------------------

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
          <SkeletonTableRows colSpan={5} />
        ) : payments.length ? (
          payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>
                <div className="flex min-w-0 flex-col">
                  <span className="max-w-36 truncate font-medium">{payment.booking.id}</span>
                  <span className="text-xs text-muted-foreground">
                    {payment.paidAt ? formatPreferenceDate(payment.paidAt, preferences) : t("notPaid")}
                  </span>
                </div>
              </TableCell>
              <TableCell>{payment.booking.guest.fullName}</TableCell>
              <TableCell>{payment.booking.room.roomNumber}</TableCell>
              <TableCell className="font-mono">{formatPreferenceCurrency(payment.amount, preferences)}</TableCell>
              <TableCell><PaymentStatusBadge status={payment.status} t={t} /></TableCell>
            </TableRow>
          ))
        ) : (
          <TableStateRow colSpan={5} message={t("noRecentPayments")} />
        )}
      </TableBody>
    </Table>
  )
}

// ---------------------------------------------------------------------------
// Desktop: Housekeeping Task Tables
// ---------------------------------------------------------------------------

function HousekeepingTaskRow({
  task,
  t,
}: {
  task: HousekeepingDashboardSummary["todaysTasks"][number]
  t: DashboardTranslation
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">{t("roomNumberShort")} {task.room.roomNumber}</span>
          <span className="text-xs text-muted-foreground">{task.room.type}</span>
        </div>
      </TableCell>
      <TableCell><Badge variant={getHkStatusVariant(task.status)}>{getHkStatusLabel(task.status, t)}</Badge></TableCell>
      <TableCell><Badge variant={getHkPriorityVariant(task.priority)}>{getHkPriorityLabel(task.priority, t)}</Badge></TableCell>
      <TableCell className="text-sm">
        {task.assignedTo ? (
          <span>{task.assignedTo.name}</span>
        ) : (
          <span className="text-muted-foreground">{t("hkUnassigned")}</span>
        )}
      </TableCell>
    </TableRow>
  )
}

function HousekeepingTasksCard({
  description,
  emptyMessage,
  isLoading,
  t,
  tasks,
  title,
}: {
  description: string
  emptyMessage: string
  isLoading: boolean
  t: DashboardTranslation
  tasks: HousekeepingDashboardSummary["todaysTasks"]
  title: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href="/housekeeping">
            {t("hkViewAll")}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Table>
            <TableBody><SkeletonTableRows colSpan={4} rows={3} /></TableBody>
          </Table>
        ) : tasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("roomNumber")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("hkPriority")}</TableHead>
                <TableHead>{t("hkAssignedTo")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => <HousekeepingTaskRow key={task.id} t={t} task={task} />)}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Shared: Status badges
// ---------------------------------------------------------------------------

function BookingStatusBadge({ status, t }: { status: BookingStatus; t: DashboardTranslation }) {
  const variant =
    status === "CONFIRMED" ? "success"
    : status === "CHECKED_IN" ? "warning"
    : status === "CHECKED_OUT" ? "info"
    : status === "CANCELLED" ? "destructive"
    : "outline"
  return <Badge className="h-7 shrink-0 px-2.5 text-sm" variant={variant}>{getBookingStatusLabel(status, t)}</Badge>
}

function PaymentStatusBadge({ status, t }: { status: PaymentStatus; t: DashboardTranslation }) {
  const variant =
    status === "PAID" ? "default"
    : status === "PENDING" ? "secondary"
    : status === "FAILED" ? "destructive"
    : "outline"
  return <Badge className="h-7 shrink-0 px-2.5 text-sm" variant={variant}>{getPaymentStatusLabel(status, t)}</Badge>
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function SkeletonTableRows({ colSpan, rows = 4 }: { colSpan: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: colSpan }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

function TableStateRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell className="h-28 text-center text-sm text-muted-foreground" colSpan={colSpan}>
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

function getHkStatusVariant(status: string): React.ComponentProps<typeof Badge>["variant"] {
  switch (status) {
    case "NEEDS_CLEANING": return "secondary"
    case "CLEANING_IN_PROGRESS": return "default"
    case "CLEANED": return "outline"
    default: return "outline"
  }
}

function getHkPriorityVariant(priority: string): React.ComponentProps<typeof Badge>["variant"] {
  switch (priority) {
    case "URGENT": return "destructive"
    case "HIGH": return "secondary"
    case "MEDIUM": return "secondary"
    default: return "outline"
  }
}

function getHkStatusLabel(status: string, t: DashboardTranslation) {
  const map: Record<string, string> = {
    NEEDS_CLEANING: t("needsCleaning"),
    CLEANING_IN_PROGRESS: t("cleaningInProgress"),
    CLEANED: t("hkCleaned"),
    INSPECTED: t("hkInspected"),
    CANCELLED: t("cancelled"),
  }
  return map[status] ?? status
}

function getHkPriorityLabel(priority: string, t: DashboardTranslation) {
  const map: Record<string, string> = {
    LOW: t("hkPriorityLow"),
    MEDIUM: t("hkPriorityMedium"),
    HIGH: t("hkPriorityHigh"),
    URGENT: t("hkPriorityUrgent"),
  }
  return map[priority] ?? priority
}
