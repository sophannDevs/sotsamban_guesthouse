"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AirVentIcon,
  BedDoubleIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
  Loader2Icon,
  MoonIcon,
  SearchIcon,
  SunIcon,
  UserIcon,
  WindIcon,
  ZapIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/app/bottom-sheet"
import { useActiveBusiness } from "@/components/app/business-provider"
import {
  formatPreferenceCurrency,
  useSystemPreferences,
} from "@/components/app/system-preferences-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  bookingService,
  getBookingErrorMessage,
  type BookingType,
  type CoolingOption,
  type HourlyPricePreview,
  type SessionType,
  type StayDuration,
} from "@/lib/bookings"
import { guestService, type Guest, type GuestSearchResult } from "@/lib/guests"
import {
  roomService,
  type Room,
  type RoomTimeAvailabilityStatus,
} from "@/lib/rooms"
import { cn } from "@/lib/utils"

type Step =
  | "guest"
  | "room"
  | "type"
  | "duration"
  | "session"
  | "price"
  | "confirm"

type SelectableGuest = {
  id: string
  name: string
  phone: string | null
}

const bookingTypes: Array<{
  value: BookingType
  title: string
  description: string
}> = [
  {
    value: "HOURLY",
    title: "Hourly",
    description: "Short stay by exact duration",
  },
  {
    value: "HALF_DAY",
    title: "Half Day",
    description: "Fast 6-hour desk booking",
  },
  { value: "DAILY", title: "Daily", description: "Full 24-hour stay" },
]

const durations: Array<{ value: StayDuration; label: string; hours: number }> =
  [
    { value: "TWO_HOURS", label: "2H", hours: 2 },
    { value: "THREE_HOURS", label: "3H", hours: 3 },
    { value: "SIX_HOURS", label: "6H", hours: 6 },
    { value: "TWELVE_HOURS", label: "12H", hours: 12 },
    { value: "TWENTY_FOUR_HOURS", label: "24H", hours: 24 },
  ]

const sessionTypes: Array<{
  value: SessionType
  label: string
  icon: typeof SunIcon
}> = [
  { value: "DAY", label: "Day", icon: SunIcon },
  { value: "NIGHT", label: "Night", icon: MoonIcon },
]

function getSteps(bookingType: BookingType): Step[] {
  return bookingType === "HOURLY"
    ? ["guest", "room", "type", "duration", "session", "price", "confirm"]
    : ["guest", "room", "type", "session", "price", "confirm"]
}

function toSelectableGuest(guest: Guest | GuestSearchResult): SelectableGuest {
  return {
    id: guest.id,
    name: "fullName" in guest ? guest.fullName : guest.name,
    phone: guest.phone,
  }
}

function availabilityTone(status: RoomTimeAvailabilityStatus | null) {
  if (status === "AVAILABLE") return "success"
  if (status === "BLOCKED") return "warning"
  if (status === "OCCUPIED") return "destructive"
  if (status === "BOOKED") return "info"
  return "secondary"
}

function availabilityText(status: RoomTimeAvailabilityStatus | null) {
  if (status === "BLOCKED") return "Blocked by hourly overlap"
  if (status === "OCCUPIED") return "Occupied"
  if (status === "BOOKED") return "Booked"
  if (status === "AVAILABLE") return "Available"
  return "Checking"
}

