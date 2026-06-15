"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AirVentIcon,
  AlertCircleIcon,
  ArrowLeftIcon,
  BedDoubleIcon,
  CalendarCheckIcon,
  CalendarPlusIcon,
  CalendarXIcon,
  CheckIcon,
  DoorOpenIcon,
  EyeIcon,
  FileDownIcon,
  LogInIcon,
  LogOutIcon,
  RefreshCwIcon,
  SearchIcon,
  UserIcon,
  WindIcon,
  XIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Pagination } from "@/components/Pagination"
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
  FieldDescription,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  bookingService,
  bookingStatuses,
  getBookingConflict,
  getBookingErrorMessage,
  type Booking,
  type BookingConflict,
  type BookingPayload,
  type BookingStatus,
} from "@/lib/bookings"
import { guestService, type Guest } from "@/lib/guests"
import {
  downloadInvoiceFile,
  getInvoiceErrorMessage,
  invoiceService,
} from "@/lib/invoices"
import {
  roomService,
  type Room,
  type RoomAvailabilityStatus,
  type RoomType,
} from "@/lib/rooms"
import { defaultPaginationMeta, type PaginatedResponse } from "@/lib/api"
import { cn } from "@/lib/utils"

type StatusFilter = "ALL" | BookingStatus

type Option<T extends string> = {
  value: T
  label: string
}

type RoomOption = Option<string> & {
  status: RoomAvailabilityStatus | "UNKNOWN"
}

type TranslationFn = ReturnType<typeof useTranslations>
type BookingForm = Omit<BookingPayload, "status">

const defaultFormValues: BookingForm = {
  guestId: "",
  roomId: "",
  checkInDate: "",
  checkOutDate: "",
}

