"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircleIcon,
  MailIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Pagination } from "@/components/Pagination"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getGuestErrorMessage,
  guestService,
  type Guest,
  type GuestPayload,
} from "@/lib/guests"
import { defaultPaginationMeta, type PaginatedResponse } from "@/lib/api"

type GuestFormInput = GuestPayload
type GuestForm = GuestPayload

const defaultFormValues: GuestFormInput = {
  fullName: "",
  phone: "",
  email: "",
  idCardNumber: "",
  address: "",
}

export default function GuestsPage() {
  const t = useTranslations()
  const [guests, setGuests] = useState<Guest[]>([])
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<Guest>["meta"]>(defaultPaginationMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeSearch, setActiveSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [guestToDelete, setGuestToDelete] = useState<Guest | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const optionalText = z
    .string()
    .trim()
    .transform((value) => (value ? value : undefined))
    .optional()
  const optionalEmail = z
    .union([z.string().trim().email(t("emailValidation")), z.literal("")])
    .transform((value) => (value ? value : undefined))
    .optional()
  const guestSchema = z.object({
    fullName: z.string().trim().min(1, t("fullNameRequired")),
    phone: z.string().trim().min(1, t("phoneRequired")),
    email: optionalEmail,
    idCardNumber: optionalText,
    address: optionalText,
  }) satisfies z.ZodType<GuestPayload>

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<GuestFormInput, unknown, GuestForm>({
    resolver: zodResolver(guestSchema),
    defaultValues: defaultFormValues,
  })

  const searchCaption = useMemo(() => {
    if (isLoading) {
      return t("loadingGuestRecords")
    }

    if (!activeSearch) {
      return t("guestDirectoryCount", { count: guests.length })
    }

    return t("guestSearchResults", {
      count: guests.length,
      search: activeSearch,
    })
  }, [activeSearch, guests.length, isLoading, t])

  const loadGuests = useCallback(async (search: string, nextPage: number) => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await guestService.listPaginated({
        page: nextPage,
        limit,
        search,
      })
      setGuests(response.data)
      setPaginationMeta(response.meta)
    } catch (error) {
      setErrorMessage(getGuestErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [limit])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextSearch = searchTerm.trim()
      setActiveSearch(nextSearch)
      setPage(1)
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [loadGuests, searchTerm])

  useEffect(() => {
    let ignore = false

    async function fetchGuests() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await guestService.listPaginated({
          page,
          limit,
          search: activeSearch,
        })

        if (!ignore) {
          setGuests(response.data)
          setPaginationMeta(response.meta)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(getGuestErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void fetchGuests()

    return () => {
      ignore = true
    }
  }, [activeSearch, limit, page])

  function openCreateDialog() {
    setEditingGuest(null)
    setFormError(null)
    reset(defaultFormValues)
    setIsDialogOpen(true)
  }

  function openEditDialog(guest: Guest) {
    setEditingGuest(guest)
    setFormError(null)
    reset({
      fullName: guest.fullName,
      phone: guest.phone,
      email: guest.email ?? "",
      idCardNumber: guest.idCardNumber ?? "",
      address: guest.address ?? "",
    })
    setIsDialogOpen(true)
  }

  async function onSubmit(values: GuestForm) {
    setFormError(null)

    try {
      const payload = normalizeGuestPayload(values)

      if (editingGuest) {
        const updatedGuest = await guestService.update(editingGuest.id, payload)
        setGuests((currentGuests) =>
          currentGuests.map((guest) =>
            guest.id === updatedGuest.id ? updatedGuest : guest
          )
        )
      } else {
        const createdGuest = await guestService.create(payload)
        setGuests((currentGuests) => [createdGuest, ...currentGuests])
      }

      setIsDialogOpen(false)
      setEditingGuest(null)
      reset(defaultFormValues)
    } catch (error) {
      setFormError(getGuestErrorMessage(error))
    }
  }

  async function deleteGuest() {
    if (!guestToDelete) {
      return
    }

    setDeleteError(null)
    setDeletingId(guestToDelete.id)

    try {
      await guestService.remove(guestToDelete.id)
      setGuests((currentGuests) =>
        currentGuests.filter((guest) => guest.id !== guestToDelete.id)
      )
      setGuestToDelete(null)
    } catch (error) {
      setDeleteError(getGuestErrorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{t("guestPageTitle")}</CardTitle>
            <CardDescription>
              {t("guestPageDescription")}
            </CardDescription>
          </div>
          <CardAction>
            <Button onClick={openCreateDialog}>
              <PlusIcon data-icon="inline-start" />
              {t("addGuest")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="guestSearch">{t("searchGuests")}</FieldLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                autoComplete="off"
                id="guestSearch"
                placeholder={t("searchGuestsPlaceholder")}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <Button
                disabled={isLoading}
                onClick={() => {
                  const nextSearch = searchTerm.trim()
                  setActiveSearch(nextSearch)
                  setPage(1)
                }}
                type="button"
                variant="outline"
              >
                <SearchIcon data-icon="inline-start" />
                {t("search")}
              </Button>
            </div>
          </Field>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("couldNotLoadGuests")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
              <Button
                className="mt-3 w-fit"
                onClick={() => void loadGuests(activeSearch, page)}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCwIcon data-icon="inline-start" />
                {t("retry")}
              </Button>
            </Alert>
          ) : null}

          <div className="text-sm text-muted-foreground">{searchCaption}</div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("guest")}</TableHead>
                <TableHead>{t("phone")}</TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("idCard")}</TableHead>
                <TableHead>{t("address")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableStateRow message={t("loadingGuests")} />
              ) : guests.length ? (
                guests.map((guest) => (
                  <TableRow key={guest.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 items-center justify-center rounded-lg border bg-muted/40">
                          <UserPlusIcon />
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium">{guest.fullName}</span>
                          <span className="max-w-36 truncate text-xs text-muted-foreground">
                            {guest.id}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ContactValue icon="phone" value={guest.phone} />
                    </TableCell>
                    <TableCell>
                      {guest.email ? (
                        <ContactValue icon="email" value={guest.email} />
                      ) : (
                        t("notProvided")
                      )}
                    </TableCell>
                    <TableCell>
                      {guest.idCardNumber ?? t("notProvided")}
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-44 truncate">
                        {guest.address ?? t("notProvided")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          aria-label={t("editGuestAria", {
                            name: guest.fullName,
                          })}
                          onClick={() => openEditDialog(guest)}
                          size="icon-sm"
                          type="button"
                          variant="outline"
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          aria-label={t("deleteGuestAria", {
                            name: guest.fullName,
                          })}
                          onClick={() => {
                            setDeleteError(null)
                            setGuestToDelete(guest)
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
                    activeSearch
                      ? t("noGuestsMatchSearch")
                      : t("noGuestsFound")
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingGuest ? t("editGuest") : t("createGuest")}
            </DialogTitle>
            <DialogDescription>
              {editingGuest
                ? t("updateGuestDescription")
                : t("createGuestDescription")}
            </DialogDescription>
          </DialogHeader>
          <form className="contents" onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              {formError ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>{t("guestCouldNotBeSaved")}</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}

              <Field data-invalid={Boolean(errors.fullName)}>
                <FieldLabel htmlFor="fullName">{t("fullName")}</FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.fullName)}
                  autoComplete="name"
                  id="fullName"
                  placeholder="Sok Dara"
                  {...register("fullName")}
                />
                <FieldError>{errors.fullName?.message}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.phone)}>
                <FieldLabel htmlFor="phone">{t("phone")}</FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.phone)}
                  autoComplete="tel"
                  id="phone"
                  placeholder="+855 12 345 678"
                  type="tel"
                  {...register("phone")}
                />
                <FieldError>{errors.phone?.message}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.email)}
                  autoComplete="email"
                  id="email"
                  placeholder="guest@example.com"
                  type="email"
                  {...register("email")}
                />
                <FieldError>{errors.email?.message}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.idCardNumber)}>
                <FieldLabel htmlFor="idCardNumber">
                  {t("idCardNumber")}
                </FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.idCardNumber)}
                  id="idCardNumber"
                  placeholder="A123456789"
                  {...register("idCardNumber")}
                />
                <FieldError>{errors.idCardNumber?.message}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.address)}>
                <FieldLabel htmlFor="address">{t("address")}</FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.address)}
                  autoComplete="street-address"
                  id="address"
                  placeholder="Phnom Penh"
                  {...register("address")}
                />
                <FieldError>{errors.address?.message}</FieldError>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? t("saving") : t("saveGuest")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(guestToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setGuestToDelete(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteGuest")}</DialogTitle>
            <DialogDescription>
              {guestToDelete
                ? t("deleteGuestDescription", { name: guestToDelete.fullName })
                : t("deleteGuestFallbackDescription")}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("guestCouldNotBeDeleted")}</AlertTitle>
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button
              disabled={Boolean(deletingId)}
              onClick={() => void deleteGuest()}
              type="button"
              variant="destructive"
            >
              <Trash2Icon data-icon="inline-start" />
              {deletingId ? t("deleting") : t("deleteGuest")}
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
        colSpan={6}
      >
        {message}
      </TableCell>
    </TableRow>
  )
}

function ContactValue({
  icon,
  value,
}: {
  icon: "email" | "phone"
  value: string
}) {
  const Icon = icon === "email" ? MailIcon : PhoneIcon

  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon />
      {value}
    </span>
  )
}

function normalizeGuestPayload(values: GuestForm): GuestPayload {
  return {
    fullName: values.fullName.trim(),
    phone: values.phone.trim(),
    ...(values.email ? { email: values.email } : {}),
    ...(values.idCardNumber ? { idCardNumber: values.idCardNumber } : {}),
    ...(values.address ? { address: values.address } : {}),
  }
}
