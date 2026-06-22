"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { AirVentIcon, AlertCircleIcon, WindIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
  bookingService,
  getBookingConflict,
  getBookingErrorMessage,
  type Booking,
  type BookingPayload,
  type CoolingOption,
} from "@/lib/bookings"
import { guestService, type Guest } from "@/lib/guests"
import { roomService, type Room, type RoomAvailabilityStatus } from "@/lib/rooms"
import { settingsService } from "@/lib/settings"
import { cn } from "@/lib/utils"

type BookingForm = Omit<BookingPayload, "status" | "coolingOption">
type Option<T extends string> = { value: T; label: string }
type RoomOption = Option<string> & { status: RoomAvailabilityStatus | "UNKNOWN" }

const defaultFormValues: BookingForm = {
  guestId: "",
  roomId: "",
  checkInDate: "",
  checkOutDate: "",
}

export function QuickBookingDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (booking: Booking) => void
}) {
  const t = useTranslations()
  const [guests, setGuests] = useState<Guest[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [isOptionsLoading, setIsOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [roomAvailability, setRoomAvailability] = useState<
    Record<string, RoomAvailabilityStatus>
  >({})
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [liveConflict, setLiveConflict] = useState(false)
  const [coolingOption, setCoolingOption] = useState<CoolingOption>("FAN")
  const [acPricePerNight, setAcPricePerNight] = useState(5)
  const [formError, setFormError] = useState<string | null>(null)

  const bookingSchema = z
    .object({
      guestId: z.string().min(1, t("selectGuest")),
      roomId: z.string().min(1, t("selectRoom")),
      checkInDate: z.string().min(1, t("selectCheckInDate")),
      checkOutDate: z.string().min(1, t("selectCheckOutDate")),
    })
    .refine(
      (value) =>
        !value.checkInDate ||
        !value.checkOutDate ||
        new Date(value.checkOutDate) > new Date(value.checkInDate),
      { message: t("checkOutAfterCheckIn"), path: ["checkOutDate"] }
    ) satisfies z.ZodType<BookingForm>

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    control,
    setValue,
  } = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: defaultFormValues,
  })

  const selectedGuestId = useWatch({ control, name: "guestId" })
  const selectedRoomId = useWatch({ control, name: "roomId" })
  const checkInDate = useWatch({ control, name: "checkInDate" })
  const checkOutDate = useWatch({ control, name: "checkOutDate" })

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId),
    [rooms, selectedRoomId]
  )

  const guestOptions = useMemo(
    () => guests.map((guest) => ({ value: guest.id, label: guest.fullName })),
    [guests]
  )

  const canCheckRoomAvailability =
    Boolean(checkInDate) &&
    Boolean(checkOutDate) &&
    calculateNights(checkInDate, checkOutDate) !== null

  const roomOptions = useMemo<RoomOption[]>(
    () =>
      rooms.map((room) => ({
        value: room.id,
        label: `${t("roomLabel", { roomNumber: room.roomNumber })} - ${formatCurrency(room.pricePerNight)}`,
        status: canCheckRoomAvailability
          ? roomAvailability[room.id] ?? "UNKNOWN"
          : "UNKNOWN",
      })),
    [canCheckRoomAvailability, roomAvailability, rooms, t]
  )

  const selectedRoomAvailability = selectedRoomId
    ? roomOptions.find((room) => room.value === selectedRoomId)?.status
    : undefined
  const isSelectedRoomUnavailable =
    Boolean(selectedRoomId) &&
    Boolean(selectedRoomAvailability) &&
    selectedRoomAvailability !== "AVAILABLE" &&
    selectedRoomAvailability !== "UNKNOWN"

  const priceBreakdown = useMemo(() => {
    if (!selectedRoom || !checkInDate || !checkOutDate) return null
    const nights = calculateNights(checkInDate, checkOutDate)
    if (!nights) return null
    const roomTotal = selectedRoom.pricePerNight * nights
    const acTotal = coolingOption === "AIR_CONDITIONER" ? acPricePerNight * nights : 0
    return { nights, total: roomTotal + acTotal }
  }, [checkInDate, checkOutDate, selectedRoom, coolingOption, acPricePerNight])

  useEffect(() => {
    if (!open) return

    async function run() {
      setIsOptionsLoading(true)
      setOptionsError(null)
      setFormError(null)
      setCoolingOption("FAN")
      reset(defaultFormValues)

      try {
        const [guestData, roomData] = await Promise.all([
          guestService.list(),
          roomService.list(),
        ])
        setGuests(guestData)
        setRooms(roomData)
      } catch (error) {
        setOptionsError(getBookingErrorMessage(error))
      } finally {
        setIsOptionsLoading(false)
      }

      try {
        const setting = await settingsService.getSetting(
          "airConditionerPricePerNight"
        )
        const parsed = parseFloat(setting.value)
        if (!isNaN(parsed) && parsed >= 0) setAcPricePerNight(parsed)
      } catch {
        // keep default
      }
    }

    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!canCheckRoomAvailability) {
      function reset() {
        setRoomAvailability({})
      }
      void reset()
      return
    }

    let ignore = false

    async function fetchRoomAvailability() {
      setIsAvailabilityLoading(true)
      setAvailabilityError(null)

      try {
        const availability = await roomService.availability({
          startDate: checkInDate,
          endDate: checkOutDate,
        })

        if (!ignore) {
          setRoomAvailability(
            Object.fromEntries(
              availability.map((room) => [
                room.roomId,
                getRoomAvailabilitySummary(room.dates.map((date) => date.status)),
              ])
            )
          )
        }
      } catch {
        if (!ignore) {
          setRoomAvailability({})
          setAvailabilityError(t("roomAvailabilityCouldNotBeLoaded"))
        }
      } finally {
        if (!ignore) setIsAvailabilityLoading(false)
      }
    }

    void fetchRoomAvailability()

    return () => {
      ignore = true
    }
  }, [canCheckRoomAvailability, checkInDate, checkOutDate, t])

  useEffect(() => {
    if (!canCheckRoomAvailability || !selectedRoomId) {
      function reset() {
        setLiveConflict(false)
      }
      void reset()
      return
    }

    let ignore = false

    async function checkConflict() {
      try {
        const conflict = await bookingService.checkConflict({
          roomId: selectedRoomId,
          checkInDate,
          checkOutDate,
        })
        if (!ignore) setLiveConflict(Boolean(conflict))
      } catch {
        if (!ignore) setLiveConflict(false)
      }
    }

    void checkConflict()

    return () => {
      ignore = true
    }
  }, [canCheckRoomAvailability, checkInDate, checkOutDate, selectedRoomId])

  async function onSubmit(values: BookingForm) {
    setFormError(null)

    if (isSelectedRoomUnavailable) {
      setFormError(t("selectedRoomUnavailable", { status: "" }))
      return
    }

    try {
      const createdBooking = await bookingService.create({
        ...values,
        coolingOption,
        status: "CONFIRMED",
      })
      onCreated?.(createdBooking)
      onOpenChange(false)
    } catch (error) {
      const conflict = getBookingConflict(error)
      setFormError(conflict ? t("checkOutAfterCheckIn") : getBookingErrorMessage(error))
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("createBooking")}</DialogTitle>
          <DialogDescription>{t("quickBookingDescription")}</DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            {optionsError ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>{t("couldNotLoadBookingOptions")}</AlertTitle>
                <AlertDescription>{optionsError}</AlertDescription>
              </Alert>
            ) : null}

            {formError ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>{t("bookingCouldNotBeCreated")}</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <Field data-invalid={Boolean(errors.guestId)}>
              <FieldLabel htmlFor="qa-booking-guest">{t("selectGuest")}</FieldLabel>
              <Select
                items={guestOptions}
                value={selectedGuestId}
                onValueChange={(value) =>
                  setValue("guestId", value as string, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.guestId)}
                  disabled={isOptionsLoading}
                  id="qa-booking-guest"
                >
                  <SelectValue placeholder={t("selectGuest")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {guestOptions.map((guest) => (
                      <SelectItem key={guest.value} value={guest.value}>
                        {guest.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{errors.guestId?.message}</FieldError>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={Boolean(errors.checkInDate)}>
                <FieldLabel htmlFor="qa-booking-checkin">
                  {t("checkInDate")}
                </FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.checkInDate)}
                  id="qa-booking-checkin"
                  type="date"
                  {...register("checkInDate")}
                />
                <FieldError>{errors.checkInDate?.message}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.checkOutDate)}>
                <FieldLabel htmlFor="qa-booking-checkout">
                  {t("checkOutDate")}
                </FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.checkOutDate)}
                  id="qa-booking-checkout"
                  type="date"
                  {...register("checkOutDate")}
                />
                <FieldError>{errors.checkOutDate?.message}</FieldError>
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.roomId)}>
              <FieldLabel htmlFor="qa-booking-room">{t("selectRoom")}</FieldLabel>
              <Select
                items={roomOptions}
                value={selectedRoomId}
                onValueChange={(value) =>
                  setValue("roomId", value as string, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.roomId)}
                  disabled={isOptionsLoading}
                  id="qa-booking-room"
                >
                  <SelectValue placeholder={t("selectRoom")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {roomOptions.map((room) => (
                      <SelectItem key={room.value} value={room.value}>
                        {room.label}
                        {room.status !== "AVAILABLE" && room.status !== "UNKNOWN"
                          ? ` (${getRoomAvailabilityStatusLabel(room.status, t)})`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{errors.roomId?.message}</FieldError>
              {isAvailabilityLoading ? (
                <p className="text-xs text-muted-foreground">{t("checkingAvailability")}</p>
              ) : availabilityError ? (
                <p className="text-xs text-destructive">{availabilityError}</p>
              ) : isSelectedRoomUnavailable ? (
                <p className="text-xs text-destructive">
                  {t("selectedRoomUnavailable", {
                    status: getRoomAvailabilityStatusLabel(
                      selectedRoomAvailability as RoomAvailabilityStatus,
                      t
                    ),
                  })}
                </p>
              ) : liveConflict ? (
                <p className="text-xs text-destructive">{t("roomAlreadyBookedForDates")}</p>
              ) : null}
            </Field>

            <Field>
              <FieldLabel>{t("coolingHint")}</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors",
                    coolingOption === "FAN"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => setCoolingOption("FAN")}
                  type="button"
                >
                  <WindIcon className="size-4 text-blue-500" />
                  {t("coolingFan")}
                </button>
                <button
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors",
                    coolingOption === "AIR_CONDITIONER"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => setCoolingOption("AIR_CONDITIONER")}
                  type="button"
                >
                  <AirVentIcon className="size-4 text-cyan-500" />
                  {t("coolingAC")}
                </button>
              </div>
            </Field>

            {priceBreakdown ? (
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3 text-sm">
                <span className="text-muted-foreground">
                  {t("estimatedTotal")} · {priceBreakdown.nights}{" "}
                  {t(priceBreakdown.nights === 1 ? "night" : "nights")}
                </span>
                <span className="font-mono font-semibold">
                  {formatCurrency(priceBreakdown.total)}
                </span>
              </div>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button
              disabled={
                isSubmitting ||
                isOptionsLoading ||
                isAvailabilityLoading ||
                isSelectedRoomUnavailable ||
                liveConflict
              }
              type="submit"
            >
              {isSubmitting ? t("saving") : t("createBooking")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getRoomAvailabilityStatusLabel(
  status: RoomAvailabilityStatus,
  t: ReturnType<typeof useTranslations>
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

function getRoomAvailabilitySummary(
  statuses: RoomAvailabilityStatus[]
): RoomAvailabilityStatus {
  if (statuses.includes("MAINTENANCE")) return "MAINTENANCE"
  if (statuses.includes("CLEANING_IN_PROGRESS")) return "CLEANING_IN_PROGRESS"
  if (statuses.includes("NEEDS_CLEANING")) return "NEEDS_CLEANING"
  if (statuses.includes("OCCUPIED")) return "OCCUPIED"
  if (statuses.includes("BOOKED")) return "BOOKED"
  return "AVAILABLE"
}

function calculateNights(checkInDate: string, checkOutDate: string) {
  const checkIn = new Date(checkInDate)
  const checkOut = new Date(checkOutDate)
  const millisecondsPerNight = 24 * 60 * 60 * 1000
  const nights = Math.ceil(
    (checkOut.getTime() - checkIn.getTime()) / millisecondsPerNight
  )

  return nights > 0 ? nights : null
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}
