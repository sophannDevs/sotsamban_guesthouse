"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AirVentIcon,
  BedDoubleIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HistoryIcon,
  SearchIcon,
  UserIcon,
  WindIcon,
  ZapIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import {
  formatPreferenceCurrency,
  formatPreferenceDate,
  type SystemPreferences,
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
  type Booking,
  type CoolingOption,
} from "@/lib/bookings"
import { guestService, type GuestSearchResult } from "@/lib/guests"
import { roomService, type Room } from "@/lib/rooms"
import { settingsService } from "@/lib/settings"
import { cn } from "@/lib/utils"

type Step = "guest" | "room" | "schedule" | "confirm"
type TranslationFn = ReturnType<typeof useTranslations>

const steps: Step[] = ["guest", "room", "schedule", "confirm"]
const SEARCH_DEBOUNCE_MS = 300

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function calcNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 1
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  const days = Math.round(ms / (1000 * 60 * 60 * 24))
  return days > 0 ? days : 1
}

function getStepDescription(step: Step, t: TranslationFn) {
  switch (step) {
    case "guest":
      return t("expressStepGuestDescription")
    case "room":
      return t("expressStepRoomDescription")
    case "schedule":
      return t("expressStepScheduleDescription")
    case "confirm":
      return t("expressStepConfirmDescription")
  }
}

