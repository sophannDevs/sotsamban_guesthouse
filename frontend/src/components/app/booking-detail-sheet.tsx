"use client"

import { useEffect, useState } from "react"
import {
  BedDoubleIcon,
  CalendarIcon,
  CircleDollarSignIcon,
  LogInIcon,
  LogOutIcon,
  MinusIcon,
  PlusIcon,
  ShoppingCartIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import {
  formatPreferenceCurrency,
  formatPreferenceDateRange,
  useSystemPreferences,
} from "@/components/app/system-preferences-provider"
import { useAuth } from "@/components/app/auth-provider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  bookingService,
  getBookingErrorMessage,
  type Booking,
} from "@/lib/bookings"
import { housekeepingService } from "@/lib/housekeeping"
import {
  miniBarConsumptionService,
  type MiniBarProduct,
} from "@/lib/mini-bar-consumption"
import { cn } from "@/lib/utils"

export type BookingDetailSheetProps = {
  bookingId: string | null
  mode: "checkIn" | "checkOut"
  open: boolean
  onOpenChange: (open: boolean) => void
  onActionComplete: (bookingId: string, mode: "checkIn" | "checkOut") => void
}

export function BookingDetailSheet({
  bookingId,
  mode,
  open,
  onOpenChange,
  onActionComplete,
}: BookingDetailSheetProps) {
  const t = useTranslations("dashboardPage")
  const tGlobal = useTranslations()
  const { preferences } = useSystemPreferences()
  const { user } = useAuth()

  const [booking, setBooking] = useState<Booking | null>(null)
  const [products, setProducts] = useState<MiniBarProduct[]>([])
  const [isBookingLoading, setIsBookingLoading] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [isMiniBarLoading, setIsMiniBarLoading] = useState(false)
  const [showMiniBar, setShowMiniBar] = useState(false)

  // Permitted roles for check-in / check-out
  const canPerformAction =
    user?.role === "ADMIN" || user?.role === "RECEPTIONIST"

  useEffect(() => {
    if (!open || !bookingId) {
      setBooking(null)
      setCart({})
      setShowMiniBar(false)
      setConfirmOpen(false)
      return
    }

    setIsBookingLoading(true)
    bookingService
      .get(bookingId)
      .then(setBooking)
      .catch(() => {})
      .finally(() => setIsBookingLoading(false))
  }, [open, bookingId])

  useEffect(() => {
    if (!showMiniBar) return

    setIsMiniBarLoading(true)
    miniBarConsumptionService
      .listEligibleProducts()
      .then(setProducts)
      .catch(() => {})
      .finally(() => setIsMiniBarLoading(false))
  }, [showMiniBar])

  // Called after the confirmation dialog "Confirm" button is clicked
  const handleExecuteAction = async () => {
    if (!bookingId || !booking) return

    setIsActionLoading(true)
    try {
      if (mode === "checkIn") {
        await bookingService.checkIn(bookingId)
        toast.success(
          t("checkInSuccess", { guestName: booking.guest.fullName }),
        )
      } else {
        await bookingService.checkOut(bookingId)
        toast.success(
          t("checkOutSuccess", { guestName: booking.guest.fullName }),
        )
        // Auto-create cleaning task — non-blocking; failure is silent
        housekeepingService
          .create({ roomId: booking.roomId, priority: "HIGH" })
          .then(() => {
            toast.info(
              t("cleaningTaskCreated", { roomNumber: booking.room.roomNumber }),
            )
          })
          .catch(() => {})
      }

      setConfirmOpen(false)
      onOpenChange(false)
      onActionComplete(bookingId, mode)
    } catch (error) {
      const msg = getBookingErrorMessage(error)
      toast.error(
        mode === "checkIn" ? t("checkInFailed") : t("checkOutFailed"),
        { description: msg },
      )
      setConfirmOpen(false)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleMiniBarSubmit = async () => {
    if (!bookingId) return

    const items = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }))
    if (items.length === 0) return

    setIsMiniBarLoading(true)
    try {
      await miniBarConsumptionService.create({ bookingId, items })
      setCart({})
      setShowMiniBar(false)
    } catch {
      // silent — user can retry
    } finally {
      setIsMiniBarLoading(false)
    }
  }

  const ActionIcon = mode === "checkIn" ? LogInIcon : LogOutIcon
  const actionLabel = mode === "checkIn" ? t("checkIn") : t("checkOut")

  const canAction =
    canPerformAction &&
    (booking?.status === "CONFIRMED" ||
      booking?.status === "PENDING" ||
      booking?.status === "CHECKED_IN")

  const cartTotal = Object.entries(cart).reduce((sum, [productId, qty]) => {
    const product = products.find((p) => p.id === productId)
    return sum + (product?.sellingPrice ?? 0) * qty
  }, 0)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          className="flex max-h-[92dvh] flex-col gap-0 overflow-y-auto pb-safe"
          side="bottom"
        >
          <SheetHeader className="pb-4">
            <SheetTitle>{t("bookingDetail")}</SheetTitle>
            {booking && (
              <SheetDescription>
                {booking.guest.fullName} · {t("roomNumberShort")}{" "}
                {booking.room.roomNumber}
              </SheetDescription>
            )}
          </SheetHeader>

          {isBookingLoading || !booking ? (
            <div className="flex flex-col gap-3 px-4 pb-6">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-11 w-full rounded-lg" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 px-4 pb-6">
              {/* Booking info card */}
              <div className="flex flex-col gap-2.5 rounded-xl bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium leading-tight">
                    {booking.guest.fullName}
                  </span>
                  <BookingStatusBadge status={booking.status} t={t} />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BedDoubleIcon className="size-3.5 shrink-0" />
                  <span>
                    {t("roomNumberShort")} {booking.room.roomNumber}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarIcon className="size-3.5 shrink-0" />
                  <span>
                    {formatPreferenceDateRange(
                      booking.checkInDate,
                      booking.checkOutDate,
                      preferences,
                    )}
                  </span>
                </div>
                {booking.balanceDue > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <CircleDollarSignIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-medium">
                      {formatPreferenceCurrency(booking.balanceDue, preferences)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("balanceDue")}
                    </span>
                  </div>
                )}
              </div>

              {/* Primary action — opens confirm dialog */}
              {canAction && (
                <Button
                  className="w-full gap-2"
                  onClick={() => setConfirmOpen(true)}
                  size="lg"
                  variant={mode === "checkOut" ? "destructive" : "default"}
                >
                  <ActionIcon className="size-4" />
                  {actionLabel}
                </Button>
              )}

              {/* Mini bar quick add — only for checked-in guests */}
              {booking.status === "CHECKED_IN" && canPerformAction && (
                <>
                  <Separator />
                  <Button
                    className="gap-2"
                    onClick={() => setShowMiniBar((v) => !v)}
                    variant="outline"
                  >
                    <ShoppingCartIcon className="size-4" />
                    {t("miniBarQuickAdd")}
                  </Button>

                  {showMiniBar && (
                    <div className="flex flex-col gap-3 rounded-xl border p-4">
                      {isMiniBarLoading ? (
                        <div className="flex flex-col gap-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton className="h-9 w-full" key={i} />
                          ))}
                        </div>
                      ) : products.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {t("noMiniBarProducts")}
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {products.map((product) => (
                            <div
                              className="flex items-center justify-between gap-3 py-1.5"
                              key={product.id}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium leading-tight">
                                  {product.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatPreferenceCurrency(
                                    product.sellingPrice,
                                    preferences,
                                  )}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Button
                                  className="size-7"
                                  disabled={(cart[product.id] ?? 0) === 0}
                                  onClick={() =>
                                    setCart((c) => ({
                                      ...c,
                                      [product.id]: Math.max(
                                        0,
                                        (c[product.id] ?? 0) - 1,
                                      ),
                                    }))
                                  }
                                  size="icon"
                                  variant="outline"
                                >
                                  <MinusIcon className="size-3" />
                                </Button>
                                <span
                                  className={cn(
                                    "w-7 text-center font-mono text-sm",
                                    (cart[product.id] ?? 0) > 0 &&
                                      "font-semibold",
                                  )}
                                >
                                  {cart[product.id] ?? 0}
                                </span>
                                <Button
                                  className="size-7"
                                  onClick={() =>
                                    setCart((c) => ({
                                      ...c,
                                      [product.id]:
                                        (c[product.id] ?? 0) + 1,
                                    }))
                                  }
                                  size="icon"
                                  variant="outline"
                                >
                                  <PlusIcon className="size-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        className="w-full gap-2"
                        disabled={isMiniBarLoading || cartTotal === 0}
                        onClick={handleMiniBarSubmit}
                      >
                        <ShoppingCartIcon className="size-4" />
                        {t("addMiniBarItems")}
                        {cartTotal > 0 && (
                          <span className="ml-1 text-xs opacity-80">
                            (
                            {formatPreferenceCurrency(cartTotal, preferences)})
                          </span>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirmation dialog — rendered outside Sheet to avoid stacking issues */}
      {booking && (
        <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {mode === "checkIn"
                  ? t("confirmCheckIn")
                  : t("confirmCheckOut")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {mode === "checkIn"
                  ? t("confirmCheckInDesc", {
                      guestName: booking.guest.fullName,
                      roomNumber: booking.room.roomNumber,
                    })
                  : t("confirmCheckOutDesc", {
                      guestName: booking.guest.fullName,
                      roomNumber: booking.room.roomNumber,
                    })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isActionLoading}>
                {tGlobal("cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isActionLoading}
                onClick={() => void handleExecuteAction()}
                variant={mode === "checkOut" ? "destructive" : "default"}
              >
                {isActionLoading ? tGlobal("working") : tGlobal("confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}

type DashboardT = ReturnType<typeof useTranslations<"dashboardPage">>

function BookingStatusBadge({
  status,
  t,
}: {
  status: Booking["status"]
  t: DashboardT
}) {
  const labels: Record<Booking["status"], string> = {
    PENDING: t("pending"),
    CONFIRMED: t("confirmed"),
    CHECKED_IN: t("checkedIn"),
    CHECKED_OUT: t("checkedOut"),
    CANCELLED: t("cancelled"),
  }
  const variant =
    status === "CONFIRMED"
      ? "success"
      : status === "CHECKED_IN"
        ? "warning"
        : status === "CHECKED_OUT"
          ? "info"
          : status === "CANCELLED"
            ? "destructive"
            : "outline"

  return (
    <Badge className="shrink-0" variant={variant}>
      {labels[status]}
    </Badge>
  )
}
