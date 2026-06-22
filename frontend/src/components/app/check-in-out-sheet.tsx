"use client"

import { useEffect, useState } from "react"
import { AlertCircleIcon, LogInIcon, LogOutIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { bookingService, getBookingErrorMessage, type Booking } from "@/lib/bookings"

type CheckInOutMode = "checkIn" | "checkOut"

export function CheckInOutSheet({
  open,
  onOpenChange,
  mode,
  onActionComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: CheckInOutMode
  onActionComplete?: (booking: Booking) => void
}) {
  const t = useTranslations()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    async function run() {
      setIsLoading(true)
      setError(null)

      try {
        const data = await bookingService.list(
          mode === "checkIn" ? "CONFIRMED" : "CHECKED_IN"
        )
        setBookings(data)
      } catch (err) {
        setError(getBookingErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    }

    void run()
  }, [open, mode])

  async function handleAction(booking: Booking) {
    setActingId(booking.id)
    setError(null)

    try {
      const updated =
        mode === "checkIn"
          ? await bookingService.checkIn(booking.id)
          : await bookingService.checkOut(booking.id)
      setBookings((prev) => prev.filter((b) => b.id !== booking.id))
      onActionComplete?.(updated)
    } catch (err) {
      setError(getBookingErrorMessage(err))
    } finally {
      setActingId(null)
    }
  }

  const isCheckIn = mode === "checkIn"

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="max-h-[80dvh]" side="bottom">
        <SheetHeader>
          <SheetTitle>{isCheckIn ? t("checkIn") : t("checkOut")}</SheetTitle>
          <SheetDescription>
            {isCheckIn ? t("quickCheckInDescription") : t("quickCheckOutDescription")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-4">
          {error ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("somethingWentWrong")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("loadingBookings")}
            </p>
          ) : bookings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {isCheckIn ? t("noBookingsReadyForCheckIn") : t("noBookingsReadyForCheckOut")}
            </p>
          ) : (
            bookings.map((booking) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
                key={booking.id}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium leading-tight">
                    {booking.guest.fullName}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t("roomLabel", { roomNumber: booking.room.roomNumber })}
                    {" · "}
                    {formatDateRange(booking.checkInDate, booking.checkOutDate)}
                  </span>
                </div>
                <Button
                  disabled={actingId === booking.id}
                  onClick={() => void handleAction(booking)}
                  size="sm"
                  type="button"
                >
                  {isCheckIn ? (
                    <LogInIcon data-icon="inline-start" />
                  ) : (
                    <LogOutIcon data-icon="inline-start" />
                  )}
                  {actingId === booking.id
                    ? t("working")
                    : isCheckIn
                      ? t("checkIn")
                      : t("checkOut")}
                </Button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function formatDateRange(checkInDate: string, checkOutDate: string) {
  return `${formatDate(checkInDate)} - ${formatDate(checkOutDate)}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}
