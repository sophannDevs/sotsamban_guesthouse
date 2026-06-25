import { AxiosError } from "axios"

import {
  apiClient,
  type PaginatedResponse,
  type PaginationParams,
  unwrapList,
  unwrapPaginated,
} from "@/lib/api"

export const roomTypes = ["SINGLE", "DOUBLE"] as const

export const roomStatuses = [
  "AVAILABLE",
  "BOOKED",
  "OCCUPIED",
  "MAINTENANCE",
  "NEEDS_CLEANING",
  "CLEANING_IN_PROGRESS",
] as const

export type RoomType = (typeof roomTypes)[number]
export type RoomStatus = (typeof roomStatuses)[number]

export type Room = {
  id: string
  roomNumber: string
  type: RoomType
  pricePerNight: number
  status: RoomStatus
  imageUrl: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type RoomPayload = {
  roomNumber: string
  type: RoomType
  pricePerNight: number
  status: RoomStatus
}

export type RoomAvailabilityStatus = RoomStatus

export type RoomTimeAvailabilityStatus =
  | "AVAILABLE"
  | "BOOKED"
  | "OCCUPIED"
  | "BLOCKED"

export type RoomAvailabilityDate = {
  date: string
  status: RoomAvailabilityStatus
}

export type RoomAvailability = {
  roomId: string
  roomNumber: string
  roomType: RoomType
  pricePerNight: number
  dates: RoomAvailabilityDate[]
}

export type RoomTimeAvailability = {
  roomId: string
  status: RoomTimeAvailabilityStatus
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export const roomService = {
  async listPaginated(params: Pick<PaginationParams, "page" | "limit"> & {
    status?: RoomStatus
  }) {
    const response =
      await apiClient.get<ApiResponse<Room[]> | PaginatedResponse<Room>>(
        "/rooms",
        {
          params: {
            page: params.page,
            limit: params.limit,
            ...(params.status ? { search: params.status } : {}),
            sortBy: "roomNumber",
            sortOrder: "asc",
          },
        }
      )

    return unwrapPaginated(
      "success" in response.data ? response.data.data : response.data,
      params
    )
  },

  async list() {
    const response =
      await apiClient.get<ApiResponse<Room[]> | PaginatedResponse<Room>>(
        "/rooms",
        { params: { limit: 100, sortBy: "roomNumber", sortOrder: "asc" } }
      )

    return unwrapList("success" in response.data ? response.data.data : response.data)
  },

  async availability(params: { startDate: string; endDate: string }) {
    const response = await apiClient.get<ApiResponse<RoomAvailability[]>>(
      "/rooms/availability",
      { params }
    )

    return response.data.data
  },

  async checkRoomAvailability(
    roomId: string,
    params: { startTime: string; endTime: string },
  ) {
    const response = await apiClient.get<ApiResponse<RoomTimeAvailability>>(
      `/rooms/${roomId}/availability`,
      { params }
    )

    return response.data.data
  },

  async create(payload: RoomPayload) {
    const response = await apiClient.post<ApiResponse<Room>>("/rooms", payload)

    return response.data.data
  },

  async update(id: string, payload: RoomPayload) {
    const response = await apiClient.patch<ApiResponse<Room>>(
      `/rooms/${id}`,
      payload
    )

    return response.data.data
  },

  async uploadImage(id: string, file: File) {
    const formData = new FormData()

    formData.append("file", file)

    const response = await apiClient.post<ApiResponse<{ imageUrl: string }>>(
      `/rooms/${id}/image`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    )

    return response.data.data
  },

  async remove(id: string) {
    await apiClient.delete<ApiResponse<Room>>(`/rooms/${id}`)
  },
}

export function getRoomErrorMessage(error: unknown) {
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

  return "Unable to reach the rooms API. Check the backend server and try again."
}
