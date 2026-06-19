"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircleIcon,
  BrushIcon,
  CheckCheckIcon,
  CircleXIcon,
  ClipboardListIcon,
  PencilIcon,
  PlayCircleIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { ActionMenu, type ActionMenuEntry } from "@/components/app/action-menu"
import { MobileFilterDrawer } from "@/components/app/mobile-filter-drawer"
import { useAuth } from "@/components/app/auth-provider"
import { Pagination } from "@/components/Pagination"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { defaultPaginationMeta, type PaginatedResponse } from "@/lib/api"
import {
  getHousekeepingErrorMessage,
  housekeepingPriorities,
  housekeepingService,
  housekeepingStatuses,
  type CreateHousekeepingTaskPayload,
  type HousekeepingPriority,
  type HousekeepingStatus,
  type HousekeepingTask,
  type UpdateHousekeepingTaskPayload,
} from "@/lib/housekeeping"
import { roomService, type Room } from "@/lib/rooms"
import { userService, type UserRecord } from "@/lib/users"

type StatusFilter = "ALL" | HousekeepingStatus
type PriorityFilter = "ALL" | HousekeepingPriority
type TranslationFn = ReturnType<typeof useTranslations<"housekeeping">>

const TERMINAL_STATUSES: HousekeepingStatus[] = ["INSPECTED", "CANCELLED"]
const ACTIVE_STATUSES: HousekeepingStatus[] = [
  "NEEDS_CLEANING",
  "CLEANING_IN_PROGRESS",
  "CLEANED",
]

// ---------- Badge helpers ----------

function getStatusVariant(
  status: HousekeepingStatus,
): React.ComponentProps<typeof Badge>["variant"] {
  switch (status) {
    case "NEEDS_CLEANING":
      return "secondary"
    case "CLEANING_IN_PROGRESS":
      return "default"
    case "CLEANED":
      return "outline"
    case "INSPECTED":
      return "secondary"
    case "CANCELLED":
      return "outline"
  }
}

function getPriorityVariant(
  priority: HousekeepingPriority,
): React.ComponentProps<typeof Badge>["variant"] {
  switch (priority) {
    case "LOW":
      return "outline"
    case "MEDIUM":
      return "secondary"
    case "HIGH":
      return "secondary"
    case "URGENT":
      return "destructive"
  }
}

function getStatusLabel(status: HousekeepingStatus, t: TranslationFn) {
  const map: Record<HousekeepingStatus, string> = {
    NEEDS_CLEANING: t("statusNeedsCleaning"),
    CLEANING_IN_PROGRESS: t("statusCleaningInProgress"),
    CLEANED: t("statusCleaned"),
    INSPECTED: t("statusInspected"),
    CANCELLED: t("statusCancelled"),
  }
  return map[status]
}

function getPriorityLabel(priority: HousekeepingPriority, t: TranslationFn) {
  const map: Record<HousekeepingPriority, string> = {
    LOW: t("priorityLow"),
    MEDIUM: t("priorityMedium"),
    HIGH: t("priorityHigh"),
    URGENT: t("priorityUrgent"),
  }
  return map[priority]
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value))
}

function TableStateRow({ message }: { message: string }) {
  return (
    <TableRow>
      <TableCell
        className="h-28 text-center text-muted-foreground"
        colSpan={8}
      >
        {message}
      </TableCell>
    </TableRow>
  )
}

// ---------- Mobile task card ----------

