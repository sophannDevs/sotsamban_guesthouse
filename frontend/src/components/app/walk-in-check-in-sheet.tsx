"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BedDoubleIcon,
  CalendarIcon,
  ChevronRightIcon,
  PhoneIcon,
  SnowflakeIcon,
  UserIcon,
  WindIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  formatPreferenceCurrency,
  useSystemPreferences,
} from "@/components/app/system-preferences-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  bookingService,
  getBookingErrorMessage,
  type CoolingOption,
} from "@/lib/bookings"
import { roomService, type Room } from "@/lib/rooms"
import { settingsService } from "@/lib/settings"
import { cn } from "@/lib/utils"

type Step = 1 | 2

interface WalkInForm {
  guestName: string
  phone: string
  roomId: string
  checkInDate: string
  checkOutDate: string
  coolingOption: CoolingOption
}

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function calcNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 1
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  const days = Math.round(ms / (1000 * 60 * 60 * 24))
  return days > 0 ? days : 1
}

function roomStatusVariant(
  status: Room["status"]
): "success" | "info" | "warning" | "destructive" | "outline" {
  switch (status) {
    case "AVAILABLE": return "success"
    case "BOOKED": return "info"
    case "OCCUPIED": return "warning"
    case "NEEDS_CLEANING":
    case "MAINTENANCE": return "destructive"
    case "CLEANING_IN_PROGRESS": return "warning"
    default: return "outline"
  }
}

function roomStatusLabel(status: Room["status"]): string {
  const labels: Record<Room["status"], string> = {
    AVAILABLE: "Available",
    BOOKED: "Booked",
    OCCUPIED: "Occupied",
    NEEDS_CLEANING: "Needs Cleaning",
    CLEANING_IN_PROGRESS: "Cleaning",
    MAINTENANCE: "Maintenance",
  }
  return labels[status] ?? status
}

const EMPTY_FORM: WalkInForm = {
  guestName: "",
  phone: "",
  roomId: "",
  checkInDate: "",
  checkOutDate: "",
  coolingOption: "FAN",
}

