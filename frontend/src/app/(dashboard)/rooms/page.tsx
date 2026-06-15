"use client"

import type { ChangeEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircleIcon,
  BedDoubleIcon,
  ImageIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  UploadIcon,
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
  getRoomErrorMessage,
  roomService,
  roomStatuses,
  roomTypes,
  type Room,
  type RoomPayload,
  type RoomStatus,
  type RoomType,
} from "@/lib/rooms"
import { defaultPaginationMeta, type PaginatedResponse } from "@/lib/api"

type StatusFilter = "ALL" | RoomStatus

type Option<T extends string> = {
  value: T
  label: string
}

type TranslationFn = ReturnType<typeof useTranslations>

const roomTypeOptions: Option<RoomType>[] = roomTypes.map((type) => ({
  value: type,
  label: formatEnumLabel(type),
}))

type RoomFormInput = Omit<RoomPayload, "pricePerNight"> & {
  pricePerNight: unknown
}
type RoomForm = RoomPayload

const defaultFormValues: RoomForm = {
  roomNumber: "",
  type: "SINGLE",
  pricePerNight: 0,
  status: "AVAILABLE",
}

const maxRoomImageSize = 5 * 1024 * 1024
const allowedRoomImageTypes = ["image/jpeg", "image/png", "image/webp"]