export default function BookingsPage() {
  const t = useTranslations()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<Booking>["meta"]>(defaultPaginationMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [guests, setGuests] = useState<Guest[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [isLoading, setIsLoading] = useState(true)
  const [isOptionsLoading, setIsOptionsLoading] = useState(true)
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null
  )
  const [roomAvailability, setRoomAvailability] = useState<
    Record<string, RoomAvailabilityStatus>
  >({})
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [bookingConflict, setBookingConflict] =
    useState<BookingConflict | null>(null)
  const [liveConflict, setLiveConflict] = useState<BookingConflict | null>(null)
  const [isCheckingConflict, setIsCheckingConflict] = useState(false)
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actingBookingId, setActingBookingId] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<
    string | null
  >(null)
  const [isMobileWizard, setIsMobileWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [coolingOption, setCoolingOption] = useState<"FAN" | "AC">("AC")
  const [guestSearch, setGuestSearch] = useState("")
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
      {
        message: t("checkOutAfterCheckIn"),
        path: ["checkOutDate"],
      }
    ) satisfies z.ZodType<BookingForm>
  const filterOptions: Option<StatusFilter>[] = useMemo(
    () => [
      { value: "ALL", label: t("allStatuses") },
      ...bookingStatuses.map((status) => ({
        value: status,
        label: getBookingStatusLabel(status, t),
      })),
    ],
    [t]
  )

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
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
    () =>
      guests.map((guest) => ({
        value: guest.id,
        label: guest.fullName,
      })),
    [guests]
  )

  const canCheckRoomAvailability =
    Boolean(checkInDate) &&
    Boolean(checkOutDate) &&
    calculateNights(checkInDate, checkOutDate) !== null
  const effectiveRoomAvailability = useMemo(
    () => (canCheckRoomAvailability ? roomAvailability : {}),
    [canCheckRoomAvailability, roomAvailability]
  )
  const effectiveAvailabilityError = canCheckRoomAvailability
    ? availabilityError
    : null

  const roomOptions = useMemo<RoomOption[]>(
    () =>
      rooms.map((room) => ({
        value: room.id,
        label: `${t("roomLabel", { roomNumber: room.roomNumber })} - ${formatCurrency(room.pricePerNight)}`,
        status: effectiveRoomAvailability[room.id] ?? "UNKNOWN",
      })),
    [effectiveRoomAvailability, rooms, t]
  )

  const selectedRoomAvailability = selectedRoomId
    ? effectiveRoomAvailability[selectedRoomId]
    : undefined
  const isSelectedRoomUnavailable =
    Boolean(selectedRoomId) &&
    Boolean(selectedRoomAvailability) &&
    selectedRoomAvailability !== "AVAILABLE"

  const estimatedTotal = useMemo(() => {
    if (!selectedRoom || !checkInDate || !checkOutDate) {
      return null
    }

    const nights = calculateNights(checkInDate, checkOutDate)

    if (!nights) {
      return null
    }

    return selectedRoom.pricePerNight * nights
  }, [checkInDate, checkOutDate, selectedRoom])

  const filteredGuests = useMemo(
    () =>
      guestSearch.trim()
        ? guests.filter(
            (g) =>
              g.fullName.toLowerCase().includes(guestSearch.toLowerCase()) ||
              g.phone.includes(guestSearch)
          )
        : guests,
    [guests, guestSearch]
  )

  const selectedGuest = useMemo(
    () => guests.find((g) => g.id === selectedGuestId),
    [guests, selectedGuestId]
  )

  const canGoToNextStep = useMemo(() => {
    switch (wizardStep) {
      case 1:
        return Boolean(selectedGuestId)
      case 2:
        return (
          Boolean(checkInDate) &&
          Boolean(checkOutDate) &&
          calculateNights(checkInDate, checkOutDate) !== null
        )
      case 3:
        return (
          Boolean(selectedRoomId) &&
          !isAvailabilityLoading &&
          !isCheckingConflict &&
          !isSelectedRoomUnavailable &&
          !liveConflict
        )
      case 4:
        return true
      default:
        return false
    }
  }, [
    wizardStep,
    selectedGuestId,
    checkInDate,
    checkOutDate,
    selectedRoomId,
    isAvailabilityLoading,
    isCheckingConflict,
    isSelectedRoomUnavailable,
    liveConflict,
  ])

  const loadBookings = useCallback(async (filter: StatusFilter, nextPage = page) => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await bookingService.listPaginated({
        page: nextPage,
        limit,
        ...(filter === "ALL" ? {} : { status: filter }),
      })
      setBookings(response.data)
      setPaginationMeta(response.meta)
    } catch (error) {
      setErrorMessage(getBookingErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [limit, page])

  const loadOptions = useCallback(async () => {
    setIsOptionsLoading(true)
    setOptionsError(null)

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
  }, [])

  useEffect(() => {
    let ignore = false

    async function fetchBookings() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await bookingService.listPaginated({
          page,
          limit,
          ...(statusFilter === "ALL" ? {} : { status: statusFilter }),
        })

        if (!ignore) {
          setBookings(response.data)
          setPaginationMeta(response.meta)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(getBookingErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void fetchBookings()

    return () => {
      ignore = true
    }
  }, [limit, page, statusFilter])

  useEffect(() => {
    let ignore = false

    async function fetchOptions() {
      try {
        const [guestData, roomData] = await Promise.all([
          guestService.list(),
          roomService.list(),
        ])

        if (!ignore) {
          setGuests(guestData)
          setRooms(roomData)
        }
      } catch (error) {
        if (!ignore) {
          setOptionsError(getBookingErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setIsOptionsLoading(false)
        }
      }
    }

    void fetchOptions()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false

    if (!canCheckRoomAvailability) {
      return
    }

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
                getRoomAvailabilitySummary(
                  room.dates.map((date) => date.status)
                ),
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
        if (!ignore) {
          setIsAvailabilityLoading(false)
        }
      }
    }

    void fetchRoomAvailability()

    return () => {
      ignore = true
    }
  }, [canCheckRoomAvailability, checkInDate, checkOutDate, t])

  useEffect(() => {
    let ignore = false

    if (!canCheckRoomAvailability || !selectedRoomId) {
      setLiveConflict(null)
      return
    }

    async function checkConflict() {
      setIsCheckingConflict(true)

      try {
        const conflict = await bookingService.checkConflict({
          roomId: selectedRoomId,
          checkInDate,
          checkOutDate,
        })

        if (!ignore) {
          setLiveConflict(conflict)
          if (conflict) {
            setBookingConflict(null)
          }
        }
      } catch {
        if (!ignore) {
          setLiveConflict(null)
        }
      } finally {
        if (!ignore) {
          setIsCheckingConflict(false)
        }
      }
    }

    void checkConflict()

    return () => {
      ignore = true
    }
  }, [canCheckRoomAvailability, checkInDate, checkOutDate, selectedRoomId])

  function openCreateDialog() {
    const isMobile =
      typeof window !== "undefined" && window.innerWidth < 640
    setIsMobileWizard(isMobile)
    setWizardStep(1)
    setCoolingOption("AC")
    setGuestSearch("")
    setFormError(null)
    setBookingConflict(null)
    setLiveConflict(null)
    setAvailabilityError(null)
    setRoomAvailability({})
    reset(defaultFormValues)
    setIsCreateOpen(true)
  }

  function closeWizard() {
    setIsCreateOpen(false)
    setIsMobileWizard(false)
    setWizardStep(1)
    setCoolingOption("AC")
    setGuestSearch("")
    setFormError(null)
    setBookingConflict(null)
    reset(defaultFormValues)
  }

  async function openDetailDialog(booking: Booking) {
    setDetailBooking(booking)
    setDetailError(null)
    setInvoiceError(null)
    setIsDetailLoading(true)

    try {
      const data = await bookingService.get(booking.id)
      setDetailBooking(data)
    } catch (error) {
      setDetailError(getBookingErrorMessage(error))
    } finally {
      setIsDetailLoading(false)
    }
  }

  async function onSubmit(values: BookingForm) {
    setFormError(null)
    setBookingConflict(null)

    if (effectiveAvailabilityError) {
      setFormError(effectiveAvailabilityError)
      return
    }

    const selectedAvailability = effectiveRoomAvailability[values.roomId]

    if (selectedAvailability && selectedAvailability !== "AVAILABLE") {
      setFormError(
        t("selectedRoomUnavailable", {
          status: getRoomAvailabilityStatusLabel(selectedAvailability, t),
        })
      )
      return
    }

    try {
      const createdBooking = await bookingService.create({
        ...values,
        status: "CONFIRMED",
      })
      setBookings((currentBookings) =>
        statusFilter === "ALL" || statusFilter === createdBooking.status
          ? [createdBooking, ...currentBookings]
          : currentBookings
      )
      setIsCreateOpen(false)
      setIsMobileWizard(false)
      setWizardStep(1)
      setCoolingOption("AC")
      setGuestSearch("")
      reset(defaultFormValues)
      void loadOptions()
    } catch (error) {
      const conflict = getBookingConflict(error)

      if (conflict) {
        setBookingConflict(conflict)
        return
      }

      setFormError(getBookingErrorMessage(error))
    }
  }

  async function runBookingAction(
    booking: Booking,
    action: "checkIn" | "checkOut" | "cancel"
  ) {
    setActionError(null)
    setActingBookingId(booking.id)

    try {
      const updatedBooking = await bookingService[action](booking.id)
      setBookings((currentBookings) =>
        currentBookings
          .map((currentBooking) =>
            currentBooking.id === updatedBooking.id
              ? updatedBooking
              : currentBooking
          )
          .filter(
            (currentBooking) =>
              statusFilter === "ALL" || currentBooking.status === statusFilter
          )
      )
      setDetailBooking((currentBooking) =>
        currentBooking?.id === updatedBooking.id ? updatedBooking : currentBooking
      )
      void loadOptions()
    } catch (error) {
      setActionError(getBookingErrorMessage(error))
    } finally {
      setActingBookingId(null)
    }
  }

  async function downloadInvoice(bookingId: string) {
    setInvoiceError(null)
    setDownloadingInvoiceId(bookingId)

    try {
      const blob = await invoiceService.downloadBookingInvoice(bookingId)
      downloadInvoiceFile(bookingId, blob)
    } catch (error) {
      setInvoiceError(await getInvoiceErrorMessage(error))
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{t("bookingPageTitle")}</CardTitle>
            <CardDescription>
              {t("bookingPageDescription")}
            </CardDescription>
          </div>
          <CardAction className="flex flex-wrap justify-end gap-2">
            <Select
              items={filterOptions}
              value={statusFilter}
              onValueChange={(value) => {
                const nextStatus = value as StatusFilter
                setStatusFilter(nextStatus)
                setPage(1)
              }}
            >
              <SelectTrigger aria-label={t("filterBookingsByStatus")} size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {filterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button onClick={openCreateDialog}>
              <CalendarPlusIcon data-icon="inline-start" />
              {t("newBooking")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("couldNotLoadBookings")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
              <Button
                className="mt-3 w-fit"
                onClick={() => void loadBookings(statusFilter, page)}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCwIcon data-icon="inline-start" />
                {t("retry")}
              </Button>
            </Alert>
          ) : null}

          {actionError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("bookingActionFailed")}</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}

          {/* Mobile card list */}
          <div className="flex flex-col divide-y sm:hidden">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("loadingBookings")}
              </p>
            ) : bookings.length ? (
              bookings.map((booking) => (
                <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0" key={booking.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium leading-tight">{booking.guest.fullName}</span>
                      <span className="text-sm text-muted-foreground">
                        {t("roomLabel", { roomNumber: booking.room.roomNumber })}
                        {" · "}{getRoomTypeLabel(booking.room.type, t)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatDateRange(booking.checkInDate, booking.checkOutDate)}
                      </span>
                      <span className="font-medium">{formatCurrency(booking.totalPrice)}</span>
                    </div>
                    <BookingStatusBadge status={booking.status} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      aria-label={t("viewBookingAria", { bookingId: booking.id })}
                      onClick={() => void openDetailDialog(booking)}
                      size="icon-sm"
                      type="button"
                      variant="outline"
                    >
                      <EyeIcon />
                    </Button>
                    <BookingActions
                      actingBookingId={actingBookingId}
                      booking={booking}
                      onAction={runBookingAction}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {statusFilter === "ALL"
                  ? t("noBookingsFound")
                  : t("noBookingsByStatusFound", {
                      status: getBookingStatusLabel(statusFilter, t).toLowerCase(),
                    })}
              </p>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("booking")}</TableHead>
                  <TableHead>{t("guest")}</TableHead>
                  <TableHead>{t("room")}</TableHead>
                  <TableHead>{t("dates")}</TableHead>
                  <TableHead>{t("total")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableStateRow message={t("loadingBookings")} />
                ) : bookings.length ? (
                  bookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium">{booking.id}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(booking.createdAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{booking.guest.fullName}</TableCell>
                      <TableCell>
                        {t("roomLabel", { roomNumber: booking.room.roomNumber })}
                        <span className="block text-xs text-muted-foreground">
                          {getRoomTypeLabel(booking.room.type, t)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {formatDateRange(
                          booking.checkInDate,
                          booking.checkOutDate
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(booking.totalPrice)}</TableCell>
                      <TableCell>
                        <BookingStatusBadge status={booking.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            aria-label={t("viewBookingAria", {
                              bookingId: booking.id,
                            })}
                            onClick={() => void openDetailDialog(booking)}
                            size="icon-sm"
                            type="button"
                            variant="outline"
                          >
                            <EyeIcon />
                          </Button>
                          <BookingActions
                            actingBookingId={actingBookingId}
                            booking={booking}
                            onAction={runBookingAction}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableStateRow
                    message={
                      statusFilter === "ALL"
                        ? t("noBookingsFound")
                        : t("noBookingsByStatusFound", {
                            status: getBookingStatusLabel(statusFilter, t).toLowerCase(),
                          })
                    }
                  />
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination
            limit={paginationMeta.limit}
            page={paginationMeta.page}
            total={paginationMeta.total}
            totalPages={paginationMeta.totalPages}
            onLimitChange={(nextLimit) => {
              setLimit(nextLimit)
              setPage(1)
            }}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Mobile step-by-step booking wizard */}
      {isMobileWizard && isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
            <Button
              onClick={
                wizardStep === 1
                  ? closeWizard
                  : () => setWizardStep((s) => s - 1)
              }
              size="icon"
              type="button"
              variant="ghost"
            >
              {wizardStep === 1 ? (
                <XIcon className="size-5" />
              ) : (
                <ArrowLeftIcon className="size-5" />
              )}
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground">
                {t("wizardStepOf", { current: wizardStep, total: 5 })}
              </p>
              <h2 className="truncate font-semibold leading-tight">
                {
                  [
                    t("wizardSelectGuest"),
                    t("wizardSelectDates"),
                    t("wizardSelectRoom"),
                    t("wizardCoolingOption"),
                    t("wizardReviewConfirm"),
                  ][wizardStep - 1]
                }
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    step === wizardStep
                      ? "w-5 bg-primary"
                      : step < wizardStep
                        ? "w-1.5 bg-primary/40"
                        : "w-1.5 bg-muted-foreground/20"
                  )}
                  key={step}
                />
              ))}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-5">
            {/* Step 1 — Select Guest */}
            {wizardStep === 1 ? (
              <div className="flex flex-col gap-3">
                {optionsError ? (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>{t("couldNotLoadFormOptions")}</AlertTitle>
                    <AlertDescription>{optionsError}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    onChange={(e) => setGuestSearch(e.target.value)}
                    placeholder={t("searchGuests")}
                    value={guestSearch}
                  />
                </div>
                {isOptionsLoading ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {t("loadingGuests")}
                  </p>
                ) : filteredGuests.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {t("noGuestsMatchSearch")}
                  </p>
                ) : (
                  <div className="flex flex-col divide-y rounded-xl border">
                    {filteredGuests.map((guest) => (
                      <button
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl",
                          selectedGuestId === guest.id
                            ? "bg-primary/5"
                            : "hover:bg-muted/50"
                        )}
                        key={guest.id}
                        onClick={() => {
                          setValue("guestId", guest.id, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }}
                        type="button"
                      >
                        <div
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-full border bg-muted",
                            selectedGuestId === guest.id &&
                              "border-primary bg-primary/10 text-primary"
                          )}
                        >
                          <UserIcon className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {guest.fullName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {guest.phone}
                          </p>
                        </div>
                        {selectedGuestId === guest.id ? (
                          <CheckIcon className="size-5 shrink-0 text-primary" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Step 2 — Select Dates */}
            {wizardStep === 2 ? (
              <div className="flex flex-col gap-4">
                <Field data-invalid={Boolean(errors.checkInDate)}>
                  <FieldLabel htmlFor="mw-checkInDate">
                    {t("checkInDate")}
                  </FieldLabel>
                  <Input
                    aria-invalid={Boolean(errors.checkInDate)}
                    id="mw-checkInDate"
                    type="date"
                    {...register("checkInDate")}
                  />
                  <FieldError>{errors.checkInDate?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.checkOutDate)}>
                  <FieldLabel htmlFor="mw-checkOutDate">
                    {t("checkOutDate")}
                  </FieldLabel>
                  <Input
                    aria-invalid={Boolean(errors.checkOutDate)}
                    id="mw-checkOutDate"
                    type="date"
                    {...register("checkOutDate")}
                  />
                  <FieldError>{errors.checkOutDate?.message}</FieldError>
                </Field>
                {checkInDate &&
                checkOutDate &&
                calculateNights(checkInDate, checkOutDate) !== null ? (
                  <div className="rounded-xl border bg-muted/40 p-5 text-center">
                    <p className="text-sm text-muted-foreground">
                      {t("duration")}
                    </p>
                    <p className="mt-1 font-mono text-4xl font-bold">
                      {calculateNights(checkInDate, checkOutDate)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("nights")}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Step 3 — Select Room */}
            {wizardStep === 3 ? (
              <div className="flex flex-col gap-3">
                {!canCheckRoomAvailability ? (
                  <Alert>
                    <AlertCircleIcon />
                    <AlertDescription>
                      {t("selectDatesBeforeRoom")}
                    </AlertDescription>
                  </Alert>
                ) : null}
                {effectiveAvailabilityError ? (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>{t("roomAvailabilityCheckFailed")}</AlertTitle>
                    <AlertDescription>
                      {effectiveAvailabilityError}
                    </AlertDescription>
                  </Alert>
                ) : null}
                {bookingConflict || liveConflict ? (
                  <BookingConflictAlert
                    conflict={(bookingConflict || liveConflict)!}
                  />
                ) : null}
                {isAvailabilityLoading ? (
                  <p className="text-sm text-muted-foreground">
                    {t("checkingRoomAvailability")}
                  </p>
                ) : null}
                <div className="flex flex-col gap-2">
                  {rooms.map((room) => {
                    const roomStatus: RoomAvailabilityStatus | "UNKNOWN" =
                      effectiveRoomAvailability[room.id] ?? "UNKNOWN"
                    const isDisabled =
                      canCheckRoomAvailability &&
                      (roomStatus === "BOOKED" ||
                        roomStatus === "OCCUPIED" ||
                        roomStatus === "MAINTENANCE")
                    const isSelected = selectedRoomId === room.id
                    return (
                      <button
                        className={cn(
                          "flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border",
                          isDisabled
                            ? "cursor-not-allowed opacity-50"
                            : "hover:border-primary/50"
                        )}
                        disabled={isDisabled}
                        key={room.id}
                        onClick={() => {
                          setValue("roomId", room.id, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }}
                        type="button"
                      >
                        <div
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted",
                            isSelected &&
                              "border-primary bg-primary/10 text-primary"
                          )}
                        >
                          <BedDoubleIcon className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {t("roomLabel", {
                              roomNumber: room.roomNumber,
                            })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {getRoomTypeLabel(room.type, t)} ·{" "}
                            {formatCurrency(room.pricePerNight)}
                            {t("perNight")}
                          </p>
                        </div>
                        <RoomAvailabilityBadge status={roomStatus} />
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {/* Step 4 — Cooling Option (guest preference, UI-only) */}
            {wizardStep === 4 ? (
              <div className="flex flex-col gap-5">
                <p className="text-sm text-muted-foreground">
                  {t("coolingHint")}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    className={cn(
                      "flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-colors",
                      coolingOption === "FAN"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() => setCoolingOption("FAN")}
                    type="button"
                  >
                    <WindIcon className="size-10 text-blue-500" />
                    <div className="text-center">
                      <p className="font-medium">{t("coolingFan")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("coolingFanDesc")}
                      </p>
                    </div>
                  </button>
                  <button
                    className={cn(
                      "flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-colors",
                      coolingOption === "AC"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() => setCoolingOption("AC")}
                    type="button"
                  >
                    <AirVentIcon className="size-10 text-cyan-500" />
                    <div className="text-center">
                      <p className="font-medium">{t("coolingAC")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("coolingACDesc")}
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Step 5 — Review & Confirm */}
            {wizardStep === 5 ? (
              <div className="flex flex-col gap-4">
                {formError ? (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>{t("bookingCouldNotBeSaved")}</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                ) : null}
                {bookingConflict || liveConflict ? (
                  <BookingConflictAlert
                    conflict={(bookingConflict || liveConflict)!}
                  />
                ) : null}

                {/* Guest */}
                <div className="rounded-xl border p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("guest")}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted">
                      <UserIcon className="size-4" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {selectedGuest?.fullName ?? "—"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedGuest?.phone}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div className="rounded-xl border p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("dates")}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("checkIn")}
                      </p>
                      <p className="font-medium">
                        {checkInDate ? formatDate(checkInDate) : "—"}
                      </p>
                    </div>
                    <ArrowLeftIcon className="size-4 rotate-180 text-muted-foreground" />
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {t("checkOut")}
                      </p>
                      <p className="font-medium">
                        {checkOutDate ? formatDate(checkOutDate) : "—"}
                      </p>
                    </div>
                  </div>
                  {checkInDate &&
                  checkOutDate &&
                  calculateNights(checkInDate, checkOutDate) !== null ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("nightsAtRate", {
                        nights:
                          calculateNights(checkInDate, checkOutDate) ?? 0,
                        rate: selectedRoom
                          ? formatCurrency(selectedRoom.pricePerNight)
                          : "—",
                      })}
                    </p>
                  ) : null}
                </div>

                {/* Room + Cooling */}
                <div className="rounded-xl border p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("room")}
                  </p>
                  {selectedRoom ? (
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted">
                        <BedDoubleIcon className="size-4" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {t("roomLabel", {
                            roomNumber: selectedRoom.roomNumber,
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {getRoomTypeLabel(selectedRoom.type, t)} ·{" "}
                          {coolingOption === "FAN"
                            ? t("coolingFan")
                            : t("coolingAC")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">—</p>
                  )}
                </div>

                {/* Price summary */}
                <div className="rounded-xl border bg-muted/40 p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("estimatedTotal")}
                  </p>
                  {estimatedTotal !== null && selectedRoom ? (
                    <>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>
                          {formatCurrency(selectedRoom.pricePerNight)} ×{" "}
                          {calculateNights(checkInDate, checkOutDate) ?? 0}{" "}
                          {t("nights")}
                        </span>
                        <span className="font-mono">
                          {formatCurrency(estimatedTotal)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t pt-3">
                        <span className="font-semibold">{t("total")}</span>
                        <span className="font-mono text-xl font-bold">
                          {formatCurrency(estimatedTotal)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      {t("selectRoomAndDates")}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t bg-background px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
            {wizardStep < 5 ? (
              <Button
                className="w-full"
                disabled={!canGoToNextStep}
                onClick={() => setWizardStep((s) => s + 1)}
                type="button"
              >
                {t("wizardNext")}
              </Button>
            ) : (
              <Button
                className="w-full"
                disabled={
                  isSubmitting ||
                  isAvailabilityLoading ||
                  isCheckingConflict ||
                  Boolean(effectiveAvailabilityError) ||
                  isSelectedRoomUnavailable ||
                  Boolean(liveConflict) ||
                  Boolean(bookingConflict)
                }
                onClick={() => void handleSubmit(onSubmit)()}
                type="button"
              >
                {isSubmitting ? t("saving") : t("saveBooking")}
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <Dialog open={!isMobileWizard && isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("createBooking")}</DialogTitle>
            <DialogDescription>
              {t("createBookingDescription")}
            </DialogDescription>
          </DialogHeader>
          <form className="contents" onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              {optionsError ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>{t("couldNotLoadFormOptions")}</AlertTitle>
                  <AlertDescription>{optionsError}</AlertDescription>
                </Alert>
              ) : null}

              {formError ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>{t("bookingCouldNotBeSaved")}</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}

              {effectiveAvailabilityError ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>{t("roomAvailabilityCheckFailed")}</AlertTitle>
                  <AlertDescription>{effectiveAvailabilityError}</AlertDescription>
                </Alert>
              ) : null}

              {isSelectedRoomUnavailable && selectedRoomAvailability ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>{t("selectedRoomNotAvailable")}</AlertTitle>
                  <AlertDescription>
                    {t("selectedRoomUnavailable", {
                      status: getRoomAvailabilityStatusLabel(
                        selectedRoomAvailability,
                        t
                      ),
                    })}
                  </AlertDescription>
                </Alert>
              ) : null}

              {bookingConflict || liveConflict ? (
                <BookingConflictAlert conflict={(bookingConflict || liveConflict)!} />
              ) : null}

              <Field data-invalid={Boolean(errors.guestId)}>
                <FieldLabel htmlFor="guestId">{t("guest")}</FieldLabel>
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
                    id="guestId"
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

              <Field data-invalid={Boolean(errors.roomId)}>
                <FieldLabel htmlFor="roomId">{t("room")}</FieldLabel>
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
                    disabled={isOptionsLoading || !canCheckRoomAvailability}
                    id="roomId"
                  >
                    <SelectValue
                      placeholder={
                        canCheckRoomAvailability
                          ? t("selectRoom")
                          : t("selectDatesBeforeRoom")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {roomOptions.map((room) => (
                        <SelectItem
                          disabled={room.status !== "AVAILABLE"}
                          key={room.value}
                          value={room.value}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {room.label}
                          </span>
                          <RoomAvailabilityBadge status={room.status} />
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {isAvailabilityLoading
                    ? t("checkingRoomAvailability")
                    : t("availableRoomsSelectable")}
                </FieldDescription>
                <FieldError>{errors.roomId?.message}</FieldError>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.checkInDate)}>
                  <FieldLabel htmlFor="checkInDate">
                    {t("checkInDate")}
                  </FieldLabel>
                  <Input
                    aria-invalid={Boolean(errors.checkInDate)}
                    id="checkInDate"
                    type="date"
                    {...register("checkInDate")}
                  />
                  <FieldError>{errors.checkInDate?.message}</FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.checkOutDate)}>
                  <FieldLabel htmlFor="checkOutDate">
                    {t("checkOutDate")}
                  </FieldLabel>
                  <Input
                    aria-invalid={Boolean(errors.checkOutDate)}
                    id="checkOutDate"
                    type="date"
                    {...register("checkOutDate")}
                  />
                  <FieldError>{errors.checkOutDate?.message}</FieldError>
                </Field>
              </div>

              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="text-sm font-medium">{t("estimatedTotal")}</div>
                <div className="mt-1 font-mono text-xl font-semibold">
                  {estimatedTotal === null
                    ? t("selectRoomAndDates")
                    : formatCurrency(estimatedTotal)}
                </div>
                {selectedRoom && checkInDate && checkOutDate ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t("nightsAtRate", {
                      nights: calculateNights(checkInDate, checkOutDate) ?? 0,
                      rate: formatCurrency(selectedRoom.pricePerNight),
                    })}
                  </div>
                ) : null}
              </div>
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
                  isCheckingConflict ||
                  Boolean(effectiveAvailabilityError) ||
                  isSelectedRoomUnavailable ||
                  Boolean(liveConflict)
                }
                type="submit"
              >
                {isSubmitting ? t("saving") : t("saveBooking")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(detailBooking)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailBooking(null)
            setDetailError(null)
            setInvoiceError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("bookingDetail")}</DialogTitle>
            <DialogDescription>
              {t("bookingDetailDescription")}
            </DialogDescription>
          </DialogHeader>

          {detailError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("couldNotLoadBookingDetail")}</AlertTitle>
              <AlertDescription>{detailError}</AlertDescription>
            </Alert>
          ) : null}

          {invoiceError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("invoiceDownloadFailed")}</AlertTitle>
              <AlertDescription>{invoiceError}</AlertDescription>
            </Alert>
          ) : null}

          {detailBooking ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {detailBooking.id}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isDetailLoading ? t("refreshingDetail") : t("currentRecord")}
                  </div>
                </div>
                <BookingStatusBadge status={detailBooking.status} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem
                  label={t("guest")}
                  value={detailBooking.guest.fullName}
                />
                <DetailItem
                  label={t("phone")}
                  value={detailBooking.guest.phone}
                />
                <DetailItem
                  label={t("room")}
                  value={t("roomLabel", {
                    roomNumber: detailBooking.room.roomNumber,
                  })}
                />
                <DetailItem
                  label={t("roomType")}
                  value={getRoomTypeLabel(detailBooking.room.type, t)}
                />
                <DetailItem
                  label={t("checkIn")}
                  value={formatDate(detailBooking.checkInDate)}
                />
                <DetailItem
                  label={t("checkOut")}
                  value={formatDate(detailBooking.checkOutDate)}
                />
                <DetailItem
                  label={t("total")}
                  value={formatCurrency(detailBooking.totalPrice)}
                />
                <DetailItem
                  label={t("updated")}
                  value={formatDate(detailBooking.updatedAt)}
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  disabled={downloadingInvoiceId === detailBooking.id}
                  onClick={() => void downloadInvoice(detailBooking.id)}
                  type="button"
                  variant="outline"
                >
                  <FileDownIcon data-icon="inline-start" />
                  {downloadingInvoiceId === detailBooking.id
                    ? t("downloading")
                    : t("downloadInvoicePdf")}
                </Button>
                <BookingActions
                  actingBookingId={actingBookingId}
                  booking={detailBooking}
                  onAction={runBookingAction}
                />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function BookingConflictAlert({ conflict }: { conflict: BookingConflict }) {
  const t = useTranslations()

  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{t("bookingConflictTitle")}</AlertTitle>
      <AlertDescription>
        <div className="flex flex-col gap-3">
          <p>
            {t("bookingConflictMessage")}
          </p>
          <dl className="grid gap-2 rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm sm:grid-cols-2">
            <ConflictDetail
              label={t("roomNumber")}
              value={conflict.roomNumber}
            />
            <ConflictDetail
              label={t("status")}
              value={getBookingStatusLabel(conflict.status, t)}
            />
            <ConflictDetail
              label={t("conflictDates")}
              value={formatDateRange(conflict.checkInDate, conflict.checkOutDate)}
            />
            {conflict.guestName ? (
              <ConflictDetail label={t("guest")} value={conflict.guestName} />
            ) : null}
            <ConflictDetail
              label={t("existingBooking")}
              value={conflict.existingBookingId}
            />
            <ConflictDetail
              label={t("suggestedAction")}
              value={t("chooseAnotherRoomOrChangeDates")}
            />
          </dl>
        </div>
      </AlertDescription>
    </Alert>
  )
}

function ConflictDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-foreground">{value}</dd>
    </div>
  )
}

function RoomAvailabilityBadge({
  status,
}: {
  status: RoomAvailabilityStatus | "UNKNOWN"
}) {
  const t = useTranslations()
  const variant: ComponentProps<typeof Badge>["variant"] =
    status === "AVAILABLE"
      ? "default"
      : status === "MAINTENANCE"
        ? "destructive"
        : status === "UNKNOWN"
          ? "outline"
          : "secondary"

  return (
    <Badge className="ml-auto shrink-0" variant={variant}>
      {status === "UNKNOWN"
        ? t("checking")
        : getRoomAvailabilityStatusLabel(status, t)}
    </Badge>
  )
}

function BookingActions({
  actingBookingId,
  booking,
  onAction,
}: {
  actingBookingId: string | null
  booking: Booking
  onAction: (
    booking: Booking,
    action: "checkIn" | "checkOut" | "cancel"
  ) => Promise<void>
}) {
  const t = useTranslations()
  const isActing = actingBookingId === booking.id

  return (
    <>
      {booking.status === "CONFIRMED" ? (
        <Button
          disabled={isActing}
          onClick={() => void onAction(booking, "checkIn")}
          size="sm"
          type="button"
          variant="secondary"
        >
          <LogInIcon data-icon="inline-start" />
          {isActing ? t("working") : t("checkIn")}
        </Button>
      ) : null}
      {booking.status === "CHECKED_IN" ? (
        <Button
          disabled={isActing}
          onClick={() => void onAction(booking, "checkOut")}
          size="sm"
          type="button"
          variant="secondary"
        >
          <LogOutIcon data-icon="inline-start" />
          {isActing ? t("working") : t("checkOut")}
        </Button>
      ) : null}
      {booking.status === "PENDING" || booking.status === "CONFIRMED" ? (
        <Button
          disabled={isActing}
          onClick={() => void onAction(booking, "cancel")}
          size="sm"
          type="button"
          variant="destructive"
        >
          <CalendarXIcon data-icon="inline-start" />
          {isActing ? t("working") : t("cancelBooking")}
        </Button>
      ) : null}
    </>
  )
}

function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const t = useTranslations()
  const variant =
    status === "CONFIRMED"
      ? "default"
      : status === "CHECKED_IN"
        ? "secondary"
        : status === "CANCELLED"
          ? "destructive"
          : "outline"

  const Icon =
    status === "CHECKED_IN"
      ? DoorOpenIcon
      : status === "CHECKED_OUT"
        ? CalendarCheckIcon
        : status === "CANCELLED"
          ? CalendarXIcon
          : CalendarPlusIcon

  return (
    <Badge variant={variant}>
      <Icon data-icon="inline-start" />
      {getBookingStatusLabel(status, t)}
    </Badge>
  )
}

function getBookingStatusLabel(status: BookingStatus, t: TranslationFn) {
  const labels: Record<BookingStatus, string> = {
    PENDING: t("pending"),
    CONFIRMED: t("confirmed"),
    CHECKED_IN: t("checkedIn"),
    CHECKED_OUT: t("checkedOut"),
    CANCELLED: t("cancelled"),
  }

  return labels[status]
}

function getRoomTypeLabel(type: RoomType, t: TranslationFn) {
  const labels: Record<RoomType, string> = {
    SINGLE: t("single"),
    DOUBLE: t("double"),
    TWIN: t("twin"),
    FAMILY: t("family"),
    VIP: t("vip"),
  }

  return labels[type]
}

function getRoomAvailabilityStatusLabel(
  status: RoomAvailabilityStatus,
  t: TranslationFn
) {
  const labels: Record<RoomAvailabilityStatus, string> = {
    AVAILABLE: t("available"),
    BOOKED: t("booked"),
    OCCUPIED: t("occupied"),
    MAINTENANCE: t("maintenance"),
  }

  return labels[status]
}

function getRoomAvailabilitySummary(statuses: RoomAvailabilityStatus[]) {
  if (statuses.includes("MAINTENANCE")) {
    return "MAINTENANCE"
  }

  if (statuses.includes("OCCUPIED")) {
    return "OCCUPIED"
  }

  if (statuses.includes("BOOKED")) {
    return "BOOKED"
  }

  return "AVAILABLE"
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  )
}

function TableStateRow({ message }: { message: string }) {
  return (
    <TableRow>
      <TableCell
        className="h-28 text-center text-sm text-muted-foreground"
        colSpan={7}
      >
        {message}
      </TableCell>
    </TableRow>
  )
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}
