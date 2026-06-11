"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  BellIcon,
  CheckIcon,
  CheckCheckIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import {
  formatNotificationTime,
  getNotificationBadgeVariant,
} from "@/components/app/notification-utils"
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
import { Separator } from "@/components/ui/separator"
import {
  getNotificationErrorMessage,
  notificationService,
  type Notification,
} from "@/lib/notifications"
import { defaultPaginationMeta, type PaginatedResponse } from "@/lib/api"
import { cn } from "@/lib/utils"

export default function NotificationsPage() {
  const t = useTranslations("notificationsPage")
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<Notification>["meta"]>(defaultPaginationMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [isMarkingAll, setIsMarkingAll] = useState(false)

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  )

  useEffect(() => {
    let ignore = false

    async function fetchNotifications() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await notificationService.listPaginated({
          page,
          limit,
        })

        if (!ignore) {
          setNotifications(response.data)
          setPaginationMeta(response.meta)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(getNotificationErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void fetchNotifications()

    return () => {
      ignore = true
    }
  }, [limit, page])

  async function loadNotifications(nextPage = page) {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await notificationService.listPaginated({
        page: nextPage,
        limit,
      })
      setNotifications(response.data)
      setPaginationMeta(response.meta)
    } catch (error) {
      setErrorMessage(getNotificationErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function markAsRead(notification: Notification) {
    if (notification.isRead) {
      return
    }

    setActingId(notification.id)
    setActionError(null)

    try {
      const updatedNotification = await notificationService.markAsRead(
        notification.id
      )
      setNotifications((currentNotifications) =>
        currentNotifications.map((currentNotification) =>
          currentNotification.id === updatedNotification.id
            ? { ...currentNotification, isRead: true }
            : currentNotification
        )
      )
    } catch (error) {
      setActionError(getNotificationErrorMessage(error))
    } finally {
      setActingId(null)
    }
  }

  async function markAllAsRead() {
    setIsMarkingAll(true)
    setActionError(null)

    try {
      const data = await notificationService.markAllAsRead()
      setNotifications(data)
    } catch (error) {
      setActionError(getNotificationErrorMessage(error))
    } finally {
      setIsMarkingAll(false)
    }
  }

  async function deleteNotification(notification: Notification) {
    setActingId(notification.id)
    setActionError(null)

    try {
      await notificationService.remove(notification.id)
      setNotifications((currentNotifications) =>
        currentNotifications.filter(
          (currentNotification) => currentNotification.id !== notification.id
        )
      )
    } catch (error) {
      setActionError(getNotificationErrorMessage(error))
    } finally {
      setActingId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        <CardAction className="flex flex-wrap justify-end gap-2">
          <Button
            disabled={isLoading}
            onClick={() => void loadNotifications(page)}
            type="button"
            variant="outline"
          >
            <RefreshCwIcon data-icon="inline-start" />
            {t("refresh")}
          </Button>
          <Button
            disabled={!unreadCount || isMarkingAll}
            onClick={() => void markAllAsRead()}
            type="button"
          >
            <CheckCheckIcon data-icon="inline-start" />
            {isMarkingAll ? t("markingRead") : t("markAllAsRead")}
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
              onClick={() => void loadNotifications(page)}
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
            <AlertTitle>{t("actionFailed")}</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="rounded-lg border">
          {isLoading ? (
            <NotificationState message={t("loading")} />
          ) : notifications.length ? (
            notifications.map((notification, index) => (
              <div key={notification.id}>
                <NotificationRow
                  actingId={actingId}
                  notification={notification}
                  onDelete={deleteNotification}
                  onMarkAsRead={markAsRead}
                  t={t}
                />
                {index < notifications.length - 1 ? <Separator /> : null}
              </div>
            ))
          ) : (
            <NotificationState message={t("empty")} />
          )}
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
  )
}

function NotificationRow({
  actingId,
  notification,
  onDelete,
  onMarkAsRead,
  t,
}: {
  actingId: string | null
  notification: Notification
  onDelete: (notification: Notification) => Promise<void>
  onMarkAsRead: (notification: Notification) => Promise<void>
  t: ReturnType<typeof useTranslations<"notificationsPage">>
}) {
  const isActing = actingId === notification.id

  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between",
        !notification.isRead && "bg-muted/30"
      )}
    >
      <div className="flex min-w-0 gap-3">
        <span
          className={cn(
            "mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground",
            !notification.isRead && "text-foreground"
          )}
        >
          <BellIcon />
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-medium">{notification.title}</h2>
            <Badge variant={getNotificationBadgeVariant(notification.type)}>
              {getNotificationTypeLabel(notification.type, t)}
            </Badge>
            {!notification.isRead ? <Badge>{t("unread")}</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatNotificationTime(notification.createdAt)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 justify-end gap-2">
        <Button
          disabled={notification.isRead || isActing}
          onClick={() => void onMarkAsRead(notification)}
          size="sm"
          type="button"
          variant="outline"
        >
          <CheckIcon data-icon="inline-start" />
          {t("markAsRead")}
        </Button>
        <Button
          disabled={isActing}
          onClick={() => void onDelete(notification)}
          size="sm"
          type="button"
          variant="destructive"
        >
          <Trash2Icon data-icon="inline-start" />
          {t("delete")}
        </Button>
      </div>
    </div>
  )
}

function getNotificationTypeLabel(
  type: Notification["type"],
  t: ReturnType<typeof useTranslations<"notificationsPage">>
) {
  const labels = {
    BOOKING: t("booking"),
    PAYMENT: t("payment"),
    MAINTENANCE: t("maintenance"),
    SYSTEM: t("system"),
  }

  return labels[type]
}

function NotificationState({ message }: { message: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
      <BellIcon />
      <p className="text-sm">{message}</p>
    </div>
  )
}
