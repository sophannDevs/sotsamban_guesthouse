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
  AlertCircleIcon,
  CalendarCheckIcon,
  CalendarPlusIcon,
  CalendarXIcon,
  DoorOpenIcon,
  EyeIcon,
  FileDownIcon,
  LogInIcon,
  LogOutIcon,
  RefreshCwIcon,
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
    setFormError(null)
    setBookingConflict(null)
    setLiveConflict(null)
    setAvailabilityError(null)
    setRoomAvailability({})
    reset(defaultFormValues)
    setIsCreateOpen(true)
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