export default function RoomsPage() {
  const t = useTranslations()
  const [rooms, setRooms] = useState<Room[]>([])
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<Room>["meta"]>(defaultPaginationMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [isImageUploading, setIsImageUploading] = useState(false)
  const roomSchema = z.object({
    roomNumber: z.string().trim().min(1, t("roomNumberRequired")),
    type: z.enum(roomTypes, { message: t("selectRoomType") }),
    pricePerNight: z.coerce
      .number({ message: t("enterNightlyPrice") })
      .positive(t("priceMustBePositive")),
    status: z.enum(roomStatuses, { message: t("selectRoomStatus") }),
  }) satisfies z.ZodType<RoomPayload>
  const translatedRoomTypeOptions = useMemo(
    () =>
      roomTypeOptions.map((option) => ({
        ...option,
        label: getRoomTypeLabel(option.value, t),
      })),
    [t]
  )
  const statusOptions = useMemo(
    () =>
      roomStatuses.map((status) => ({
        value: status,
        label: getRoomStatusLabel(status, t),
      })),
    [t]
  )
  const filterOptions: Option<StatusFilter>[] = useMemo(
    () => [{ value: "ALL", label: t("allStatuses") }, ...statusOptions],
    [statusOptions, t]
  )

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<RoomFormInput, unknown, RoomForm>({
    resolver: zodResolver(roomSchema),
    defaultValues: defaultFormValues,
  })

  const typeValue = useWatch({ control, name: "type" })
  const statusValue = useWatch({ control, name: "status" })

  useEffect(() => {
    let ignore = false

    async function fetchRooms() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await roomService.listPaginated({
          page,
          limit,
          ...(statusFilter === "ALL" ? {} : { status: statusFilter }),
        })

        if (!ignore) {
          setRooms(response.data)
          setPaginationMeta(response.meta)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(getRoomErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void fetchRooms()

    return () => {
      ignore = true
    }
  }, [limit, page, statusFilter])

  async function loadRooms() {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await roomService.listPaginated({
        page,
        limit,
        ...(statusFilter === "ALL" ? {} : { status: statusFilter }),
      })
      setRooms(response.data)
      setPaginationMeta(response.meta)
    } catch (error) {
      setErrorMessage(getRoomErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  function openCreateDialog() {
    setEditingRoom(null)
    setFormError(null)
    clearImageSelection()
    reset(defaultFormValues)
    setIsDialogOpen(true)
  }

  function openEditDialog(room: Room) {
    setEditingRoom(room)
    setFormError(null)
    clearImageSelection()
    reset({
      roomNumber: room.roomNumber,
      type: room.type,
      pricePerNight: room.pricePerNight,
      status: room.status,
    })
    setIsDialogOpen(true)
  }

  async function onSubmit(values: RoomForm) {
    setFormError(null)
    setIsImageUploading(false)

    try {
      const payload: RoomPayload = {
        ...values,
        roomNumber: values.roomNumber.trim(),
      }

      let savedRoom: Room

      if (editingRoom) {
        const updatedRoom = await roomService.update(editingRoom.id, payload)
        savedRoom = updatedRoom
      } else {
        const createdRoom = await roomService.create(payload)
        savedRoom = createdRoom
      }

      if (imageFile) {
        setIsImageUploading(true)
        const upload = await roomService.uploadImage(savedRoom.id, imageFile)
        savedRoom = {
          ...savedRoom,
          imageUrl: upload.imageUrl,
        }
      }

      if (editingRoom) {
        setRooms((currentRooms) =>
          currentRooms.map((room) =>
            room.id === savedRoom.id ? savedRoom : room
          )
        )
      } else {
        setRooms((currentRooms) => [savedRoom, ...currentRooms])
      }

      setIsDialogOpen(false)
      setEditingRoom(null)
      clearImageSelection()
      reset(defaultFormValues)
    } catch (error) {
      setFormError(getRoomErrorMessage(error))
    } finally {
      setIsImageUploading(false)
    }
  }

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null

    if (!file) {
      clearImageSelection()
      return
    }

    if (!allowedRoomImageTypes.includes(file.type)) {
      setFormError(t("roomImageTypeError"))
      event.target.value = ""
      return
    }

    if (file.size > maxRoomImageSize) {
      setFormError(t("roomImageSizeError"))
      event.target.value = ""
      return
    }

    const previewUrl = URL.createObjectURL(file)

    setFormError(null)
    setImageFile(file)
    setImagePreviewUrl((currentUrl) => {
      if (currentUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(currentUrl)
      }

      return previewUrl
    })
  }

  function clearImageSelection() {
    setImageFile(null)
    setImagePreviewUrl((currentUrl) => {
      if (currentUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(currentUrl)
      }

      return null
    })
  }

  async function deleteRoom() {
    if (!roomToDelete) {
      return
    }

    setDeleteError(null)
    setDeletingId(roomToDelete.id)

    try {
      await roomService.remove(roomToDelete.id)
      setRooms((currentRooms) =>
        currentRooms.filter((room) => room.id !== roomToDelete.id)
      )
      setRoomToDelete(null)
    } catch (error) {
      setDeleteError(getRoomErrorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{t("roomPageTitle")}</CardTitle>
            <CardDescription>
              {t("roomPageDescription")}
            </CardDescription>
          </div>
          <CardAction className="flex flex-wrap justify-end gap-2">
            <Select
              items={filterOptions}
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as StatusFilter)
                setPage(1)
              }}
            >
              <SelectTrigger aria-label={t("filterRoomsByStatus")} size="sm">
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
              <PlusIcon data-icon="inline-start" />
              {t("addRoom")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("couldNotLoadRooms")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
              <Button
                className="mt-3 w-fit"
                onClick={() => void loadRooms()}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCwIcon data-icon="inline-start" />
                {t("retry")}
              </Button>
            </Alert>
          ) : null}

          {/* Mobile card list */}
          <div className="flex flex-col divide-y sm:hidden">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("loadingRooms")}
              </p>
            ) : rooms.length ? (
              rooms.map((room) => (
                <div
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  key={room.id}
                >
                  <RoomThumbnail room={room} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium leading-tight">
                        {t("roomLabel", { roomNumber: room.roomNumber })}
                      </span>
                      <RoomStatusBadge status={room.status} />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {getRoomTypeLabel(room.type, t)}{" "}
                      <span aria-hidden>·</span>{" "}
                      {formatCurrency(room.pricePerNight)}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      aria-label={t("editRoomAria", { roomNumber: room.roomNumber })}
                      onClick={() => openEditDialog(room)}
                      size="icon-sm"
                      type="button"
                      variant="outline"
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      aria-label={t("deleteRoomAria", { roomNumber: room.roomNumber })}
                      onClick={() => {
                        setDeleteError(null)
                        setRoomToDelete(room)
                      }}
                      size="icon-sm"
                      type="button"
                      variant="destructive"
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {statusFilter === "ALL"
                  ? t("noRoomsFound")
                  : t("noRoomsByStatusFound", {
                      status: getRoomStatusLabel(statusFilter, t).toLowerCase(),
                    })}
              </p>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("room")}</TableHead>
                  <TableHead>{t("roomType")}</TableHead>
                  <TableHead>{t("nightlyRate")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableStateRow message={t("loadingRooms")} />
                ) : rooms.length ? (
                  rooms.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <RoomThumbnail room={room} />
                          <div className="flex min-w-0 flex-col">
                            <span className="font-medium">
                              {t("roomLabel", { roomNumber: room.roomNumber })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {room.id}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoomTypeLabel(room.type, t)}</TableCell>
                      <TableCell>{formatCurrency(room.pricePerNight)}</TableCell>
                      <TableCell>
                        <RoomStatusBadge status={room.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            aria-label={t("editRoomAria", {
                              roomNumber: room.roomNumber,
                            })}
                            onClick={() => openEditDialog(room)}
                            size="icon-sm"
                            type="button"
                            variant="outline"
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            aria-label={t("deleteRoomAria", {
                              roomNumber: room.roomNumber,
                            })}
                            onClick={() => {
                              setDeleteError(null)
                              setRoomToDelete(room)
                            }}
                            size="icon-sm"
                            type="button"
                            variant="destructive"
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableStateRow
                    message={
                      statusFilter === "ALL"
                        ? t("noRoomsFound")
                        : t("noRoomsByStatusFound", {
                            status: getRoomStatusLabel(statusFilter, t).toLowerCase(),
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

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)

          if (!open) {
            clearImageSelection()
            setFormError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRoom ? t("editRoom") : t("createRoom")}
            </DialogTitle>
            <DialogDescription>
              {editingRoom
                ? t("updateRoomDescription")
                : t("createRoomDescription")}
            </DialogDescription>
          </DialogHeader>
          <form className="contents" onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              {formError ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>{t("roomCouldNotBeSaved")}</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}

              <Field>
                <FieldLabel htmlFor="roomImage">{t("roomImage")}</FieldLabel>
                <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row">
                  <RoomImagePreview
                    alt={
                      editingRoom
                        ? t("roomImageAlt", {
                            roomNumber: editingRoom.roomNumber,
                          })
                        : t("roomImagePreview")
                    }
                    imageUrl={
                      imagePreviewUrl ??
                      (editingRoom?.imageUrl
                        ? getImageUrl(editingRoom.imageUrl)
                        : null)
                    }
                  />
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                    <Input
                      accept="image/jpeg,image/png,image/webp"
                      id="roomImage"
                      onChange={onImageChange}
                      type="file"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("roomImageHelp")}
                    </p>
                    {imageFile ? (
                      <Button
                        className="w-fit"
                        onClick={clearImageSelection}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {t("clearImage")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Field>

              <Field data-invalid={Boolean(errors.roomNumber)}>
                <FieldLabel htmlFor="roomNumber">{t("roomNumber")}</FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.roomNumber)}
                  id="roomNumber"
                  placeholder="101"
                  {...register("roomNumber")}
                />
                <FieldError>{errors.roomNumber?.message}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.type)}>
                <FieldLabel htmlFor="roomType">{t("roomType")}</FieldLabel>
                <Select
                  items={translatedRoomTypeOptions}
                  value={typeValue}
                  onValueChange={(value) =>
                    setValue("type", value as RoomType, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger aria-invalid={Boolean(errors.type)} id="roomType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {translatedRoomTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError>{errors.type?.message}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.pricePerNight)}>
                <FieldLabel htmlFor="pricePerNight">
                  {t("pricePerNight")}
                </FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.pricePerNight)}
                  id="pricePerNight"
                  min="0"
                  placeholder="35"
                  step="0.01"
                  type="number"
                  {...register("pricePerNight")}
                />
                <FieldError>{errors.pricePerNight?.message}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.status)}>
                <FieldLabel htmlFor="roomStatus">{t("status")}</FieldLabel>
                <Select
                  items={statusOptions}
                  value={statusValue}
                  onValueChange={(value) =>
                    setValue("status", value as RoomStatus, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger
                    aria-invalid={Boolean(errors.status)}
                    id="roomStatus"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError>{errors.status?.message}</FieldError>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <Button disabled={isSubmitting || isImageUploading} type="submit">
                <UploadIcon data-icon="inline-start" />
                {isImageUploading
                  ? t("uploadingImage")
                  : isSubmitting
                    ? t("saving")
                    : t("saveRoom")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(roomToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setRoomToDelete(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteRoom")}</DialogTitle>
            <DialogDescription>
              {roomToDelete
                ? t("deleteRoomDescription", {
                    roomNumber: roomToDelete.roomNumber,
                  })
                : t("deleteRoomFallbackDescription")}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("roomCouldNotBeDeleted")}</AlertTitle>
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button
              disabled={Boolean(deletingId)}
              onClick={() => void deleteRoom()}
              type="button"
              variant="destructive"
            >
              <Trash2Icon data-icon="inline-start" />
              {deletingId ? t("deleting") : t("deleteRoom")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TableStateRow({ message }: { message: string }) {
  return (
    <TableRow>
      <TableCell
        className="h-28 text-center text-sm text-muted-foreground"
        colSpan={5}
      >
        {message}
      </TableCell>
    </TableRow>
  )
}

function RoomThumbnail({ room }: { room: Room }) {
  const t = useTranslations()
  const imageUrl = room.imageUrl ? getImageUrl(room.imageUrl) : null

  return (
    <div
      aria-label={
        imageUrl
          ? t("roomImageUploadedAlt", { roomNumber: room.roomNumber })
          : t("noRoomImageUploaded")
      }
      className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 bg-cover bg-center"
      role="img"
      style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
    >
      {imageUrl ? null : <BedDoubleIcon />}
    </div>
  )
}

function RoomImagePreview({
  alt,
  imageUrl,
}: {
  alt: string
  imageUrl: string | null
}) {
  const t = useTranslations()

  return (
    <div
      aria-label={imageUrl ? alt : t("noRoomImageSelected")}
      className="flex aspect-video min-h-32 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 bg-cover bg-center sm:w-44"
      role="img"
      style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
    >
      {imageUrl ? null : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImageIcon />
          <span className="text-xs">{t("noImage")}</span>
        </div>
      )}
    </div>
  )
}

function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const t = useTranslations()
  const variant =
    status === "AVAILABLE"
      ? "default"
      : status === "MAINTENANCE"
        ? "destructive"
        : status === "BOOKED"
          ? "secondary"
          : "outline"

  return <Badge variant={variant}>{getRoomStatusLabel(status, t)}</Badge>
}

function getRoomStatusLabel(status: RoomStatus, t: TranslationFn) {
  const labels: Record<RoomStatus, string> = {
    AVAILABLE: t("available"),
    BOOKED: t("booked"),
    OCCUPIED: t("occupied"),
    MAINTENANCE: t("maintenance"),
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

function getImageUrl(imageUrl: string) {
  if (imageUrl.startsWith("blob:") || imageUrl.startsWith("http")) {
    return imageUrl
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

  return `${baseUrl}${imageUrl}`
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}
