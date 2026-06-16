"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircleIcon,
  PencilIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserCogIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { useAuth } from "@/components/app/auth-provider"
import { useI18n } from "@/components/app/i18n-provider"
import { Pagination } from "@/components/Pagination"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  getUserErrorMessage,
  userRoles,
  userService,
  type UserPayload,
  type UserRecord,
  type UserRole,
} from "@/lib/users"
import { defaultPaginationMeta, type PaginatedResponse } from "@/lib/api"
import { ActionMenu } from "@/components/app/action-menu"

type Option<T extends string> = {
  value: T
  label: string
}

type UserFormInput = UserPayload
type UserForm = UserPayload

const defaultFormValues: UserForm = {
  name: "",
  email: "",
  role: "RECEPTIONIST",
}

export default function UsersPage() {
  const t = useTranslations("usersPage")
  const { locale } = useI18n()
  const { isLoading: isAuthLoading, refreshUser, user } = useAuth()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<UserRecord>["meta"]>(defaultPaginationMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [userToDelete, setUserToDelete] = useState<UserRecord | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const userSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("nameRequired")),
        email: z
          .string()
          .trim()
          .min(1, t("emailRequired"))
          .email(t("invalidEmailAddress")),
        role: z.enum(userRoles, { message: t("roleRequired") }),
      }) satisfies z.ZodType<UserPayload>,
    [t]
  )
  const roleOptions: Option<UserRole>[] = useMemo(
    () =>
      userRoles.map((role) => ({
        value: role,
        label: getRoleLabel(role, t),
      })),
    [t]
  )

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<UserFormInput, unknown, UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: defaultFormValues,
  })

  const roleValue = useWatch({ control, name: "role" })
  const canManageUsers = user?.role === "ADMIN"

  const tableCaption = useMemo(() => {
    if (isLoading) {
      return t("loadingStaffAccess")
    }

    return t("tableCaption", { count: users.length })
  }, [isLoading, t, users.length])

  useEffect(() => {
    if (isAuthLoading) {
      return
    }

    if (!canManageUsers) {
      return
    }

    let ignore = false

    async function fetchUsers() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await userService.listPaginated({
          page,
          limit,
        })

        if (!ignore) {
          setUsers(response.data)
          setPaginationMeta(response.meta)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(getUserErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void fetchUsers()

    return () => {
      ignore = true
    }
  }, [canManageUsers, isAuthLoading, limit, page])

  async function loadUsers(nextPage = page) {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await userService.listPaginated({
        page: nextPage,
        limit,
      })
      setUsers(response.data)
      setPaginationMeta(response.meta)
    } catch (error) {
      setErrorMessage(getUserErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  function openEditDialog(selectedUser: UserRecord) {
    setEditingUser(selectedUser)
    setFormError(null)
    reset({
      name: selectedUser.name,
      email: selectedUser.email,
      role: selectedUser.role,
    })
    setIsDialogOpen(true)
  }

  async function onSubmit(values: UserForm) {
    if (!editingUser) {
      return
    }

    setFormError(null)

    try {
      const updatedUser = await userService.update(editingUser.id, {
        name: values.name.trim(),
        email: values.email.trim(),
        role: values.role,
      })

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === updatedUser.id ? updatedUser : currentUser
        )
      )

      if (updatedUser.id === user?.id) {
        void refreshUser()
      }

      setIsDialogOpen(false)
      setEditingUser(null)
      reset(defaultFormValues)
    } catch (error) {
      setFormError(getUserErrorMessage(error))
    }
  }

  async function deleteUser() {
    if (!userToDelete) {
      return
    }

    setDeleteError(null)
    setDeletingId(userToDelete.id)

    try {
      await userService.remove(userToDelete.id)
      setUsers((currentUsers) =>
        currentUsers.filter((currentUser) => currentUser.id !== userToDelete.id)
      )
      setUserToDelete(null)
    } catch (error) {
      setDeleteError(getUserErrorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  if (isAuthLoading || !user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("checkingStaffPermissions")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableStateRow colSpan={7} message={t("checkingPermissions")} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    )
  }

  if (!canManageUsers) {
    return <ForbiddenUsersPage />
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{t("userManagement")}</CardTitle>
            <CardDescription>{t("manageSystemUsers")}</CardDescription>
          </div>
          <CardAction>
            <Button
              disabled={isLoading}
              onClick={() => void loadUsers(page)}
              type="button"
              variant="outline"
            >
              <RefreshCwIcon data-icon="inline-start" />
              {t("refresh")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("failedToLoadUsers")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
              <Button
                className="mt-3 w-fit"
                onClick={() => void loadUsers(page)}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCwIcon data-icon="inline-start" />
                {t("retry")}
              </Button>
            </Alert>
          ) : null}

          <div className="text-sm text-muted-foreground">{tableCaption}</div>

          {/* Mobile card list */}
          <div className="flex flex-col divide-y sm:hidden">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("loadingUsers")}
              </p>
            ) : users.length ? (
              users.map((staffUser) => {
                const isCurrentUser = staffUser.id === user.id
                return (
                  <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" key={staffUser.id}>
                    <Avatar size="sm">
                      <AvatarFallback>{getInitials(staffUser.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium leading-tight">{staffUser.name}</span>
                        {isCurrentUser ? (
                          <Badge className="shrink-0" variant="outline">{t("currentUser")}</Badge>
                        ) : null}
                      </div>
                      <span className="truncate text-sm text-muted-foreground">{staffUser.email}</span>
                      <div className="flex items-center gap-2">
                        <RoleBadge role={staffUser.role} t={t} />
                        <span className="text-xs text-muted-foreground">{formatDate(staffUser.createdAt, locale)}</span>
                      </div>
                    </div>
                    <ActionMenu
                      items={[
                        { label: t("editUser"), icon: <PencilIcon />, onClick: () => openEditDialog(staffUser) },
                        !isCurrentUser && { label: t("deleteUser"), icon: <Trash2Icon />, onClick: () => { setDeleteError(null); setUserToDelete(staffUser) }, variant: "destructive" as const },
                      ]}
                    />
                  </div>
                )
              })
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("noUsersFound")}
              </p>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("id")}</TableHead>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("createdAt")}</TableHead>
                  <TableHead>{t("updatedAt")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableStateRow colSpan={7} message={t("loadingUsers")} />
                ) : users.length ? (
                  users.map((staffUser) => {
                    const isCurrentUser = staffUser.id === user.id

                    return (
                      <TableRow key={staffUser.id}>
                        <TableCell>
                          <span className="max-w-40 truncate text-xs text-muted-foreground">
                            {staffUser.id}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar size="sm">
                              <AvatarFallback>
                                {getInitials(staffUser.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-col">
                              <span className="font-medium">
                                {staffUser.name}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{staffUser.email}</TableCell>
                        <TableCell>
                          <RoleBadge role={staffUser.role} t={t} />
                        </TableCell>
                        <TableCell>{formatDate(staffUser.createdAt, locale)}</TableCell>
                        <TableCell>{formatDate(staffUser.updatedAt, locale)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              onClick={() => openEditDialog(staffUser)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <PencilIcon data-icon="inline-start" />
                              {t("editUser")}
                            </Button>
                            {isCurrentUser ? (
                              <Badge variant="outline">{t("currentUser")}</Badge>
                            ) : (
                              <Button
                                onClick={() => {
                                  setDeleteError(null)
                                  setUserToDelete(staffUser)
                                }}
                                size="sm"
                                type="button"
                                variant="destructive"
                              >
                                <Trash2Icon data-icon="inline-start" />
                                {t("deleteUser")}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableStateRow colSpan={7} message={t("noUsersFound")} />
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
            setEditingUser(null)
            setFormError(null)
            reset(defaultFormValues)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{t("editUser")}</DialogTitle>
              <DialogDescription>{t("editUserDescription")}</DialogDescription>
            </DialogHeader>

            {formError ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>{t("failedToUpdateUser")}</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <FieldGroup>
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.name)}
                  autoComplete="name"
                  id="name"
                  {...register("name")}
                />
                <FieldError errors={[errors.name]} />
              </Field>

              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.email)}
                  autoComplete="email"
                  id="email"
                  type="email"
                  {...register("email")}
                />
                <FieldError errors={[errors.email]} />
              </Field>

              <Field data-invalid={Boolean(errors.role)}>
                <FieldLabel htmlFor="role">{t("role")}</FieldLabel>
                <Select
                  items={roleOptions}
                  value={roleValue}
                  onValueChange={(value) =>
                    setValue("role", value as UserRole, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger aria-invalid={Boolean(errors.role)} id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {roleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError errors={[errors.role]} />
              </Field>
            </FieldGroup>

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <Button disabled={isSubmitting} type="submit">
                <ShieldCheckIcon data-icon="inline-start" />
                {isSubmitting ? t("saving") : t("saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(userToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setUserToDelete(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteUser")}</DialogTitle>
            <DialogDescription>
              {t("deleteUserDescription", {
                name: userToDelete?.name ?? t("selectedUser"),
              })}
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("failedToDeleteUser")}</AlertTitle>
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button
              disabled={Boolean(deletingId)}
              onClick={() => void deleteUser()}
              type="button"
              variant="destructive"
            >
              <Trash2Icon data-icon="inline-start" />
              {deletingId ? t("deleting") : t("deleteUser")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ForbiddenUsersPage() {
  const t = useTranslations("usersPage")

  return (
    <Card>
      <CardHeader>
        <div className="flex size-11 items-center justify-center rounded-lg border bg-muted/40">
          <UserCogIcon />
        </div>
        <CardTitle>{t("adminAccessRequired")}</CardTitle>
        <CardDescription>{t("restrictedToAdmins")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert>
          <ShieldCheckIcon />
          <AlertTitle>{t("forbidden")}</AlertTitle>
          <AlertDescription>{t("forbiddenDescription")}</AlertDescription>
        </Alert>
        <Button className="w-fit" render={<Link href="/dashboard" />}>
          {t("backToDashboard")}
        </Button>
      </CardContent>
    </Card>
  )
}

function RoleBadge({
  role,
  t,
}: {
  role: UserRole
  t: ReturnType<typeof useTranslations<"usersPage">>
}) {
  return (
    <Badge variant={role === "ADMIN" ? "default" : "secondary"}>
      {getRoleLabel(role, t)}
    </Badge>
  )
}

function TableStateRow({
  colSpan,
  message,
}: {
  colSpan: number
  message: string
}) {
  return (
    <TableRow>
      <TableCell
        className="h-28 text-center text-sm text-muted-foreground"
        colSpan={colSpan}
      >
        {message}
      </TableCell>
    </TableRow>
  )
}

function getRoleLabel(
  role: UserRole,
  t: ReturnType<typeof useTranslations<"usersPage">>
) {
  return role === "ADMIN" ? t("admin") : t("receptionist")
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}