export default function HourlyBookingPage() {
  const { preferences } = useSystemPreferences()
  const { activeBusiness } = useActiveBusiness()
  const [step, setStep] = useState<Step>("guest")
  const [guestSheetOpen, setGuestSheetOpen] = useState(false)
  const [roomSheetOpen, setRoomSheetOpen] = useState(false)

  const [guestQuery, setGuestQuery] = useState("")
  const [guests, setGuests] = useState<SelectableGuest[]>([])
  const [isLoadingGuests, setIsLoadingGuests] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState<SelectableGuest | null>(
    null,
  )

  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoadingRooms, setIsLoadingRooms] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)

  const [bookingType, setBookingType] = useState<BookingType>("HOURLY")
  const [stayDuration, setStayDuration] = useState<StayDuration>("THREE_HOURS")
  const [sessionType, setSessionType] = useState<SessionType>("DAY")
  const [coolingOption, setCoolingOption] = useState<CoolingOption>("FAN")

  const [pricePreview, setPricePreview] = useState<HourlyPricePreview | null>(
    null,
  )
  const [availability, setAvailability] =
    useState<RoomTimeAvailabilityStatus | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const steps = useMemo(() => getSteps(bookingType), [bookingType])
  const stepIndex = steps.indexOf(step)
  const progress = ((stepIndex + 1) / steps.length) * 100

  useEffect(() => {
    if (!activeBusiness) {
      setGuests([])
      return
    }

    let ignore = false

    async function loadGuests() {
      setIsLoadingGuests(true)
      try {
        const data = guestQuery.trim()
          ? await guestService.search(guestQuery.trim(), 12)
          : await guestService.list()
        if (!ignore) setGuests(data.map(toSelectableGuest))
      } catch {
        if (!ignore) setGuests([])
      } finally {
        if (!ignore) setIsLoadingGuests(false)
      }
    }

    const timeout = setTimeout(() => void loadGuests(), 250)
    return () => {
      ignore = true
      clearTimeout(timeout)
    }
  }, [activeBusiness, guestQuery])

  useEffect(() => {
    if (!activeBusiness) {
      setRooms([])
      return
    }

    let ignore = false

    async function loadRooms() {
      setIsLoadingRooms(true)
      try {
        const data = await roomService.list()
        if (!ignore) setRooms(data)
      } catch {
        if (!ignore) setRooms([])
      } finally {
        if (!ignore) setIsLoadingRooms(false)
      }
    }

    void loadRooms()
    return () => {
      ignore = true
    }
  }, [activeBusiness])

  useEffect(() => {
    if (bookingType === "HALF_DAY") {
      setStayDuration("SIX_HOURS")
      if (step === "duration") setStep("session")
    }
    if (bookingType === "DAILY") {
      setStayDuration("TWENTY_FOUR_HOURS")
      if (step === "duration") setStep("session")
    }
  }, [bookingType, step])

  useEffect(() => {
    if (!selectedRoom) {
      setPricePreview(null)
      setAvailability(null)
      setPreviewError(null)
      return
    }

    const room = selectedRoom
    let ignore = false

    async function loadPreview() {
      setIsPreviewLoading(true)
      setPreviewError(null)

      try {
        const preview = await bookingService.previewHourlyPrice({
          roomId: room.id,
          bookingType,
          stayDuration: bookingType === "DAILY" ? undefined : stayDuration,
          sessionType,
          coolingOption,
        })
        if (ignore) return

        setPricePreview(preview)
        const availabilityResult = await roomService.checkRoomAvailability(
          room.id,
          {
            startTime: preview.checkInTime,
            endTime: preview.autoCheckoutAt,
          },
        )
        if (!ignore) setAvailability(availabilityResult.status)
      } catch (error) {
        if (!ignore) {
          setPricePreview(null)
          setAvailability(null)
          setPreviewError(getBookingErrorMessage(error))
        }
      } finally {
        if (!ignore) setIsPreviewLoading(false)
      }
    }

    void loadPreview()
    return () => {
      ignore = true
    }
  }, [bookingType, coolingOption, selectedRoom, sessionType, stayDuration])

  function goNext() {
    const nextStep = steps[Math.min(stepIndex + 1, steps.length - 1)]
    if (nextStep) setStep(nextStep)
  }

  function goBack() {
    const previousStep = steps[Math.max(stepIndex - 1, 0)]
    if (previousStep) setStep(previousStep)
  }

  const canContinue =
    (step === "guest" && selectedGuest !== null) ||
    (step === "room" && selectedRoom !== null) ||
    step === "type" ||
    (step === "duration" && stayDuration !== null) ||
    step === "session" ||
    (step === "price" &&
      pricePreview !== null &&
      availability === "AVAILABLE") ||
    step === "confirm"

  const canConfirm =
    selectedGuest !== null &&
    selectedRoom !== null &&
    pricePreview !== null &&
    availability === "AVAILABLE" &&
    !isSubmitting

  async function handleConfirm() {
    if (!selectedGuest || !selectedRoom || !canConfirm) return

    setIsSubmitting(true)
    try {
      const booking = await bookingService.createHourly({
        guestId: selectedGuest.id,
        roomId: selectedRoom.id,
        bookingType,
        stayDuration: bookingType === "DAILY" ? undefined : stayDuration,
        sessionType,
        coolingOption,
      })

      toast.success("Booking confirmed", {
        description: `Room ${booking.room.roomNumber} is checked in.`,
      })
      setStep("guest")
      setSelectedGuest(null)
      setSelectedRoom(null)
    } catch (error) {
      toast.error("Booking failed", {
        description: getBookingErrorMessage(error),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-24">
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock3Icon />
          <span>Hourly booking desk</span>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold leading-tight">
            Create timed stay
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Select a guest, lock a room, confirm the duration, and let the
            backend price and availability checks decide when the booking can
            proceed.
          </p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>{getStepTitle(step)}</CardTitle>
            <CardDescription>{getStepDescription(step)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {step === "guest" ? (
              <SelectionPanel
                icon={UserIcon}
                title={selectedGuest?.name ?? "No guest selected"}
                description={selectedGuest?.phone ?? "Choose an existing guest"}
                actionLabel="Select Guest"
                onClick={() => setGuestSheetOpen(true)}
                selected={selectedGuest !== null}
              />
            ) : null}

            {step === "room" ? (
              <SelectionPanel
                icon={BedDoubleIcon}
                title={
                  selectedRoom
                    ? `Room ${selectedRoom.roomNumber}`
                    : "No room selected"
                }
                description={
                  selectedRoom
                    ? `${selectedRoom.type} room, ${formatPreferenceCurrency(
                        selectedRoom.pricePerNight,
                        preferences,
                      )} per day`
                    : "Choose a room to check live availability"
                }
                actionLabel="Select Room"
                onClick={() => setRoomSheetOpen(true)}
                selected={selectedRoom !== null}
              />
            ) : null}

            {step === "type" ? (
              <OptionGrid>
                {bookingTypes.map((type) => (
                  <OptionButton
                    description={type.description}
                    key={type.value}
                    onClick={() => setBookingType(type.value)}
                    selected={bookingType === type.value}
                    title={type.title}
                  />
                ))}
              </OptionGrid>
            ) : null}

            {step === "duration" ? (
              <OptionGrid>
                {durations.map((duration) => (
                  <OptionButton
                    description={`${duration.hours} hour stay`}
                    key={duration.value}
                    onClick={() => setStayDuration(duration.value)}
                    selected={stayDuration === duration.value}
                    title={duration.label}
                  />
                ))}
              </OptionGrid>
            ) : null}

            {step === "session" ? (
              <div className="flex flex-col gap-3">
                <OptionGrid>
                  {sessionTypes.map(({ value, label, icon: Icon }) => (
                    <button
                      className={cn(
                        "flex min-h-24 flex-col items-start justify-between rounded-lg border p-4 text-left transition",
                        sessionType === value
                          ? "border-primary bg-primary/5"
                          : "bg-background hover:bg-muted",
                      )}
                      key={value}
                      onClick={() => setSessionType(value)}
                      type="button"
                    >
                      <Icon />
                      <span className="font-medium">{label}</span>
                    </button>
                  ))}
                </OptionGrid>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => setCoolingOption("FAN")}
                    type="button"
                    variant={coolingOption === "FAN" ? "default" : "outline"}
                  >
                    <WindIcon data-icon="inline-start" />
                    Fan
                  </Button>
                  <Button
                    onClick={() => setCoolingOption("AIR_CONDITIONER")}
                    type="button"
                    variant={
                      coolingOption === "AIR_CONDITIONER"
                        ? "default"
                        : "outline"
                    }
                  >
                    <AirVentIcon data-icon="inline-start" />
                    AC
                  </Button>
                </div>
              </div>
            ) : null}

            {step === "price" || step === "confirm" ? (
              <PricePreview
                availability={availability}
                isLoading={isPreviewLoading}
                preview={pricePreview}
                preferences={preferences}
                selectedRoom={selectedRoom}
              />
            ) : null}

            {previewError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not calculate booking</AlertTitle>
                <AlertDescription>{previewError}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-3">
          <SummaryPanel
            availability={availability}
            bookingType={bookingType}
            guest={selectedGuest}
            preview={pricePreview}
            room={selectedRoom}
            sessionType={sessionType}
            stayDuration={stayDuration}
          />
        </aside>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-4 backdrop-blur md:left-[var(--sidebar-width,0px)]">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Button
            className="min-h-11 flex-1"
            disabled={stepIndex === 0}
            onClick={goBack}
            type="button"
            variant="outline"
          >
            <ChevronLeftIcon data-icon="inline-start" />
            Back
          </Button>
          {step === "confirm" ? (
            <Button
              className="min-h-11 flex-[1.4]"
              disabled={!canConfirm}
              onClick={handleConfirm}
              type="button"
            >
              {isSubmitting ? (
                <Loader2Icon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <CheckCircle2Icon data-icon="inline-start" />
              )}
              Confirm
            </Button>
          ) : (
            <Button
              className="min-h-11 flex-[1.4]"
              disabled={!canContinue}
              onClick={goNext}
              type="button"
            >
              Continue
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          )}
        </div>
      </div>

      <GuestPickerSheet
        guests={guests}
        isLoading={isLoadingGuests}
        onOpenChange={setGuestSheetOpen}
        onQueryChange={setGuestQuery}
        onSelect={(guest) => {
          setSelectedGuest(guest)
          setGuestSheetOpen(false)
          setStep("room")
        }}
        open={guestSheetOpen}
        query={guestQuery}
      />

      <RoomPickerSheet
        isLoading={isLoadingRooms}
        onOpenChange={setRoomSheetOpen}
        onSelect={(room) => {
          setSelectedRoom(room)
          setRoomSheetOpen(false)
          setStep("type")
        }}
        open={roomSheetOpen}
        rooms={rooms}
      />
    </div>
  )
}

function getStepTitle(step: Step) {
  const titles: Record<Step, string> = {
    guest: "Select Guest",
    room: "Select Room",
    type: "Choose Booking Type",
    duration: "Choose Duration",
    session: "Select Session",
    price: "Live Price Preview",
    confirm: "Confirm Booking",
  }
  return titles[step]
}

function getStepDescription(step: Step) {
  const descriptions: Record<Step, string> = {
    guest: "Find the guest record before assigning a room.",
    room: "Pick a room, then availability is checked against the exact time slot.",
    type: "Select how the stay should be priced and timed.",
    duration: "Hourly bookings require an exact duration.",
    session: "Night sessions apply the backend night multiplier.",
    price: "The preview below is calculated by the backend pricing engine.",
    confirm: "Review the final room, guest, price, and availability.",
  }
  return descriptions[step]
}

function OptionGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{children}</div>
}

function OptionButton({
  description,
  onClick,
  selected,
  title,
}: {
  description: string
  onClick: () => void
  selected: boolean
  title: string
}) {
  return (
    <button
      className={cn(
        "flex min-h-24 flex-col justify-between rounded-lg border p-4 text-left transition",
        selected
          ? "border-primary bg-primary/5"
          : "bg-background hover:bg-muted",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="text-base font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  )
}

function SelectionPanel({
  actionLabel,
  description,
  icon: Icon,
  onClick,
  selected,
  title,
}: {
  actionLabel: string
  description: string
  icon: typeof UserIcon
  onClick: () => void
  selected: boolean
  title: string
}) {
  return (
    <button
      className={cn(
        "flex min-h-28 items-center gap-3 rounded-lg border p-4 text-left transition",
        selected
          ? "border-primary bg-primary/5"
          : "bg-background hover:bg-muted",
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{description}</p>
      </div>
      <Badge variant={selected ? "success" : "outline"}>{actionLabel}</Badge>
    </button>
  )
}

function PricePreview({
  availability,
  isLoading,
  preferences,
  preview,
  selectedRoom,
}: {
  availability: RoomTimeAvailabilityStatus | null
  isLoading: boolean
  preferences: ReturnType<typeof useSystemPreferences>["preferences"]
  preview: HourlyPricePreview | null
  selectedRoom: Room | null
}) {
  if (!selectedRoom) {
    return (
      <Alert>
        <AlertTitle>Select a room first</AlertTitle>
        <AlertDescription>
          Price and availability start after a room is selected.
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!preview) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm text-muted-foreground">Availability</p>
          <p className="font-medium">{availabilityText(availability)}</p>
        </div>
        <Badge variant={availabilityTone(availability)}>
          {availabilityText(availability)}
        </Badge>
      </div>
      <div className="grid gap-2">
        <PriceRow
          label="Daily base"
          value={formatPreferenceCurrency(preview.basePrice, preferences)}
        />
        <PriceRow
          label="Duration price"
          value={formatPreferenceCurrency(preview.durationPrice, preferences)}
        />
        <PriceRow
          label="Session adjustment"
          value={formatPreferenceCurrency(preview.sessionPrice, preferences)}
        />
        <PriceRow
          label="Cooling"
          value={formatPreferenceCurrency(preview.coolingPrice, preferences)}
        />
      </div>
      <div className="rounded-lg bg-primary p-4 text-primary-foreground">
        <p className="text-sm opacity-80">Total due</p>
        <p className="text-3xl font-semibold tabular-nums">
          {formatPreferenceCurrency(preview.totalPrice, preferences)}
        </p>
      </div>
    </div>
  )
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

function SummaryPanel({
  availability,
  bookingType,
  guest,
  preview,
  room,
  sessionType,
  stayDuration,
}: {
  availability: RoomTimeAvailabilityStatus | null
  bookingType: BookingType
  guest: SelectableGuest | null
  preview: HourlyPricePreview | null
  room: Room | null
  sessionType: SessionType
  stayDuration: StayDuration
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking Summary</CardTitle>
        <CardDescription>Updates as selections change.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <SummaryRow label="Guest" value={guest?.name ?? "Not selected"} />
        <SummaryRow
          label="Room"
          value={room ? `Room ${room.roomNumber}` : "Not selected"}
        />
        <SummaryRow label="Type" value={bookingType.replace("_", " ")} />
        <SummaryRow
          label="Duration"
          value={stayDuration.replaceAll("_", " ")}
        />
        <SummaryRow label="Session" value={sessionType} />
        <SummaryRow label="Status" value={availabilityText(availability)} />
        {preview ? (
          <SummaryRow
            label="Checkout"
            value={new Date(preview.autoCheckoutAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-44 text-right font-medium">{value}</span>
    </div>
  )
}

function GuestPickerSheet({
  guests,
  isLoading,
  onOpenChange,
  onQueryChange,
  onSelect,
  open,
  query,
}: {
  guests: SelectableGuest[]
  isLoading: boolean
  onOpenChange: (open: boolean) => void
  onQueryChange: (value: string) => void
  onSelect: (guest: SelectableGuest) => void
  open: boolean
  query: string
}) {
  return (
    <BottomSheet onOpenChange={onOpenChange} open={open}>
      <BottomSheetContent size="lg">
        <BottomSheetHeader>
          <BottomSheetTitle>Select Guest</BottomSheetTitle>
          <BottomSheetDescription>
            Search by guest name or phone number.
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="guestSearch">Guest search</FieldLabel>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  id="guestSearch"
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder="Name or phone"
                  value={query}
                />
              </div>
            </Field>
          </FieldGroup>
          <div className="flex flex-col gap-2">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <Skeleton className="h-14 w-full" key={index} />
              ))
            ) : guests.length ? (
              guests.map((guest) => (
                <button
                  className="flex min-h-14 items-center gap-3 rounded-lg border px-3 text-left hover:bg-muted"
                  key={guest.id}
                  onClick={() => onSelect(guest)}
                  type="button"
                >
                  <UserIcon />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{guest.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {guest.phone ?? "No phone"}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <p className="rounded-lg border p-4 text-sm text-muted-foreground">
                No guests found.
              </p>
            )}
          </div>
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  )
}

function RoomPickerSheet({
  isLoading,
  onOpenChange,
  onSelect,
  open,
  rooms,
}: {
  isLoading: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (room: Room) => void
  open: boolean
  rooms: Room[]
}) {
  return (
    <BottomSheet onOpenChange={onOpenChange} open={open}>
      <BottomSheetContent size="lg">
        <BottomSheetHeader>
          <BottomSheetTitle>Select Room</BottomSheetTitle>
          <BottomSheetDescription>
            Availability is checked after timing is selected.
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {isLoading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton className="h-20 w-full" key={index} />
                ))
              : rooms.map((room) => (
                  <button
                    className="flex min-h-20 flex-col justify-between rounded-lg border p-3 text-left hover:bg-muted"
                    key={room.id}
                    onClick={() => onSelect(room)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        Room {room.roomNumber}
                      </span>
                      <Badge
                        variant={
                          room.status === "AVAILABLE" ? "success" : "outline"
                        }
                      >
                        {room.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {room.type} room
                    </span>
                  </button>
                ))}
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <p className="text-xs text-muted-foreground">
            Rooms under maintenance or cleaning will be blocked by the live
            availability check.
          </p>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  )
}
