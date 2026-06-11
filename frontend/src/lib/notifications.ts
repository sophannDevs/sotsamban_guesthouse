import { AxiosError } from "axios"

import {
  apiClient,
  type PaginatedResponse,
  type PaginationParams,
  unwrapList,
  unwrapPaginated,
} from "@/lib/api"
import type { UserRole } from "@/lib/users"

export const notificationTypes = [
  "BOOKING",
  "PAYMENT",
  "MAINTENANCE",
  "SYSTEM",
] as const

export type NotificationType = (typeof notificationTypes)[number]

export type Notification = {
  id: string
  userId: string
  title: string
  message: string
  type: NotificationType
  isRead: boolean
  createdAt: string
  user?: {
    id: string
    name: string
    email: string
    role: UserRole
  }
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export const notificationService = {
  async listPaginated(options: PaginationParams & { all?: boolean }) {
    const response =
      await apiClient.get<
        ApiResponse<Notification[]> | PaginatedResponse<Notification>
      >("/notifications", {
        params: {
          page: options.page,
          limit: options.limit,
          ...(options.search ? { search: options.search } : {}),
          ...(options.all ? { all: true } : {}),
          sortBy: options.sortBy ?? "createdAt",
          sortOrder: options.sortOrder ?? "desc",
        },
      })

    return unwrapPaginated(
      "success" in response.data ? response.data.data : response.data,
      options
    )
  },

  async list(options?: { all?: boolean }) {
    const response =
      await apiClient.get<
        ApiResponse<Notification[]> | PaginatedResponse<Notification>
      >("/notifications", {
        params: options?.all ? { all: true } : undefined,
      })

    return unwrapList("success" in response.data ? response.data.data : response.data)
  },

  async markAsRead(id: string) {
    const response = await apiClient.patch<ApiResponse<Notification>>(
      `/notifications/${id}/read`
    )

    return response.data.data
  },

  async markAllAsRead() {
    const response =
      await apiClient.patch<
        ApiResponse<Notification[] | PaginatedResponse<Notification>>
      >("/notifications/read-all")

    return unwrapList(response.data.data)
  },

  async remove(id: string) {
    await apiClient.delete<ApiResponse<Notification>>(`/notifications/${id}`)
  },
}

export function getNotificationErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data as
      | { message?: string | string[] }
      | undefined
    const message = responseData?.message

    if (Array.isArray(message)) {
      return message.join(" ")
    }

    if (message) {
      return message
    }
  }

  return "Unable to reach the notifications API. Check the backend server and try again."
}
