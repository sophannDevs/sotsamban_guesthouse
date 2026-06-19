import { AxiosError } from "axios"

import {
  apiClient,
  type PaginatedResponse,
  type PaginationParams,
  unwrapPaginated,
} from "@/lib/api"

export const housekeepingStatuses = [
  "NEEDS_CLEANING",
  "CLEANING_IN_PROGRESS",
  "CLEANED",
  "INSPECTED",
  "CANCELLED",
] as const

export const housekeepingPriorities = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
] as const

export type HousekeepingStatus = (typeof housekeepingStatuses)[number]
export type HousekeepingPriority = (typeof housekeepingPriorities)[number]

export type HousekeepingTaskRoom = {
  id: string
  roomNumber: string
  type: string
  pricePerNight: number
  status: string
}

export type HousekeepingTaskAssignee = {
  id: string
  name: string
  email: string
}

export type HousekeepingTaskBooking = {
  id: string
  status: string
  checkInDate: string
  checkOutDate: string
  guest: {
    id: string
    fullName: string
    phone: string
  }
} | null

export type HousekeepingTask = {
  id: string
  businessId: string
  roomId: string
  assignedToId: string | null
  bookingId: string | null
  status: HousekeepingStatus
  priority: HousekeepingPriority
  note: string | null
  startedAt: string | null
  completedAt: string | null
  inspectedAt: string | null
  room: HousekeepingTaskRoom
  assignedTo: HousekeepingTaskAssignee | null
  booking: HousekeepingTaskBooking
  createdAt: string
  updatedAt: string
}

export type CreateHousekeepingTaskPayload = {
  roomId: string
  assignedToId?: string
  status?: HousekeepingStatus
  priority?: HousekeepingPriority
  note?: string
}

export type UpdateHousekeepingTaskPayload = {
  assignedToId?: string | null
  priority?: HousekeepingPriority
  note?: string | null
}

export type HousekeepingListParams = Pick<PaginationParams, "page" | "limit" | "search"> & {
  status?: HousekeepingStatus
  priority?: HousekeepingPriority
  roomId?: string
  assignedToId?: string
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export const housekeepingService = {
  async listPaginated(params: HousekeepingListParams) {
    const response = await apiClient.get<
      ApiResponse<HousekeepingTask[]> | PaginatedResponse<HousekeepingTask>
    >("/housekeeping/tasks", {
      params: {
        page: params.page,
        limit: params.limit,
        ...(params.search ? { search: params.search } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.priority ? { priority: params.priority } : {}),
        ...(params.roomId ? { roomId: params.roomId } : {}),
        ...(params.assignedToId ? { assignedToId: params.assignedToId } : {}),
        ...(params.startDate ? { startDate: params.startDate } : {}),
        ...(params.endDate ? { endDate: params.endDate } : {}),
        sortBy: params.sortBy ?? "createdAt",
        sortOrder: params.sortOrder ?? "desc",
      },
    })

    return unwrapPaginated(
      "success" in response.data ? response.data.data : response.data,
      params,
    )
  },

  async create(payload: CreateHousekeepingTaskPayload) {
    const response = await apiClient.post<ApiResponse<HousekeepingTask>>(
      "/housekeeping/tasks",
      payload,
    )
    return response.data.data
  },

  async update(id: string, payload: UpdateHousekeepingTaskPayload) {
    const response = await apiClient.patch<ApiResponse<HousekeepingTask>>(
      `/housekeeping/tasks/${id}`,
      payload,
    )
    return response.data.data
  },

  async start(id: string) {
    const response = await apiClient.patch<ApiResponse<HousekeepingTask>>(
      `/housekeeping/tasks/${id}/start`,
    )
    return response.data.data
  },

  async complete(id: string) {
    const response = await apiClient.patch<ApiResponse<HousekeepingTask>>(
      `/housekeeping/tasks/${id}/complete`,
    )
    return response.data.data
  },

  async inspect(id: string) {
    const response = await apiClient.patch<ApiResponse<HousekeepingTask>>(
      `/housekeeping/tasks/${id}/inspect`,
    )
    return response.data.data
  },

  async cancel(id: string) {
    const response = await apiClient.patch<ApiResponse<HousekeepingTask>>(
      `/housekeeping/tasks/${id}/cancel`,
    )
    return response.data.data
  },

  async remove(id: string) {
    await apiClient.delete<ApiResponse<HousekeepingTask>>(
      `/housekeeping/tasks/${id}`,
    )
  },
}

export function getHousekeepingErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data as
      | { message?: string | string[] }
      | undefined
    const message = responseData?.message

    if (Array.isArray(message)) return message.join(" ")
    if (message) return message
  }

  return "Unable to reach the housekeeping API. Check the backend server and try again."
}