function MobileTaskCard({
  task,
  actions,
  t,
}: {
  task: HousekeepingTask
  actions: Array<ActionMenuEntry | false | null | undefined>
  t: TranslationFn
}) {
  return (
    <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium leading-tight">
              {t("roomLabel", { roomNumber: task.room.roomNumber })}
            </span>
            <span className="text-xs text-muted-foreground">{task.room.type}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={getStatusVariant(task.status)}>
              {getStatusLabel(task.status, t)}
            </Badge>
            <Badge variant={getPriorityVariant(task.priority)}>
              {getPriorityLabel(task.priority, t)}
            </Badge>
          </div>
        </div>
        <ActionMenu items={actions} />
      </div>

      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        {task.assignedTo ? (
          <div className="flex items-center gap-1.5">
            <UserIcon className="size-3.5 shrink-0" />
            <span>{task.assignedTo.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <UserIcon className="size-3.5 shrink-0 opacity-40" />
            <span className="opacity-60">{t("unassigned")}</span>
          </div>
        )}
        {task.booking ? (
          <div className="flex items-center gap-1.5">
            <ClipboardListIcon className="size-3.5 shrink-0" />
            <span>{task.booking.guest.fullName}</span>
          </div>
        ) : null}
        {task.note ? (
          <p className="line-clamp-2 text-xs">{task.note}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{formatDate(task.createdAt)}</span>
        {task.startedAt ? (
          <>
            <Separator orientation="vertical" className="h-3" />
            <span>
              {t("startedAt")}: {formatDate(task.startedAt)}
            </span>
          </>
        ) : null}
        {task.completedAt ? (
          <>
            <Separator orientation="vertical" className="h-3" />
            <span>
              {t("completedAt")}: {formatDate(task.completedAt)}
            </span>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ---------- Main page ----------

export default function HousekeepingPage() {
  const t = useTranslations("housekeeping")
  const { user } = useAuth()
  const isAdmin = user?.role === "ADMIN"

  // List state
  const [tasks, setTasks] = useState<HousekeepingTask[]>([])
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<HousekeepingTask>["meta"]>(defaultPaginationMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL")
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reference data for dialogs
  const [rooms, setRooms] = useState<Room[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])

  // Create / Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<HousekeepingTask | null>(null)
  const [formRoomId, setFormRoomId] = useState("")
  const [formPriority, setFormPriority] = useState<HousekeepingPriority>("MEDIUM")
  const [formNote, setFormNote] = useState("")
  const [formAssignedToId, setFormAssignedToId] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Confirm dialogs
  const [cancelTarget, setCancelTarget] = useState<HousekeepingTask | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HousekeepingTask | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  // ---------- Data fetching ----------

  useEffect(() => {
    let ignore = false

    async function fetchTasks() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await housekeepingService.listPaginated({
          page,
          limit,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
          ...(priorityFilter !== "ALL" ? { priority: priorityFilter } : {}),
        })

        if (!ignore) {
          setTasks(response.data)
          setPaginationMeta(response.meta)
        }
      } catch (error) {
        if (!ignore) setErrorMessage(getHousekeepingErrorMessage(error))
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    void fetchTasks()
    return () => {
      ignore = true
    }
  }, [page, limit, debouncedSearch, statusFilter, priorityFilter])

  async function reloadTasks() {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const response = await housekeepingService.listPaginated({
        page,
        limit,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        ...(priorityFilter !== "ALL" ? { priority: priorityFilter } : {}),
      })
      setTasks(response.data)
      setPaginationMeta(response.meta)
    } catch (error) {
      setErrorMessage(getHousekeepingErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    roomService.list().then(setRooms).catch(() => {})
    userService.list().then(setUsers).catch(() => {})
  }, [])

  function handleSearchChange(value: string) {
    setSearch(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 400)
  }

  // ---------- Filter options ----------

  const statusOptions = useMemo(
    () => housekeepingStatuses.map((s) => ({ value: s, label: getStatusLabel(s, t) })),
    [t],
  )

  const priorityOptions = useMemo(
    () =>
      housekeepingPriorities.map((p) => ({ value: p, label: getPriorityLabel(p, t) })),
    [t],
  )

  const statusFilterOptions = useMemo(
    () => [{ value: "ALL" as const, label: t("allStatuses") }, ...statusOptions],
    [statusOptions, t],
  )

  const priorityFilterOptions = useMemo(
    () => [{ value: "ALL" as const, label: t("allPriorities") }, ...priorityOptions],
    [priorityOptions, t],
  )

  const activeFilterCount =
    (statusFilter !== "ALL" ? 1 : 0) + (priorityFilter !== "ALL" ? 1 : 0)

  // ---------- Create / Edit ----------

  function openCreateDialog() {
    setEditingTask(null)
    setFormRoomId("")
    setFormPriority("MEDIUM")
    setFormNote("")
    setFormAssignedToId("")
    setFormError(null)
    setIsDialogOpen(true)
  }

  function openEditDialog(task: HousekeepingTask) {
    setEditingTask(task)
    setFormPriority(task.priority)
    setFormNote(task.note ?? "")
    setFormAssignedToId(task.assignedToId ?? "")
    setFormError(null)
    setIsDialogOpen(true)
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setIsSubmitting(true)

    try {
      if (editingTask) {
        const payload: UpdateHousekeepingTaskPayload = {
          priority: formPriority,
          note: formNote.trim() || null,
          ...(isAdmin ? { assignedToId: formAssignedToId || null } : {}),
        }
        const updated = await housekeepingService.update(editingTask.id, payload)
        setTasks((prev) => prev.map((tk) => (tk.id === updated.id ? updated : tk)))
        toast.success(t("taskUpdated"))
      } else {
        if (!formRoomId) {
          setFormError(t("roomRequired"))
          setIsSubmitting(false)
          return
        }
        const payload: CreateHousekeepingTaskPayload = {
          roomId: formRoomId,
          priority: formPriority,
          ...(formNote.trim() ? { note: formNote.trim() } : {}),
          ...(isAdmin && formAssignedToId ? { assignedToId: formAssignedToId } : {}),
        }
        const created = await housekeepingService.create(payload)
        setTasks((prev) => [created, ...prev])
        toast.success(t("taskCreated"))
      }
      setIsDialogOpen(false)
    } catch (error) {
      setFormError(getHousekeepingErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---------- Status transitions ----------

  async function handleStart(task: HousekeepingTask) {
    try {
      const updated = await housekeepingService.start(task.id)
      setTasks((prev) => prev.map((tk) => (tk.id === updated.id ? updated : tk)))
      toast.success(t("taskStarted"))
    } catch (error) {
      toast.error(getHousekeepingErrorMessage(error))
    }
  }

  async function handleComplete(task: HousekeepingTask) {
    try {
      const updated = await housekeepingService.complete(task.id)
      setTasks((prev) => prev.map((tk) => (tk.id === updated.id ? updated : tk)))
      toast.success(t("taskCompleted"))
    } catch (error) {
      toast.error(getHousekeepingErrorMessage(error))
    }
  }

  async function handleInspect(task: HousekeepingTask) {
    try {
      const updated = await housekeepingService.inspect(task.id)
      setTasks((prev) => prev.map((tk) => (tk.id === updated.id ? updated : tk)))
      toast.success(t("taskInspected"))
    } catch (error) {
      toast.error(getHousekeepingErrorMessage(error))
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return
    setIsConfirming(true)
    try {
      const updated = await housekeepingService.cancel(cancelTarget.id)
      setTasks((prev) => prev.map((tk) => (tk.id === updated.id ? updated : tk)))
      toast.success(t("taskCancelled"))
      setCancelTarget(null)
    } catch (error) {
      toast.error(getHousekeepingErrorMessage(error))
    } finally {
      setIsConfirming(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setIsConfirming(true)
    try {
      await housekeepingService.remove(deleteTarget.id)
      setTasks((prev) => prev.filter((tk) => tk.id !== deleteTarget.id))
      toast.success(t("taskDeleted"))
      setDeleteTarget(null)
    } catch (error) {
      toast.error(getHousekeepingErrorMessage(error))
    } finally {
      setIsConfirming(false)
    }
  }

  // ---------- Action menu per task ----------

  function buildTaskActions(
    task: HousekeepingTask,
  ): Array<ActionMenuEntry | false | null | undefined> {
    const isTerminal = TERMINAL_STATUSES.includes(task.status)
    return [
      task.status === "NEEDS_CLEANING" && {
        label: t("start"),
        icon: <PlayCircleIcon />,
        onClick: () => void handleStart(task),
      },
      task.status === "CLEANING_IN_PROGRESS" && {
        label: t("complete"),
        icon: <CheckCheckIcon />,
        onClick: () => void handleComplete(task),
      },
      isAdmin &&
        task.status === "CLEANED" && {
          label: t("inspect"),
          icon: <ShieldCheckIcon />,
          onClick: () => void handleInspect(task),
        },
      !isTerminal && {
        label: t("edit"),
        icon: <PencilIcon />,
        onClick: () => openEditDialog(task),
      },
      isAdmin &&
        ACTIVE_STATUSES.includes(task.status) && {
          label: t("cancelTask"),
          icon: <CircleXIcon />,
          onClick: () => setCancelTarget(task),
          variant: "destructive" as const,
        },
      isAdmin && {
        label: t("deleteTask"),
        icon: <Trash2Icon />,
        onClick: () => setDeleteTarget(task),
        variant: "destructive" as const,
      },
    ]
  }

  // ---------- Render ----------

  const isEmpty = !isLoading && tasks.length === 0
  const hasFilters =
    debouncedSearch !== "" || statusFilter !== "ALL" || priorityFilter !== "ALL"

  return (
    <>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <CardAction className="flex flex-wrap justify-end gap-2">
            {/* Mobile: filter drawer */}
            <MobileFilterDrawer
              activeCount={activeFilterCount}
              onClear={() => {
                setStatusFilter("ALL")
                setPriorityFilter("ALL")
                setPage(1)
              }}
              triggerClassName="sm:hidden"
            >
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">
                  {t("filterByStatus")}
                </p>
                <Select
                  items={statusFilterOptions}
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v as StatusFilter)
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {statusFilterOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">
                  {t("filterByPriority")}
                </p>
                <Select
                  items={priorityFilterOptions}
                  value={priorityFilter}
                  onValueChange={(v) => {
                    setPriorityFilter(v as PriorityFilter)
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {priorityFilterOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </MobileFilterDrawer>

            {/* Desktop: inline filters */}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 w-44 pl-8 text-sm"
                  placeholder={t("searchPlaceholder")}
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              <Select
                items={statusFilterOptions}
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as StatusFilter)
                  setPage(1)
                }}
              >
                <SelectTrigger
                  aria-label={t("filterByStatus")}
                  size="sm"
                  className="w-40"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectGroup>
                    {statusFilterOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select
                items={priorityFilterOptions}
                value={priorityFilter}
                onValueChange={(v) => {
                  setPriorityFilter(v as PriorityFilter)
                  setPage(1)
                }}
              >
                <SelectTrigger
                  aria-label={t("filterByPriority")}
                  size="sm"
                  className="w-36"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectGroup>
                    {priorityFilterOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Mobile: search */}
            <div className="relative sm:hidden">
              <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 w-40 pl-8 text-sm"
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>

            <Button onClick={openCreateDialog} size="sm">
              <PlusIcon data-icon="inline-start" />
              {t("createTask")}
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("couldNotLoad")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
              <Button
                className="mt-3 w-fit"
                onClick={() => void reloadTasks()}
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
                {t("loading")}
              </p>
            ) : isEmpty ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <BrushIcon className="size-8 opacity-30" />
                <p className="text-sm">
                  {hasFilters ? t("noTasksFiltered") : t("noTasks")}
                </p>
              </div>
            ) : (
              tasks.map((task) => (
                <MobileTaskCard
                  key={task.id}
                  task={task}
                  actions={buildTaskActions(task)}
                  t={t}
                />
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("room")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("priority")}</TableHead>
                  <TableHead>{t("assignedTo")}</TableHead>
                  <TableHead>{t("booking")}</TableHead>
                  <TableHead>{t("createdAt")}</TableHead>
                  <TableHead>{t("startedAt")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableStateRow message={t("loading")} />
                ) : isEmpty ? (
                  <TableStateRow
                    message={hasFilters ? t("noTasksFiltered") : t("noTasks")}
                  />
                ) : (
                  tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium">
                            {t("roomLabel", { roomNumber: task.room.roomNumber })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {task.room.type}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(task.status)}>
                          {getStatusLabel(task.status, t)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPriorityVariant(task.priority)}>
                          {getPriorityLabel(task.priority, t)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.assignedTo ? (
                          <div className="flex min-w-0 flex-col">
                            <span className="text-sm font-medium">
                              {task.assignedTo.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {task.assignedTo.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {t("unassigned")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.booking ? (
                          <div className="flex min-w-0 flex-col">
                            <span className="text-sm font-medium">
                              {task.booking.guest.fullName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {task.booking.guest.phone}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(task.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(task.startedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ActionMenu items={buildTaskActions(task)} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={paginationMeta.page}
            limit={paginationMeta.limit}
            total={paginationMeta.total}
            totalPages={paginationMeta.totalPages}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => {
              setLimit(l)
              setPage(1)
            }}
          />
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? t("editTask") : t("createTask")}
            </DialogTitle>
            <DialogDescription>
              {editingTask ? t("editTaskDescription") : t("createTaskDescription")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleFormSubmit(e)}>
            <FieldGroup className="flex flex-col gap-4 py-2">
              {formError ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}

              {/* Room selector — create only */}
              {!editingTask && (
                <Field>
                  <FieldLabel htmlFor="task-room">{t("room")} *</FieldLabel>
                  <Select
                    items={rooms.map((r) => ({ value: r.id, label: r.roomNumber }))}
                    value={formRoomId}
                    onValueChange={(v) => setFormRoomId(v ?? "")}
                  >
                    <SelectTrigger id="task-room">
                      <SelectValue placeholder={t("selectRoom")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {rooms.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {t("roomLabel", { roomNumber: r.roomNumber })}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {r.type}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {/* Priority */}
              <Field>
                <FieldLabel htmlFor="task-priority">{t("priority")}</FieldLabel>
                <Select
                  items={priorityOptions.map((o) => ({ value: o.value, label: o.label }))}
                  value={formPriority}
                  onValueChange={(v) => setFormPriority(v as HousekeepingPriority)}
                >
                  <SelectTrigger id="task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {priorityOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              {/* Assignee — ADMIN only */}
              {isAdmin && (
                <Field>
                  <FieldLabel htmlFor="task-assignee">{t("assignTo")}</FieldLabel>
                  <Select
                    items={[
                      { value: "", label: t("noAssignee") },
                      ...users.map((u) => ({ value: u.id, label: u.name })),
                    ]}
                    value={formAssignedToId}
                    onValueChange={(v) => setFormAssignedToId(v ?? "")}
                  >
                    <SelectTrigger id="task-assignee">
                      <SelectValue placeholder={t("selectAssignee")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="">{t("noAssignee")}</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            <div className="flex min-w-0 flex-col">
                              <span>{u.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {u.email}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {/* Note */}
              <Field>
                <FieldLabel htmlFor="task-note">{t("note")}</FieldLabel>
                <Textarea
                  id="task-note"
                  placeholder={t("notePlaceholder")}
                  rows={3}
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                />
              </Field>
            </FieldGroup>

            <DialogFooter className="mt-4">
              <DialogClose
                render={
                  <Button disabled={isSubmitting} type="button" variant="outline" />
                }
              >
                {t("cancel")}
              </DialogClose>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <RefreshCwIcon className="animate-spin" data-icon="inline-start" />
                ) : null}
                {editingTask ? t("save") : t("createTask")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel task confirmation */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelTaskTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cancelTaskDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>{t("back")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isConfirming}
              onClick={() => void handleCancel()}
            >
              {t("cancelTaskConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete task confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTaskTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteTaskDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>{t("back")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isConfirming}
              onClick={() => void handleDelete()}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