export function ExpressCheckInSheet({
  open,
  onOpenChange,
  onComplete,
  initialGuest,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (booking: Booking) => void
  /** Skips straight to the room step — e.g. "Check-in Again" from the Frequent Guests widget. */
  initialGuest?: GuestSearchResult
}) {
  const t = useTranslations()
  const { preferences } = useSystemPreferences()

  const [step, setStep] = useState<Step>(initialGuest ? "room" : "guest")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Steps 1-2: search & select an existing guest
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GuestSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState<GuestSearchResult | null>(
    initialGuest ?? null
  )

  // Step 3: room (available only)
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoadingRooms, setIsLoadingRooms] = useState(false)
  const [roomsError, setRoomsError] = useState<string | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState("")

  // Step 4: schedule
  const [checkInDate, setCheckInDate] = useState(todayISO())
  const [checkOutDate, setCheckOutDate] = useState("")
  const [coolingOption, setCoolingOption] = useState<CoolingOption>("FAN")
  const [acPricePerNight, setAcPricePerNight] = useState(0)

  // The sheet is only ever rendered (mounted) while `open` is true — the
  // parent unmounts it on close — so initial state is already fresh on
  // every open via the useState initializers above. Only the AC price
  // setting needs an actual fetch-on-mount effect.
  useEffect(() => {
    settingsService
      .getSetting("airConditionerPricePerNight")
      .then((setting) => {
        const parsed = Number(setting.value)
        if (!Number.isNaN(parsed) && parsed >= 0) setAcPricePerNight(parsed)
      })
      .catch(() => {
        // keep default
      })
  }, [])

  // Rule 1: instant search must hit the API debounced, not on every keystroke
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) return

    let ignore = false

    const timeout = setTimeout(() => {
      setIsSearching(true)
      guestService
        .search(trimmed)
        .then((guests) => {
          if (!ignore) setResults(guests)
        })
        .catch(() => {
          if (!ignore) setResults([])
        })
        .finally(() => {
          if (!ignore) setIsSearching(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      ignore = true
      clearTimeout(timeout)
    }
  }, [query])

  // Rule 3: re-fetch on every visit to this step so availability is live,
  // not a stale snapshot from when the sheet was first opened
  useEffect(() => {
    if (step !== "room") return

    let ignore = false

    async function loadRooms() {
      setIsLoadingRooms(true)
      setRoomsError(null)

      try {
        const allRooms = await roomService.list()
        if (!ignore) {
          setRooms(allRooms.filter((room) => room.status === "AVAILABLE"))
        }
      } catch {
        if (!ignore) setRoomsError(t("couldNotLoadRooms"))
      } finally {
        if (!ignore) setIsLoadingRooms(false)
      }
    }

    void loadRooms()

    return () => {
      ignore = true
    }
  }, [step, t])

  function selectGuest(guest: GuestSearchResult) {
    setSelectedGuest(guest)
    setSelectedRoomId("")
    setStep("room")
  }

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId)

  const nights = useMemo(
    () => (checkOutDate ? calcNights(checkInDate, checkOutDate) : 1),
    [checkInDate, checkOutDate]
  )

  const isDateRangeValid =
    !checkOutDate || new Date(checkOutDate) > new Date(checkInDate)

  const roomCost = (selectedRoom?.pricePerNight ?? 0) * nights
  const acCost =
    coolingOption === "AIR_CONDITIONER" ? acPricePerNight * nights : 0
  const totalCost = roomCost + acCost

  const stepIndex = steps.indexOf(step)

  function goBack() {
    const index = steps.indexOf(step)
    if (index > 0) setStep(steps[index - 1])
  }

  async function handleSubmit() {
    if (!selectedGuest || !selectedRoom || isSubmitting) return
    setIsSubmitting(true)

    try {
      const booking = await bookingService.expressCheckIn({
        guestId: selectedGuest.id,
        roomId: selectedRoom.id,
        checkInDate,
        ...(checkOutDate ? { checkOutDate } : {}),
        coolingOption,
      })

      toast.success(t("expressCheckInSuccessTitle"), {
        description: t("expressCheckInSuccessDescription", {
          guestName: selectedGuest.name,
          roomNumber: selectedRoom.roomNumber,
        }),
      })

      onOpenChange(false)
      onComplete?.(booking)
    } catch (err) {
      toast.error(t("checkInFailed"), {
        description: getBookingErrorMessage(err),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="flex max-h-[92dvh] flex-col gap-0 p-0"
        side="bottom"
      >
        <SheetHeader className="shrink-0 px-4 pb-3 pt-4">
          <div className="mb-2 flex gap-1.5">
            {steps.map((s, index) => (
              <div
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  index <= stepIndex ? "bg-primary" : "bg-muted"
                )}
                key={s}
              />
            ))}
          </div>
          <SheetTitle className="flex items-center gap-1.5">
            <ZapIcon className="size-4 text-primary" />
            {t("expressCheckIn")}
          </SheetTitle>
          <SheetDescription>{getStepDescription(step, t)}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {step === "guest" ? (
            <GuestStep
              isSearching={isSearching && Boolean(query.trim())}
              onQueryChange={setQuery}
              onSelect={selectGuest}
              query={query}
              results={query.trim() ? results : []}
              t={t}
            />
          ) : null}

          {step === "room" ? (
            <RoomStep
              error={roomsError}
              isLoading={isLoadingRooms}
              onSelect={setSelectedRoomId}
              preferences={preferences}
              rooms={rooms}
              selectedGuest={selectedGuest}
              selectedRoomId={selectedRoomId}
              t={t}
            />
          ) : null}

          {step === "schedule" ? (
            <ScheduleStep
              acCost={acCost}
              checkInDate={checkInDate}
              checkOutDate={checkOutDate}
              coolingOption={coolingOption}
              isDateRangeValid={isDateRangeValid}
              nights={nights}
              preferences={preferences}
              roomCost={roomCost}
              selectedRoom={selectedRoom}
              setCheckInDate={setCheckInDate}
              setCheckOutDate={setCheckOutDate}
              setCoolingOption={setCoolingOption}
              t={t}
              totalCost={totalCost}
            />
          ) : null}

          {step === "confirm" ? (
            <ConfirmStep
              checkInDate={checkInDate}
              checkOutDate={checkOutDate}
              coolingOption={coolingOption}
              guest={selectedGuest}
              nights={nights}
              preferences={preferences}
              room={selectedRoom}
              t={t}
              totalCost={totalCost}
            />
          ) : null}
        </div>

        <SheetFooter className="shrink-0 border-t bg-popover px-4 pb-4 pt-3">
          <div className="flex w-full gap-2">
            {stepIndex > 0 ? (
              <Button
                className="flex-1"
                disabled={isSubmitting}
                onClick={goBack}
                type="button"
                variant="outline"
              >
                <ChevronLeftIcon data-icon="inline-start" />
                {t("back")}
              </Button>
            ) : null}

            {step === "room" ? (
              <Button
                className="flex-1"
                disabled={!selectedRoomId}
                onClick={() => setStep("schedule")}
                type="button"
              >
                {t("next")}
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            ) : null}

            {step === "schedule" ? (
              <Button
                className="flex-1"
                disabled={!checkInDate || !isDateRangeValid}
                onClick={() => setStep("confirm")}
                type="button"
              >
                {t("next")}
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            ) : null}

            {step === "confirm" ? (
              <Button
                className="flex-1"
                disabled={isSubmitting}
                onClick={() => void handleSubmit()}
                type="button"
              >
                {isSubmitting ? t("checkingIn") : t("confirmCheckIn")}
              </Button>
            ) : null}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Step 1 + 2 — search and select an existing guest
// ---------------------------------------------------------------------------

function GuestStep({
  query,
  onQueryChange,
  results,
  isSearching,
  onSelect,
  t,
}: {
  query: string
  onQueryChange: (value: string) => void
  results: GuestSearchResult[]
  isSearching: boolean
  onSelect: (guest: GuestSearchResult) => void
  t: TranslationFn
}) {
  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel className="flex items-center gap-1.5">
          <SearchIcon className="size-3.5 shrink-0" />
          {t("expressSearchGuestLabel")}
        </FieldLabel>
        <Input
          autoFocus
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("expressSearchGuestPlaceholder")}
          value={query}
        />
      </Field>

      <div className="flex flex-col divide-y rounded-lg border">
        {isSearching ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div className="flex items-center gap-3 p-3" key={index}>
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))
        ) : results.length > 0 ? (
          results.map((guest) => (
            <button
              className="flex items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50"
              key={guest.id}
              onClick={() => onSelect(guest)}
              type="button"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/40">
                <UserIcon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{guest.name}</p>
                <p className="text-sm text-muted-foreground">
                  {guest.phone ?? t("notProvided")}
                </p>
              </div>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {query.trim() ? t("noGuestsFound") : t("expressSearchGuestHint")}
          </p>
        )}
      </div>
    </FieldGroup>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — select an AVAILABLE room (with guest history preview)
// ---------------------------------------------------------------------------

function RoomStep({
  selectedGuest,
  rooms,
  isLoading,
  error,
  selectedRoomId,
  onSelect,
  preferences,
  t,
}: {
  selectedGuest: GuestSearchResult | null
  rooms: Room[]
  isLoading: boolean
  error: string | null
  selectedRoomId: string
  onSelect: (roomId: string) => void
  preferences: SystemPreferences
  t: TranslationFn
}) {
  return (
    <FieldGroup className="gap-4">
      {selectedGuest ? (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="flex items-center gap-1.5 font-medium">
            <UserIcon className="size-3.5 shrink-0 text-muted-foreground" />
            {selectedGuest.name}
          </p>
          {selectedGuest.totalVisits > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <HistoryIcon className="size-3" />
                {t(
                  selectedGuest.totalVisits === 1
                    ? "expressTotalStay"
                    : "expressTotalStays",
                  { count: selectedGuest.totalVisits }
                )}
              </span>
              {selectedGuest.lastBookingDate ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarIcon className="size-3" />
                  {t("expressLastVisit", {
                    date: formatPreferenceDate(
                      selectedGuest.lastBookingDate,
                      preferences
                    ),
                  })}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t("expressFirstTimeGuest")}
            </p>
          )}
        </div>
      ) : null}

      <Field>
        <FieldLabel className="mb-1.5 flex items-center gap-1.5">
          <BedDoubleIcon className="size-3.5 shrink-0" />
          {t("selectRoom")}
        </FieldLabel>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <Skeleton className="h-[4.5rem] w-full rounded-lg" key={index} />
              ))
            ) : rooms.length > 0 ? (
              rooms.map((room) => {
                const selected = selectedRoomId === room.id
                return (
                  <button
                    className={cn(
                      "flex min-h-[4.5rem] flex-col gap-0.5 rounded-lg border p-2.5 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/40"
                    )}
                    key={room.id}
                    onClick={() => onSelect(room.id)}
                    type="button"
                  >
                    <span className="text-sm font-semibold leading-tight">
                      {t("roomLabel", { roomNumber: room.roomNumber })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {room.type}
                    </span>
                    <Badge
                      className="mt-auto h-5 px-1.5 text-[10px] font-medium"
                      variant="success"
                    >
                      {t("available")}
                    </Badge>
                  </button>
                )
              })
            ) : (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                {t("noRoomsAvailable")}
              </p>
            )}
          </div>
        )}
      </Field>
    </FieldGroup>
  )
}