export function WalkInCheckInSheet({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: () => void
}) {
  const router = useRouter()
  const { preferences } = useSystemPreferences()
  const [step, setStep] = useState<Step>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<WalkInForm>({ ...EMPTY_FORM, checkInDate: todayISO() })
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoadingRooms, setIsLoadingRooms] = useState(false)
  const [acPrice, setAcPrice] = useState(0)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setForm({ ...EMPTY_FORM, checkInDate: todayISO() })

    async function load() {
      setIsLoadingRooms(true)
      try {
        const [roomList, acSetting] = await Promise.all([
          roomService.list(),
          settingsService.getSetting("airConditionerPricePerNight").catch(() => null),
        ])
        setRooms(roomList)
        if (acSetting) setAcPrice(Number(acSetting.value) || 0)
      } finally {
        setIsLoadingRooms(false)
      }
    }

    void load()
  }, [open])

  const selectedRoom = rooms.find((r) => r.id === form.roomId)

  const nights = useMemo(
    () => (form.checkOutDate ? calcNights(form.checkInDate, form.checkOutDate) : 1),
    [form.checkInDate, form.checkOutDate]
  )

  const roomCost = (selectedRoom?.pricePerNight ?? 0) * nights
  const acCost = form.coolingOption === "AIR_CONDITIONER" ? acPrice * nights : 0
  const totalCost = roomCost + acCost

  const canNext = form.guestName.trim().length > 0
  const canSubmit = form.roomId.length > 0 && canNext

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) return
    setIsSubmitting(true)

    try {
      const booking = await bookingService.walkInCheckIn({
        guest: {
          name: form.guestName.trim(),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        },
        roomId: form.roomId,
        checkInDate: form.checkInDate,
        ...(form.checkOutDate ? { checkOutDate: form.checkOutDate } : {}),
        coolingOption: form.coolingOption,
      })

      toast.success("Walk-in check-in successful", {
        description: `${form.guestName.trim()} checked in to Room ${selectedRoom?.roomNumber ?? ""}.`,
      })

      onComplete?.()
      onOpenChange(false)
      router.push(`/bookings/${booking.id}`)
    } catch (err) {
      toast.error("Check-in failed", {
        description: getBookingErrorMessage(err),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[92dvh] flex-col gap-0 p-0"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 px-4 pb-3 pt-4">
          {/* Step progress */}
          <div className="mb-2 flex gap-1.5">
            {([1, 2] as Step[]).map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  step >= s ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
          <SheetTitle>Walk-in Check-in</SheetTitle>
          <SheetDescription>
            {step === 1
              ? "Step 1 of 2 — Enter guest information"
              : "Step 2 of 2 — Select room and stay details"}
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {/* ── Step 1: Guest Info ── */}
          {step === 1 && (
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel className="flex items-center gap-1.5">
                  <UserIcon className="size-3.5 shrink-0" />
                  Guest Name
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  autoFocus
                  placeholder="Full name"
                  value={form.guestName}
                  onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter" && canNext) setStep(2) }}
                />
              </Field>
              <Field>
                <FieldLabel className="flex items-center gap-1.5">
                  <PhoneIcon className="size-3.5 shrink-0" />
                  Phone
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </FieldLabel>
                <Input
                  type="tel"
                  placeholder="e.g. 012 345 678"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter" && canNext) setStep(2) }}
                />
              </Field>
            </FieldGroup>
          )}

          {/* ── Step 2: Room + Stay ── */}
          {step === 2 && (
            <FieldGroup className="gap-5">
              {/* Room selection */}
              <Field>
                <FieldLabel className="mb-1.5 flex items-center gap-1.5">
                  <BedDoubleIcon className="size-3.5 shrink-0" />
                  Select Room
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {isLoadingRooms
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-[4.5rem] w-full rounded-lg" />
                      ))
                    : rooms.map((room) => {
                        const available = room.status === "AVAILABLE"
                        const selected = form.roomId === room.id
                        return (
                          <button
                            key={room.id}
                            type="button"
                            disabled={!available}
                            onClick={() => setForm((f) => ({ ...f, roomId: room.id }))}
                            className={cn(
                              "flex min-h-[4.5rem] flex-col gap-0.5 rounded-lg border p-2.5 text-left transition-colors",
                              selected
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : available
                                  ? "border-border hover:border-primary/40 hover:bg-muted/40"
                                  : "cursor-not-allowed border-border opacity-45",
                            )}
                          >
                            <span className="text-sm font-semibold leading-tight">
                              Room {room.roomNumber}
                            </span>
                            <span className="text-xs text-muted-foreground">{room.type}</span>
                            <Badge
                              variant={roomStatusVariant(room.status)}
                              className="mt-auto h-5 px-1.5 text-[10px] font-medium"
                            >
                              {roomStatusLabel(room.status)}
                            </Badge>
                          </button>
                        )
                      })}
                </div>
              </Field>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel className="flex items-center gap-1.5">
                    <CalendarIcon className="size-3.5 shrink-0" />
                    Check-in
                  </FieldLabel>
                  <Input
                    type="date"
                    value={form.checkInDate}
                    min={todayISO()}
                    onChange={(e) => setForm((f) => ({ ...f, checkInDate: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel className="flex items-center gap-1">
                    <CalendarIcon className="size-3.5 shrink-0" />
                    Check-out
                    <span className="text-[10px] font-normal text-muted-foreground">(opt.)</span>
                  </FieldLabel>
                  <Input
                    type="date"
                    value={form.checkOutDate}
                    min={form.checkInDate || todayISO()}
                    onChange={(e) => setForm((f) => ({ ...f, checkOutDate: e.target.value }))}
                  />
                </Field>
              </div>

              {/* Cooling option */}
              <Field>
                <FieldLabel className="mb-1.5">Cooling Option</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: "FAN", label: "Fan", Icon: WindIcon },
                      { value: "AIR_CONDITIONER", label: "Air Conditioning", Icon: SnowflakeIcon },
                    ] as { value: CoolingOption; label: string; Icon: typeof WindIcon }[]
                  ).map(({ value, label, Icon }) => {
                    const selected = form.coolingOption === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, coolingOption: value }))}
                        className={cn(
                          "flex min-h-[2.75rem] items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                          selected
                            ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                            : "border-border hover:border-primary/40 hover:bg-muted/40"
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        {label}
                      </button>
                    )
                  })}
                </div>
              </Field>

              {/* Price preview */}
              {selectedRoom && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Price Preview
                  </p>
                  <div className="flex flex-col gap-1.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        Room {selectedRoom.roomNumber}
                        {form.checkOutDate
                          ? ` × ${nights} night${nights !== 1 ? "s" : ""}`
                          : " (1 night est.)"}
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatPreferenceCurrency(roomCost, preferences)}
                      </span>
                    </div>
                    {form.coolingOption === "AIR_CONDITIONER" && acPrice > 0 && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          A/C surcharge
                          {form.checkOutDate ? ` × ${nights}` : ""}
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatPreferenceCurrency(acCost, preferences)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 border-t border-border pt-1.5">
                      <span className="font-semibold">Total</span>
                      <span className="font-mono text-base font-semibold tabular-nums">
                        {formatPreferenceCurrency(totalCost, preferences)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </FieldGroup>
          )}
        </div>

        {/* Footer — sticky */}
        <SheetFooter className="shrink-0 border-t bg-popover px-4 pb-4 pt-3">
          {step === 1 ? (
            <Button
              className="w-full"
              disabled={!canNext}
              onClick={() => setStep(2)}
              type="button"
            >
              Next
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          ) : (
            <div className="flex w-full gap-2">
              <Button
                className="flex-1"
                disabled={isSubmitting}
                onClick={() => setStep(1)}
                type="button"
                variant="outline"
              >
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={!canSubmit || isSubmitting}
                onClick={handleSubmit}
                type="button"
              >
                {isSubmitting ? "Checking in…" : "Confirm Check-in"}
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
