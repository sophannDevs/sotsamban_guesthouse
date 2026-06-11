import type { NotificationType } from "@/lib/notifications"

export function formatNotificationType(type: NotificationType) {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function getNotificationBadgeVariant(type: NotificationType) {
  if (type === "PAYMENT") {
    return "default"
  }

  if (type === "MAINTENANCE") {
    return "destructive"
  }

  if (type === "SYSTEM") {
    return "outline"
  }

  return "secondary"
}
