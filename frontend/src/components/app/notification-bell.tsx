"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { BellIcon, CheckCheckIcon, InboxIcon, RefreshCwIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  formatNotificationTime,
  getNotificationBadgeVariant,
} from "@/components/app/notification-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  getNotificationErrorMessage,
  notificationService,
  type Notification,
} from "@/lib/notifications"

export function NotificationBell() {
  const t = useTranslations("notificationsPage")
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isMarkingAll, setIsMarkingAll] = useState(false)

  const latestNotifications = useMemo(
    () => notifications.slice(0, 5),
    [notifications]
  )
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  )

  useEffect(() => {
    void loadNotifications()
  }, [])

  async function loadNotifications() {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const data = await notificationService.list()
      setNotifications(data)
    } catch (error) {
      setErrorMessage(getNotificationErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function markAllAsRead() {
    setIsMarkingAll(true)
    setErrorMessage(null)

    try {
      const data = await notificationService.markAllAsRead()
      setNotifications(data)
    } catch (error) {
      setErrorMessage(getNotificationErrorMessage(error))
    } finally {
      setIsMarkingAll(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button aria-label={t("title")} size="icon" variant="ghost" />}
      >
        <span className="relative flex">
          <BellIcon />
          {unreadCount ? (
            <Badge className="absolute -right-2 -top-2 h-5 min-w-5 px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          ) : null}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between gap-3">
            <span>{t("title")}</span>
            {unreadCount ? (
              <Badge variant="secondary">
                {unreadCount} {t("unread")}
              </Badge>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {isLoading ? (
            <DropdownMenuItem disabled>
              <RefreshCwIcon />
              {t("loading")}
            </DropdownMenuItem>
          ) : errorMessage ? (
            <DropdownMenuItem onClick={() => void loadNotifications()}>
              <RefreshCwIcon />
              {t("retry")}
            </DropdownMenuItem>
          ) : latestNotifications.length ? (
            latestNotifications.map((notification) => (
              <DropdownMenuItem
                className="items-start gap-3 py-2"
                key={notification.id}
              >
                <span className="mt-1 flex size-2 shrink-0 rounded-full bg-primary data-[read=true]:bg-muted-foreground/30" data-read={notification.isRead} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {notification.title}
                    </span>
                    <Badge variant={getNotificationBadgeVariant(notification.type)}>
                      {getNotificationTypeLabel(notification.type, t)}
                    </Badge>
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {notification.message}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatNotificationTime(notification.createdAt)}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>
              <InboxIcon />
              {t("empty")}
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={!unreadCount || isMarkingAll}
            onClick={() => void markAllAsRead()}
          >
            <CheckCheckIcon />
            {isMarkingAll ? t("markingRead") : t("markAllAsRead")}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/notifications" />}>
            {t("viewAll")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
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