// ---------------------------------------------------------------------------
// Step 4 — schedule (dates + cooling) with live price preview
// ---------------------------------------------------------------------------

function ScheduleStep({
  checkInDate,
  setCheckInDate,
  checkOutDate,
  setCheckOutDate,
  coolingOption,
  setCoolingOption,
  isDateRangeValid,
  selectedRoom,
  nights,
  roomCost,
  acCost,
  totalCost,
  preferences,
  t,
}: {
  checkInDate: string
  setCheckInDate: (value: string) => void
  checkOutDate: string
  setCheckOutDate: (value: string) => void
  coolingOption: CoolingOption
  setCoolingOption: (value: CoolingOption) => void
  isDateRangeValid: boolean
  selectedRoom: Room | undefined
  nights: number
  roomCost: number
  acCost: number
  totalCost: number
  preferences: SystemPreferences
  t: TranslationFn
}) {
  return (
    <FieldGroup className="gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel className="flex items-center gap-1.5">
            <CalendarIcon className="size-3.5 shrink-0" />
            {t("checkInDate")}
          </FieldLabel>
          <Input
            min={todayISO()}
            onChange={(event) => setCheckInDate(event.target.value)}
            type="date"
            value={checkInDate}
          />
        </Field>
        <Field data-invalid={!isDateRangeValid}>
          <FieldLabel className="flex items-center gap-1">
            <CalendarIcon className="size-3.5 shrink-0" />
            {t("checkOutDate")}
            <span className="text-[10px] font-normal text-muted-foreground">
              ({t("optional")})
            </span>
          </FieldLabel>
          <Input
            aria-invalid={!isDateRangeValid}
            min={checkInDate || todayISO()}
            onChange={(event) => setCheckOutDate(event.target.value)}
            type="date"
            value={checkOutDate}
          />
          {!isDateRangeValid ? (
            <p className="text-xs text-destructive">
              {t("checkOutAfterCheckIn")}
            </p>
          ) : null}
        </Field>
      </div>

      <Field>
        <FieldLabel className="mb-1.5">{t("coolingHint")}</FieldLabel>
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

      {selectedRoom ? (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("pricePreview")}
          </p>
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {t("roomLabel", { roomNumber: selectedRoom.roomNumber })}
                {checkOutDate
                  ? ` × ${nights} ${t(nights === 1 ? "night" : "nights")}`
                  : ` (${t("estimateOneNight")})`}
              </span>
              <span className="font-mono tabular-nums">
                {formatPreferenceCurrency(roomCost, preferences)}
              </span>
            </div>
            {coolingOption === "AIR_CONDITIONER" && acCost > 0 ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t("acSurcharge")}</span>
                <span className="font-mono tabular-nums">
                  {formatPreferenceCurrency(acCost, preferences)}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-2 border-t border-border pt-1.5">
              <span className="font-semibold">{t("total")}</span>
              <span className="font-mono text-base font-semibold tabular-nums">
                {formatPreferenceCurrency(totalCost, preferences)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </FieldGroup>
  )
}

// ---------------------------------------------------------------------------
// Step 5 — one-click final confirm
// ---------------------------------------------------------------------------

function ConfirmStep({
  guest,
  room,
  checkInDate,
  checkOutDate,
  coolingOption,
  nights,
  totalCost,
  preferences,
  t,
}: {
  guest: GuestSearchResult | null
  room: Room | undefined
  checkInDate: string
  checkOutDate: string
  coolingOption: CoolingOption
  nights: number
  totalCost: number
  preferences: SystemPreferences
  t: TranslationFn
}) {
  if (!guest || !room) return null

  return (
    <FieldGroup className="gap-3">
      <div className="flex flex-col divide-y rounded-lg border">
        <ConfirmRow label={t("guest")} value={guest.name} />
        <ConfirmRow
          label={t("room")}
          value={t("roomLabel", { roomNumber: room.roomNumber })}
        />
        <ConfirmRow
          label={t("checkInDate")}
          value={formatPreferenceDate(checkInDate, preferences)}
        />
        <ConfirmRow
          label={t("checkOutDate")}
          value={
            checkOutDate
              ? formatPreferenceDate(checkOutDate, preferences)
              : `${t("estimateOneNight")}`
          }
        />
        <ConfirmRow
          label={t("wizardCoolingOption")}
          value={coolingOption === "AIR_CONDITIONER" ? t("coolingAC") : t("coolingFan")}
        />
      </div>

      <div className="rounded-lg border bg-primary/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {t("estimatedTotal")} · {nights} {t(nights === 1 ? "night" : "nights")}
          </span>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {formatPreferenceCurrency(totalCost, preferences)}
          </span>
        </div>
      </div>
    </FieldGroup>
  )
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 p-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
